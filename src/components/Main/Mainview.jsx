// src/components/Main/Mainview.jsx (Full File - Corrected Ref Handling)
import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import ReactDOM from "react-dom";

import { useCanvasOrchestrator } from "../../hooks/useCanvasOrchestrator";
import { useNotifications } from "../../hooks/useNotifications";
import { useVisualEffects } from "../../hooks/useVisualEffects";
import { useUpProvider } from "../../context/UpProvider";
import { useConfig } from "../../context/ConfigContext";
import { useMIDI } from "../../context/MIDIContext";
import { useRenderLifecycle } from '../../hooks/useRenderLifecycle';
import { useCanvasContainer } from '../../hooks/useCanvasContainer';
import { useAudioVisualizer } from '../../hooks/useAudioVisualizer';
import { useUIState } from '../../hooks/useUIState';
import { useLsp1Events } from '../../hooks/useLsp1Events';
import { useAnimationLifecycleManager } from '../../hooks/useAnimationLifecycleManager';

import AudioAnalyzer from "../Audio/AudioAnalyzer";
import ToastContainer from "../Notifications/ToastContainer";
import UIOverlay from '../UI/UIOverlay';
import { sliderParams } from '../Panels/EnhancedControlPanel'; // Imported from new location

import { BLEND_MODES } from "../../config/global-config";
import { demoAssetMap } from '../../assets/DemoLayers/initLayers';
import { PING_COLOR, PING_STROKE_WIDTH, NO_PING_SELECTORS } from "../../config/uiConstants";
import { INTERPOLATED_MIDI_PARAMS } from "../../config/midiConstants";

import { scaleNormalizedValue } from "../../utils/helpers";

import "./MainviewStyles/Mainview.css";
import "./MainviewStyles/FpsCounter.css";

const portalContainer = document.getElementById('portal-container');

/**
 * MainView component: The central orchestrator for the application.
 * It integrates context providers, manages UI state, handles user interactions,
 * orchestrates the canvas rendering lifecycle, and connects services like LSP1 events.
 *
 * @param {object} props - Component props.
 * @param {string[]} [props.blendModes=BLEND_MODES] - Available blend modes for layers.
 */
