// src/hooks/useCoreApplicationStateAndLifecycle.js
import { useRef, useEffect, useCallback, useMemo } from "react";
import { useCanvasOrchestrator } from "./useCanvasOrchestrator";
import { useRenderLifecycle } from './useRenderLifecycle';
import { useCanvasContainer } from './useCanvasContainer';
import { useAudioVisualizer } from './useAudioVisualizer';
import { useAnimationLifecycleManager } from './useAnimationLifecycleManager';
import { usePLockSequencer } from './usePLockSequencer';
import { useAppContext } from '../context/AppContext';

export const useCoreApplicationStateAndLifecycle = (props) => {
  const {
    canvasRefs,
    configLoadNonce,
    currentActiveLayerConfigs,
    currentActiveTokenAssignments,
    loadedLayerConfigsFromScene,
    loadedTokenAssignmentsFromScene, // Correctly receive this prop
    loadError,
    upInitializationError,
    upFetchStateError,
    isInitiallyResolved,
    activeSceneName,
    currentProfileAddress,
    isBenignOverlayActive,
    animatingPanel,
    sideA,
    sideB,
    crossfaderValue,
    isFullyLoaded, 
    activeWorkspaceName, // <-- ADD THIS LINE
  } = props;

  const { updateLayerConfig, setLiveConfig } = useAppContext();
  const isMountedRef = useRef(false);
  const internalResetLifecycleRef = useRef(null);
  const lastProcessedNonceRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const {
    managersReady, managerInstancesRef,
    stopCanvasAnimations, restartCanvasAnimations,
    redrawAllCanvases, handleCanvasResize, setCanvasLayerImage,
    applyPlaybackValue, clearAllPlaybackValues,
    transitionToScene,
  } = useCanvasOrchestrator({
    canvasRefs,
    sideA,
    sideB,
    crossfaderValue,
    isInitiallyResolved,
    currentActiveLayerConfigs,
    currentActiveTokenAssignments,
    activeWorkspaceName, // <-- PASS IT DOWN
  });

  const sequencer = usePLockSequencer({
    onValueUpdate: (layerId, paramName, value) => {
      updateLayerConfig(String(layerId), paramName, value); 
      if (applyPlaybackValue) {
        applyPlaybackValue(String(layerId), paramName, value);
      }
    },
    onAnimationEnd: (finalStateSnapshot) => {
      if (clearAllPlaybackValues) {
        clearAllPlaybackValues();
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
    if (isMountedRef.current && internalResetLifecycleRef.current && typeof internalResetLifecycleRef.current === 'function') {
      if (import.meta.env.DEV) console.log("[CoreAppLifecycle] Zero dimensions detected, triggering lifecycle reset.");
      internalResetLifecycleRef.current();
    }
  }, []);

  const onResizeCanvasContainer = useCallback(() => {
    if (isMountedRef.current && typeof handleCanvasResize === 'function') {
      handleCanvasResize();
    }
  }, [handleCanvasResize]);

  const { containerRef, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen } = useCanvasContainer({
    onResize: onResizeCanvasContainer,
    onZeroDimensions: handleZeroDimensionsOrchestrator,
  });

  const renderLifecycleData = useRenderLifecycle({
    managersReady,
    isInitiallyResolved,
    hasValidDimensions,
    isContainerObservedVisible,
    configLoadNonce,
    currentProfileAddress,
    layerConfigs: currentActiveLayerConfigs,
    targetLayerConfigsForPreset: loadedLayerConfigsFromScene, // Pass down layers
    targetTokenAssignmentsForPreset: loadedTokenAssignmentsFromScene, // Pass down tokens
    loadError,
    upInitializationError,
    upFetchStateError,
    stopAllAnimations: stopCanvasAnimations,
    restartCanvasAnimations: restartCanvasAnimations,
    isFullyLoaded, 
  });
  const {
    renderState, loadingStatusMessage, isStatusFadingOut, showStatusDisplay,
    showRetryButton, isTransitioning,
    outgoingLayerIdsOnTransitionStart,
    makeIncomingCanvasVisible,
    isAnimating, handleManualRetry, resetLifecycle
  } = renderLifecycleData;

  useEffect(() => {
    internalResetLifecycleRef.current = resetLifecycle;
  }, [resetLifecycle]);

  useEffect(() => {
    if (isTransitioning && configLoadNonce > lastProcessedNonceRef.current) {
      const targetSceneConfig = {
        layers: loadedLayerConfigsFromScene,
        tokenAssignments: loadedTokenAssignmentsFromScene, // Use correct variable
      };
      if (transitionToScene && targetSceneConfig.layers && targetSceneConfig.tokenAssignments) {
        transitionToScene(targetSceneConfig);
        lastProcessedNonceRef.current = configLoadNonce;
      }
    }
  }, [isTransitioning, configLoadNonce, loadedLayerConfigsFromScene, loadedTokenAssignmentsFromScene, transitionToScene]);

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
  });

  return useMemo(() => ({
    containerRef,
    managerInstancesRef,
    audioState,
    renderState,
    loadingStatusMessage,
    isStatusFadingOut,
    showStatusDisplay,
    showRetryButton,
    isTransitioning,
    outgoingLayerIdsOnTransitionStart,
    makeIncomingCanvasVisible,
    isAnimating,
    handleManualRetry,
    resetLifecycle,
    managersReady,
    stopCanvasAnimations,
    restartCanvasAnimations,
    redrawAllCanvases,
    setCanvasLayerImage,
    hasValidDimensions,
    isContainerObservedVisible,
    isFullscreenActive,
    enterFullscreen,
    isMountedRef,
    sequencer,
  }), [
    containerRef, managerInstancesRef, audioState, renderState, loadingStatusMessage,
    isStatusFadingOut, showStatusDisplay, showRetryButton, isTransitioning,
    outgoingLayerIdsOnTransitionStart, makeIncomingCanvasVisible, isAnimating,
    handleManualRetry,
    resetLifecycle, managersReady,
    stopCanvasAnimations, restartCanvasAnimations, redrawAllCanvases, setCanvasLayerImage,
    hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen,
    isMountedRef, sequencer
  ]);
};