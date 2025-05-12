// src/components/Main/Mainview.jsx
import React, { useRef, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";

// Custom Hooks
import { useCanvasOrchestrator } from "../../hooks/useCanvasOrchestrator";
import { useNotifications } from "../../hooks/useNotifications";
import { useVisualEffects } from "../../hooks/useVisualEffects";
import { useUpProvider } from "../../context/UpProvider";
import {
  useVisualLayerState,
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
import { sliderParams } from '../Panels/EnhancedControlPanel'; 

// New Child Components
import CanvasContainerWrapper from '../MainViewParts/CanvasContainerWrapper';
import FpsDisplay from '../MainViewParts/FpsDisplay';
import StatusIndicator from '../MainViewParts/StatusIndicator';
import AudioAnalyzerWrapper from '../MainViewParts/AudioAnalyzerWrapper';

// Config & Assets
import { BLEND_MODES, IPFS_GATEWAY } from "../../config/global-config";
import { demoAssetMap } from '../../assets/DemoLayers/initLayers';
import { PING_COLOR, PING_STROKE_WIDTH, NO_PING_SELECTORS } from "../../config/uiConstants";
import { INTERPOLATED_MIDI_PARAMS } from '../../config/midiConstants';

// Utils
import { scaleNormalizedValue } from "../../utils/helpers";
import { resolveLsp4Metadata } from '../../utils/erc725.js';
import { isAddress } from 'viem';

// Styles
import "./MainviewStyles/Mainview.css";

/**
 * Portal container node for rendering elements outside the main React tree (e.g., fullscreen FPS counter).
 * @type {HTMLElement | null}
 */
const portalContainerNode = document.getElementById('portal-container');

/**
 * MainView is the central orchestrating component for the RADAR application.
 * It integrates various custom hooks and contexts to manage:
 * - Universal Profile connection and session state (`useUpProvider`, `useProfileSessionState`).
 * - Visual layer configurations and token assignments (`useVisualLayerState`).
 * - Preset loading, saving, and management (`usePresetManagementState`).
 * - MIDI input, mapping, and pending action processing (`useMIDI`).
 * - Audio analysis and reactivity (`useAudioVisualizer`).
 * - LSP1 event listening from the blockchain and triggering visual reactions (`useLsp1Events`, `useVisualEffects`).
 * - Canvas rendering lifecycle, including initialization, transitions, and error states (`useRenderLifecycle`).
 * - Canvas container management, including resize and visibility observation (`useCanvasContainer`).
 * - Overall UI state including active panels, overlays, and general UI visibility (`useUIState`).
 * - Animation control for canvas elements (`useAnimationLifecycleManager`).
 *
 * It renders the core canvas structure (`CanvasContainerWrapper`) and the main UI overlay (`UIOverlay`),
 * passing down necessary state and action callbacks to these and other child components like status indicators and FPS displays.
 *
 * @param {object} props - Component props.
 * @param {string[]} [props.blendModes=BLEND_MODES] - An array of available blend mode strings for visual layers.
 * @returns {JSX.Element} The rendered MainView component.
 */
const MainView = ({ blendModes = BLEND_MODES }) => {
  useUpProvider(); // Initializes UP provider connection logic

  // --- State from various contexts and custom hooks ---
  const { layerConfigs, tokenAssignments, updateLayerConfig, updateTokenAssignment } = useVisualLayerState();
  const { savedReactions, updateSavedReaction, deleteSavedReaction } = useInteractionSettingsState();
  const { currentProfileAddress, isProfileOwner, canSave, isPreviewMode, isParentAdmin, isVisitor } = useProfileSessionState(); 
  const { isInitiallyResolved, configLoadNonce, loadError, upInitializationError, upFetchStateError, configServiceRef, isLoading: isConfigLoading } = useConfigStatusState();
  const { 
    loadNamedConfig, 
    currentConfigName, 
    savedConfigList: presetSavedConfigList,
    loadedLayerConfigsFromPreset,      
    loadedTokenAssignmentsFromPreset,  
  } = usePresetManagementState();
  const { pendingLayerSelect, pendingParamUpdate, clearPendingActions } = useMIDI();
  const notificationData = useNotifications();
  const { addNotification } = notificationData;

  // --- Refs for DOM elements and mutable values ---
  /** @type {React.RefObject<HTMLDivElement>} Ref for the main root div, used for fullscreen targeting. */
  const rootRef = useRef(null);
  /** @type {React.RefObject<boolean>} Ref indicating if the component is currently mounted. */
  const isMountedRef = useRef(false);
  /** @type {React.RefObject<boolean>} Ref indicating if a visual transition (e.g., preset load) is in progress. */
  const transitionInProgressRef = useRef(false);
  /** @type {React.RefObject<Function | null>} Ref to the `resetLifecycle` function from `useRenderLifecycle`. */
  const resetLifecycleRef = useRef(null);
  /** @type {React.RefObject<HTMLCanvasElement>} Refs for the three visual layer canvases. */
  const canvasRef1 = useRef(null); 
  const canvasRef2 = useRef(null); 
  const canvasRef3 = useRef(null);
  /** Memoized object mapping layer IDs to their canvas refs. */
  const canvasRefs = useMemo(() => ({ 1: canvasRef1, 2: canvasRef2, 3: canvasRef3 }), []);

  // --- Canvas and rendering orchestration hooks ---
  const {
    managersReady, defaultImagesLoaded, managerInstancesRef,
    applyConfigurationsToManagers, applyTokenAssignmentsToManagers,
    stopCanvasAnimations, restartCanvasAnimations,
    redrawAllCanvases, handleCanvasResize, setCanvasLayerImage,
  } = useCanvasOrchestrator({ configServiceRef, canvasRefs, configLoadNonce });

  const { processEffect, createDefaultEffect } = useVisualEffects(updateLayerConfig);
  const audioState = useAudioVisualizer();
  const { isAudioActive, audioSettings, handleAudioDataUpdate } = audioState;
  const uiStateHook = useUIState('tab1'); 
  const { setActiveLayerTab } = uiStateHook;

  /** Callback triggered by `useCanvasContainer` if canvas dimensions become zero. */
  const handleZeroDimensions = useCallback(() => {
    if (resetLifecycleRef.current && typeof resetLifecycleRef.current === 'function') resetLifecycleRef.current();
  }, []);

  const { containerRef, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen } = useCanvasContainer({
      onResize: useCallback(() => { if (isMountedRef.current) handleCanvasResize(); }, [handleCanvasResize]),
      onVisibilityChange: useCallback((isVisible) => {
         if (!isMountedRef.current) return;
         const currentlyFullscreen = !!document.fullscreenElement;
         if (!isVisible) { if (!currentlyFullscreen && !transitionInProgressRef.current && stopCanvasAnimations) stopCanvasAnimations(); }
         else { if (restartCanvasAnimations) restartCanvasAnimations(); }
      }, [stopCanvasAnimations, restartCanvasAnimations]), // These are stable callbacks from useCanvasOrchestrator
      onZeroDimensions: handleZeroDimensions,
  });

  /** 
   * Data and state from `useRenderLifecycle`, managing the visual rendering pipeline.
   * @type {import('../../hooks/useRenderLifecycle').RenderLifecycleData} 
   */
  const renderLifecycleData = useRenderLifecycle({
      managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
      isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress, 
      layerConfigs,                       
      tokenAssignments,                 
      targetLayerConfigsForPreset: loadedLayerConfigsFromPreset,         
      targetTokenAssignmentsForPreset: loadedTokenAssignmentsFromPreset, 
      loadError, upInitializationError, upFetchStateError,
      stopAllAnimations: stopCanvasAnimations,
      applyConfigurationsToManagers: applyConfigurationsToManagers,
      applyTokenAssignments: applyTokenAssignmentsToManagers,
      redrawAllCanvases: redrawAllCanvases,
      restartCanvasAnimations: restartCanvasAnimations,
      isLoading: isConfigLoading,
  });
  const { renderState, loadingStatusMessage, isStatusFadingOut, showStatusDisplay, showRetryButton, isTransitioning, isCanvasVisible, isAnimating, handleManualRetry, resetLifecycle } = renderLifecycleData;

  // --- Lifecycle and State Synchronization Effects ---
  useEffect(() => { resetLifecycleRef.current = resetLifecycle; }, [resetLifecycle]);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);
  useAnimationLifecycleManager({ isMounted: isMountedRef.current, renderState, isContainerObservedVisible, isAnimating, isTransitioning, restartCanvasAnimations, stopCanvasAnimations });
  useEffect(() => { transitionInProgressRef.current = isTransitioning; }, [isTransitioning]);

  /** Memoized boolean indicating whether the FPS counter should be displayed. */
  const showFpsCounter = useMemo(() => renderState === 'rendered' && isContainerObservedVisible, [renderState, isContainerObservedVisible]);

  /**
   * Callback to update a specific property of a layer's configuration.
   * Propagates the change to the VisualConfigContext.
   * @param {string|number} layerId - The ID of the layer to update.
   * @param {string} key - The configuration key (property name) to update.
   * @param {any} value - The new value for the property.
   */
  const handleLayerPropChange = useCallback((layerId, key, value) => {
    if (updateLayerConfig) updateLayerConfig(String(layerId), key, value);
  }, [updateLayerConfig]);

  /**
   * Effect to process pending MIDI parameter updates and layer selections.
   * When a MIDI message results in a pending update (from `useMIDI`), this effect
   * scales the MIDI value to the parameter's range and applies it to the
   * appropriate layer configuration or UI state (active layer tab).
   */
  useEffect(() => {
    let processed = false;
    if (pendingParamUpdate) {
        const { layer, param, value: normalizedMidiValue } = pendingParamUpdate;
        const manager = managerInstancesRef.current?.[String(layer)]; // managerInstancesRef from useCanvasOrchestrator

        if (manager) {
            const sliderConfig = sliderParams.find(p => p.prop === param);
            if (sliderConfig) {
                const scaledValue = scaleNormalizedValue(normalizedMidiValue, sliderConfig.min, sliderConfig.max);

                if (INTERPOLATED_MIDI_PARAMS.includes(param) && typeof manager.setTargetValue === 'function') {
                    manager.setTargetValue(param, scaledValue);
                }
                handleLayerPropChange(String(layer), param, scaledValue);
                processed = true;
            } else {
                 if (import.meta.env.DEV) {
                   console.warn(`[MainView MIDI] No sliderConfig found for param: ${param}`);
                 }
            }
        } else {
             if (import.meta.env.DEV) {
               console.warn(`[MainView MIDI] No manager found for layer: ${layer}`);
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
    if (processed && clearPendingActions) clearPendingActions();
  }, [pendingParamUpdate, pendingLayerSelect, handleLayerPropChange, setActiveLayerTab, clearPendingActions, managerInstancesRef]);

  /**
   * Callback to handle applying a selected token (demo or owned) to a visual layer.
   * It resolves token metadata (e.g., image URL from IPFS via LSP4) if necessary
   * and then updates the corresponding canvas via `setCanvasLayerImage` and updates
   * the `tokenAssignments` state in `VisualConfigContext`.
   * @param {string|object} data - The token data. Can be a string (demo token key or direct URL) or an object for owned tokens.
   * @param {string|number} layerId - The ID of the layer to apply the token to.
   */
  const handleTokenApplied = useCallback(async (data, layerId) => {
    if (!isMountedRef.current || !setCanvasLayerImage || !configServiceRef.current) return;
    let idToSave = null; let srcToApply = null;

    if (data?.type === 'owned' && data.address && isAddress(data.address)) {
        idToSave = data.address;
        const metadata = await resolveLsp4Metadata(configServiceRef.current, data.address);
        if (metadata?.LSP4Metadata) {
            const meta = metadata.LSP4Metadata;
            const url = meta.assets?.[0]?.url || meta.icon?.[0]?.url || meta.images?.[0]?.[0]?.url || null;
            if (url && typeof url === 'string') {
                const trimmedUrl = url.trim();
                if (trimmedUrl.startsWith('ipfs://')) srcToApply = `${IPFS_GATEWAY}${trimmedUrl.slice(7)}`;
                else if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) srcToApply = trimmedUrl;
            }
        }
        if (!srcToApply && data.iconUrl) srcToApply = data.iconUrl;
    } else if (typeof data === 'string') {
        if (Object.hasOwnProperty.call(demoAssetMap, data)) {
            idToSave = data; srcToApply = demoAssetMap[data];
        } else if (Object.values(demoAssetMap).includes(data)) {
            const demoKey = Object.keys(demoAssetMap).find(key => demoAssetMap[key] === data);
            idToSave = demoKey || data; srcToApply = data;
        } else if (data.startsWith('http') || data.startsWith('data:')) {
            idToSave = data.startsWith('data:') ? data.substring(0, 50) + '...' : data;
            srcToApply = data;
        } else {
            idToSave = data; srcToApply = data;
        }
    }

    if (srcToApply) {
      setCanvasLayerImage(String(layerId), srcToApply)
        .catch(e => {
          if (import.meta.env.DEV) {
            console.error(`[MV handleTokenApplied L${layerId}] setCanvasLayerImage failed for ${String(srcToApply).substring(0,60)}...:`, e);
          }
        });
    } else {
        if (import.meta.env.DEV) {
          console.warn(`[MV handleTokenApplied L${layerId}] No valid srcToApply derived for data:`, data);
        }
    }
    if (updateTokenAssignment && idToSave !== null) updateTokenAssignment(String(layerId), idToSave);
  }, [updateTokenAssignment, setCanvasLayerImage, configServiceRef]);

  /**
   * Callback to handle incoming LSP1 events from `useLsp1Events`.
   * It adds a notification to the system and triggers either a user-configured
   * visual effect (if a reaction is defined for the event type) or a default
   * visual effect.
   * @param {object} event - The LSP1 event object.
   */
  const handleEventReceived = useCallback((event) => {
    if (!isMountedRef.current || !event?.type) return;
    if (addNotification) addNotification(event);
    const reactionsMap = savedReactions || {};
    const eventTypeLower = event.type.toLowerCase();
    const matchingReactions = Object.values(reactionsMap).filter(r => r?.event?.toLowerCase() === eventTypeLower);
    if (matchingReactions.length > 0) {
      matchingReactions.forEach(reactionConfig => {
        if (processEffect) processEffect({ ...reactionConfig, originEvent: event })
            .catch(e => {
              if (import.meta.env.DEV) {
                console.error("[MainView] Error processing configured reaction:", e);
              }
            });
      });
    } else if (createDefaultEffect) {
      createDefaultEffect(event.type)
        .catch(e => {
          if (import.meta.env.DEV) {
            console.error("[MainView] Error creating default effect:", e);
          }
        });
    }
  }, [addNotification, savedReactions, processEffect, createDefaultEffect]);

  useLsp1Events(currentProfileAddress, handleEventReceived); 

  /** Memoized data object passed to `UIOverlay`, containing various configuration states. */
  const configDataForUIOverlay = useMemo(() => ({
    layerConfigs, tokenAssignments, savedReactions, currentConfigName, isConfigLoading,
    canSave, isPreviewMode, isParentAdmin, isProfileOwner, isVisitor, currentProfileAddress, 
    blendModes, notifications: notificationData.notifications, unreadCount: notificationData.unreadCount, isTransitioning,
    isBaseReady: (managersReady && defaultImagesLoaded && isInitiallyResolved && hasValidDimensions && isContainerObservedVisible), 
    renderState,
  }), [
    layerConfigs, tokenAssignments, savedReactions, currentConfigName, isConfigLoading,
    canSave, isPreviewMode, isParentAdmin, isProfileOwner, isVisitor, currentProfileAddress, 
    blendModes, notificationData.notifications, notificationData.unreadCount, isTransitioning,
    managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions, isContainerObservedVisible, 
    renderState,
  ]);

  /** Memoized actions object passed to `UIOverlay`, containing various callback functions. */
  const actionsForUIOverlay = useMemo(() => ({
    onLayerConfigChange: handleLayerPropChange,
    onSaveReaction: updateSavedReaction, onRemoveReaction: deleteSavedReaction, onPresetSelect: loadNamedConfig,
    onEnhancedView: enterFullscreen, onMarkNotificationRead: notificationData.markAsRead,
    onClearAllNotifications: notificationData.clearAll, onPreviewEffect: processEffect, onTokenApplied: handleTokenApplied
  }), [
    handleLayerPropChange, updateSavedReaction, deleteSavedReaction, loadNamedConfig,
    enterFullscreen, notificationData.markAsRead, notificationData.clearAll, processEffect, handleTokenApplied
  ]);

  // Handle critical UP initialization or state fetch errors by showing an error message.
  if (upInitializationError || upFetchStateError) {
    const msg = upInitializationError?.message || upFetchStateError?.message || "Unknown critical error initialising Universal Profile connection.";
    return (
        <div id="fullscreen-root" className="main-view">
            <div style={{ padding: "20px", color: "red", position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.7)', borderRadius: '8px', textAlign: 'center' }}>
                <p>Critical Error:</p> <p style={{ wordBreak: 'break-word', maxWidth: '400px' }}>{msg}</p> <p>Please try refreshing the page.</p>
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
          canvasRef1={canvasRef1} canvasRef2={canvasRef2} canvasRef3={canvasRef3}
          containerClass={containerClass} canvas1Class={canvas1Class} canvas2Class={canvas2Class} canvas3Class={canvas3Class}
          pingColor={PING_COLOR} pingStrokeWidth={PING_STROKE_WIDTH} noPingSelectors={NO_PING_SELECTORS}
        />
        <FpsDisplay showFpsCounter={showFpsCounter} isFullscreenActive={isFullscreenActive} portalContainer={portalContainerNode} />
        <ToastContainer />
        <UIOverlay
          uiState={uiStateHook}
          audioState={audioState}
          configData={configDataForUIOverlay}
          actions={actionsForUIOverlay}
          passedSavedConfigList={presetSavedConfigList}
        />
        <StatusIndicator showStatusDisplay={showStatusDisplay} isStatusFadingOut={isStatusFadingOut} renderState={renderState} loadingStatusMessage={loadingStatusMessage} showRetryButton={showRetryButton} onManualRetry={handleManualRetry} />
        <AudioAnalyzerWrapper 
            isAudioActive={isAudioActive} 
            managersReady={managersReady} 
            handleAudioDataUpdate={handleAudioDataUpdate} 
            layerConfigs={layerConfigs} 
            audioSettings={audioSettings} 
            configLoadNonce={configLoadNonce} 
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