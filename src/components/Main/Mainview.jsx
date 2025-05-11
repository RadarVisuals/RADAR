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
import { sliderParams } from '../Panels/EnhancedControlPanel'; // For MIDI scaling

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

const portalContainerNode = document.getElementById('portal-container');

const MainView = ({ blendModes = BLEND_MODES }) => {
  useUpProvider();

  const { layerConfigs, tokenAssignments, updateLayerConfig, updateTokenAssignment } = useVisualLayerState();
  const { savedReactions, updateSavedReaction, deleteSavedReaction } = useInteractionSettingsState();
  const { currentProfileAddress, isProfileOwner, canSave, isPreviewMode, isParentAdmin, isVisitor } = useProfileSessionState();
  const { isInitiallyResolved, configLoadNonce, loadError, upInitializationError, upFetchStateError, configServiceRef, isLoading: isConfigLoading } = useConfigStatusState();
  const { loadNamedConfig, currentConfigName, savedConfigList: presetSavedConfigList } = usePresetManagementState();
  const { pendingLayerSelect, pendingParamUpdate, clearPendingActions } = useMIDI();
  const notificationData = useNotifications();
  const { addNotification } = notificationData;

  const rootRef = useRef(null);
  const isMountedRef = useRef(false);
  const transitionInProgressRef = useRef(false);
  const resetLifecycleRef = useRef(null);
  const canvasRef1 = useRef(null); const canvasRef2 = useRef(null); const canvasRef3 = useRef(null);
  const canvasRefs = useMemo(() => ({ 1: canvasRef1, 2: canvasRef2, 3: canvasRef3 }), []);

  const {
    managersReady, defaultImagesLoaded, managerInstancesRef,
    applyConfigurationsToManagers, applyTokenAssignmentsToManagers,
    stopCanvasAnimations, restartCanvasAnimations,
    redrawAllCanvases, handleCanvasResize, setCanvasLayerImage,
  } = useCanvasOrchestrator({ configServiceRef, canvasRefs });

  const { processEffect, createDefaultEffect } = useVisualEffects(updateLayerConfig);
  const audioState = useAudioVisualizer();
  const { isAudioActive, audioSettings, handleAudioDataUpdate } = audioState;
  const uiStateHook = useUIState('tab1');
  const { setActiveLayerTab } = uiStateHook;

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
      }, [stopCanvasAnimations, restartCanvasAnimations]),
      onZeroDimensions: handleZeroDimensions,
  });

  const renderLifecycleData = useRenderLifecycle({
      managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
      isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress,
      layerConfigs, tokenAssignments, loadError, upInitializationError, upFetchStateError,
      stopAllAnimations: stopCanvasAnimations,
      applyConfigurationsToManagers: applyConfigurationsToManagers,
      applyTokenAssignments: applyTokenAssignmentsToManagers,
      redrawAllCanvases: redrawAllCanvases,
      restartCanvasAnimations: restartCanvasAnimations,
      isLoading: isConfigLoading,
  });
  const { renderState, loadingStatusMessage, isStatusFadingOut, showStatusDisplay, showRetryButton, isTransitioning, isCanvasVisible, isAnimating, handleManualRetry, resetLifecycle } = renderLifecycleData;

  useEffect(() => { resetLifecycleRef.current = resetLifecycle; }, [resetLifecycle]);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);
  useAnimationLifecycleManager({ isMounted: isMountedRef.current, renderState, isContainerObservedVisible, isAnimating, isTransitioning, restartCanvasAnimations, stopCanvasAnimations });
  useEffect(() => { transitionInProgressRef.current = isTransitioning; }, [isTransitioning]);

  // const isBaseReady = useMemo(() => managersReady && defaultImagesLoaded && isInitiallyResolved && hasValidDimensions && isContainerObservedVisible, [managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions, isContainerObservedVisible]);
  // shouldShowUI is removed as UIOverlay calculates this itself from configData
  // const shouldShowUI = useMemo(() => isBaseReady || renderState === 'prompt_connect', [isBaseReady, renderState]); 
  const showFpsCounter = useMemo(() => renderState === 'rendered' && isContainerObservedVisible, [renderState, isContainerObservedVisible]);

  const handleLayerPropChange = useCallback((layerId, key, value) => {
    if (updateLayerConfig) updateLayerConfig(String(layerId), key, value);
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
            } else {
                // console.warn(`[MainView MIDI] No sliderConfig found for param: ${param}`);
            }
        } else {
            // console.warn(`[MainView MIDI] No manager found for layer: ${layer}`);
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
        .catch(e => console.error(`[MV handleTokenApplied L${layerId}] setCanvasLayerImage failed for ${String(srcToApply).substring(0,60)}...:`, e));
    } else {
        // console.warn(`[MV handleTokenApplied L${layerId}] No valid srcToApply derived for data:`, data);
    }
    if (updateTokenAssignment && idToSave !== null) updateTokenAssignment(String(layerId), idToSave);
  }, [updateTokenAssignment, setCanvasLayerImage, configServiceRef]);


  const handleEventReceived = useCallback((event) => {
    if (!isMountedRef.current || !event?.type) return;
    if (addNotification) addNotification(event);
    const reactionsMap = savedReactions || {};
    const eventTypeLower = event.type.toLowerCase();
    const matchingReactions = Object.values(reactionsMap).filter(r => r?.event?.toLowerCase() === eventTypeLower);
    if (matchingReactions.length > 0) {
      matchingReactions.forEach(reactionConfig => {
        if (processEffect) processEffect({ ...reactionConfig, originEvent: event })
            .catch(e => console.error("[MainView] Error processing configured reaction:", e));
      });
    } else if (createDefaultEffect) {
      createDefaultEffect(event.type)
        .catch(e => console.error("[MainView] Error creating default effect:", e));
    }
  }, [addNotification, savedReactions, processEffect, createDefaultEffect]);

  useLsp1Events(currentProfileAddress, handleEventReceived);

  const configDataForUIOverlay = useMemo(() => ({
    layerConfigs, tokenAssignments, savedReactions, currentConfigName, isConfigLoading,
    canSave, isPreviewMode, isParentAdmin, isProfileOwner, isVisitor, currentProfileAddress,
    blendModes, notifications: notificationData.notifications, unreadCount: notificationData.unreadCount, isTransitioning,
    isBaseReady: (managersReady && defaultImagesLoaded && isInitiallyResolved && hasValidDimensions && isContainerObservedVisible), // Pass the derived isBaseReady
    renderState,
  }), [
    layerConfigs, tokenAssignments, savedReactions, currentConfigName, isConfigLoading,
    canSave, isPreviewMode, isParentAdmin, isProfileOwner, isVisitor, currentProfileAddress,
    blendModes, notificationData.notifications, notificationData.unreadCount, isTransitioning,
    managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions, isContainerObservedVisible, // Dependencies for isBaseReady
    renderState,
  ]);

  const actionsForUIOverlay = useMemo(() => ({
    onLayerConfigChange: handleLayerPropChange,
    onSaveReaction: updateSavedReaction, onRemoveReaction: deleteSavedReaction, onPresetSelect: loadNamedConfig,
    onEnhancedView: enterFullscreen, onMarkNotificationRead: notificationData.markAsRead,
    onClearAllNotifications: notificationData.clearAll, onPreviewEffect: processEffect, onTokenApplied: handleTokenApplied
  }), [
    handleLayerPropChange, updateSavedReaction, deleteSavedReaction, loadNamedConfig,
    enterFullscreen, notificationData.markAsRead, notificationData.clearAll, processEffect, handleTokenApplied
  ]);

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
          // shouldShowUI prop is removed here
          passedSavedConfigList={presetSavedConfigList}
        />
        <StatusIndicator showStatusDisplay={showStatusDisplay} isStatusFadingOut={isStatusFadingOut} renderState={renderState} loadingStatusMessage={loadingStatusMessage} showRetryButton={showRetryButton} onManualRetry={handleManualRetry} />
        <AudioAnalyzerWrapper isAudioActive={isAudioActive} managersReady={managersReady} handleAudioDataUpdate={handleAudioDataUpdate} layerConfigs={layerConfigs} audioSettings={audioSettings} configLoadNonce={configLoadNonce} managerInstancesRef={managerInstancesRef} />
      </div>
    </>
  );
};

MainView.propTypes = {
  blendModes: PropTypes.arrayOf(PropTypes.string),
};

export default MainView;