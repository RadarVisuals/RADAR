import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types"; // Import PropTypes

// Custom Hooks
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

// Components
import AudioAnalyzer from "../Audio/AudioAnalyzer";
import ToastContainer from "../Notifications/ToastContainer";
import UIOverlay from '../UI/UIOverlay';
import { sliderParams } from '../Panels/EnhancedControlPanel'; // Keep if needed for MIDI scaling

// Config & Assets
import { BLEND_MODES } from "../../config/global-config";
import { demoAssetMap } from '../../assets/DemoLayers/initLayers';
import { PING_COLOR, PING_STROKE_WIDTH, NO_PING_SELECTORS } from "../../config/uiConstants";
import { INTERPOLATED_MIDI_PARAMS } from "../../config/midiConstants";

// Utils
import { scaleNormalizedValue } from "../../utils/helpers";

// Styles
import "./MainviewStyles/Mainview.css";
import "./MainviewStyles/FpsCounter.css";

const portalContainer = document.getElementById('portal-container');

/**
 * MainView component: The central orchestrator for the RADAR application.
 * It integrates context providers, manages UI state, handles user interactions,
 * orchestrates the canvas rendering lifecycle via custom hooks, and connects
 * services like LSP1 blockchain events.
 *
 * @param {object} props - Component props.
 * @param {string[]} [props.blendModes=BLEND_MODES] - Available blend modes for layers.
 */
