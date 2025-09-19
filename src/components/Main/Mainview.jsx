// src/components/Main/Mainview.jsx
import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";

// Custom Hooks
import { useUpProvider } from "../../context/UpProvider";
import { useCoreApplicationStateAndLifecycle } from '../../hooks/useCoreApplicationStateAndLifecycle';
import { useAppInteractions } from '../../hooks/useAppInteractions';
import { useProfileSessionState } from "../../hooks/configSelectors";
import { useAppContext } from "../../context/AppContext";

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

const MainView = ({ blendModes = BLEND_MODES }) => {
  const { publicClient, walletClient } = useUpProvider();

  const {
    currentProfileAddress,
    isInitiallyResolved,
    sceneLoadNonce,
    loadError,
    upInitializationError,
    upFetchStateError,
    configServiceRef,
    isLoading: isConfigLoading,
    activeSceneName,
    activeWorkspaceName,
    stagedActiveWorkspace,
    savedSceneList,
    loadedLayerConfigsFromScene,
    loadedTokenAssignmentsFromScene,
    isFullyLoaded,
    loadingMessage,
    isWorkspaceTransitioning,
    _executeLoadAfterFade, // <<< GET THE FUNCTION FROM CONTEXT
    sideA,
    sideB,
    renderedCrossfaderValue,
    uiControlConfig,
    isAutoFading,
    registerManagerInstancesRef,
    registerCanvasUpdateFns,
    updateLayerConfig, 
    updateTokenAssignment, 
  } = useAppContext();
  
  const { canInteract } = useProfileSessionState();

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
  
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const parallaxRafIdRef = useRef(null);

  // --- THIS IS THE FIX ---
  useEffect(() => {
    let fadeOutTimer = null;
    if (isWorkspaceTransitioning) {
      // This timeout should match your CSS fade-out duration for the canvas container
      fadeOutTimer = setTimeout(() => {
        // After the visual transition, call the function to actually load the data
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
  // --- END FIX ---

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

  const appInteractions = useAppInteractions({
    updateLayerConfig: updateLayerConfig,
    currentProfileAddress,
    managerInstancesRef, setCanvasLayerImage, 
    updateTokenAssignment: updateTokenAssignment,
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

  const actionsForUIOverlay = useMemo(() => ({
    onEnhancedView: enterFullscreen,
    onToggleParallax: toggleParallax,
    onTokenApplied: updateTokenAssignment, 
    onPreviewEffect: appInteractions.processEffect,
  }), [enterFullscreen, toggleParallax, updateTokenAssignment, appInteractions.processEffect]);

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
          savedSceneList={savedSceneList}
          pLockProps={pLockProps}
          isReady={isUiReady}
          actions={actionsForUIOverlay}
          onLayerConfigChange={updateLayerConfig}
          configData={{ 
            isAutoFading, 
            isTransitioning,
            isConfigLoading,
            isParallaxEnabled,
            unreadCount: appInteractions.notificationData.unreadCount,
            renderState,
            crossfader: { value: renderedCrossfaderValue }, 
            uiControlConfig,
          }}
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