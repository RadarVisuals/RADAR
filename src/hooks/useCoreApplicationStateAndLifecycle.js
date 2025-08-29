// src/hooks/useCoreApplicationStateAndLifecycle.js
import { useRef, useEffect, useCallback, useMemo } from "react";
import { useCanvasOrchestrator } from "./useCanvasOrchestrator";
import { useRenderLifecycle } from './useRenderLifecycle';
import { useCanvasContainer } from './useCanvasContainer';
import { useAudioVisualizer } from './useAudioVisualizer';
import { useAnimationLifecycleManager } from './useAnimationLifecycleManager';
import { usePLockSequencer } from './usePLockSequencer';
import { useVisualConfig } from '../context/VisualConfigContext';

/**
 * @typedef {import('../services/ConfigService').default} ConfigService
 * @typedef {import('../utils/CanvasManager').default} CanvasManager
 * @typedef {import('./useAudioVisualizer').AudioVisualizerAPI} AudioVisualizerState
 * @typedef {import('../context/VisualConfigContext').AllLayerConfigs} LayerConfigsType
 * @typedef {import('../context/VisualConfig_types').TokenAssignments} TokenAssignmentsType
 */

/**
 * @typedef {object} UseCoreApplicationStateAndLifecycleProps
 * @property {{ "1": React.RefObject<HTMLCanvasElement>, "2": React.RefObject<HTMLCanvasElement>, "3": React.RefObject<HTMLCanvasElement> }} canvasRefs
 * @property {React.RefObject<ConfigService | null>} configServiceRef
 * @property {number} configLoadNonce
 * @property {LayerConfigsType} currentActiveLayerConfigs
 * @property {TokenAssignmentsType} currentActiveTokenAssignments
 * @property {LayerConfigsType | null} loadedLayerConfigsFromPreset
 * @property {TokenAssignmentsType | null} loadedTokenAssignmentsFromPreset
 * @property {Error | string | null} loadError
 * @property {Error | null} upInitializationError
 * @property {Error | null} upFetchStateError
 * @property {boolean} isConfigLoading
 * @property {boolean} isInitiallyResolved
 * @property {string | null} currentConfigName
 * @property {string | null} currentProfileAddress
 * @property {boolean} isBenignOverlayActive
 * @property {string | null} animatingPanel
 * @property {boolean} animationLockForTokenOverlay
 */

/**
 * @typedef {object} CoreApplicationStateAndLifecycle
 * @property {React.RefObject<HTMLDivElement>} containerRef
 * @property {React.RefObject<{[key: string]: CanvasManager}>} managerInstancesRef
 * @property {AudioVisualizerState} audioState
 * @property {string} renderState
 * @property {string} loadingStatusMessage
 * @property {boolean} isStatusFadingOut
 * @property {boolean} showStatusDisplay
 * @property {boolean} showRetryButton
 * @property {boolean} isTransitioning
 * @property {Set<string> | null} outgoingLayerIdsOnTransitionStart
 * @property {boolean} makeIncomingCanvasVisible
 * @property {boolean} isAnimating
 * @property {() => void} handleManualRetry
 * @property {() => void} resetLifecycle
 * @property {boolean} managersReady
 * @property {boolean} defaultImagesLoaded
 * @property {() => void} stopCanvasAnimations
 * @property {() => void} restartCanvasAnimations
 * @property {(configs: LayerConfigsType) => void} applyConfigurationsToManagers
 * @property {(assignments: TokenAssignmentsType) => Promise<void>} applyTokenAssignmentsToManagers
 * @property {(configs?: LayerConfigsType | null) => Promise<boolean>} redrawAllCanvases
 * @property {(layerId: string, src: string) => Promise<void>} setCanvasLayerImage
 * @property {boolean} hasValidDimensions
 * @property {boolean} isContainerObservedVisible
 * @property {boolean} isFullscreenActive
 * @property {() => void} enterFullscreen
 * @property {React.RefObject<boolean>} isMountedRef
 * @property {object} sequencer
 */

/**
 * Consolidates and manages the primary operational state and lifecycle logic
 * for the application's core visual and interactive elements.
 * @param {UseCoreApplicationStateAndLifecycleProps} props
 * @returns {CoreApplicationStateAndLifecycle}
 */
export const useCoreApplicationStateAndLifecycle = (props) => {
  const {
    canvasRefs,
    configServiceRef,
    configLoadNonce,
    currentActiveLayerConfigs,
    currentActiveTokenAssignments,
    loadedLayerConfigsFromPreset,
    loadedTokenAssignmentsFromPreset,
    loadError,
    upInitializationError,
    upFetchStateError,
    isConfigLoading,
    isInitiallyResolved,
    currentConfigName,
    currentProfileAddress,
    isBenignOverlayActive,
    animatingPanel,
    animationLockForTokenOverlay,
  } = props;

  const { updateLayerConfig } = useVisualConfig();
  const isMountedRef = useRef(false);
  const internalResetLifecycleRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // --- START: MODIFIED SEQUENCER WIRING ---
  const {
    managersReady, defaultImagesLoaded, managerInstancesRef,
    applyConfigurationsToManagers, applyTokenAssignmentsToManagers,
    stopCanvasAnimations, restartCanvasAnimations,
    redrawAllCanvases, handleCanvasResize, setCanvasLayerImage,
    applyPlaybackValue, clearAllPlaybackValues // <-- Get new functions from orchestrator
  } = useCanvasOrchestrator({
    configServiceRef, canvasRefs, configLoadNonce, isInitiallyResolved,
    pLockState: null // pLockState is from sequencer, so we pass null initially
  });

  const sequencer = usePLockSequencer({
    onValueUpdate: (layerId, paramName, value) => {
      // Still update React state for UI display
      updateLayerConfig(String(layerId), paramName, value); 
      // Use the new dedicated method to apply playback values to the manager
      if (applyPlaybackValue) {
        applyPlaybackValue(String(layerId), paramName, value);
      }
    },
    onAnimationEnd: (finalStateSnapshot) => {
      // When animation ends, clear all playback overrides
      if (clearAllPlaybackValues) {
        clearAllPlaybackValues();
      }
      // And snap the final state to the main config
      if (finalStateSnapshot) {
        for (const layerId in finalStateSnapshot) {
          for (const paramName in finalStateSnapshot[layerId]) {
            updateLayerConfig(layerId, paramName, finalStateSnapshot[layerId][paramName]);
          }
        }
      }
    }
  });
  // --- END: MODIFIED SEQUENCER WIRING ---

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
    animationLockForTokenOverlay,
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
    defaultImagesLoaded,
    stopCanvasAnimations,
    restartCanvasAnimations,
    applyConfigurationsToManagers,
    applyTokenAssignmentsToManagers,
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
    handleManualRetry, resetLifecycle, managersReady, defaultImagesLoaded,
    stopCanvasAnimations, restartCanvasAnimations, applyConfigurationsToManagers,
    applyTokenAssignmentsToManagers, redrawAllCanvases, setCanvasLayerImage,
    hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen,
    isMountedRef, sequencer
  ]);
};