const MainView = ({ blendModes = BLEND_MODES }) => {
  useUpProvider(); // Initialize UP Provider context usage
  const configContextData = useConfig(); // Get the whole context object

  // Destructure ONLY values directly used in MainView logic flow
  const {
    layerConfigs,
    tokenAssignments,
    savedReactions,
    configLoadNonce,
    isInitiallyResolved,
    loadError,
    currentProfileAddress,
    currentConfigName,
    updateLayerConfig: updateCentralConfig,
    updateTokenAssignment,
    updateSavedReaction,
    deleteSavedReaction,
    upInitializationError,
    upFetchStateError,
    loadNamedConfig,
    configServiceRef,
    // Variables like canSave, isVisitor etc. are accessed via configContextData in uiOverlayProps construction
  } = configContextData;

  const { pendingLayerSelect, pendingParamUpdate, clearPendingActions } = useMIDI();
  const notificationData = useNotifications();
  const { addNotification } = notificationData;
  const { processEffect, createDefaultEffect } = useVisualEffects(updateCentralConfig);
  const audioState = useAudioVisualizer();
  const { isAudioActive, audioSettings, handleAudioDataUpdate } = audioState;
  const uiState = useUIState('tab1'); // Initialize UI state hook
  const { setActiveLayerTab } = uiState; // Get UI state setters/getters as needed

  const [currentFps, setCurrentFps] = useState(0);

  // Refs
  const rootRef = useRef(null);
  const isMountedRef = useRef(false);
  const fpsFrameCountRef = useRef(0);
  const fpsLastTimeRef = useRef(performance.now());
  const fpsRafId = useRef(null);
  const transitionInProgressRef = useRef(false);
  const resetLifecycleRef = useRef(null);
  const canvasRef1 = useRef(null);
  const canvasRef2 = useRef(null);
  const canvasRef3 = useRef(null);
  const canvasRefs = useMemo(() => ({ 1: canvasRef1, 2: canvasRef2, 3: canvasRef3 }), []);

  // Canvas Orchestration Hook
  const {
    managersReady, defaultImagesLoaded, managerInstancesRef,
    applyConfigurationsToManagers, applyTokenAssignmentsToManagers,
    updateLayerConfigProperty, stopCanvasAnimations, restartCanvasAnimations,
    redrawAllCanvases, handleCanvasResize, setCanvasLayerImage,
  } = useCanvasOrchestrator({ configServiceRef, canvasRefs });

  // Stable callback for zero dimensions using the ref
  const handleZeroDimensions = useCallback(() => {
    console.warn("[MainView onZeroDimensions Callback] Triggered.");
    if (resetLifecycleRef.current && typeof resetLifecycleRef.current === 'function') {
      resetLifecycleRef.current();
    } else {
      console.error("[MainView onZeroDimensions Callback] Critical: resetLifecycleRef.current is not a function!");
    }
  }, []);

  // Canvas Container Hook
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
      onZeroDimensions: handleZeroDimensions,
  });

  // Render Lifecycle Hook
  const renderLifecycleData = useRenderLifecycle({
      managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
      isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress,
      layerConfigs, tokenAssignments, loadError, upInitializationError, upFetchStateError,
      stopAllAnimations: stopCanvasAnimations, applyConfigurationsToManagers: applyConfigurationsToManagers,
      applyTokenAssignments: applyTokenAssignmentsToManagers, redrawAllCanvases: redrawAllCanvases,
      restartCanvasAnimations: restartCanvasAnimations,
  });
  const {
      renderState, loadingStatusMessage, isStatusFadingOut, showStatusDisplay,
      showRetryButton, isTransitioning, isCanvasVisible, isAnimating, handleManualRetry,
      resetLifecycle
  } = renderLifecycleData;

  // Update the ref whenever resetLifecycle changes
  useEffect(() => {
    resetLifecycleRef.current = resetLifecycle;
  }, [resetLifecycle]);

  // Mount status tracking
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  // Animation Lifecycle Hook
  useAnimationLifecycleManager({
      isMounted: isMountedRef.current, renderState, isContainerObservedVisible,
      isAnimating, isTransitioning, restartCanvasAnimations, stopCanvasAnimations,
  });

  // Sync isTransitioning state
  useEffect(() => { transitionInProgressRef.current = isTransitioning; }, [isTransitioning]);

  // Derived states for UI rendering
  const isBaseReady = useMemo(() => managersReady && defaultImagesLoaded && isInitiallyResolved && hasValidDimensions && isContainerObservedVisible, [managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions, isContainerObservedVisible]);
  const shouldShowUI = useMemo(() => isBaseReady || renderState === 'prompt_connect', [isBaseReady, renderState]);
  const showFpsCounter = useMemo(() => renderState === 'rendered' && isContainerObservedVisible, [renderState, isContainerObservedVisible]);

  // Callback to propagate layer config changes upwards and to managers
  const handleLayerPropChange = useCallback((layerId, key, value) => {
    if (updateCentralConfig) { updateCentralConfig(layerId, key, value); }
    if (updateLayerConfigProperty) { updateLayerConfigProperty(layerId, key, value); }
  }, [updateCentralConfig, updateLayerConfigProperty]);

  // Effect to handle pending MIDI actions (parameter updates, layer selects)
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
                handleLayerPropChange(layer, param, scaledValue); // Fallback
                processed = true;
            }
        } else {
             handleLayerPropChange(layer, param, scaledValue); // Direct update
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

  // Callback to handle token selection/application from UI
  const handleTokenApplied = useCallback((data, layerId) => {
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
        if (Object.hasOwnProperty.call(demoAssetMap, data)) { // Demo Key
            idToSave = data;
            srcToApply = demoAssetMap[data];
        } else if (Object.values(demoAssetMap).includes(data)) { // Demo Path
            const demoKey = Object.keys(demoAssetMap).find(key => demoAssetMap[key] === data);
            idToSave = demoKey || data;
            srcToApply = data;
        } else if (data.startsWith('http')) { // URL
            idToSave = data;
            srcToApply = data;
        } else if (data.startsWith('data:')) { // Data URI
            idToSave = data.substring(0, 50) + '...';
            srcToApply = data;
        } else { // Fallback/Unknown
            console.warn(`[MV handleTokenApplied L${layerId}] Unhandled string data type: ${data}`);
            idToSave = data;
            srcToApply = data;
        }
    } else {
        console.warn(`[MV handleTokenApplied L${layerId}] Invalid or undefined data type received:`, data);
    }

    if (srcToApply) {
      // console.log(`[MV handleTokenApplied L${layerId}] Calling setCanvasLayerImage with src: ${srcToApply.substring(0,60)}...`); // Removed non-critical log
      setCanvasLayerImage(layerId, srcToApply)
        .catch(e => console.error(`[MV handleTokenApplied L${layerId}] setCanvasLayerImage failed for ${srcToApply.substring(0,60)}...:`, e));
    } else {
      console.warn(`[MV handleTokenApplied L${layerId}] No image source determined (srcToApply is null). ID to save was: ${idToSave}`);
    }

    if (updateTokenAssignment && idToSave !== null) {
      updateTokenAssignment(layerId, idToSave);
    } else if (idToSave === null) {
      console.warn(`[MV handleTokenApplied L${layerId}] No ID determined, cannot save assignment.`);
    }
  }, [updateTokenAssignment, setCanvasLayerImage]); // Removed demoAssetMap dependency

  // Callback to handle LSP1 events
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

  // LSP1 Event Listener Hook
  useLsp1Events(currentProfileAddress, handleEventReceived);

  // Direct pass-through callbacks for UI actions
  const handleSaveReactionConfig = updateSavedReaction;
  const handleRemoveReactionConfig = deleteSavedReaction;

  // Callback for canvas click effect
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
  }, [containerRef]); // Depends only on the ref

  // FPS Counter Effect
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

  // Helper render functions
  const renderFpsCounter = () => {
    if (!showFpsCounter) return null;
    return (<div className="fps-counter">FPS: {currentFps}</div>);
  };
  const renderStatusContent = () => {
    if (showRetryButton) { return ( <> {loadingStatusMessage} <button onClick={handleManualRetry} className="retry-render-button"> Retry Render </button> </> ); }
    return loadingStatusMessage;
  };
  const getStatusDisplayClass = () => {
      if (renderState === 'error') return 'error-state';
      if (renderState === 'prompt_connect') return 'prompt-connect-state';
      return 'info-state';
  };

  // Memoized props for UIOverlay to prevent unnecessary re-renders
  const uiOverlayProps = useMemo(() => ({
    uiState: uiState,
    audioState: audioState,
    configData: { // Pass the whole context data object
      ...configContextData,
      blendModes: blendModes, // Add blendModes if not in context
      notifications: notificationData.notifications, // Add notifications
      unreadCount: notificationData.unreadCount, // Add unread count
      isTransitioning: isTransitioning, // Pass derived state
    },
    actions: {
      onEnhancedView: enterFullscreen,
      onLayerConfigChange: handleLayerPropChange,
      onMarkNotificationRead: notificationData.markAsRead,
      onClearAllNotifications: notificationData.clearAll,
      onSaveReaction: handleSaveReactionConfig,
      onRemoveReaction: handleRemoveReactionConfig,
      onPreviewEffect: processEffect,
      onTokenApplied: handleTokenApplied,
      onPresetSelect: loadNamedConfig,
    },
    shouldShowUI,
  }), [
    uiState, audioState, configContextData, // Re-evaluate if these change
    blendModes, notificationData, isTransitioning, enterFullscreen,
    handleLayerPropChange, handleSaveReactionConfig, handleRemoveReactionConfig,
    processEffect, handleTokenApplied, loadNamedConfig, shouldShowUI
  ]);

  // Handle critical UP Provider errors
  if (upInitializationError || upFetchStateError) {
    const msg = upInitializationError?.message || upFetchStateError?.message || "Unknown critical error initialising Universal Profile connection.";
    console.error("[MV Render] Halting due to UP error:", { upInitializationError, upFetchStateError });
    return (
        <div id="fullscreen-root" className="main-view">
            <div style={{ padding: "20px", color: "red", position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.7)', borderRadius: '8px', textAlign: 'center' }}>
                <p>Critical Error:</p>
                <p style={{ wordBreak: 'break-word', maxWidth: '400px' }}>{msg}</p>
                <p>Please try refreshing the page.</p>
            </div>
        </div>
    );
  }

  // Determine dynamic CSS classes
  const canvas1Class = `canvas layer-1 ${isCanvasVisible ? 'visible' : ''}`;
  const canvas2Class = `canvas layer-2 ${isCanvasVisible ? 'visible' : ''}`;
  const canvas3Class = `canvas layer-3 ${isCanvasVisible ? 'visible' : ''}`;
  const containerClass = `canvas-container ${isTransitioning ? 'transitioning' : ''}`;

  // Render the main component structure
  return (
    <>
      <div id="fullscreen-root" ref={rootRef} className="main-view radar-cursor">
        {/* Canvas container */}
        <div ref={containerRef} className={containerClass} onClick={handleCanvasClick}>
          <div className="grid-overlay"></div>
          <canvas ref={canvasRef1} className={canvas1Class} />
          <canvas ref={canvasRef2} className={canvas2Class} />
          <canvas ref={canvasRef3} className={canvas3Class} />
        </div>

        {/* Portaled FPS Counter for fullscreen */}
        {portalContainer && isFullscreenActive ? ReactDOM.createPortal(renderFpsCounter(), portalContainer) : renderFpsCounter()}

        {/* Toast Notifications */}
        <ToastContainer />

        {/* Main UI Overlay */}
        <UIOverlay {...uiOverlayProps} />

        {/* Status Display */}
        {showStatusDisplay && ( <div className={`status-display ${getStatusDisplayClass()} ${isStatusFadingOut ? 'fade-out' : ''}`}> {renderStatusContent()} </div> )}

        {/* Hidden Audio Analyzer */}
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

// Define PropTypes
MainView.propTypes = {
  blendModes: PropTypes.arrayOf(PropTypes.string),
};

export default MainView;