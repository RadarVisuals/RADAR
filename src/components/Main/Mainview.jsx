// src/components/Main/Mainview.jsx
import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";

import { useUpProvider } from "../../context/UpProvider.jsx";
import { useCoreApplicationStateAndLifecycle } from '../../hooks/useCoreApplicationStateAndLifecycle';
import { useAppInteractions } from '../../hooks/useAppInteractions';
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useVisualEngineContext } from "../../context/VisualEngineContext";

import ToastContainer from "../Notifications/ToastContainer";
import UIOverlay from '../UI/UIOverlay';
import PixiCanvasWrapper from '../MainViewParts/PixiCanvasWrapper';
import FpsDisplay from '../MainViewParts/FpsDisplay';
import StatusIndicator from '../MainViewParts/StatusIndicator';
import AudioAnalyzerWrapper from '../MainViewParts/AudioAnalyzerWrapper';
import CriticalErrorDisplay from '../MainViewParts/CriticalErrorDisplay';

import { BLEND_MODES } from "../../config/global-config";
import { PING_COLOR, PING_STROKE_WIDTH, NO_PING_SELECTORS } from "../../config/uiConstants";

import "./MainviewStyles/Mainview.css";

const DEFAULT_CROSSFADE_DURATION = 1000;

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

const MainView = ({ blendModes = BLEND_MODES }) => {
  const { publicClient, walletClient, upInitializationError, upFetchStateError } = useUpProvider();

  const {
    isWorkspaceTransitioning,
    _executeLoadAfterFade,
    loadingMessage,
    stagedSetlist,
    loadWorkspace,
    activeWorkspaceName,
    fullSceneList, 
    activeSceneName, 
  } = useWorkspaceContext();

  const {
    registerManagerInstancesRef,
    registerCanvasUpdateFns,
    uiControlConfig,
    handleSceneSelect, 
  } = useVisualEngineContext();
  
  const rootRef = useRef(null);
  
  const [isParallaxEnabled, setIsParallaxEnabled] = useState(false);
  const toggleParallax = useCallback(() => setIsParallaxEnabled(prev => !prev), []);
  const [crossfadeDurationMs, setCrossfadeDurationMs] = useState(DEFAULT_CROSSFADE_DURATION);

  const [localAnimatingPanel, setLocalAnimatingPanel] = useState(null);
  const [localIsBenignOverlayActive, setLocalIsBenignOverlayActive] = useState(false);
  
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const parallaxRafIdRef = useRef(null);

  useEffect(() => {
    let fadeOutTimer = null;
    if (isWorkspaceTransitioning) {
      fadeOutTimer = setTimeout(() => {
        if (_executeLoadAfterFade) {
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

  const coreApp = useCoreApplicationStateAndLifecycle({
    canvasRefs: {}, 
    animatingPanel: localAnimatingPanel, 
    isBenignOverlayActive: localIsBenignOverlayActive,
  });

  const {
    containerRef, 
    pixiCanvasRef,
    managerInstancesRef, audioState,
    renderState, loadingStatusMessage: renderLifecycleMessage, isStatusFadingOut, showStatusDisplay,
    showRetryButton, isTransitioning,
    handleManualRetry,
    managersReady,
    setCanvasLayerImage,
    isContainerObservedVisible, isFullscreenActive, enterFullscreen,
    isMountedRef,
    sequencer, 
  } = coreApp;

  useEffect(() => {
    if (registerManagerInstancesRef) {
        registerManagerInstancesRef(managerInstancesRef);
    }
    if (registerCanvasUpdateFns) {
        registerCanvasUpdateFns({ setCanvasLayerImage });
    }
  }, [registerManagerInstancesRef, registerCanvasUpdateFns, managerInstancesRef, setCanvasLayerImage]);


  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      mousePositionRef.current = { x, y };
    };
  
    const updateParallax = () => {
      if (managerInstancesRef.current) {
        const { x, y } = isParallaxEnabled ? mousePositionRef.current : { x: 0, y: 0 };
        if (managerInstancesRef.current['1'] && managerInstancesRef.current['1'].setParallax) {
             managerInstancesRef.current['1'].setParallax(x, y);
        }
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

  const workspaceList = useMemo(() => {
    if (!stagedSetlist?.workspaces) return [];
    return Object.keys(stagedSetlist.workspaces)
      .map(name => ({ name }));
  }, [stagedSetlist]);

  const handleNextScene = useCallback(() => {
    if (!fullSceneList || fullSceneList.length < 2) return;
    const currentIndex = fullSceneList.findIndex(p => p.name === activeSceneName);
    const nextIndex = (currentIndex + 1) % fullSceneList.length;
    const nextScene = fullSceneList[nextIndex];
    if (nextScene?.name) {
      handleSceneSelect(nextScene.name, crossfadeDurationMs);
    }
  }, [fullSceneList, activeSceneName, handleSceneSelect, crossfadeDurationMs]);

  const handlePrevScene = useCallback(() => {
    if (!fullSceneList || fullSceneList.length < 2) return;
    const currentIndex = fullSceneList.findIndex(p => p.name === activeSceneName);
    const prevIndex = (currentIndex - 1 + fullSceneList.length) % fullSceneList.length;
    const prevScene = fullSceneList[prevIndex];
    if (prevScene?.name) {
      handleSceneSelect(prevScene.name, crossfadeDurationMs);
    }
  }, [fullSceneList, activeSceneName, handleSceneSelect, crossfadeDurationMs]);

  const handleNextWorkspace = useCallback(() => {
    if (!workspaceList || workspaceList.length < 2) return;
    const currentIndex = workspaceList.findIndex(w => w.name === activeWorkspaceName);
    const nextIndex = (currentIndex + 1) % workspaceList.length;
    const nextWorkspace = workspaceList[nextIndex];
    if (nextWorkspace?.name) {
        loadWorkspace(nextWorkspace.name);
    }
  }, [workspaceList, activeWorkspaceName, loadWorkspace]);

  const handlePrevWorkspace = useCallback(() => {
      if (!workspaceList || workspaceList.length < 2) return;
      const currentIndex = workspaceList.findIndex(w => w.name === activeWorkspaceName);
      const prevIndex = (currentIndex - 1 + workspaceList.length) % workspaceList.length;
      const prevWorkspace = workspaceList[prevIndex];
      if (prevWorkspace?.name) {
          loadWorkspace(prevWorkspace.name);
      }
  }, [workspaceList, activeWorkspaceName, loadWorkspace]);

  const appInteractions = useAppInteractions({
    managerInstancesRef, 
    isMountedRef, 
    onTogglePLock: handleTogglePLock,
    onNextScene: handleNextScene,
    onPrevScene: handlePrevScene,
    onNextWorkspace: handleNextWorkspace,
    onPrevWorkspace: handlePrevWorkspace,
  });

  const { uiStateHook } = appInteractions;

  useEffect(() => {
    setLocalAnimatingPanel(uiStateHook.animatingPanel);
    const newIsBenign = uiStateHook.animatingPanel === 'tokens' || uiStateHook.activePanel === 'tokens' || uiStateHook.infoOverlayOpen;
    setLocalIsBenignOverlayActive(newIsBenign);
  }, [ uiStateHook.animatingPanel, uiStateHook.activePanel, uiStateHook.infoOverlayOpen ]);

  const criticalErrorContent = (
    <CriticalErrorDisplay initializationError={upInitializationError} fetchStateError={upFetchStateError} publicClient={publicClient} walletClient={walletClient} />
  );
  if (criticalErrorContent.props.initializationError || (criticalErrorContent.props.fetchStateError && !criticalErrorContent.props.publicClient && !criticalErrorContent.props.walletClient)) {
    return criticalErrorContent;
  }
  
  const showFpsCounter = useMemo(() => renderState === 'rendered' && isContainerObservedVisible, [renderState, isContainerObservedVisible]);

  const actionsForUIOverlay = useMemo(() => ({
    onEnhancedView: enterFullscreen,
    onToggleParallax: toggleParallax,
    onPreviewEffect: appInteractions.processEffect,
  }), [enterFullscreen, toggleParallax, appInteractions.processEffect]);

  const pLockProps = useMemo(() => ({
    pLockState: sequencer.pLockState, loopProgress: sequencer.loopProgress, hasLockedParams: sequencer.hasLockedParams,
    onTogglePLock: handleTogglePLock, pLockSpeed: sequencer.pLockSpeed, onSetPLockSpeed: sequencer.setPLockSpeed,
    animationDataRef: sequencer.animationDataRef,
  }), [sequencer, handleTogglePLock]);

  const containerClass = `canvas-container ${isTransitioning ? 'transitioning-active' : ''} ${isWorkspaceTransitioning ? 'workspace-fading-out' : ''}`;
  
  const isReadyToRender = renderState === 'rendered';
  const showLoadingIndicator = !!loadingMessage;

  return (
    <>
      <div id="fullscreen-root" ref={rootRef} className="main-view radar-cursor">
        
        <LoadingIndicatorPill message={loadingMessage} isVisible={showLoadingIndicator} />

        <PixiCanvasWrapper
          containerRef={containerRef}
          canvasRef={pixiCanvasRef}
          containerClass={containerClass}
          pingColor={PING_COLOR}
          pingStrokeWidth={PING_STROKE_WIDTH}
          noPingSelectors={NO_PING_SELECTORS}
        />

        {isReadyToRender && (
          <>
            <FpsDisplay showFpsCounter={showFpsCounter} isFullscreenActive={isFullscreenActive} portalContainer={portalContainerNode} />
            <ToastContainer />
            <UIOverlay
              uiState={uiStateHook}
              audioState={audioState}
              pLockProps={pLockProps}
              isReady={isReadyToRender}
              actions={actionsForUIOverlay}
              configData={{ 
                isParallaxEnabled,
                renderState,
              }}
              crossfadeDurationMs={crossfadeDurationMs}
              onSetCrossfadeDuration={setCrossfadeDurationMs}
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
              configLoadNonce={0}
              managerInstancesRef={managerInstancesRef}
            />
          </>
        )}
      </div>
    </>
  );
};
MainView.propTypes = { blendModes: PropTypes.arrayOf(PropTypes.string) };
export default MainView;