const MainView = ({ blendModes = BLEND_MODES }) => {
  useUpProvider();
  const configContextData = useConfig();
  const {
    layerConfigs, tokenAssignments, savedReactions, configLoadNonce, isInitiallyResolved, loadError,
    currentProfileAddress, isParentAdmin, isProfileOwner, isVisitor, canSave,
    isPreviewMode, currentConfigName, updateLayerConfig: updateCentralConfig,
    updateTokenAssignment, updateSavedReaction, deleteSavedReaction,
    upInitializationError, upFetchStateError,
    isLoading: isConfigLoading, // Corrected prop name
    loadNamedConfig, savedConfigList, configServiceRef,
  } = configContextData;

  const { pendingLayerSelect, pendingParamUpdate, clearPendingActions } = useMIDI();
  const notificationData = useNotifications();
  const { addNotification } = notificationData;
  const { processEffect, createDefaultEffect } = useVisualEffects(updateCentralConfig);
  const audioState = useAudioVisualizer();
  const { isAudioActive, audioSettings, handleAudioDataUpdate } = audioState;
  const uiState = useUIState('tab1'); // Default to Layer 3 controls tab
  const { setActiveLayerTab } = uiState;

  const [currentFps, setCurrentFps] = useState(0);

  const rootRef = useRef(null);
  const isMountedRef = useRef(false);
  const fpsFrameCountRef = useRef(0);
  const fpsLastTimeRef = useRef(performance.now());
  const fpsRafId = useRef(null);
  const transitionInProgressRef = useRef(false);
  const onZeroDimensionsCallbackRef = useRef(null);

  // --- Define Refs Here ---
  const canvasRef1 = useRef(null);
  const canvasRef2 = useRef(null);
  const canvasRef3 = useRef(null);
  // Create the canvasRefs object to pass down
  const canvasRefs = useMemo(() => ({ 1: canvasRef1, 2: canvasRef2, 3: canvasRef3 }), []);
  // --- End Ref Definition ---

  // Custom Hook Instantiation Order
  const {
    // Remove canvasRefs from here, as they are defined above
    managersReady, defaultImagesLoaded, managerInstancesRef,
    applyConfigurationsToManagers, applyTokenAssignmentsToManagers,
    updateLayerConfigProperty, stopCanvasAnimations, restartCanvasAnimations,
    redrawAllCanvases, handleCanvasResize, setCanvasLayerImage,
  } = useCanvasOrchestrator({ configServiceRef, canvasRefs }); // Pass canvasRefs to the hook

  const renderLifecycleData = useRenderLifecycle({
      managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions: false, // hasValidDimensions will be updated by useCanvasContainer
      isContainerObservedVisible: true, // Assume visible initially, updated by useCanvasContainer
      configLoadNonce, currentConfigName, layerConfigs,
      tokenAssignments, loadError, upInitializationError, upFetchStateError,
      stopAllAnimations: stopCanvasAnimations, applyConfigurationsToManagers: applyConfigurationsToManagers,
      applyTokenAssignments: applyTokenAssignmentsToManagers, redrawAllCanvases: redrawAllCanvases,
      restartCanvasAnimations: restartCanvasAnimations,
  });
  const { resetLifecycle } = renderLifecycleData;

  const {
      containerRef, hasValidDimensions, isContainerObservedVisible,
      isFullscreenActive, enterFullscreen
  } = useCanvasContainer({
      onResize: useCallback(() => {
          if (isMountedRef.current) { handleCanvasResize(); }
      }, [handleCanvasResize]),
      onVisibilityChange: useCallback((isVisible) => {
         if (!isMountedRef.current) return;
         const currentlyFullscreen = !!document.fullscreenElement;
         if (!isVisible) {
             if (!currentlyFullscreen && !transitionInProgressRef.current) {
                 if (stopCanvasAnimations) stopCanvasAnimations();
             }
         } else {
             if (restartCanvasAnimations) restartCanvasAnimations();
         }
      }, [ stopCanvasAnimations, restartCanvasAnimations ]),
      onZeroDimensions: useCallback(() => {
          console.warn("[MainView onZeroDimensions Callback] Resetting lifecycle.");
          if (typeof resetLifecycle === 'function') { resetLifecycle(); }
          else { console.error("[MainView onZeroDimensions Callback] Critical: resetLifecycle missing!"); }
      }, [resetLifecycle]),
  });

  // Pass the actual hasValidDimensions to useRenderLifecycle
  const {
      renderState, loadingStatusMessage, isStatusFadingOut, showStatusDisplay,
      showRetryButton, isTransitioning, isCanvasVisible, isAnimating, handleManualRetry,
  } = useRenderLifecycle({ // Re-call or update useRenderLifecycle with correct hasValidDimensions
      managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions, // <-- Use actual value now
      isContainerObservedVisible, configLoadNonce, currentConfigName, layerConfigs,
      tokenAssignments, loadError, upInitializationError, upFetchStateError,
      stopAllAnimations: stopCanvasAnimations, applyConfigurationsToManagers: applyConfigurationsToManagers,
      applyTokenAssignments: applyTokenAssignmentsToManagers, redrawAllCanvases: redrawAllCanvases,
      restartCanvasAnimations: restartCanvasAnimations,
  });

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  useAnimationLifecycleManager({
      isMounted: isMountedRef.current, renderState, isContainerObservedVisible,
      isAnimating, isTransitioning, restartCanvasAnimations, stopCanvasAnimations,
  });

  useEffect(() => { transitionInProgressRef.current = isTransitioning; }, [isTransitioning]);

  const handleContainerZeroDimensionsActual = useCallback(() => {
    console.warn("[MainView Zero Dimensions Callback Ref] Container dimensions zero. Resetting lifecycle.");
    if(resetLifecycle) resetLifecycle(); else console.error("resetLifecycle unavailable in callback ref!");
  }, [resetLifecycle]);
  useEffect(() => { onZeroDimensionsCallbackRef.current = handleContainerZeroDimensionsActual; }, [handleContainerZeroDimensionsActual]);

  const isBaseReady = useMemo(() => managersReady && defaultImagesLoaded && isInitiallyResolved && hasValidDimensions && isContainerObservedVisible, [managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions, isContainerObservedVisible]);
  const shouldShowUI = useMemo(() => isBaseReady, [isBaseReady]);
  const showFpsCounter = useMemo(() => renderState === 'rendered' && isContainerObservedVisible, [renderState, isContainerObservedVisible]);

  const handleLayerPropChange = useCallback((layerId, key, value) => {
    if (updateCentralConfig) { updateCentralConfig(layerId, key, value); }
    if (updateLayerConfigProperty) { updateLayerConfigProperty(layerId, key, value); }
  }, [updateCentralConfig, updateLayerConfigProperty]);

  useEffect(() => {
    let processed = false;
    const currentManagers = managerInstancesRef.current;
    if (pendingParamUpdate && currentManagers) {
      const { layer, param, value } = pendingParamUpdate;
      const sliderConfig = sliderParams.find(p => p.prop === param);
      if (sliderConfig) {
        const scaledValue = scaleNormalizedValue(value, sliderConfig.min, sliderConfig.max);
        const manager = currentManagers[layer];
        if (manager && INTERPOLATED_MIDI_PARAMS.includes(param)) {
            if (typeof manager.setTargetValue === 'function') {
                manager.setTargetValue(param, scaledValue);
                if (updateCentralConfig) { updateCentralConfig(layer, param, scaledValue); }
                processed = true;
            } else {
                handleLayerPropChange(layer, param, scaledValue);
                processed = true;
            }
        } else {
             handleLayerPropChange(layer, param, scaledValue);
             processed = true;
        }
      }
    }
    if (pendingLayerSelect) {
      const { layer } = pendingLayerSelect;
      const layerToTabMap = { 1: 'tab3', 2: 'tab2', 3: 'tab1' };
      const targetTab = layerToTabMap[layer];
      if (targetTab && typeof setActiveLayerTab === 'function') {
          setActiveLayerTab(targetTab);
          processed = true;
      }
    }
    if (processed && clearPendingActions) { clearPendingActions(); }
  }, [pendingParamUpdate, pendingLayerSelect, handleLayerPropChange, setActiveLayerTab, clearPendingActions, managerInstancesRef, updateCentralConfig]);

  const handleTokenApplied = useCallback((data, layerId) => {
    console.log(`[MainView] handleTokenApplied called. Layer: ${layerId}`);
    if (!isMountedRef.current || !setCanvasLayerImage) {
      console.warn(`[MainView] handleTokenApplied aborted: Not mounted or setCanvasLayerImage missing.`);
      return;
    }

    let idToSave = null;
    let srcToApply = null;

    if (data?.type === 'owned' && data.address && data.iconUrl) {
        idToSave = data.address;
        srcToApply = data.iconUrl;
    } else if (typeof data === 'string') {
        const isDemoImagePath = data.startsWith('/src/assets/DemoLayers/');
        const demoKeyFromPath = isDemoImagePath ? Object.keys(demoAssetMap).find(k => demoAssetMap[k] === data) : null;

        if (isDemoImagePath && demoKeyFromPath) {
            idToSave = demoKeyFromPath;
            srcToApply = data;
        } else if (demoAssetMap[data]) {
            idToSave = data;
            srcToApply = demoAssetMap[data];
        } else if (data.startsWith('http')) {
             idToSave = data;
             srcToApply = data;
        } else {
            idToSave = data;
            srcToApply = null;
        }
    } else {
        console.warn(`[MV handleTokenApplied L${layerId}] Invalid data type received:`, data);
        return;
    }

    if (srcToApply) {
      setCanvasLayerImage(layerId, srcToApply)
        .catch(e=>console.error(`[MV handleTokenApplied L${layerId}] Apply Image FAIL:`, e));
    } else {
      console.warn(`[MV handleTokenApplied L${layerId}] No image source URL determined to apply immediately for ID: ${idToSave}`);
    }

    if (updateTokenAssignment && idToSave !== null) {
      updateTokenAssignment(layerId, idToSave);
    } else {
      console.warn(`[MV handleTokenApplied L${layerId}] No ID determined to save assignment.`);
    }
  }, [updateTokenAssignment, setCanvasLayerImage]);

  const handleEventReceived = useCallback((event) => {
    if (!isMountedRef.current || !event?.type) return;
    if (addNotification) addNotification(event);
    const reactions = savedReactions || {};
    const eventTypeLower = event.type.toLowerCase();
    const matchingReactions = Object.values(reactions).filter(r => r?.event?.toLowerCase() === eventTypeLower);
    if (matchingReactions.length > 0) {
      matchingReactions.forEach(reactionConfig => {
        if (processEffect) {
          processEffect({ ...reactionConfig, originEvent: event })
            .catch(e => console.error("Error processing configured reaction:", e));
        }
      });
    }
    else if (createDefaultEffect) {
      createDefaultEffect(event.type)
        .catch(e => console.error("Error creating default effect:", e));
    }
  }, [addNotification, savedReactions, processEffect, createDefaultEffect]);

  useLsp1Events(currentProfileAddress, handleEventReceived);

  const handleSaveReactionConfig = updateSavedReaction;
  const handleRemoveReactionConfig = deleteSavedReaction;

  const handleCanvasClick = useCallback((event) => {
    if (event.target.closest(NO_PING_SELECTORS)) return;
    const containerElement = containerRef.current;
    if (!containerElement) return;
    const x = event.clientX; const y = event.clientY;
    const pingContainer = document.createElement('div');
    pingContainer.className = 'click-ping-svg-container';
    pingContainer.style.left = `${x}px`; pingContainer.style.top = `${y}px`;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "click-ping-svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.style.overflow = "visible";
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "10"); circle.setAttribute("cy", "10");
    circle.setAttribute("r", "5"); circle.setAttribute("stroke", PING_COLOR);
    circle.setAttribute("stroke-width", PING_STROKE_WIDTH.toString());
    circle.setAttribute("fill", "none");
    svg.appendChild(circle);
    pingContainer.appendChild(svg);
    try {
      containerElement.appendChild(pingContainer);
      requestAnimationFrame(() => pingContainer.classList.add('ping-svg-animation'));
      pingContainer.addEventListener('animationend', () => pingContainer.remove(), { once: true });
    } catch (e) { console.error("[CanvasClick Ping Error]:", e); }
  }, [containerRef]);

  useEffect(() => {
    const updateFps = () => {
      const now = performance.now(); const delta = now - fpsLastTimeRef.current;
      fpsFrameCountRef.current++;
      if (delta >= 1000) {
        const fps = Math.round((fpsFrameCountRef.current * 1000) / delta);
        setCurrentFps(fps); fpsFrameCountRef.current = 0; fpsLastTimeRef.current = now;
      }
      fpsRafId.current = requestAnimationFrame(updateFps);
    };
    if (showFpsCounter) {
      if (!fpsRafId.current) { fpsLastTimeRef.current = performance.now(); fpsFrameCountRef.current = 0; fpsRafId.current = requestAnimationFrame(updateFps); }
    } else {
      if (fpsRafId.current) { cancelAnimationFrame(fpsRafId.current); fpsRafId.current = null; setCurrentFps(0); }
    }
    return () => { if (fpsRafId.current) cancelAnimationFrame(fpsRafId.current); };
  }, [showFpsCounter]);

  const renderFpsCounter = () => {
    if (!showFpsCounter) return null;
    return (<div className="fps-counter">FPS: {currentFps}</div>);
  };
  const renderStatusContent = () => {
    if (showRetryButton) { return ( <> {loadingStatusMessage} <button onClick={handleManualRetry} className="retry-render-button"> Retry Render </button> </> ); }
    return loadingStatusMessage;
  };
  const getStatusDisplayClass = () => { if (renderState === 'error') return 'error-state'; return 'info-state'; };

  const uiOverlayProps = useMemo(() => ({
    uiState: uiState,
    audioState: audioState,
    configData: {
      layerConfigs, blendModes, notifications: notificationData.notifications,
      savedReactions, savedConfigList, currentConfigName, isTransitioning,
      isConfigHookLoading: isConfigLoading, // Correct prop name passed
      canSave, isParentAdmin, isProfileOwner, isVisitor,
      isPreviewMode, unreadCount: notificationData.unreadCount,
    },
    actions: {
      onEnhancedView: enterFullscreen, onLayerConfigChange: handleLayerPropChange,
      onMarkNotificationRead: notificationData.markAsRead,
      onClearAllNotifications: notificationData.clearAll,
      onSaveReaction: handleSaveReactionConfig, onRemoveReaction: handleRemoveReactionConfig,
      onPreviewEffect: processEffect, onTokenApplied: handleTokenApplied,
      onPresetSelect: loadNamedConfig,
    },
    shouldShowUI,
  }), [
    uiState, audioState, layerConfigs, blendModes, notificationData,
    savedReactions, savedConfigList, currentConfigName, isTransitioning,
    isConfigLoading, // Dependency added
    canSave, isParentAdmin, isProfileOwner, isVisitor,
    isPreviewMode, enterFullscreen, handleLayerPropChange,
    handleSaveReactionConfig, handleRemoveReactionConfig,
    processEffect, handleTokenApplied, loadNamedConfig, shouldShowUI
  ]);

  if (upInitializationError || upFetchStateError) {
    const msg = upInitializationError?.message || upFetchStateError?.message || "Unknown critical error initialising Universal Profile connection.";
    console.error("[MV Render] Halting due to UP error:", { upInitializationError, upFetchStateError });
    return ( <div id="fullscreen-root" className="main-view"> <div style={{ padding: "20px", color: "red", position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.7)', borderRadius: '8px', textAlign: 'center' }}> <p>Critical Error:</p> <p style={{ wordBreak: 'break-word', maxWidth: '400px' }}>{msg}</p> <p>Please try refreshing the page.</p> </div> </div> );
  }

  const canvas1Class = `canvas layer-1 ${isCanvasVisible ? 'visible' : ''}`;
  const canvas2Class = `canvas layer-2 ${isCanvasVisible ? 'visible' : ''}`;
  const canvas3Class = `canvas layer-3 ${isCanvasVisible ? 'visible' : ''}`;
  const containerClass = `canvas-container ${isTransitioning ? 'transitioning' : ''}`;

  return (
    <>
      <div id="fullscreen-root" ref={rootRef} className="main-view radar-cursor">
        <div ref={containerRef} className={containerClass} onClick={handleCanvasClick}>
          <div className="grid-overlay"></div>
          {/* --- Apply Refs Here --- */}
          <canvas ref={canvasRef1} className={canvas1Class} />
          <canvas ref={canvasRef2} className={canvas2Class} />
          <canvas ref={canvasRef3} className={canvas3Class} />
          {/* --- End Apply Refs --- */}
        </div>

        {portalContainer && isFullscreenActive ? ReactDOM.createPortal(renderFpsCounter(), portalContainer) : renderFpsCounter()}
        <ToastContainer />
        <UIOverlay {...uiOverlayProps} />

        {showStatusDisplay && ( <div className={`status-display ${getStatusDisplayClass()} ${isStatusFadingOut ? 'fade-out' : ''}`}> {renderStatusContent()} </div> )}

        {isAudioActive && managersReady && (
          <div className="hidden-audio-analyzer">
            <AudioAnalyzer
              isActive={isAudioActive}
              onAudioData={handleAudioDataUpdate}
              layerConfigs={layerConfigs}
              audioSettings={audioSettings}
              configLoadNonce={configLoadNonce}
              managerInstancesRef={managerInstancesRef}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default MainView;