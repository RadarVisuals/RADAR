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
  useSetManagementState,
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
import { lerp } from '../../utils/helpers';
import { INTERPOLATED_MIDI_PARAMS } from '../../config/midiConstants';

// Styles
import "./MainviewStyles/Mainview.css";

// --- START: UTILITY HOOK ---
const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};
// --- END: UTILITY HOOK ---

const LoadingIndicatorPill = ({ message, isVisible }) => {
  return (
    <div className={`loading-indicator-pill ${isVisible ? 'visible' : ''}`}>
      <div className="loading-spinner"></div>
      <span className="loading-message">{message}</span>
    </div>
  );
};
LoadingIndicatorPill.propTypes = {
  message: PropTypes.string.isRequired,
  isVisible: PropTypes.bool.isRequired,
};

const portalContainerNode = typeof document !== 'undefined' ? document.getElementById('portal-container') : null;
const TOKEN_OVERLAY_ANIMATION_LOCK_DURATION = 500;
const AUTO_FADE_DURATION_MS = 1000;
const CROSSFADER_LERP_FACTOR = 0.2;

const MainView = ({ blendModes = BLEND_MODES }) => {
  const { publicClient, walletClient } = useUpProvider();
  const { liveCrossfaderValue, clearPendingActions } = useMIDI();

  const {
    updateLayerConfig,
    updateTokenAssignment,
  } = useVisualLayerState();

  const { savedReactions, updateSavedReaction, deleteSavedReaction } = useInteractionSettingsState();
  const { currentProfileAddress, isProfileOwner, canSave, isPreviewMode, isParentAdmin, isVisitor, canInteract } = useProfileSessionState();
  const { isInitiallyResolved, sceneLoadNonce, loadError, upInitializationError, upFetchStateError, configServiceRef, isLoading: isConfigLoading } = useConfigStatusState();
  const {
    activeSceneName,
    stagedActiveWorkspace,
    activeWorkspaceName,
    savedSceneList,
    loadedLayerConfigsFromScene,
    loadedTokenAssignmentsFromScene,
    setActiveSceneSilently,
    isFullyLoaded,
    loadingMessage,
    isWorkspaceTransitioning,
    _executeLoadAfterFade,
  } = useSetManagementState();

  const rootRef = useRef(null);
  const canvasRef1 = useRef(null);
  const canvasRef2 = useRef(null);
  const canvasRef3 = useRef(null);
  const canvasRefs = useMemo(() => ({ "1": canvasRef1, "2": canvasRef2, "3": canvasRef3 }), []);

  const [isParallaxEnabled, setIsParallaxEnabled] = useState(false);
  const toggleParallax = useCallback(() => setIsParallaxEnabled(prev => !prev), []);

  const [localAnimatingPanel, setLocalAnimatingPanel] = useState(null);
  const [localIsBenignOverlayActive, setLocalIsBenignOverlayActive] = useState(false);
  const [animationLockForTokenOverlay, setAnimationLockForTokenOverlay] = useState(false);
  const animationLockTimerRef = useRef(null);

  const [targetCrossfaderValue, setTargetCrossfaderValue] = useState(0.0);
  const [renderedCrossfaderValue, setRenderedCrossfaderValue] = useState(0.0);
  const renderedValueRef = useRef(0.0);
  const faderAnimationRef = useRef();

  const [sideA, setSideA] = useState({ config: null });
  const [sideB, setSideB] = useState({ config: null });
  const [uiControlConfig, setUiControlConfig] = useState(null);

  const prevFaderValueRef = useRef(0.0);
  const [isAutoFading, setIsAutoFading] = useState(false);
  const autoFadeRef = useRef(null);
  
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const parallaxRafIdRef = useRef(null);

  const prevSceneListLengthRef = useRef(savedSceneList.length);

  const fullSceneList = useMemo(() => {
    if (!stagedActiveWorkspace?.presets) return [];
    const validScenes = Object.values(stagedActiveWorkspace.presets).filter(
        (item) => item && typeof item.name === 'string'
    );
    return [...validScenes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [stagedActiveWorkspace]);

  useEffect(() => {
    let fadeOutTimer = null;
    if (isWorkspaceTransitioning) {
      fadeOutTimer = setTimeout(() => {
        if (typeof _executeLoadAfterFade === 'function') {
          _executeLoadAfterFade();
        }
      }, 500);
    }
    return () => {
      if (fadeOutTimer) {
        clearTimeout(fadeOutTimer);
      }
    };
  }, [isWorkspaceTransitioning, _executeLoadAfterFade]);

  useEffect(() => {
    if (liveCrossfaderValue !== null) {
      setTargetCrossfaderValue(liveCrossfaderValue);
      clearPendingActions();
    }
  }, [liveCrossfaderValue, clearPendingActions]);
  
  useEffect(() => {
    const animateFader = () => {
      const current = renderedValueRef.current;
      const target = targetCrossfaderValue;
      if (Math.abs(target - current) > 0.0001) {
        const newRendered = lerp(current, target, CROSSFADER_LERP_FACTOR);
        renderedValueRef.current = newRendered;
        setRenderedCrossfaderValue(newRendered);
      } else if (current !== target) {
        renderedValueRef.current = target;
        setRenderedCrossfaderValue(target);
      }
      faderAnimationRef.current = requestAnimationFrame(animateFader);
    };
    faderAnimationRef.current = requestAnimationFrame(animateFader);
    return () => { if (faderAnimationRef.current) cancelAnimationFrame(faderAnimationRef.current); };
  }, [targetCrossfaderValue]);

  useEffect(() => {
    const activeConfig = renderedCrossfaderValue < 0.5 ? sideA.config : sideB.config;
    setUiControlConfig(activeConfig);
  }, [renderedCrossfaderValue, sideA, sideB]);

  const animateCrossfade = useCallback((startTime, startValue, endValue, duration) => {
    const now = performance.now();
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const newCrossfaderValue = startValue + (endValue - startValue) * progress;
    setTargetCrossfaderValue(newCrossfaderValue);
    if (progress < 1) autoFadeRef.current = requestAnimationFrame(() => animateCrossfade(startTime, startValue, endValue, duration));
    else { setIsAutoFading(false); autoFadeRef.current = null; }
  }, [setIsAutoFading, setTargetCrossfaderValue]);

  // --- START: THE DEFINITIVE FIX FOR INITIAL LOAD & WORKSPACE SWITCHING ---
  const prevIsWorkspaceTransitioning = usePrevious(isWorkspaceTransitioning);
  const prevIsFullyLoaded = usePrevious(isFullyLoaded);

  useEffect(() => {
    const initialLoadJustFinished = !prevIsFullyLoaded && isFullyLoaded;
    const transitionJustFinished = prevIsWorkspaceTransitioning && !isWorkspaceTransitioning;

    if (initialLoadJustFinished || transitionJustFinished) {
      const reason = initialLoadJustFinished ? "Initial Load Finished" : `Workspace Transition Finished for "${activeWorkspaceName}"`;
      console.log(`[MainView] Resetting decks. Reason: ${reason}.`);
      
      if (!fullSceneList || fullSceneList.length === 0) {
        setSideA({ config: null });
        setSideB({ config: null });
        return;
      }
      
      const initialSceneName = stagedActiveWorkspace.defaultPresetName || fullSceneList[0]?.name;
      let startIndex = fullSceneList.findIndex(p => p.name === initialSceneName);
      if (startIndex === -1) startIndex = 0;
      
      const nextIndex = (startIndex + 1) % fullSceneList.length;
  
      const startSceneConfig = JSON.parse(JSON.stringify(fullSceneList[startIndex]));
      const nextSceneConfig = fullSceneList.length > 1
        ? JSON.parse(JSON.stringify(fullSceneList[nextIndex]))
        : JSON.parse(JSON.stringify(fullSceneList[startIndex]));
  
      // **THE FIX**: Check which side was active and load the new workspace onto that side.
      const activeSideIsA = renderedValueRef.current < 0.5;

      if (activeSideIsA) {
        setSideA({ config: startSceneConfig });
        setSideB({ config: nextSceneConfig });
        setTargetCrossfaderValue(0.0);
      } else {
        setSideB({ config: startSceneConfig });
        setSideA({ config: nextSceneConfig });
        setTargetCrossfaderValue(1.0);
      }
    }
  }, [isWorkspaceTransitioning, isFullyLoaded, stagedActiveWorkspace, activeWorkspaceName, fullSceneList]);
  // --- END: THE DEFINITIVE FIX ---

  useEffect(() => {
    if (!fullSceneList || fullSceneList.length < 2) return;

    const prevValue = prevFaderValueRef.current;
    const newValue = renderedCrossfaderValue;
    
    if (prevValue < 1.0 && newValue >= 0.999) {
      const sceneBInCurrentList = fullSceneList.some(p => p.ts === sideB.config?.ts);
      if (!sceneBInCurrentList) return;

      const currentBIndex = fullSceneList.findIndex(p => p.ts === sideB.config?.ts);
      if (currentBIndex !== -1) {
        const nextAIndex = (currentBIndex + 1) % fullSceneList.length;
        if (fullSceneList[nextAIndex]?.ts !== sideA.config?.ts) {
          setSideA({ config: JSON.parse(JSON.stringify(fullSceneList[nextAIndex])) });
        }
      }
    } 
    else if (prevValue > 0.0 && newValue <= 0.001) {
      const sceneAInCurrentList = fullSceneList.some(p => p.ts === sideA.config?.ts);
      if (!sceneAInCurrentList) return;

      const currentAIndex = fullSceneList.findIndex(p => p.ts === sideA.config?.ts);
      if (currentAIndex !== -1) {
        const nextBIndex = (currentAIndex + 1) % fullSceneList.length;
        if (fullSceneList[nextBIndex]?.ts !== sideB.config?.ts) {
          setSideB({ config: JSON.parse(JSON.stringify(fullSceneList[nextBIndex])) });
        }
      }
    }
    
    prevFaderValueRef.current = newValue;
  }, [renderedCrossfaderValue, fullSceneList, sideA, sideB]);

  useEffect(() => {
    if (!fullSceneList || fullSceneList.length === 0) return;
    const target = targetCrossfaderValue;
  
    if (target >= 0.999) {
      const sceneNameB = sideB.config?.name;
      if (sceneNameB && fullSceneList.some(s => s.name === sceneNameB)) {
        setActiveSceneSilently(sceneNameB);
      }
    } else if (target <= 0.001) {
      const sceneNameA = sideA.config?.name;
      if (sceneNameA && fullSceneList.some(s => s.name === sceneNameA)) {
        setActiveSceneSilently(sceneNameA);
      }
    }
  }, [targetCrossfaderValue, sideA.config, sideB.config, fullSceneList, setActiveSceneSilently]);

  const handleSceneSelect = useCallback((sceneName, duration = AUTO_FADE_DURATION_MS) => {
    if (isAutoFading || !fullSceneList || fullSceneList.length === 0) return;
    
    const targetScene = fullSceneList.find(s => s.name === sceneName);
    if (!targetScene) return;

    if (sideA.config?.name === sceneName || sideB.config?.name === sceneName) {
        const targetValue = sideA.config?.name === sceneName ? 0.0 : 1.0;
        if (Math.abs(targetCrossfaderValue - targetValue) < 0.001) return;
        setIsAutoFading(true);
        if (autoFadeRef.current) cancelAnimationFrame(autoFadeRef.current);
        animateCrossfade(performance.now(), targetCrossfaderValue, targetValue, duration);
        return;
    }

    const currentActiveSide = renderedCrossfaderValue < 0.5 ? 'A' : 'B';

    if (currentActiveSide === 'A') {
      setSideB({ config: JSON.parse(JSON.stringify(targetScene)) });
      setIsAutoFading(true);
      if (autoFadeRef.current) cancelAnimationFrame(autoFadeRef.current);
      animateCrossfade(performance.now(), targetCrossfaderValue, 1.0, duration);
    } else {
      setSideA({ config: JSON.parse(JSON.stringify(targetScene)) });
      setIsAutoFading(true);
      if (autoFadeRef.current) cancelAnimationFrame(autoFadeRef.current);
      animateCrossfade(performance.now(), targetCrossfaderValue, 0.0, duration);
    }
  }, [isAutoFading, fullSceneList, sideA.config, sideB.config, targetCrossfaderValue, renderedCrossfaderValue, animateCrossfade]);
  
  const handleInstantSceneSwitch = useCallback((sceneName) => {
    if (!fullSceneList || fullSceneList.length === 0) return;
    const targetScene = fullSceneList.find(s => s.name === sceneName);
    if (!targetScene) return;
  
    const activeSide = renderedCrossfaderValue < 0.5 ? 'A' : 'B';
  
    if (activeSide === 'A') {
      setSideA({ config: JSON.parse(JSON.stringify(targetScene)) });
      setTargetCrossfaderValue(0.0);
    } else {
      setSideB({ config: JSON.parse(JSON.stringify(targetScene)) });
      setTargetCrossfaderValue(1.0);
    }
  }, [fullSceneList, renderedCrossfaderValue]);

  useEffect(() => {
    const newListLength = savedSceneList.length;
    const prevListLength = prevSceneListLengthRef.current;

    if (newListLength === prevListLength + 1 && activeSceneName) {
      const isNewSceneOnDecks = sideA.config?.name === activeSceneName || sideB.config?.name === activeSceneName;
      
      if (!isNewSceneOnDecks) {
        handleInstantSceneSwitch(activeSceneName);
      }
    }
    
    prevSceneListLengthRef.current = newListLength;
  }, [savedSceneList, activeSceneName, handleInstantSceneSwitch, sideA.config, sideB.config]);
  
  const handleCrossfaderChange = useCallback((newValue) => {
    setTargetCrossfaderValue(newValue);
  }, []);

  const coreApp = useCoreApplicationStateAndLifecycle({
    canvasRefs, configServiceRef, sceneLoadNonce, 
    currentActiveLayerConfigs: uiControlConfig?.layers,
    currentActiveTokenAssignments: uiControlConfig?.tokenAssignments,
    loadedLayerConfigsFromScene,
    loadedTokenAssignmentsFromScene,
    loadError, upInitializationError, upFetchStateError, isConfigLoading,
    isInitiallyResolved, activeSceneName, currentProfileAddress,
    animatingPanel: localAnimatingPanel, isBenignOverlayActive: localIsBenignOverlayActive,
    animationLockForTokenOverlay,
    sideA, sideB, crossfaderValue: renderedCrossfaderValue, stagedActiveWorkspace,
    isFullyLoaded,
    activeWorkspaceName,
  });

  const {
    containerRef, managerInstancesRef, audioState,
    renderState, loadingStatusMessage: renderLifecycleMessage, isStatusFadingOut, showStatusDisplay,
    showRetryButton, isTransitioning, outgoingLayerIdsOnTransitionStart,
    makeIncomingCanvasVisible, 
    handleManualRetry,
    managersReady,
    setCanvasLayerImage,
    hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen,
    isMountedRef,
    sequencer, 
  } = coreApp;

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      mousePositionRef.current = { x, y };
    };
  
    const updateParallax = () => {
      if (managerInstancesRef.current) {
        const { x, y } = isParallaxEnabled ? mousePositionRef.current : { x: 0, y: 0 };
        
        Object.values(managerInstancesRef.current).forEach(manager => {
          if (manager?.setParallaxOffset) {
            manager.setParallaxOffset(x, y);
          }
        });
      }
      parallaxRafIdRef.current = requestAnimationFrame(updateParallax);
    };
  
    window.addEventListener('mousemove', handleMouseMove);
    parallaxRafIdRef.current = requestAnimationFrame(updateParallax);
  
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (parallaxRafIdRef.current) {
        cancelAnimationFrame(parallaxRafIdRef.current);
      }
    };
  }, [managerInstancesRef, isParallaxEnabled]);

  const handleTogglePLock = useCallback(() => { sequencer.toggle(uiControlConfig?.layers); }, [sequencer, uiControlConfig]);
  
  const handleUserLayerPropChange = useCallback((layerId, key, value, isMidiUpdate = false) => {
    const pLockIsPlaying = sequencer.pLockState === 'playing';
    const isParamLockedBySequencer = sequencer.animationDataRef.current?.[String(layerId)]?.[key];
    if (pLockIsPlaying && isParamLockedBySequencer) return;

    const manager = managerInstancesRef.current?.[String(layerId)];
    if (!manager) return;
    
    const activeDeck = renderedCrossfaderValue < 0.5 ? 'A' : 'B';

    if (isMidiUpdate && INTERPOLATED_MIDI_PARAMS.includes(key)) {
      if (activeDeck === 'A') {
        manager.setTargetValue(key, value);
      } else {
        manager.setTargetValueB(key, value);
      }
    } else {
      if (activeDeck === 'A') {
        manager.updateConfigProperty(key, value);
      } else {
        manager.updateConfigBProperty(key, value);
      }
    }
    
    const stateSetter = activeDeck === 'A' ? setSideA : setSideB;
    stateSetter(prev => {
      if (!prev.config) return prev;
      const newConfig = JSON.parse(JSON.stringify(prev.config));
      if (!newConfig.layers[layerId]) {
        newConfig.layers[layerId] = {};
      }
      newConfig.layers[layerId][key] = value;
      return { ...prev, config: newConfig };
    });
    
    updateLayerConfig(String(layerId), key, value);

  }, [updateLayerConfig, managerInstancesRef, sequencer.pLockState, sequencer.animationDataRef, renderedCrossfaderValue]);

  const handleTokenAssignmentChange = useCallback(async (token, layerId) => {
    if (!isMountedRef.current) return;
  
    const idToSave = token.id;
    const srcToLoad = token.metadata?.image;
    if (!idToSave || !srcToLoad) return;
  
    const assignmentObject = { id: idToSave, src: srcToLoad };
    
    const targetDeck = renderedCrossfaderValue < 0.5 ? 'A' : 'B';
    const stateSetter = targetDeck === 'A' ? setSideA : setSideB;

    stateSetter(prev => {
      if (!prev.config) return prev;
      const newConfig = JSON.parse(JSON.stringify(prev.config));
      if (!newConfig.tokenAssignments) newConfig.tokenAssignments = {};
      newConfig.tokenAssignments[String(layerId)] = assignmentObject;
      return { ...prev, config: newConfig };
    });

    if (typeof setCanvasLayerImage === 'function') {
      try {
        await setCanvasLayerImage(String(layerId), srcToLoad);
      } catch (e) {
        console.error(`[MainView] Error setting canvas image for layer ${layerId}:`, e);
      }
    }

    updateTokenAssignment(String(layerId), assignmentObject);
  }, [isMountedRef, setCanvasLayerImage, updateTokenAssignment, renderedCrossfaderValue]);


  const appInteractions = useAppInteractions({
    updateLayerConfig: handleUserLayerPropChange,
    currentProfileAddress, savedReactions,
    managerInstancesRef, setCanvasLayerImage, 
    updateTokenAssignment: handleTokenAssignmentChange,
    isMountedRef, onTogglePLock: handleTogglePLock,
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
    layerConfigs: uiControlConfig?.layers, 
    tokenAssignments: uiControlConfig?.tokenAssignments,
    savedReactions, activeSceneName,
    isConfigLoading, canSave, isPreviewMode, isParentAdmin, isProfileOwner, isVisitor, currentProfileAddress, blendModes,
    notifications: appInteractions.notificationData.notifications, unreadCount: appInteractions.notificationData.unreadCount,
    isTransitioning,
    renderState, canInteract, isAutoFading,
    crossfader: { value: renderedCrossfaderValue, sideA: sideA, sideB: sideB },
    isParallaxEnabled: isParallaxEnabled,
  }), [uiControlConfig, savedReactions, activeSceneName, isConfigLoading, canSave, isPreviewMode,
    isParentAdmin, isProfileOwner, isVisitor, currentProfileAddress, blendModes, appInteractions.notificationData.notifications,
    appInteractions.notificationData.unreadCount, isTransitioning, renderState, 
    canInteract, isAutoFading, renderedCrossfaderValue, sideA, sideB, isParallaxEnabled]);
  
  const actionsForUIOverlay = useMemo(() => ({
    onLayerConfigChange: handleUserLayerPropChange, onSaveReaction: updateSavedReaction, onRemoveReaction: deleteSavedReaction,
    onSceneSelect: handleSceneSelect, onEnhancedView: enterFullscreen, onMarkNotificationRead: appInteractions.notificationData.markAsRead,
    onClearAllNotifications: appInteractions.notificationData.clearAll, onPreviewEffect: appInteractions.processEffect,
    onTokenApplied: handleTokenAssignmentChange, 
    onCrossfaderChange: handleCrossfaderChange,
    onToggleParallax: toggleParallax,
  }), [handleUserLayerPropChange, updateSavedReaction, deleteSavedReaction, handleSceneSelect, enterFullscreen,
    appInteractions.notificationData.markAsRead, appInteractions.notificationData.clearAll, appInteractions.processEffect,
    handleTokenAssignmentChange, handleCrossfaderChange, toggleParallax]);

  const pLockProps = useMemo(() => ({
    pLockState: sequencer.pLockState, loopProgress: sequencer.loopProgress, hasLockedParams: sequencer.hasLockedParams,
    onTogglePLock: handleTogglePLock, pLockSpeed: sequencer.pLockSpeed, onSetPLockSpeed: sequencer.setPLockSpeed,
    animationDataRef: sequencer.animationDataRef,
  }), [sequencer, handleTogglePLock]);

  const getCanvasClasses = useCallback((layerIdStr) => {
    let classes = `canvas layer-${layerIdStr}`;
    const isOutgoing = isTransitioning && outgoingLayerIdsOnTransitionStart?.has(layerIdStr);
    const isStableAndVisible = !isTransitioning && renderState === 'rendered' && uiControlConfig?.layers?.[layerIdStr]?.enabled;
    const isIncomingAndReadyToFadeIn = isTransitioning && makeIncomingCanvasVisible && loadedLayerConfigsFromScene?.[layerIdStr]?.enabled;
    if (isOutgoing) classes += ' visible is-fading-out';
    else if (isStableAndVisible) classes += ' visible';
    else if (isIncomingAndReadyToFadeIn) classes += ' visible is-fading-in';
    return classes;
  }, [isTransitioning, outgoingLayerIdsOnTransitionStart, renderState, uiControlConfig, loadedLayerConfigsFromScene, makeIncomingCanvasVisible]);

  const canvas1Class = getCanvasClasses('1');
  const canvas2Class = getCanvasClasses('2');
  const canvas3Class = getCanvasClasses('3');
  const containerClass = `canvas-container ${isTransitioning ? 'transitioning-active' : ''} ${isWorkspaceTransitioning ? 'workspace-fading-out' : ''}`;
  
  const isUiReady = isFullyLoaded && renderState === 'rendered';
  const showLoadingIndicator = !isFullyLoaded || !!loadingMessage;

  return (
    <>
      <div id="fullscreen-root" ref={rootRef} className="main-view radar-cursor">
        <CanvasContainerWrapper
          containerRef={containerRef}
          canvasRef1={canvasRef1} canvasRef2={canvasRef2} canvasRef3={canvasRef3}
          containerClass={containerClass}
          canvas1Class={canvas1Class}
          canvas2Class={canvas2Class}
          canvas3Class={canvas3Class}
          pingColor={PING_COLOR}
          pingStrokeWidth={PING_STROKE_WIDTH}
          noPingSelectors={NO_PING_SELECTORS}
        />
        
        <LoadingIndicatorPill message={loadingMessage} isVisible={showLoadingIndicator} />

        <FpsDisplay showFpsCounter={showFpsCounter} isFullscreenActive={isFullscreenActive} portalContainer={portalContainerNode} />
        <ToastContainer />
        <UIOverlay
          uiState={uiStateHook}
          audioState={audioState}
          configData={configDataForUIOverlay}
          actions={actionsForUIOverlay}
          savedSceneList={savedSceneList}
          pLockProps={pLockProps}
          isReady={isUiReady}
        />
        <StatusIndicator
            showStatusDisplay={showStatusDisplay}
            isStatusFadingOut={isStatusFadingOut}
            renderState={renderState}
            loadingStatusMessage={renderLifecycleMessage}
            showRetryButton={showRetryButton}
            onManualRetry={handleManualRetry}
        />
        <AudioAnalyzerWrapper
          isAudioActive={audioState.isAudioActive}
          managersReady={managersReady}
          handleAudioDataUpdate={audioState.handleAudioDataUpdate}
          layerConfigs={uiControlConfig?.layers} 
          audioSettings={audioState.audioSettings}
          configLoadNonce={sceneLoadNonce}
          managerInstancesRef={managerInstancesRef}
        />
      </div>
    </>
  );
};
MainView.propTypes = { blendModes: PropTypes.arrayOf(PropTypes.string) };
export default MainView;