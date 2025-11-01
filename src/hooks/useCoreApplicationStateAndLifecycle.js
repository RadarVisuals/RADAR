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
    isLoading,
  } = useWorkspaceContext();

  const {
    sideA,
    sideB,
    renderedCrossfaderValue,
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

  // --- START OF FIX: The master gate for the entire rendering pipeline ---
  // The lifecycle hooks should only run after the initial workspace load is complete and not in a loading state.
  const isReadyForLifecycle = isFullyLoaded && !isLoading;
  // --- END OF FIX ---

  const orchestrator = useCanvasOrchestrator({
    canvasRefs,
    sideA,
    sideB,
    crossfaderValue: renderedCrossfaderValue,
    isInitiallyResolved: isReadyForLifecycle,
    activeWorkspaceName,
  });

  const sequencer = usePLockSequencer({
    onValueUpdate: (layerId, paramName, value) => {
      updateLayerConfig(String(layerId), paramName, value); 
      if (orchestrator.applyPlaybackValue) {
        orchestrator.applyPlaybackValue(String(layerId), paramName, value);
      }
    },
    onAnimationEnd: (finalStateSnapshot) => {
      if (orchestrator.clearAllPlaybackValues) {
        orchestrator.clearAllPlaybackValues();
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
    if (isMountedRef.current && typeof orchestrator.handleCanvasResize === 'function') {
      orchestrator.handleCanvasResize();
    }
  }, [orchestrator.handleCanvasResize]);

  const { containerRef, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen } = useCanvasContainer({
    onResize: onResizeCanvasContainer,
    onZeroDimensions: handleZeroDimensionsOrchestrator,
  });

  const renderLifecycleData = useRenderLifecycle({
    managersReady: orchestrator.managersReady,
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

  // --- START OF FIX: Return a default 'not ready' state if the lifecycle gate is closed ---
  return useMemo(() => {
    // If we are not ready for the lifecycle, return a default "not ready" state.
    if (!isReadyForLifecycle) {
      return {
        containerRef, managersReady: false, audioState, renderState: 'initializing',
        loadingStatusMessage: '', isStatusFadingOut: false, showStatusDisplay: false,
        showRetryButton: false, isTransitioning: false, outgoingLayerIdsOnTransitionStart: new Set(),
        makeIncomingCanvasVisible: false, isAnimating: false, handleManualRetry: () => {},
        resetLifecycle: () => {}, stopCanvasAnimations: () => {}, restartCanvasAnimations: () => {},
        setCanvasLayerImage: () => {}, hasValidDimensions: false, isContainerObservedVisible: true,
        isFullscreenActive: false, enterFullscreen: () => {}, isMountedRef, sequencer,
        uiControlConfig: null, managerInstancesRef: { current: null },
      };
    }

    // If ready, return the fully computed state.
    return {
      containerRef,
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
      managersReady: orchestrator.managersReady,
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
    isReadyForLifecycle, // The master gate
    containerRef, orchestrator, audioState, renderLifecycleData, hasValidDimensions,
    isContainerObservedVisible, isFullscreenActive, enterFullscreen,
    isMountedRef, sequencer, uiControlConfig
  ]);
  // --- END OF FIX ---
};