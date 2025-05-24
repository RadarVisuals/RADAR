// src/hooks/useCoreApplicationStateAndLifecycle.js
import { useRef, useEffect, useCallback, useMemo } from "react";
import { useCanvasOrchestrator } from "./useCanvasOrchestrator";
import { useRenderLifecycle } from './useRenderLifecycle';
import { useCanvasContainer } from './useCanvasContainer';
import { useAudioVisualizer } from './useAudioVisualizer';
import { useAnimationLifecycleManager } from './useAnimationLifecycleManager';

/**
 * @typedef {import('../services/ConfigService').default} ConfigService
 * @typedef {import('../utils/CanvasManager').default} CanvasManager // Corrected path if CanvasManager is in utils
 * @typedef {import('./useAudioVisualizer').AudioVisualizerAPI} AudioVisualizerState // Assuming useAudioVisualizer returns an object matching this type
 * @typedef {import('../context/VisualConfigContext').AllLayerConfigs} LayerConfigsType // Placeholder, assuming defined in VisualConfigContext or a types file
 * @typedef {import('../context/VisualConfigContext').TokenAssignments} TokenAssignmentsType // Placeholder, assuming defined or imported
 */

/**
 * @typedef {object} UseCoreApplicationStateAndLifecycleProps
 * @property {{ "1": React.RefObject<HTMLCanvasElement>, "2": React.RefObject<HTMLCanvasElement>, "3": React.RefObject<HTMLCanvasElement> }} canvasRefs - Refs to the HTML canvas elements for each layer.
 * @property {React.RefObject<ConfigService | null>} configServiceRef - Ref to the ConfigurationService instance.
 * @property {number} configLoadNonce - A nonce that changes when a new global configuration (preset) is loaded.
 * @property {LayerConfigsType} currentActiveLayerConfigs - The currently active layer configurations from `VisualConfigContext`.
 * @property {TokenAssignmentsType} currentActiveTokenAssignments - The currently active token assignments from `VisualConfigContext`.
 * @property {LayerConfigsType | null} loadedLayerConfigsFromPreset - Layer configurations loaded from the most recent preset (via `PresetManagementContext`).
 * @property {TokenAssignmentsType | null} loadedTokenAssignmentsFromPreset - Token assignments loaded from the most recent preset (via `PresetManagementContext`).
 * @property {Error | string | null} loadError - Error object or message from preset loading.
 * @property {Error | null} upInitializationError - Error from `UpProvider` initialization.
 * @property {Error | null} upFetchStateError - Error from `UpProvider` client fetching.
 * @property {boolean} isConfigLoading - Indicates if a configuration preset is currently being loaded.
 * @property {boolean} isInitiallyResolved - Indicates if the initial configuration (preset or fallback) has been resolved.
 * @property {string | null} currentConfigName - The name of the currently loaded configuration preset.
 * @property {string | null} currentProfileAddress - The address of the current Universal Profile being viewed.
 * @property {boolean} isBenignOverlayActive - Flag indicating if a non-blocking overlay (e.g., toasts) is active.
 * @property {string | null} animatingPanel - Identifier of any UI panel currently undergoing an open/close animation.
 * @property {boolean} animationLockForTokenOverlay - Flag to temporarily lock animation state changes during token overlay transitions.
 */

