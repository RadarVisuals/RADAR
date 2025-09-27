// src/hooks/useCoreApplicationStateAndLifecycle.js
import { useRef, useEffect, useCallback, useMemo } from "react";
import { useCanvasOrchestrator } from "./useCanvasOrchestrator";
import { useRenderLifecycle } from './useRenderLifecycle';
import { useCanvasContainer } from './useCanvasContainer';
import { useAudioVisualizer } from './useAudioVisualizer';
import { useAnimationLifecycleManager } from './useAnimationLifecycleManager';
import { usePLockSequencer } from './usePLockSequencer';
import { useWorkspaceContext } from '../context/WorkspaceContext';
import { useVisualEngineContext } from '../context/VisualEngineContext';
import { useUpProvider } from '../context/UpProvider';
import { useUserSession } from '../context/UserSessionContext';

export const useCoreApplicationStateAndLifecycle = (props) => {
  const {
    canvasRefs,
    isBenignOverlayActive,
    animatingPanel,
  } = props;

  const {
    isInitiallyResolved,
    loadError,
    activeWorkspaceName,
    isFullyLoaded,
  } = useWorkspaceContext();

  const {
    sideA,
    sideB,
    renderedCrossfaderValue, // Use the rendered value for the orchestrator
    uiControlConfig,
    updateLayerConfig,
  } = useVisualEngineContext();

  const { upInitializationError, upFetchStateError } = useUpProvider();
  const { hostProfileAddress: currentProfileAddress } = useUserSession();

  const isMountedRef = useRef(false);
  const internalResetLifecycleRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // --- FIX: Rely directly on sideA, sideB, and the renderedCrossfaderValue ---
  const {
    managersReady, managerInstancesRef,
    stopCanvasAnimations, restartCanvasAnimations,
    setCanvasLayerImage,
    applyPlaybackValue, clearAllPlaybackValues,
    handleCanvasResize,
  } = useCanvasOrchestrator({
    canvasRefs,
    sideA,
    sideB,
    crossfaderValue: renderedCrossfaderValue,
    isInitiallyResolved,
    activeWorkspaceName,
  });
  // --- END FIX ---

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
    configLoadNonce: 0,
    currentProfileAddress,
    layerConfigs: uiControlConfig?.layers,
    targetLayerConfigsForPreset: null,
    targetTokenAssignmentsForPreset: null,
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
    setCanvasLayerImage,
    hasValidDimensions,
    isContainerObservedVisible,
    isFullscreenActive,
    enterFullscreen,
    isMountedRef,
    sequencer,
    uiControlConfig,
  }), [
    containerRef, managerInstancesRef, audioState, renderState, loadingStatusMessage,
    isStatusFadingOut, showStatusDisplay, showRetryButton, isTransitioning,
    outgoingLayerIdsOnTransitionStart, makeIncomingCanvasVisible, isAnimating,
    handleManualRetry,
    resetLifecycle, managersReady,
    stopCanvasAnimations, restartCanvasAnimations, setCanvasLayerImage,
    hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen,
    isMountedRef, sequencer, uiControlConfig
  ]);
};