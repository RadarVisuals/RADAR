// src/components/Main/Mainview.jsx
import React, { useRef, useEffect, useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";

// Custom Hooks - Grouped by category for readability
import { useUpProvider } from "../../context/UpProvider";
// import { useConfig } from "../../context/ConfigContext"; // REMOVED: Not directly used
import { useMIDI } from "../../context/MIDIContext";
import { useNotifications } from "../../hooks/useNotifications";
import { useVisualEffects } from "../../hooks/useVisualEffects";
import { useCanvasOrchestrator } from "../../hooks/useCanvasOrchestrator";
import { useRenderLifecycle } from '../../hooks/useRenderLifecycle';
import { useCanvasContainer } from '../../hooks/useCanvasContainer';
import { useAudioVisualizer } from '../../hooks/useAudioVisualizer';
import { useUIState } from '../../hooks/useUIState';
import { useLsp1Events } from '../../hooks/useLsp1Events';
import { useAnimationLifecycleManager } from '../../hooks/useAnimationLifecycleManager';
import {
  useVisualLayerState,
  useInteractionSettingsState,
  useProfileSessionState,
  useConfigStatusState,
  usePresetManagementState,
} from "../../hooks/configSelectors";

// UI Components
import ToastContainer from "../Notifications/ToastContainer";
import UIOverlay from '../UI/UIOverlay';
import CanvasContainerWrapper from '../MainViewParts/CanvasContainerWrapper';
import FpsDisplay from '../MainViewParts/FpsDisplay';
import StatusIndicator from '../MainViewParts/StatusIndicator';
import AudioAnalyzerWrapper from '../MainViewParts/AudioAnalyzerWrapper';
import { sliderParams } from '../Panels/EnhancedControlPanel';

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

/** @type {HTMLElement | null} */
const portalContainerNode = typeof document !== 'undefined' ? document.getElementById('portal-container') : null;
const TOKEN_OVERLAY_ANIMATION_LOCK_DURATION = 500;

/**
 * @typedef {object} MainViewProps
 * @property {string[]} [blendModes] - Array of available blend mode strings. Defaults to BLEND_MODES from global config.
 */

/**
 * MainView: The primary component orchestrating the entire visual application.
 * @param {MainViewProps} props - The component's props.
 * @returns {JSX.Element} The rendered MainView component.
 */
const MainView = ({ blendModes = BLEND_MODES }) => {
  // Destructure necessary values from useUpProvider
  const {
    publicClient, // For critical error check
    walletClient, // For critical error check
    // Other properties from useUpProvider are not directly used in MainView's top level
    // but are consumed by other hooks like useConfigStatusState.
  } = useUpProvider();

  const {
    layerConfigs: currentActiveLayerConfigs,
    tokenAssignments: currentActiveTokenAssignments,
    updateLayerConfig,
    updateTokenAssignment,
  } = useVisualLayerState();

  const { savedReactions, updateSavedReaction, deleteSavedReaction } = useInteractionSettingsState();
  const { currentProfileAddress, isProfileOwner, canSave, isPreviewMode, isParentAdmin, isVisitor } = useProfileSessionState();
  // upInitializationError and upFetchStateError are from useConfigStatusState, which internally uses useUpProvider
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

  /** @type {React.RefObject<HTMLDivElement>} */
  const rootRef = useRef(null);
  /** @type {React.RefObject<boolean>} */
  const isMountedRef = useRef(false);
  /** @type {React.RefObject<(() => void) | null>} */
  const resetLifecycleRef = useRef(null);

  /** @type {React.RefObject<HTMLCanvasElement>} */
  const canvasRef1 = useRef(null);
  /** @type {React.RefObject<HTMLCanvasElement>} */
  const canvasRef2 = useRef(null);
  /** @type {React.RefObject<HTMLCanvasElement>} */
  const canvasRef3 = useRef(null);
  const canvasRefs = useMemo(() => ({ "1": canvasRef1, "2": canvasRef2, "3": canvasRef3 }), []);

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
  const { setActiveLayerTab, activePanel: currentActivePanel, infoOverlayOpen: currentInfoOverlayOpen, animatingPanel } = uiStateHook;

  const [animationLockForTokenOverlay, setAnimationLockForTokenOverlay] = useState(false);
  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const animationLockTimerRef = useRef(null);

  useEffect(() => {
    if (animatingPanel === 'tokens') {
      setAnimationLockForTokenOverlay(true);
      if (animationLockTimerRef.current) clearTimeout(animationLockTimerRef.current);
      animationLockTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setAnimationLockForTokenOverlay(false);
        animationLockTimerRef.current = null;
      }, TOKEN_OVERLAY_ANIMATION_LOCK_DURATION);
    } else if (animationLockForTokenOverlay && animatingPanel !== 'tokens') {
      setAnimationLockForTokenOverlay(false);
      if (animationLockTimerRef.current) {
        clearTimeout(animationLockTimerRef.current);
        animationLockTimerRef.current = null;
      }
    }
    return () => {
      if (animationLockTimerRef.current) clearTimeout(animationLockTimerRef.current);
    };
  }, [animatingPanel, animationLockForTokenOverlay]);

  const isBenignOverlayActive = useMemo(() => {
    return animatingPanel === 'tokens' || currentActivePanel === 'tokens' || currentInfoOverlayOpen;
  }, [currentActivePanel, currentInfoOverlayOpen, animatingPanel]);

  const handleZeroDimensionsOrchestrator = useCallback(() => {
    if (isMountedRef.current && resetLifecycleRef.current && typeof resetLifecycleRef.current === 'function') {
      if (import.meta.env.DEV) console.log("[MainView] Zero dimensions detected, triggering lifecycle reset.");
      resetLifecycleRef.current();
    }
  }, []);

  const { containerRef, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen } = useCanvasContainer({
    onResize: useCallback(() => { if (isMountedRef.current && typeof handleCanvasResize === 'function') handleCanvasResize(); }, [handleCanvasResize]),
    onZeroDimensions: handleZeroDimensionsOrchestrator,
  });

  const renderLifecycleData = useRenderLifecycle({
    managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
    isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress,
    layerConfigs: currentActiveLayerConfigs,
    tokenAssignments: currentActiveTokenAssignments,
    targetLayerConfigsForPreset: loadedLayerConfigsFromPreset,
    targetTokenAssignmentsForPreset: loadedTokenAssignmentsFromPreset,
    loadError, upInitializationError, upFetchStateError,
    stopAllAnimations: stopCanvasAnimations,
    applyConfigurationsToManagers: applyConfigurationsToManagers,
    applyTokenAssignments: applyTokenAssignmentsToManagers,
    redrawAllCanvases: redrawAllCanvases,
    restartCanvasAnimations: restartCanvasAnimations,
    isLoading: isConfigLoading,
    managerInstancesRef,
  });
  const {
    renderState, loadingStatusMessage, isStatusFadingOut, showStatusDisplay,
    showRetryButton, isTransitioning,
    outgoingLayerIdsOnTransitionStart,
    makeIncomingCanvasVisible,
    isAnimating, handleManualRetry, resetLifecycle
  } = renderLifecycleData;

  useEffect(() => { resetLifecycleRef.current = resetLifecycle; }, [resetLifecycle]);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  useAnimationLifecycleManager({
    isMounted: isMountedRef.current,
    renderState,
    isContainerObservedVisible,
    isBenignOverlayActive,
    animatingPanel,
    isAnimating,
    isTransitioning,
    restartCanvasAnimations,
    stopCanvasAnimations,
    animationLockForTokenOverlay,
  });

  const showFpsCounter = useMemo(() => renderState === 'rendered' && isContainerObservedVisible, [renderState, isContainerObservedVisible]);

  const handleLayerPropChange = useCallback((layerId, key, value) => {
    if (typeof updateLayerConfig === 'function') {
      updateLayerConfig(String(layerId), key, value);
    }
  }, [updateLayerConfig]);

  useEffect(() => {
    let processed = false;
    if (pendingParamUpdate) {
      const { layer, param, value: normalizedMidiValue } = pendingParamUpdate;
      const manager = managerInstancesRef.current?.[String(layer)];
      if (manager) {
        const sliderConfig = sliderParams.find(p => p.prop === param);
        if (sliderConfig) {
          const scaledValue = scaleNormalizedValue(normalizedMidiValue, sliderConfig.min, sliderConfig.max);
          if (INTERPOLATED_MIDI_PARAMS.includes(param) && typeof manager.setTargetValue === 'function') {
            manager.setTargetValue(param, scaledValue);
          }
          handleLayerPropChange(String(layer), param, scaledValue);
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
    if (processed && typeof clearPendingActions === 'function') {
      clearPendingActions();
    }
  }, [pendingParamUpdate, pendingLayerSelect, handleLayerPropChange, setActiveLayerTab, clearPendingActions, managerInstancesRef]);

  const handleTokenApplied = useCallback(async (data, layerId) => {
    if (!isMountedRef.current || typeof setCanvasLayerImage !== 'function' || !configServiceRef.current) return;

    let idToSaveInConfig = null;
    let srcToLoadInCanvas = null;

    if (data?.type === 'owned' && data.address && isAddress(data.address)) {
      idToSaveInConfig = data.address;
      const metadata = await resolveLsp4Metadata(configServiceRef.current, data.address);
      if (metadata?.LSP4Metadata) {
        const meta = metadata.LSP4Metadata;
        const url = meta.assets?.[0]?.url || meta.icon?.[0]?.url || meta.images?.[0]?.[0]?.url || null;
        if (url && typeof url === 'string') {
          const trimmedUrl = url.trim();
          if (trimmedUrl.startsWith('ipfs://')) srcToLoadInCanvas = `${IPFS_GATEWAY}${trimmedUrl.slice(7)}`;
          else if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) srcToLoadInCanvas = trimmedUrl;
        }
      }
      if (!srcToLoadInCanvas && data.iconUrl) srcToLoadInCanvas = data.iconUrl;
    } else if (typeof data === 'string') {
      if (Object.prototype.hasOwnProperty.call(demoAssetMap, data)) {
        idToSaveInConfig = data;
        srcToLoadInCanvas = demoAssetMap[data];
      } else if (Object.values(demoAssetMap).includes(data)) {
        const demoKey = Object.keys(demoAssetMap).find(key => demoAssetMap[key] === data);
        idToSaveInConfig = demoKey || data;
        srcToLoadInCanvas = data;
      } else if (data.startsWith('http') || data.startsWith('data:')) {
        idToSaveInConfig = data.startsWith('data:') ? data.substring(0, 50) + '...' : data;
        srcToLoadInCanvas = data;
      } else {
        idToSaveInConfig = data;
        srcToLoadInCanvas = data;
        if (import.meta.env.DEV) console.warn(`[MainView handleTokenApplied] Unknown string token data: ${data}. Attempting to load as URL.`);
      }
    }

    if (srcToLoadInCanvas) {
      setCanvasLayerImage(String(layerId), srcToLoadInCanvas)
        .catch(e => { if (import.meta.env.DEV) console.error(`[MainView handleTokenApplied L${layerId}] setCanvasLayerImage failed for ${String(srcToLoadInCanvas).substring(0, 60)}...:`, e); });
    } else if (import.meta.env.DEV) {
      console.warn(`[MainView handleTokenApplied L${layerId}] No valid image source found to apply for token data:`, data);
    }

    if (typeof updateTokenAssignment === 'function' && idToSaveInConfig !== null) {
      updateTokenAssignment(String(layerId), idToSaveInConfig);
    }
  }, [updateTokenAssignment, setCanvasLayerImage, configServiceRef]);

  const handleEventReceived = useCallback((event) => {
    if (!isMountedRef.current || !event?.type) return;
    if (typeof addNotification === 'function') addNotification(event);

    const reactionsMap = savedReactions || {};
    const eventTypeLower = event.type.toLowerCase();
    const matchingReactions = Object.values(reactionsMap).filter(r => r?.event?.toLowerCase() === eventTypeLower);

    if (matchingReactions.length > 0) {
      matchingReactions.forEach(reactionConfig => {
        if (typeof processEffect === 'function') {
          processEffect({ ...reactionConfig, originEvent: event })
            .catch(e => { if (import.meta.env.DEV) console.error("[MainView] Error processing configured reaction:", e); });
        }
      });
    } else if (typeof createDefaultEffect === 'function') {
      createDefaultEffect(event.type)
        .catch(e => { if (import.meta.env.DEV) console.error("[MainView] Error creating default effect:", e); });
    }
  }, [addNotification, savedReactions, processEffect, createDefaultEffect]);

  useLsp1Events(currentProfileAddress, handleEventReceived);

  const configDataForUIOverlay = useMemo(() => ({
    layerConfigs: currentActiveLayerConfigs, tokenAssignments: currentActiveTokenAssignments,
    savedReactions, currentConfigName, isConfigLoading,
    canSave, isPreviewMode, isParentAdmin, isProfileOwner, isVisitor, currentProfileAddress,
    blendModes, notifications: notificationData.notifications, unreadCount: notificationData.unreadCount,
    isTransitioning,
    isBaseReady: (managersReady && defaultImagesLoaded && isInitiallyResolved && hasValidDimensions && isContainerObservedVisible),
    renderState,
  }), [
    currentActiveLayerConfigs, currentActiveTokenAssignments, savedReactions, currentConfigName, isConfigLoading,
    canSave, isPreviewMode, isParentAdmin, isProfileOwner, isVisitor, currentProfileAddress,
    blendModes, notificationData.notifications, notificationData.unreadCount, isTransitioning,
    managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions, isContainerObservedVisible,
    renderState,
  ]);

  const actionsForUIOverlay = useMemo(() => ({
    onLayerConfigChange: handleLayerPropChange,
    onSaveReaction: updateSavedReaction,
    onRemoveReaction: deleteSavedReaction,
    onPresetSelect: loadNamedConfig,
    onEnhancedView: enterFullscreen,
    onMarkNotificationRead: notificationData.markAsRead,
    onClearAllNotifications: notificationData.clearAll,
    onPreviewEffect: processEffect,
    onTokenApplied: handleTokenApplied
  }), [
    handleLayerPropChange, updateSavedReaction, deleteSavedReaction, loadNamedConfig,
    enterFullscreen, notificationData.markAsRead, notificationData.clearAll, processEffect, handleTokenApplied
  ]);

  // Critical error display for UP Provider or Viem client initialization issues
  if (upInitializationError || (upFetchStateError && !publicClient && !walletClient)) {
    const errorSource = upInitializationError ? "Universal Profile Provider" : "Blockchain Client";
    const msg = (upInitializationError?.message || upFetchStateError?.message || `Unknown critical error initialising ${errorSource}.`);
    return (
      <div id="fullscreen-root" className="main-view error-boundary-display">
        <div className="error-content">
          <p><strong>Critical Application Error</strong></p>
          <p style={{ wordBreak: 'break-word', maxWidth: '400px' }}>{msg}</p>
          <p>Please ensure your Universal Profile browser extension is enabled and configured correctly, then try refreshing the page.</p>
        </div>
      </div>
    );
  }

  const displayConfigsForClassLogic = isTransitioning ? loadedLayerConfigsFromPreset : currentActiveLayerConfigs;

  const getCanvasClasses = (layerIdStr) => {
    let classes = `canvas layer-${layerIdStr}`;
    const isThisLayerOutgoing = isTransitioning && outgoingLayerIdsOnTransitionStart && outgoingLayerIdsOnTransitionStart.has(layerIdStr);
    const isThisLayerIncomingAndReady = isTransitioning && makeIncomingCanvasVisible && displayConfigsForClassLogic?.[layerIdStr]?.enabled;
    const isThisLayerStableAndVisible = !isTransitioning && renderState === 'rendered' && currentActiveLayerConfigs?.[layerIdStr]?.enabled;

    if (isThisLayerOutgoing) {
      classes += ' is-fading-out';
    } else if (isThisLayerIncomingAndReady || isThisLayerStableAndVisible) {
      classes += ' visible';
      if (isThisLayerIncomingAndReady) {
        classes += ' is-fading-in';
      }
    }
    return classes;
  };

  const canvas1Class = getCanvasClasses('1');
  const canvas2Class = getCanvasClasses('2');
  const canvas3Class = getCanvasClasses('3');
  const containerClass = `canvas-container ${isTransitioning ? 'transitioning-active' : ''}`;

  return (
    <>
      <div id="fullscreen-root" ref={rootRef} className="main-view radar-cursor">
        <CanvasContainerWrapper
          containerRef={containerRef}
          canvasRef1={canvasRef1} canvasRef2={canvasRef2} canvasRef3={canvasRef3}
          containerClass={containerClass}
          canvas1Class={canvas1Class} canvas2Class={canvas2Class} canvas3Class={canvas3Class}
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
          layerConfigs={currentActiveLayerConfigs}
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