/**
 * @typedef {object} CoreApplicationStateAndLifecycle
 * @property {React.RefObject<HTMLDivElement>} containerRef - Ref to the main canvas container element.
 * @property {React.RefObject<{[key: string]: CanvasManager}>} managerInstancesRef - Ref to the initialized CanvasManager instances.
 * @property {AudioVisualizerState} audioState - State and functions related to audio visualization, from `useAudioVisualizer`.
 * @property {string} renderState - The current state of the rendering lifecycle (e.g., 'initializing', 'rendered', 'error').
 * @property {string} loadingStatusMessage - A message indicating the current loading or status.
 * @property {boolean} isStatusFadingOut - True if the status message display is currently fading out.
 * @property {boolean} showStatusDisplay - True if the loading/status display should be visible.
 * @property {boolean} showRetryButton - True if a retry button should be shown (typically in a recoverable error state).
 * @property {boolean} isTransitioning - True if a preset transition (fade-out/fade-in) is currently active.
 * @property {Set<string> | null} outgoingLayerIdsOnTransitionStart - A set of layer IDs that were active when a transition started.
 * @property {boolean} makeIncomingCanvasVisible - A flag to signal when incoming canvases (for a new preset) should become visible.
 * @property {boolean} isAnimating - True if canvas animations are considered to be (or should be) running.
 * @property {() => void} handleManualRetry - Function to attempt a manual retry from an error state.
 * @property {() => void} resetLifecycle - Function to reset the entire render lifecycle to its initial state.
 * @property {boolean} managersReady - True if all expected CanvasManager instances are initialized and ready.
 * @property {boolean} defaultImagesLoaded - True if the initial default images for all layers have been successfully loaded.
 * @property {() => void} stopCanvasAnimations - Function to stop animations on all managed canvases.
 * @property {() => void} restartCanvasAnimations - Function to restart animations on all managed canvases.
 * @property {(configs: LayerConfigsType) => void} applyConfigurationsToManagers - Applies full layer configurations to all canvas managers. (Note: `useCanvasOrchestrator`'s version might be async if it involves image loading based on config, but the one passed to `useRenderLifecycle` is often synchronous for config application itself).
 * @property {(assignments: TokenAssignmentsType) => Promise<void>} applyTokenAssignmentsToManagers - Resolves and applies token/image assignments to canvas layers.
 * @property {(configs?: LayerConfigsType | null) => Promise<boolean>} redrawAllCanvases - Forces a redraw on all canvases, optionally applying new configurations.
 * @property {(layerId: string, src: string) => Promise<void>} setCanvasLayerImage - Sets an image for a specific canvas layer directly.
 * @property {boolean} hasValidDimensions - Indicates if the canvas container currently has valid (non-zero) width and height.
 * @property {boolean} isContainerObservedVisible - Indicates if the container is currently considered visible within the viewport.
 * @property {boolean} isFullscreenActive - Indicates if the browser is currently in fullscreen mode.
 * @property {() => void} enterFullscreen - Function to attempt to toggle fullscreen mode.
 * @property {React.RefObject<boolean>} isMountedRef - Ref indicating if the component consuming this hook (or this hook itself) is mounted.
 */

