// src/components/Main/MainView.jsx
import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import PropTypes from "prop-types";

// Custom Hooks
import { useCanvasOrchestrator } from "../../hooks/useCanvasOrchestrator";
import { useNotifications } from "../../hooks/useNotifications";
import { useVisualEffects } from "../../hooks/useVisualEffects";
import { useUpProvider } from "../../context/UpProvider";
import {
  useVisualLayerState, // This will now source from VisualConfigContext
  useInteractionSettingsState,
  useProfileSessionState,
  useConfigStatusState,
  usePresetManagementState,
} from "../../hooks/configSelectors";
import { useMIDI } from "../../context/MIDIContext";
import { useRenderLifecycle } from '../../hooks/useRenderLifecycle';
import { useCanvasContainer } from '../../hooks/useCanvasContainer';
import { useAudioVisualizer } from '../../hooks/useAudioVisualizer';
import { useUIState } from '../../hooks/useUIState';
import { useLsp1Events } from '../../hooks/useLsp1Events';
import { useAnimationLifecycleManager } from '../../hooks/useAnimationLifecycleManager';

// Components
import ToastContainer from "../Notifications/ToastContainer";
import UIOverlay from '../UI/UIOverlay';
import { sliderParams } from '../Panels/EnhancedControlPanel'; // Assuming sliderParams is still relevant

// New Child Components (assuming these are correctly structured)
import CanvasContainerWrapper from '../MainViewParts/CanvasContainerWrapper';
import FpsDisplay from '../MainViewParts/FpsDisplay';
import StatusIndicator from '../MainViewParts/StatusIndicator';
import AudioAnalyzerWrapper from '../MainViewParts/AudioAnalyzerWrapper';

// Config & Assets
import { BLEND_MODES } from "../../config/global-config";
import { demoAssetMap } from '../../assets/DemoLayers/initLayers';
import { PING_COLOR, PING_STROKE_WIDTH, NO_PING_SELECTORS } from "../../config/uiConstants";
import { INTERPOLATED_MIDI_PARAMS } from "../../config/midiConstants";

// Utils
import { scaleNormalizedValue } from "../../utils/helpers";

// Styles
import "./MainviewStyles/Mainview.css";

const portalContainerNode = document.getElementById('portal-container');

/**
 * MainView component: The primary view of the RADAR application.
 * It orchestrates various parts of the application including canvas rendering,
 * UI overlays, state management hooks, and event handling.
 * It now consumes `useVisualLayerState` which sources its data (`layerConfigs`, `tokenAssignments`,
 * `updateLayerConfig`, `updateTokenAssignment`) from the new `VisualConfigContext`.
 *
 * @param {object} props
 * @param {Array<string>} [props.blendModes=BLEND_MODES] - Array of available blend mode strings.
 * @returns {JSX.Element} The rendered MainView component.
 */
