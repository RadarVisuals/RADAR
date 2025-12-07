// src/hooks/useCoreApplicationStateAndLifecycle.js
import { useRef, useEffect, useCallback, useMemo } from "react";
import { usePixiOrchestrator } from "./usePixiOrchestrator"; 
import { useRenderLifecycle } from './useRenderLifecycle';
import { useCanvasContainer } from './useCanvasContainer';
import { useAudioVisualizer } from './useAudioVisualizer';
import { useAnimationLifecycleManager } from './useAnimationLifecycleManager';
import { usePLockSequencer } from './usePLockSequencer';
import { useVisualEngineContext } from '../context/VisualEngineContext';
import { useUpProvider } from '../context/UpProvider';
import { useProjectStore } from '../store/useProjectStore'; // New Import
import { useWalletStore } from '../store/useWalletStore'; // New Import

export const useCoreApplicationStateAndLifecycle = (props) => {
  const {
    isBenignOverlayActive,
    animatingPanel,
  } = props;

  // --- REFACTOR: Use Store ---
  const isInitiallyResolved = useProjectStore(s => !!s.setlist);
  const loadError = useProjectStore(s => s.error);
  const isFullyLoaded = useProjectStore(s => !s.isLoading && !!s.activeWorkspaceName);
  const isLoading = useProjectStore(s => s.isLoading);
  // --- END REFACTOR ---

  const {
    sideA,
    sideB,
    renderedCrossfaderValue,
    uiControlConfig,
    updateLayerConfig,
    transitionMode, 
  } = useVisualEngineContext();

  const { upInitializationError, upFetchStateError } = useUpProvider();
  
  // --- REFACTOR: Use Store ---
  const currentProfileAddress = useWalletStore(s => s.hostProfileAddress);
  // --- END REFACTOR ---

  const isMountedRef = useRef(false);
  const internalResetLifecycleRef = useRef(null);
  const canvasRef = useRef(null); 

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isReadyForLifecycle = isFullyLoaded && !isLoading;

  const orchestrator = usePixiOrchestrator({
    canvasRef,
    sideA,
    sideB,
    crossfaderValue: renderedCrossfaderValue,
    isReady: isReadyForLifecycle,
    transitionMode, 
  });

  const sequencer = usePLockSequencer({
    onValueUpdate: (layerId, paramName, value) => {
      updateLayerConfig(String(layerId), paramName, value, false, true); 
      
      if (orchestrator.isEngineReady && orchestrator.applyPlaybackValue) {
        orchestrator.applyPlaybackValue(String(layerId), paramName, value);
      }
    },
    onAnimationEnd: (finalStateSnapshot) => {
      if (orchestrator.isEngineReady && orchestrator.clearPlaybackValues) {
        orchestrator.clearPlaybackValues();
      }
      if (finalStateSnapshot) {
        for (const layerId in finalStateSnapshot) {
          for (const paramName in finalStateSnapshot[layerId]) {
            updateLayerConfig(layerId, paramName, finalStateSnapshot[layerId][paramName]);
          }
        }
      }
    }
  });

  const audioState = useAudioVisualizer();

  const handleZeroDimensionsOrchestrator = useCallback(() => {
    if (isMountedRef.current && internalResetLifecycleRef.current) {
      internalResetLifecycleRef.current();
    }
  }, []);

  const onResizeCanvasContainer = useCallback(() => {}, []);

  const { containerRef, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen } = useCanvasContainer({
    onResize: onResizeCanvasContainer,
    onZeroDimensions: handleZeroDimensionsOrchestrator,
  });

  const renderLifecycleData = useRenderLifecycle({
    managersReady: orchestrator.isEngineReady,
    isInitiallyResolved: isReadyForLifecycle,
    hasValidDimensions,
    isContainerObservedVisible,
    configLoadNonce: 0,
    currentProfileAddress,
    layerConfigs: uiControlConfig?.layers,
    targetLayerConfigsForPreset: null,
    targetTokenAssignmentsForPreset: null,
    loadError,
    upInitializationError,
    upFetchStateError,
    stopAllAnimations: orchestrator.stopCanvasAnimations,
    restartCanvasAnimations: orchestrator.restartCanvasAnimations,
    isFullyLoaded: isReadyForLifecycle,
  });

  useEffect(() => {
    internalResetLifecycleRef.current = renderLifecycleData.resetLifecycle;
  }, [renderLifecycleData.resetLifecycle]);

  useAnimationLifecycleManager({
    isMounted: isMountedRef.current,
    renderState: renderLifecycleData.renderState,
    isContainerObservedVisible,
    isBenignOverlayActive,
    animatingPanel,
    isAnimating: renderLifecycleData.isAnimating,
    isTransitioning: renderLifecycleData.isTransitioning,
    restartCanvasAnimations: orchestrator.restartCanvasAnimations,
    stopCanvasAnimations: orchestrator.stopCanvasAnimations,
  });

  return useMemo(() => {
    if (!isReadyForLifecycle) {
      return {
        containerRef, pixiCanvasRef: canvasRef,
        managersReady: false, audioState, renderState: 'initializing',
        loadingStatusMessage: '', isStatusFadingOut: false, showStatusDisplay: false,
        showRetryButton: false, isTransitioning: false, outgoingLayerIdsOnTransitionStart: new Set(),
        makeIncomingCanvasVisible: false, isAnimating: false, handleManualRetry: () => {},
        resetLifecycle: () => {}, stopCanvasAnimations: () => {}, restartCanvasAnimations: () => {},
        setCanvasLayerImage: () => {}, hasValidDimensions: false, isContainerObservedVisible: true,
        isFullscreenActive: false, enterFullscreen: () => {}, isMountedRef, sequencer,
        uiControlConfig: null, managerInstancesRef: { current: null },
      };
    }

    return {
      containerRef,
      pixiCanvasRef: canvasRef,
      managerInstancesRef: orchestrator.managerInstancesRef,
      audioState,
      renderState: renderLifecycleData.renderState,
      loadingStatusMessage: renderLifecycleData.loadingStatusMessage,
      isStatusFadingOut: renderLifecycleData.isStatusFadingOut,
      showStatusDisplay: renderLifecycleData.showStatusDisplay,
      showRetryButton: renderLifecycleData.showRetryButton,
      isTransitioning: renderLifecycleData.isTransitioning,
      outgoingLayerIdsOnTransitionStart: renderLifecycleData.outgoingLayerIdsOnTransitionStart,
      makeIncomingCanvasVisible: renderLifecycleData.makeIncomingCanvasVisible,
      isAnimating: renderLifecycleData.isAnimating,
      handleManualRetry: renderLifecycleData.handleManualRetry,
      resetLifecycle: renderLifecycleData.resetLifecycle,
      managersReady: orchestrator.isEngineReady,
      stopCanvasAnimations: orchestrator.stopCanvasAnimations,
      restartCanvasAnimations: orchestrator.restartCanvasAnimations,
      setCanvasLayerImage: orchestrator.setCanvasLayerImage,
      hasValidDimensions,
      isContainerObservedVisible,
      isFullscreenActive,
      enterFullscreen,
      isMountedRef,
      sequencer,
      uiControlConfig,
    };
  }, [
    isReadyForLifecycle,
    containerRef, orchestrator, audioState, renderLifecycleData, hasValidDimensions,
    isContainerObservedVisible, isFullscreenActive, enterFullscreen,
    isMountedRef, sequencer, uiControlConfig
  ]);
};