/**
 * `useCoreApplicationStateAndLifecycle` is a custom React hook designed to consolidate and manage
 * the primary operational state and lifecycle logic for the RADAR application's core visual and interactive elements.
 * It achieves this by internally initializing and orchestrating several other specialized hooks:
 *
 * - `useCanvasOrchestrator`: Manages the creation, image loading, and configuration application for individual canvas layers.
 * - `useAudioVisualizer`: Handles audio input, analysis, and provides data for audio-reactive visuals.
 * - `useCanvasContainer`: Observes the main canvas container for resize events, viewport visibility, and manages fullscreen state.
 * - `useRenderLifecycle`: Implements a state machine to control the overall rendering process, including initial loading, preset transitions, and error states.
 * - `useAnimationLifecycleManager`: Decides when canvas animations should start or stop based on various application states (visibility, UI interactions, transitions).
 *
 * This hook acts as a central hub, taking numerous pieces of application-wide state (like current configurations,
 * preset loading status, and UI interaction flags) as input props. It then wires these inputs and the outputs of
 * its internal hooks together to create a cohesive operational flow.
 *
 * **Key Responsibilities:**
 * 1.  **Initialization:** Sets up the core visual and audio processing systems.
 * 2.  **State Aggregation:** Collects and exposes essential state variables (e.g., `renderState`, `isAnimating`, `managersReady`) required by the main application view (`MainView.jsx`) for rendering its UI and orchestrating high-level behaviors.
 * 3.  **Lifecycle Management:**
 *     - Manages an `isMountedRef` to track component mount status, crucial for preventing state updates on unmounted components within async operations or timeouts.
 *     - Exposes a `resetLifecycle` function (from `useRenderLifecycle`) to allow the application to revert to an initial state, for instance, upon profile changes or critical errors.
 *     - Integrates `useAnimationLifecycleManager` to intelligently pause or resume canvas animations, optimizing performance and visual correctness.
 * 4.  **Callback Provision:** Defines and provides stable callbacks (e.g., for handling zero-dimension errors from `useCanvasContainer`) to its internal hooks.
 * 5.  **Memoization:** The entire object returned by this hook is memoized using `React.useMemo`. This is critical for performance, ensuring that consuming components (like `MainView.jsx`) only re-render when the actual data or function references they depend on have changed, rather than on every render of this hook.
 *
 * **Props (`UseCoreApplicationStateAndLifecycleProps`):**
 * This hook accepts a comprehensive set of props that represent the current global state of the application, including:
 * - Canvas element references (`canvasRefs`).
 * - Configuration service reference (`configServiceRef`).
 * - State related to preset loading and current configurations (`configLoadNonce`, `currentActiveLayerConfigs`, etc.).
 * - Error states from various parts of the application (`loadError`, `upInitializationError`).
 * - Flags indicating UI states that might affect animations (`isBenignOverlayActive`, `animatingPanel`).
 *
 * **Returns (`CoreApplicationStateAndLifecycle`):**
 * It returns a single, memoized object containing:
 * - Refs to important elements (`containerRef`, `managerInstancesRef`, `isMountedRef`).
 * - Aggregated state from its internal hooks (e.g., `audioState`, `renderState`, `isAnimating`).
 * - Key functions for controlling the application's core lifecycle and visuals (e.g., `handleManualRetry`, `resetLifecycle`, `stopCanvasAnimations`, `applyConfigurationsToManagers`, `enterFullscreen`).
 *
 * By centralizing this complex orchestration, `useCoreApplicationStateAndLifecycle` simplifies the `MainView` component, making it more focused on rendering and delegating complex state interactions.
 *
 * @param {UseCoreApplicationStateAndLifecycleProps} props - The properties required to initialize and manage the core application state and lifecycle.
 * @returns {CoreApplicationStateAndLifecycle} A memoized object containing the consolidated state and control functions.
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

  const isMountedRef = useRef(false);
  const internalResetLifecycleRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const {
    managersReady, defaultImagesLoaded, managerInstancesRef,
    applyConfigurationsToManagers, applyTokenAssignmentsToManagers,
    stopCanvasAnimations, restartCanvasAnimations,
    redrawAllCanvases, handleCanvasResize, setCanvasLayerImage,
  } = useCanvasOrchestrator({ configServiceRef, canvasRefs, configLoadNonce });

  const audioState = useAudioVisualizer();

  const handleZeroDimensionsOrchestrator = useCallback(() => {
    if (isMountedRef.current && internalResetLifecycleRef.current && typeof internalResetLifecycleRef.current === 'function') {
      if (import.meta.env.DEV) console.log("[CoreAppLifecycle] Zero dimensions detected, triggering lifecycle reset.");
      internalResetLifecycleRef.current();
    }
  }, []); // isMountedRef and internalResetLifecycleRef are stable refs

  const onResizeCanvasContainer = useCallback(() => {
    if (isMountedRef.current && typeof handleCanvasResize === 'function') {
      handleCanvasResize();
    }
  }, [handleCanvasResize]); // handleCanvasResize from useCanvasOrchestrator should be stable

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
  }, [resetLifecycle]); // resetLifecycle from useRenderLifecycle should be stable

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
  }), [
    containerRef, managerInstancesRef, audioState, renderState, loadingStatusMessage,
    isStatusFadingOut, showStatusDisplay, showRetryButton, isTransitioning,
    outgoingLayerIdsOnTransitionStart, makeIncomingCanvasVisible, isAnimating,
    handleManualRetry, resetLifecycle, managersReady, defaultImagesLoaded,
    stopCanvasAnimations, restartCanvasAnimations, applyConfigurationsToManagers,
    applyTokenAssignmentsToManagers, redrawAllCanvases, setCanvasLayerImage,
    hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen,
    isMountedRef
  ]);
};