// src/components/Main/Mainview.jsx
import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";

// Custom Hooks
import { useUpProvider } from "../../context/UpProvider";
import { useMIDI } from "../../context/MIDIContext";
import { useCoreApplicationStateAndLifecycle } from '../../hooks/useCoreApplicationStateAndLifecycle';
import { useAppInteractions } from '../../hooks/useAppInteractions';
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
import CriticalErrorDisplay from '../MainViewParts/CriticalErrorDisplay';

// Config & Assets
import { BLEND_MODES } from "../../config/global-config";
import { PING_COLOR, PING_STROKE_WIDTH, NO_PING_SELECTORS } from "../../config/uiConstants";

// Styles
import "./MainviewStyles/Mainview.css";

const portalContainerNode = typeof document !== 'undefined' ? document.getElementById('portal-container') : null;
const TOKEN_OVERLAY_ANIMATION_LOCK_DURATION = 500;

const MainView = ({ blendModes = BLEND_MODES }) => {
  const { publicClient, walletClient } = useUpProvider();

  const {
    layerConfigs: currentActiveLayerConfigs,
    tokenAssignments: currentActiveTokenAssignments,
    updateLayerConfig,
    updateTokenAssignment,
  } = useVisualLayerState();

  const { savedReactions, updateSavedReaction, deleteSavedReaction } = useInteractionSettingsState();
  
  const { currentProfileAddress, isProfileOwner, canSave, isPreviewMode, isParentAdmin, isVisitor, canInteract } = useProfileSessionState();
  
  const { isInitiallyResolved, configLoadNonce, loadError, upInitializationError, upFetchStateError, configServiceRef, isLoading: isConfigLoading } = useConfigStatusState();

  const {
    loadNamedConfig,
    currentConfigName,
    stagedWorkspace,
    savedConfigList: presetNameList,
    loadedLayerConfigsFromPreset,
    loadedTokenAssignmentsFromPreset,
    setActivePresetSilently,
  } = usePresetManagementState();

  const rootRef = useRef(null);
  const canvasRef1 = useRef(null);
  const canvasRef2 = useRef(null);
  const canvasRef3 = useRef(null);
  const canvasRefs = useMemo(() => ({ "1": canvasRef1, "2": canvasRef2, "3": canvasRef3 }), []);

  const [localAnimatingPanel, setLocalAnimatingPanel] = useState(null);
  const [localIsBenignOverlayActive, setLocalIsBenignOverlayActive] = useState(false);
  const [animationLockForTokenOverlay, setAnimationLockForTokenOverlay] = useState(false);
  const animationLockTimerRef = useRef(null);

  const [crossfaderValue, setCrossfaderValue] = useState(0.0);
  const [sideA, setSideA] = useState({ index: 0, config: null });
  const [sideB, setSideB] = useState({ index: 1, config: null });
  const prevFaderValueRef = useRef(0.0);

  const fullPresetList = useMemo(() => {
    if (!stagedWorkspace?.presets) return [];

    const validPresets = Object.values(stagedWorkspace.presets).filter(
        (item) => item && typeof item.name === 'string'
    );

    return [...validPresets].sort((a, b) => {
        const numA = parseInt(a.name.split('.')[1] || 'NaN', 10);
        const numB = parseInt(b.name.split('.')[1] || 'NaN', 10);

        const valA = isNaN(numA) ? Infinity : numA;
        const valB = isNaN(numB) ? Infinity : numB;

        if (valA !== Infinity && valB !== Infinity) {
            return valA - valB;
        }
        if (valA !== Infinity) return -1;
        if (valB !== Infinity) return 1;

        return a.name.localeCompare(b.name);
    });
  }, [stagedWorkspace]);

  useEffect(() => {
    if (fullPresetList.length > 0 && isInitiallyResolved) {
        let startIndex = fullPresetList.findIndex(p => p.name === currentConfigName);
        if (startIndex === -1) startIndex = 0;
        
        const sideAIndex = startIndex;
        const sideBIndex = (startIndex + 1) % fullPresetList.length;

        setSideA({ index: sideAIndex, config: fullPresetList[sideAIndex] });
        setSideB({ index: sideBIndex, config: fullPresetList[sideBIndex] });
        setCrossfaderValue(0.0);
        prevFaderValueRef.current = 0.0;
    }
  }, [fullPresetList, isInitiallyResolved, configLoadNonce]);
  
  useEffect(() => {
    const prevValue = prevFaderValueRef.current;
    const newValue = crossfaderValue;

    if (newValue === 1.0 && prevValue < 1.0) {
      if (sideB.config?.name) {
        setActivePresetSilently(sideB.config.name);
      }
    } else if (newValue === 0.0 && prevValue > 0.0) {
      if (sideA.config?.name) {
        setActivePresetSilently(sideA.config.name);
      }
    }
    
    prevFaderValueRef.current = newValue;
  }, [crossfaderValue, sideA.config, sideB.config, setActivePresetSilently]);

  useEffect(() => {
    if (!fullPresetList || fullPresetList.length < 2) return;

    if (crossfaderValue === 1.0) {
      const nextAIndex = (sideB.index + 1) % fullPresetList.length;
      if (nextAIndex !== sideA.index) {
        setSideA({ index: nextAIndex, config: fullPresetList[nextAIndex] });
      }
    } else if (crossfaderValue === 0.0) {
      const nextBIndex = (sideA.index + 1) % fullPresetList.length;
      if (nextBIndex !== sideB.index) {
        setSideB({ index: nextBIndex, config: fullPresetList[nextBIndex] });
      }
    }
  }, [crossfaderValue, fullPresetList, sideA.index, sideB.index]);
  
  const handleCrossfaderChange = useCallback((newValue) => {
    setCrossfaderValue(newValue);
  }, []);


  const coreApp = useCoreApplicationStateAndLifecycle({
    canvasRefs, configServiceRef, configLoadNonce, currentActiveLayerConfigs,
    currentActiveTokenAssignments, loadedLayerConfigsFromPreset,
    loadedTokenAssignmentsFromPreset,
    loadError, upInitializationError, upFetchStateError, isConfigLoading,
    isInitiallyResolved, currentConfigName, currentProfileAddress,
    animatingPanel: localAnimatingPanel, isBenignOverlayActive: localIsBenignOverlayActive,
    animationLockForTokenOverlay,
    sideA,
    sideB,
    crossfaderValue,
    stagedWorkspace
  });

  const {
    containerRef, managerInstancesRef, audioState,
    renderState, loadingStatusMessage, isStatusFadingOut, showStatusDisplay,
    showRetryButton, isTransitioning, outgoingLayerIdsOnTransitionStart,
    makeIncomingCanvasVisible, handleManualRetry,
    managersReady, defaultImagesLoaded,
    setCanvasLayerImage,
    hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen,
    isMountedRef,
    sequencer, 
  } = coreApp;
  
  const handleTogglePLock = useCallback(() => {
    sequencer.toggle(currentActiveLayerConfigs);
  }, [sequencer, currentActiveLayerConfigs]);
  
  // --- START MODIFICATION: REMOVED THE FAULTY CONDITIONAL ---
  const handleUserLayerPropChange = useCallback((layerId, key, value, isMidiUpdate = false) => {
    const pLockIsPlaying = sequencer.pLockState === 'playing';
    const isParamLockedBySequencer = sequencer.animationDataRef.current?.[String(layerId)]?.[key];

    if (pLockIsPlaying && isParamLockedBySequencer) {
      return;
    }
    
    const manager = managerInstancesRef.current?.[String(layerId)];
    if (!manager) return;
    
    const targetDeck = crossfaderValue < 0.5 ? 'A' : 'B';

    if (targetDeck === 'A') {
      if (isMidiUpdate) {
        manager.setTargetValue(key, value);
      } else {
        manager.updateConfigProperty(key, value);
      }
    } else { // Target is Deck B
      if (isMidiUpdate) {
        manager.setTargetValueB(key, value);
      } else {
        manager.updateConfigBProperty(key, value);
      }
    }

    // REMOVED: The faulty `if (targetPresetName === activePresetNameInContext)` check.
    // The central state is now updated on every interaction, ensuring live edits are never lost.
    updateLayerConfig(String(layerId), key, value);

  }, [
    updateLayerConfig, 
    managerInstancesRef, 
    sequencer.pLockState, 
    sequencer.animationDataRef,
    crossfaderValue,
  ]);
  // --- END MODIFICATION ---

  const appInteractions = useAppInteractions({
    updateLayerConfig: handleUserLayerPropChange,
    currentProfileAddress, savedReactions,
    managerInstancesRef, setCanvasLayerImage, updateTokenAssignment,
    isMountedRef,
    onTogglePLock: handleTogglePLock,
  });

  const { uiStateHook } = appInteractions;

  useEffect(() => {
    setLocalAnimatingPanel(uiStateHook.animatingPanel);
    const newIsBenign = uiStateHook.animatingPanel === 'tokens' || uiStateHook.activePanel === 'tokens' || uiStateHook.infoOverlayOpen;
    setLocalIsBenignOverlayActive(newIsBenign);
  }, [ uiStateHook.animatingPanel, uiStateHook.activePanel, uiStateHook.infoOverlayOpen ]);

  useEffect(() => {
    if (localAnimatingPanel === 'tokens') {
      setAnimationLockForTokenOverlay(true);
      if (animationLockTimerRef.current) clearTimeout(animationLockTimerRef.current);
      animationLockTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setAnimationLockForTokenOverlay(false);
        animationLockTimerRef.current = null;
      }, TOKEN_OVERLAY_ANIMATION_LOCK_DURATION);
    } else if (animationLockForTokenOverlay && localAnimatingPanel !== 'tokens') {
      setAnimationLockForTokenOverlay(false);
      if (animationLockTimerRef.current) { clearTimeout(animationLockTimerRef.current); animationLockTimerRef.current = null; }
    }
    return () => { if (animationLockTimerRef.current) clearTimeout(animationLockTimerRef.current); };
  }, [localAnimatingPanel, animationLockForTokenOverlay, isMountedRef]);

  const criticalErrorContent = (
    <CriticalErrorDisplay initializationError={upInitializationError} fetchStateError={upFetchStateError} publicClient={publicClient} walletClient={walletClient} />
  );
  if (criticalErrorContent.props.initializationError || (criticalErrorContent.props.fetchStateError && !criticalErrorContent.props.publicClient && !criticalErrorContent.props.walletClient)) {
    return criticalErrorContent;
  }
  
  const showFpsCounter = useMemo(() => renderState === 'rendered' && isContainerObservedVisible, [renderState, isContainerObservedVisible]);

  const configDataForUIOverlay = useMemo(() => ({
    layerConfigs: currentActiveLayerConfigs, tokenAssignments: currentActiveTokenAssignments, savedReactions, currentConfigName,
    isConfigLoading, canSave, isPreviewMode, isParentAdmin, isProfileOwner, isVisitor, currentProfileAddress, blendModes,
    notifications: appInteractions.notificationData.notifications, unreadCount: appInteractions.notificationData.unreadCount,
    isTransitioning, isBaseReady: (managersReady && defaultImagesLoaded && isInitiallyResolved && hasValidDimensions && isContainerObservedVisible),
    renderState,
    canInteract,
    crossfader: {
      value: crossfaderValue,
      sideA: sideA,
      sideB: sideB,
    },
  }), [currentActiveLayerConfigs, currentActiveTokenAssignments, savedReactions, currentConfigName, isConfigLoading, canSave, isPreviewMode,
    isParentAdmin, isProfileOwner, isVisitor, currentProfileAddress, blendModes, appInteractions.notificationData.notifications,
    appInteractions.notificationData.unreadCount, isTransitioning, managersReady, defaultImagesLoaded, isInitiallyResolved,
    hasValidDimensions, isContainerObservedVisible, renderState, 
    canInteract,
    crossfaderValue, sideA, sideB]);
  
  const actionsForUIOverlay = useMemo(() => ({
    onLayerConfigChange: handleUserLayerPropChange, onSaveReaction: updateSavedReaction, onRemoveReaction: deleteSavedReaction,
    onPresetSelect: loadNamedConfig, onEnhancedView: enterFullscreen, onMarkNotificationRead: appInteractions.notificationData.markAsRead,
    onClearAllNotifications: appInteractions.notificationData.clearAll, onPreviewEffect: appInteractions.processEffect,
    onTokenApplied: appInteractions.handleTokenApplied, onCrossfaderChange: handleCrossfaderChange,
  }), [handleUserLayerPropChange, updateSavedReaction, deleteSavedReaction, loadNamedConfig, enterFullscreen,
    appInteractions.notificationData.markAsRead, appInteractions.notificationData.clearAll, appInteractions.processEffect,
    appInteractions.handleTokenApplied, handleCrossfaderChange]);

  const pLockProps = useMemo(() => ({
    pLockState: sequencer.pLockState,
    loopProgress: sequencer.loopProgress,
    hasLockedParams: sequencer.hasLockedParams,
    onTogglePLock: handleTogglePLock,
    pLockSpeed: sequencer.pLockSpeed,
    onSetPLockSpeed: sequencer.setPLockSpeed,
    animationDataRef: sequencer.animationDataRef,
  }), [sequencer, handleTogglePLock]);

  const displayConfigsForClassLogic = isTransitioning ? loadedLayerConfigsFromPreset : currentActiveLayerConfigs;
  const getCanvasClasses = (layerIdStr) => {
    let classes = `canvas layer-${layerIdStr}`;
    const isThisLayerOutgoing = isTransitioning && outgoingLayerIdsOnTransitionStart?.has(layerIdStr);
    const isThisLayerIncomingAndReady = isTransitioning && makeIncomingCanvasVisible && displayConfigsForClassLogic?.[layerIdStr]?.enabled;
    const isThisLayerStableAndVisible = !isTransitioning && renderState === 'rendered' && currentActiveLayerConfigs?.[layerIdStr]?.enabled;

    if (isThisLayerOutgoing) classes += ' is-fading-out';
    else if (isThisLayerIncomingAndReady || isThisLayerStableAndVisible) {
      classes += ' visible';
      if (isThisLayerIncomingAndReady) classes += ' is-fading-in';
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
          passedSavedConfigList={presetNameList}
          pLockProps={pLockProps}
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
          isAudioActive={audioState.isAudioActive}
          managersReady={managersReady}
          handleAudioDataUpdate={audioState.handleAudioDataUpdate}
          layerConfigs={currentActiveLayerConfigs}
          audioSettings={audioState.audioSettings}
          configLoadNonce={configLoadNonce}
          managerInstancesRef={managerInstancesRef}
        />
      </div>
    </>
  );
};
MainView.propTypes = { blendModes: PropTypes.arrayOf(PropTypes.string) };
export default MainView;