const MainView = ({ blendModes = BLEND_MODES }) => {
  useUpProvider(); // Initialize UP Provider connection, consumed by UserSessionContext

  // Consuming useVisualLayerState which now sources from VisualConfigContext
  const {
    layerConfigs, tokenAssignments, updateLayerConfig, updateTokenAssignment
  } = useVisualLayerState();

  // Other state hooks remain the same, sourcing from their respective contexts via selectors
  const {
    savedReactions, updateSavedReaction, deleteSavedReaction
  } = useInteractionSettingsState();
  const {
    currentProfileAddress, // This is hostProfileAddress
    isProfileOwner,        // This is isHostProfileOwner
    canSave,               // This is canSaveToHostProfile
    isPreviewMode,
    isParentAdmin,         // This is isRadarProjectAdmin
    isVisitor
  } = useProfileSessionState();
  const {
    isInitiallyResolved, configLoadNonce, loadError, upInitializationError,
    upFetchStateError, configServiceRef, isLoading: isConfigLoading
  } = useConfigStatusState(); // Note: up...Error fields here are now null from the selector
  const {
    loadNamedConfig, currentConfigName, savedConfigList: presetSavedConfigList
  } = usePresetManagementState();

  const { pendingLayerSelect, pendingParamUpdate, clearPendingActions } = useMIDI();
  const notificationData = useNotifications();
  const { addNotification } = notificationData;

  const rootRef = useRef(null);
  const isMountedRef = useRef(false);
  const transitionInProgressRef = useRef(false);
  const resetLifecycleRef = useRef(null);
  const canvasRef1 = useRef(null);
  const canvasRef2 = useRef(null);
  const canvasRef3 = useRef(null);
  const canvasRefs = useMemo(() => ({ 1: canvasRef1, 2: canvasRef2, 3: canvasRef3 }), []);

  const {
    managersReady, defaultImagesLoaded, managerInstancesRef,
    applyConfigurationsToManagers, applyTokenAssignmentsToManagers,
    updateLayerConfigProperty, // Direct manager update for performance-critical MIDI interpolation
    stopCanvasAnimations, restartCanvasAnimations,
    redrawAllCanvases, handleCanvasResize, setCanvasLayerImage,
  } = useCanvasOrchestrator({ configServiceRef, canvasRefs });

  // Pass updateLayerConfig (from VisualConfigContext via useVisualLayerState) to useVisualEffects
  const { processEffect, createDefaultEffect } = useVisualEffects(updateLayerConfig);

  const audioState = useAudioVisualizer();
  const { isAudioActive, audioSettings, handleAudioDataUpdate } = audioState;
  const uiState = useUIState('tab1'); // Manages active panel, overlays, UI visibility etc.
  const { setActiveLayerTab } = uiState;

  const handleZeroDimensions = useCallback(() => {
    console.warn("[MainView onZeroDimensions Callback] Triggered.");
    if (resetLifecycleRef.current && typeof resetLifecycleRef.current === 'function') {
      resetLifecycleRef.current();
    } else {
      console.error("[MainView onZeroDimensions Callback] Critical: resetLifecycleRef.current is not a function!");
    }
  }, []);

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

  // Render lifecycle now uses layerConfigs and tokenAssignments from VisualConfigContext
  const renderLifecycleData = useRenderLifecycle({
      managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
      isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress,
      layerConfigs, tokenAssignments, // These now come from VisualConfigContext via useVisualLayerState
      loadError, upInitializationError, upFetchStateError,
      stopAllAnimations: stopCanvasAnimations, applyConfigurationsToManagers: applyConfigurationsToManagers,
      applyTokenAssignments: applyTokenAssignmentsToManagers, redrawAllCanvases: redrawAllCanvases,
      restartCanvasAnimations: restartCanvasAnimations,
  });
  const {
      renderState, loadingStatusMessage, isStatusFadingOut, showStatusDisplay,
      showRetryButton, isTransitioning, isCanvasVisible, isAnimating, handleManualRetry,
      resetLifecycle
  } = renderLifecycleData;

  useEffect(() => { resetLifecycleRef.current = resetLifecycle; }, [resetLifecycle]);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  useAnimationLifecycleManager({
      isMounted: isMountedRef.current, renderState, isContainerObservedVisible,
      isAnimating, isTransitioning, restartCanvasAnimations, stopCanvasAnimations,
  });

  useEffect(() => { transitionInProgressRef.current = isTransitioning; }, [isTransitioning]);

  const isBaseReady = useMemo(() => managersReady && defaultImagesLoaded && isInitiallyResolved && hasValidDimensions && isContainerObservedVisible, [managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions, isContainerObservedVisible]);
  const shouldShowUI = useMemo(() => isBaseReady || renderState === 'prompt_connect', [isBaseReady, renderState]); // prompt_connect might be obsolete
  const showFpsCounter = useMemo(() => renderState === 'rendered' && isContainerObservedVisible, [renderState, isContainerObservedVisible]);

  /**
   * Handles changes to layer properties.
   * Calls `updateLayerConfig` (from VisualConfigContext) to update the central state,
   * and `updateLayerConfigProperty` (from useCanvasOrchestrator) for direct, potentially faster
   * updates to CanvasManager instances, especially for interpolated MIDI parameters.
   */
  const handleLayerPropChange = useCallback((layerId, key, value) => {
    if (updateLayerConfig) {
      updateLayerConfig(layerId, key, value); // Updates VisualConfigContext state
    }
    if (updateLayerConfigProperty) {
      // For direct/immediate updates to canvas managers, e.g., for MIDI interpolation targets
      updateLayerConfigProperty(layerId, key, value);
    }
  }, [updateLayerConfig, updateLayerConfigProperty]);

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
                // Update context state as well, handleLayerPropChange does both
                handleLayerPropChange(layer, param, scaledValue);
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
  }, [pendingParamUpdate, pendingLayerSelect, handleLayerPropChange, setActiveLayerTab, clearPendingActions, managerInstancesRef]);

  /**
   * Handles applying a new token to a layer.
   * Updates the token assignment in `VisualConfigContext` via `updateTokenAssignment`
   * and instructs the `CanvasOrchestrator` to set the image on the canvas.
   */
  const handleTokenApplied = useCallback((data, layerId) => {
    if (!isMountedRef.current || !setCanvasLayerImage) {
        console.warn(`[MainView] handleTokenApplied aborted: Not mounted or setCanvasLayerImage missing.`);
        return;
    }
    let idToSave = null; let srcToApply = null;
    // Logic to determine idToSave and srcToApply (remains the same)
    if (data?.type === 'owned' && data.address && data.iconUrl) {
        idToSave = data.address; srcToApply = data.iconUrl;
    } else if (typeof data === 'string') {
        if (Object.hasOwnProperty.call(demoAssetMap, data)) {
            idToSave = data; srcToApply = demoAssetMap[data];
        } else if (Object.values(demoAssetMap).includes(data)) {
            const demoKey = Object.keys(demoAssetMap).find(key => demoAssetMap[key] === data);
            idToSave = demoKey || data; srcToApply = data;
        } else if (data.startsWith('http')) {
            idToSave = data; srcToApply = data;
        } else if (data.startsWith('data:')) {
            idToSave = data.substring(0, 50) + '...'; srcToApply = data;
        } else {
            console.warn(`[MV handleTokenApplied L${layerId}] Unhandled string data type: ${data}`);
            idToSave = data; srcToApply = data;
        }
    } else {
        console.warn(`[MV handleTokenApplied L${layerId}] Invalid or undefined data type received:`, data);
    }

    if (srcToApply) {
      setCanvasLayerImage(layerId, srcToApply)
        .catch(e => console.error(`[MV handleTokenApplied L${layerId}] setCanvasLayerImage failed for ${srcToApply.substring(0,60)}...:`, e));
    } else {
      console.warn(`[MV handleTokenApplied L${layerId}] No image source determined (srcToApply is null). ID to save was: ${idToSave}`);
    }

    // Update token assignment in VisualConfigContext
    if (updateTokenAssignment && idToSave !== null) {
      updateTokenAssignment(layerId, idToSave);
    } else if (idToSave === null) {
      console.warn(`[MV handleTokenApplied L${layerId}] No ID determined, cannot save assignment.`);
    }
  }, [updateTokenAssignment, setCanvasLayerImage]); // Added updateTokenAssignment

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

  // layerConfigs for AudioAnalyzerWrapper and configDataForUIOverlay now comes from useVisualLayerState
  const configDataForUIOverlay = useMemo(() => ({
    layerConfigs, // From useVisualLayerState
    savedReactions,
    currentConfigName,
    savedConfigList: presetSavedConfigList,
    isLoading: isConfigLoading,
    canSave,
    isPreviewMode,
    isParentAdmin,
    isProfileOwner,
    isVisitor,
    currentProfileAddress, // This is hostProfileAddress
    blendModes,
    notifications: notificationData.notifications,
    unreadCount: notificationData.unreadCount,
    isTransitioning,
  }), [
    layerConfigs, savedReactions, currentConfigName, presetSavedConfigList, isConfigLoading,
    canSave, isPreviewMode, isParentAdmin, isProfileOwner, isVisitor, currentProfileAddress,
    blendModes, notificationData.notifications, notificationData.unreadCount, isTransitioning
  ]);

  // onLayerConfigChange for UIOverlay now uses handleLayerPropChange which correctly sources updateLayerConfig
  const actionsForUIOverlay = useMemo(() => ({
    onLayerConfigChange: handleLayerPropChange,
    onSaveReaction: updateSavedReaction,
    onRemoveReaction: deleteSavedReaction,
    onPresetSelect: loadNamedConfig,
    onEnhancedView: enterFullscreen,
    onMarkNotificationRead: notificationData.markAsRead,
    onClearAllNotifications: notificationData.clearAll,
    onPreviewEffect: processEffect,
    onTokenApplied: handleTokenApplied,
  }), [
    handleLayerPropChange,
    updateSavedReaction, deleteSavedReaction, loadNamedConfig,
    enterFullscreen, notificationData.markAsRead, notificationData.clearAll,
    processEffect, handleTokenApplied
  ]);

  if (upInitializationError || upFetchStateError) {
    // This uses the raw errors from UpProvider, which is fine for critical failures.
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

  const canvas1Class = `canvas layer-1 ${isCanvasVisible ? 'visible' : ''}`;
  const canvas2Class = `canvas layer-2 ${isCanvasVisible ? 'visible' : ''}`;
  const canvas3Class = `canvas layer-3 ${isCanvasVisible ? 'visible' : ''}`;
  const containerClass = `canvas-container ${isTransitioning ? 'transitioning' : ''}`;

  return (
    <>
      <div id="fullscreen-root" ref={rootRef} className="main-view radar-cursor">
        <CanvasContainerWrapper
          containerRef={containerRef}
          canvasRef1={canvasRef1}
          canvasRef2={canvasRef2}
          canvasRef3={canvasRef3}
          containerClass={containerClass}
          canvas1Class={canvas1Class}
          canvas2Class={canvas2Class}
          canvas3Class={canvas3Class}
          pingColor={PING_COLOR}
          pingStrokeWidth={PING_STROKE_WIDTH}
          noPingSelectors={NO_PING_SELECTORS}
        />

        <FpsDisplay
          showFpsCounter={showFpsCounter}
          isFullscreenActive={isFullscreenActive}
          portalContainer={portalContainerNode}
        />

        <ToastContainer />
        <UIOverlay
            uiState={uiState}
            audioState={audioState}
            configData={configDataForUIOverlay} // Contains layerConfigs from useVisualLayerState
            actions={actionsForUIOverlay}        // Contains onLayerConfigChange correctly wired
            shouldShowUI={shouldShowUI}
        />

        <StatusIndicator
          showStatusDisplay={showStatusDisplay}
          isStatusFadingOut={isStatusFadingOut}
          renderState={renderState}
          loadingStatusMessage={loadingStatusMessage}
          showRetryButton={showRetryButton}
          onManualRetry={handleManualRetry}
        />

        <AudioAnalyzerWrapper
            isAudioActive={isAudioActive}
            managersReady={managersReady}
            handleAudioDataUpdate={handleAudioDataUpdate}
            layerConfigs={layerConfigs} // From useVisualLayerState
            audioSettings={audioSettings}
            configLoadNonce={configLoadNonce} // From useConfigStatusState (ConfigContext)
            managerInstancesRef={managerInstancesRef}
        />
      </div>
    </>
  );
};

MainView.propTypes = {
  blendModes: PropTypes.arrayOf(PropTypes.string),
};

export default MainView;