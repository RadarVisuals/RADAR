// src/hooks/useRenderLifecycle.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// Constants for timing and display messages
const LOADING_FADE_DURATION = 600;
const CANVAS_FADE_DURATION = 1000; // Duration for canvas fade in/out
const FORCE_REPAINT_DELAY = 50; // Small delay before redraw after config apply
const ANIMATION_CONTINUE_DURING_TRANSITION = true; // Configurable: Keep animations running during fade transitions
// const IDLE_MESSAGE = "Connect Universal Profile or load a preset."; // No longer needed
const CONNECTING_MESSAGE = "Connecting...";
const LOADING_MESSAGE = "Loading preset...";
const APPLYING_MESSAGE = "Applying configuration...";
const RENDERING_MESSAGE = "Rendering visuals..."; // Currently unused but kept for potential future use
const TRANSITION_MESSAGE = "Transitioning...";
// const PROMPT_CONNECT_MESSAGE = "Please connect your Universal Profile via the parent application."; // No longer needed

/**
 * @typedef {'initializing' | 'waiting_layout' | 'applying_config' | 'drawing' | 'rendered' | 'error'} RenderState - Possible states of the rendering lifecycle. Removed 'prompt_connect'.
 */

/**
 * @typedef RenderLifecycleOptions Options for the useRenderLifecycle hook.
 * @property {boolean} managersReady - Whether the canvas managers are initialized.
 * @property {boolean} defaultImagesLoaded - Whether the default layer images have been loaded.
 * @property {boolean} isInitiallyResolved - Whether the initial configuration (default or named) has been resolved (loaded or confirmed not present).
 * @property {boolean} hasValidDimensions - Whether the canvas container has valid non-zero dimensions.
 * @property {boolean} isContainerObservedVisible - Whether the canvas container is currently visible in the viewport.
 * @property {number} configLoadNonce - A number that increments each time a new configuration is successfully loaded or applied.
 * @property {string|null} currentConfigName - The name of the currently loaded configuration preset.
 * @property {string|null} currentProfileAddress - The address of the profile being viewed.
 * @property {object} layerConfigs - The current configuration object for all layers.
 * @property {object} tokenAssignments - The current token assignments for all layers.
 * @property {Error|null} loadError - An error object if the last configuration load failed.
 * @property {Error|null} upInitializationError - An error from the UpProvider initialization.
 * @property {Error|null} upFetchStateError - An error from the UpProvider state fetching.
 * @property {() => void} stopAllAnimations - Function to stop canvas animations.
 * @property {(configs: object) => void} applyConfigurationsToManagers - Function to apply visual configurations to canvas managers.
 * @property {(assignments: object) => Promise<void>} applyTokenAssignments - Function to apply token assignments (resolving images) to canvas managers.
 * @property {(configs?: object | null) => Promise<boolean>} redrawAllCanvases - Function to force a redraw on all canvases, optionally with specific configs.
 * @property {() => void} restartCanvasAnimations - Function to restart canvas animations.
 */

/**
 * @typedef RenderLifecycleAPI The interface returned by the useRenderLifecycle hook.
 * @property {RenderState} renderState - The current state of the rendering lifecycle.
 * @property {string} loadingStatusMessage - A user-facing message indicating the current loading/rendering status.
 * @property {boolean} isStatusFadingOut - Whether the status message is currently fading out.
 * @property {boolean} showStatusDisplay - Derived state indicating if the status display element should be visible.
 * @property {boolean} showRetryButton - Derived state indicating if a retry button should be shown (for recoverable errors).
 * @property {boolean} isTransitioning - Whether the visualizer is currently fading between configuration states.
 * @property {boolean} isCanvasVisible - Whether the canvas elements themselves should be visible (handles fade-in/out).
 * @property {boolean} isAnimating - Whether the canvas animations are currently considered active.
 * @property {() => void} handleManualRetry - Function to attempt recovery from a recoverable error state.
 * @property {() => void} resetLifecycle - Function to force the lifecycle back to the 'initializing' state.
 */

export function useRenderLifecycle(options) {
  const {
    managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
    isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress,
    layerConfigs, tokenAssignments, loadError, upInitializationError, upFetchStateError,
    stopAllAnimations, applyConfigurationsToManagers,
    applyTokenAssignments,
    redrawAllCanvases,
    restartCanvasAnimations,
  } = options;

  const [renderState, setRenderStateInternal] = useState('initializing');
  const [loadingStatusMessage, setLoadingStatusMessageState] = useState(CONNECTING_MESSAGE);
  const [isStatusFadingOut, setIsStatusFadingOut] = useState(false);
  const [isTransitioningInternal, setIsTransitioningInternal] = useState(false);
  const [isCanvasVisibleInternal, setIsCanvasVisibleInternal] = useState(false);
  const isMountedRef = useRef(false);
  const lastAppliedNonceRef = useRef(0);
  const statusDisplayFadeTimeoutRef = useRef(null);
  const transitionEndTimeoutRef = useRef(null);
  const fadeOutTimeoutRef = useRef(null);
  const repaintDelayTimeoutRef = useRef(null);
  const applyConfigPromiseRef = useRef(null);
  const animationStateRef = useRef('stopped');
  const stateEntryTimeRef = useRef(Date.now());

  const latestLayerConfigsRef = useRef(layerConfigs);
  const latestTokenAssignmentsRef = useRef(tokenAssignments);

  useEffect(() => {
    latestLayerConfigsRef.current = layerConfigs;
  }, [layerConfigs]);

  useEffect(() => {
    latestTokenAssignmentsRef.current = tokenAssignments;
  }, [tokenAssignments]);


  const logStateChange = useCallback((newState, reason) => {
    setRenderStateInternal(prevState => {
      if (prevState !== newState) {
        console.log(`%c[RenderLifecycle] State CHANGE: ${prevState} -> ${newState} (Reason: ${reason})`, 'color: blue; font-weight: bold;');
        return newState;
      }
      return prevState;
    });
  }, []);

  const logAction = useCallback((actionName, details = '') => {
    console.log(`%c[RenderLifecycle] Action: ${actionName}`, 'color: purple;', details);
  }, []);

  const logCheck = useCallback((currentState, conditions) => {
     console.log(`%c[RenderLifecycle] State Check (${currentState}):`, 'color: #888;', JSON.parse(JSON.stringify(conditions || {})));
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    logAction("Component Mounted");
    return () => {
      logAction("Component Unmounting - Cleaning up timers");
      isMountedRef.current = false;
      if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
      if (fadeOutTimeoutRef.current) clearTimeout(fadeOutTimeoutRef.current);
      if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current);
      applyConfigPromiseRef.current = null;
    };
  }, [logAction]);

  useEffect(() => {
    stateEntryTimeRef.current = Date.now();
  }, [renderState]);

  const setLoadingStatusMessage = useCallback((message) => {
    if (isMountedRef.current) {
      setLoadingStatusMessageState(prev => {
          if (prev !== message) {
              logAction("Set Status Message", message);
              return message;
          }
          return prev;
      });
    }
  }, [logAction]);

  const handleManualRetry = useCallback(() => {
    if (!isMountedRef.current || renderState !== 'error') return;
    logAction(`Manual Retry Triggered.`);
    if (hasValidDimensions) {
      logAction(`Manual Retry: Dimensions valid -> 'applying_config'.`);
      logStateChange('applying_config', 'Manual Retry (Valid Dim)');
    } else {
      logAction(`Manual Retry: No valid dimensions.`);
      setLoadingStatusMessage("⚠ Still waiting for layout.");
    }
  }, [renderState, hasValidDimensions, setLoadingStatusMessage, logAction, logStateChange]);

  const resetLifecycle = useCallback(() => {
      if (!isMountedRef.current) return;
      logAction(`!!! Resetting Lifecycle Triggered !!!`);
      try { throw new Error("Reset Trace"); } catch (e) { console.warn(e.stack); }

      animationStateRef.current = 'pending_stop';
      logStateChange("initializing", "External Reset");
      setLoadingStatusMessage(CONNECTING_MESSAGE);
      setIsStatusFadingOut(false);
      lastAppliedNonceRef.current = 0;
      setIsTransitioningInternal(false);
      setIsCanvasVisibleInternal(false);
      applyConfigPromiseRef.current = null;

      setTimeout(() => {
        if (isMountedRef.current && animationStateRef.current === 'pending_stop') {
          logAction(`Executing delayed animation stop after reset`);
          if (stopAllAnimations) stopAllAnimations(); else console.error("stopAllAnimations function is missing in resetLifecycle!");
          animationStateRef.current = 'stopped';
        }
      }, CANVAS_FADE_DURATION);

      if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
      if (fadeOutTimeoutRef.current) clearTimeout(fadeOutTimeoutRef.current);
      if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current);
      statusDisplayFadeTimeoutRef.current = null;
      transitionEndTimeoutRef.current = null;
      fadeOutTimeoutRef.current = null;
      repaintDelayTimeoutRef.current = null;
  }, [stopAllAnimations, setLoadingStatusMessage, logAction, logStateChange]);

  useEffect(() => {
    const criticalError = upInitializationError || upFetchStateError || (loadError && !isInitiallyResolved);
    if (criticalError) {
      const errorSource = upInitializationError ? 'UP Init Error' : upFetchStateError ? 'UP Fetch Error' : 'Initial Load Error';
      logAction(`Critical Error Detected: ${errorSource}: ${criticalError.message}`);
      setLoadingStatusMessage(`⚠ Critical Error: ${criticalError.message}`);
      logStateChange('error', errorSource);
      animationStateRef.current = 'stopped';
    }
  }, [upInitializationError, upFetchStateError, loadError, isInitiallyResolved, setLoadingStatusMessage, logAction, logStateChange]);

  // Main state machine logic
  useEffect(() => {
    const currentState = renderState;
    logCheck(currentState, {
      managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
      isContainerObservedVisible, configLoadNonce, currentProfileAddress,
      lastAppliedNonce: lastAppliedNonceRef.current
    });

    // Skip checks if in a terminal state or an intermediate async state
    if (currentState === 'error' || currentState === 'fading_out' || currentState === 'applying_config') {
        logAction(`Skipping state machine check (Current State: ${currentState})`);
        return;
    }

    // const conditionsMetForAllSystems = managersReady && defaultImagesLoaded && isInitiallyResolved && hasValidDimensions && isContainerObservedVisible; // Not used directly anymore
    const hasNewConfigToApply = configLoadNonce > lastAppliedNonceRef.current;
    const configNameDisplay = currentConfigName || (configLoadNonce > 0 ? 'New' : 'Default');

    // Simplified state progression
    if (!hasValidDimensions) {
        if (currentState !== 'waiting_layout') {
            setLoadingStatusMessage("Waiting for layout...");
            logStateChange('waiting_layout', 'Init -> No Layout');
        }
    } else if (!managersReady) {
        setLoadingStatusMessage("Initializing managers...");
        if (currentState !== 'initializing') logStateChange('initializing', 'Layout -> Init Wait Mgr');
    } else if (!defaultImagesLoaded) {
        setLoadingStatusMessage("Loading defaults...");
        if (currentState !== 'initializing') logStateChange('initializing', 'Layout -> Init Wait Img');
    } else if (!isInitiallyResolved) {
        // This state means useConfigState is still waiting for the UP address or initial load.
        // show a generic loading/resolving message.
        setLoadingStatusMessage("Loading Configuration");
        if (currentState !== 'initializing') logStateChange('initializing', 'Layout -> Init Wait Res');
    } else { // All basic dependencies met (layout, managers, defaults), and config resolution has been attempted
        if (hasNewConfigToApply) {
            // This is the primary path to rendering/transitioning.
            // It means useConfigState has successfully loaded a config (actual or fallback for a known address)
            // and incremented the nonce.
            if (currentState === 'rendered') { // If already rendered, it's a transition
                logAction(`Rendered -> FADING_OUT (New config Nonce ${configLoadNonce})`);
                if (ANIMATION_CONTINUE_DURING_TRANSITION) { animationStateRef.current = 'running_during_transition'; }
                logStateChange('fading_out', 'Rendered -> New Config');
                setLoadingStatusMessage(TRANSITION_MESSAGE);
            } else { // If not rendered yet (e.g., coming from initializing), go straight to applying
                logAction(`${currentState} -> APPLYING_CONFIG (All systems ready, new config Nonce ${configLoadNonce})`);
                setLoadingStatusMessage(`Applying '${configNameDisplay}'...`);
                logStateChange('applying_config', `${currentState} -> Apply New/Fallback`);
            }
        } else if (currentState !== 'rendered') {
            // If no new config, and not yet rendered, it implies we are waiting for something
            // or the initial state was the final state (e.g. fallback applied, nonce 0, lastAppliedNonce 0)
            // This path should lead to 'rendered' if all conditions are met.
            // This also covers the case where the initial fallback (nonce 0) is the state to render.
            logAction(`${currentState} -> RENDERED (All systems ready, no *new* nonce-driven config)`);
            logStateChange('rendered', `${currentState} -> Rendered (No New Conf / Initial Fallback)`);
        }
        // If currentState is 'rendered' and no new config, do nothing (already handled by other effects)
    }
  }, [renderState, managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions, isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress, setLoadingStatusMessage, logStateChange, logAction, logCheck, resetLifecycle]);


  const prevAddressRef = useRef(currentProfileAddress);
  useEffect(() => {
    if (isMountedRef.current && isInitiallyResolved) {
      const previousAddress = prevAddressRef.current;
      const currentAddress = currentProfileAddress;
      if (previousAddress !== currentAddress) {
         if ( (previousAddress && !currentAddress) || (previousAddress && currentAddress && previousAddress !== currentAddress) ) {
              logAction(`Address Change Detected: ${previousAddress || 'null'} -> ${currentAddress || 'null'}. Resetting Lifecycle.`);
              resetLifecycle();
         }
         prevAddressRef.current = currentAddress;
      }
    }
     else if (prevAddressRef.current !== currentProfileAddress) {
         prevAddressRef.current = currentProfileAddress;
     }
  }, [currentProfileAddress, isInitiallyResolved, resetLifecycle, logAction]);


  useEffect(() => {
      if (renderState !== 'fading_out') return;
      logAction(`Starting fade out transition for Nonce ${configLoadNonce}.`);

      if (!ANIMATION_CONTINUE_DURING_TRANSITION) {
        logAction("Fading Out: Stopping animations.");
        if (stopAllAnimations) stopAllAnimations(); else console.error("stopAllAnimations function is missing!");
        animationStateRef.current = 'stopped';
      } else {
        logAction("Fading Out: Keeping animations running during transition.");
        animationStateRef.current = 'running_during_transition';
      }

      setIsTransitioningInternal(true);
      setIsCanvasVisibleInternal(false);
      logAction(`Canvas visibility set to FALSE - fade out animation starts.`);
      setLoadingStatusMessage(TRANSITION_MESSAGE);

      if (fadeOutTimeoutRef.current) clearTimeout(fadeOutTimeoutRef.current);
      fadeOutTimeoutRef.current = setTimeout(() => {
        fadeOutTimeoutRef.current = null;
        if (isMountedRef.current && renderState === 'fading_out') {
          logAction(`Fade out complete. -> APPLYING_CONFIG.`);
          if (ANIMATION_CONTINUE_DURING_TRANSITION && animationStateRef.current === 'running_during_transition') {
             logAction("Fade Out Complete: Stopping transition animations before apply.");
             if (stopAllAnimations) stopAllAnimations(); else console.error("stopAllAnimations function is missing!");
             animationStateRef.current = 'stopped';
          }
          logStateChange('applying_config', 'Fade Out Complete');
        } else {
            logAction(`Fade out timeout finished, but state is no longer 'fading_out' (Current: ${renderState}). No state change action.`);
        }
      }, CANVAS_FADE_DURATION);

      return () => { if (fadeOutTimeoutRef.current) { clearTimeout(fadeOutTimeoutRef.current); fadeOutTimeoutRef.current = null; } };
  }, [renderState, configLoadNonce, stopAllAnimations, setLoadingStatusMessage, logStateChange, logAction]);

  useEffect(() => {
    if (renderState !== 'applying_config') return;
    if (applyConfigPromiseRef.current) { logAction(`Apply config already in progress.`); return; }

    logAction(`Starting configuration application process.`);
    setLoadingStatusMessage(APPLYING_MESSAGE);

    const applyAndDrawLogic = async () => {
        if (!isMountedRef.current || renderState !== 'applying_config') { logAction(`Core apply/draw aborted (unmounted or state changed).`); return; }

        let configApplySuccess = true, tokenApplySuccess = true, redrawSuccess = false;
        const currentNonce = configLoadNonce;
        const currentLayerConfigs = latestLayerConfigsRef.current;
        const currentTokenAssignments = latestTokenAssignmentsRef.current;

        try {
            logAction(`APPLYING_CONFIG Nonce: ${currentNonce}`);
            logAction(`Calling applyConfigurationsToManagers...`);
            if (typeof applyConfigurationsToManagers !== 'function') throw new Error("applyConfigurationsToManagers is not a function");
            applyConfigurationsToManagers(currentLayerConfigs);
            logAction(`Visual configs applied to managers.`);

            logAction(`Calling applyTokenAssignments...`);
            if (typeof applyTokenAssignments !== 'function') throw new Error("applyTokenAssignments is not a function");
            await applyTokenAssignments(currentTokenAssignments);
            logAction(`Token assignment process completed.`);
            tokenApplySuccess = true;

            await new Promise(resolve => setTimeout(resolve, FORCE_REPAINT_DELAY));
            if (!isMountedRef.current || renderState !== 'applying_config') { logAction(`Redraw aborted after delay (unmounted or state changed).`); return; }

            logAction(`Calling redrawAllCanvases with current layerConfigs...`);
            if (typeof redrawAllCanvases !== 'function') throw new Error("redrawAllCanvases is not a function");
            redrawSuccess = await redrawAllCanvases(currentLayerConfigs);
            logAction(`redrawAllCanvases finished. Success: ${redrawSuccess}.`);
            if (!redrawSuccess) throw new Error("Redraw after config/token application failed.");

        } catch (error) {
            logAction(`Error during apply/redraw: ${error.message}`);
            setLoadingStatusMessage(`⚠ Error applying config: ${error.message}`);
            configApplySuccess = false;
            redrawSuccess = false;
        } finally {
            applyConfigPromiseRef.current = null;
        }

        if (isMountedRef.current && renderState === 'applying_config') {
            if (configApplySuccess && tokenApplySuccess && redrawSuccess) {
                logAction(`Apply & Redraw SUCCESS (Nonce ${currentNonce}). Starting animations...`);
                animationStateRef.current = 'running';
                if (typeof restartCanvasAnimations === 'function') { restartCanvasAnimations(); logAction(`Animations restarted.`); }
                else { logAction(`ERROR: restartCanvasAnimations function is missing!`); }

                logAction(`Moving to RENDERED state.`);
                logStateChange('rendered', 'Apply Success');
                lastAppliedNonceRef.current = currentNonce;
            } else {
                logAction(`Apply or Redraw FAILED (Config: ${configApplySuccess}, Token: ${tokenApplySuccess}, Redraw: ${redrawSuccess}). Moving to 'error' state.`);
                logStateChange('error', 'Apply/Redraw Failed');
                setIsTransitioningInternal(false);
                animationStateRef.current = 'stopped';
            }
        } else {
            logAction(`Apply/Draw finished, but state changed during process (Current: ${renderState}). No final state transition from this effect run.`);
        }
    };

    applyConfigPromiseRef.current = applyAndDrawLogic();
  }, [renderState, configLoadNonce, applyConfigurationsToManagers, applyTokenAssignments, redrawAllCanvases, restartCanvasAnimations, setLoadingStatusMessage, logStateChange, logAction]);

  useEffect(() => {
    if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
    if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
    transitionEndTimeoutRef.current = null;
    statusDisplayFadeTimeoutRef.current = null;

    if (renderState === "rendered") {
        logAction(`State is 'rendered'. Handling post-render updates.`);
        if (!isCanvasVisibleInternal) {
            requestAnimationFrame(() => {
                if (isMountedRef.current && renderState === "rendered") {
                    logAction(`Setting canvas VISIBLE (via RAF).`);
                    setIsCanvasVisibleInternal(true);
                    if (animationStateRef.current !== 'running') {
                        logAction(`Ensuring animations are running post-render visibility set.`);
                        if (restartCanvasAnimations) restartCanvasAnimations();
                        animationStateRef.current = 'running';
                    }
                }
            });
        } else {
             if (animationStateRef.current !== 'running') {
                 logAction(`Canvas already visible, ensuring animations are running.`);
                 if (restartCanvasAnimations) restartCanvasAnimations();
                 animationStateRef.current = 'running';
             }
        }
        if (isTransitioningInternal) {
            logAction(`Transition flag active. Scheduling clear after ${CANVAS_FADE_DURATION}ms.`);
            transitionEndTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current && renderState === "rendered") {
                    logAction(`Clearing transition flag.`);
                    setIsTransitioningInternal(false);
                }
                transitionEndTimeoutRef.current = null;
            }, CANVAS_FADE_DURATION);
        }
        if (!isStatusFadingOut && !isTransitioningInternal) {
            logAction(`Starting status message fade out.`);
            setLoadingStatusMessage("Render complete.");
            setIsStatusFadingOut(true);
            statusDisplayFadeTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    setIsStatusFadingOut(false);
                    logAction(`Status message fade out complete.`);
                }
                statusDisplayFadeTimeoutRef.current = null;
            }, LOADING_FADE_DURATION);
        } else if (isTransitioningInternal && isStatusFadingOut) {
            logAction(`Transition started during status fade. Cancelling fade out.`);
            setIsStatusFadingOut(false);
        }
    // --- REMOVED specific handling for 'prompt_connect' here ---
    // } else if (renderState === "prompt_connect") { ... }
    } else { // Handles all other states, including if prompt_connect was somehow re-entered
        if (isStatusFadingOut) { setIsStatusFadingOut(false); }
        if (transitionEndTimeoutRef.current) { clearTimeout(transitionEndTimeoutRef.current); transitionEndTimeoutRef.current = null; }
        if (isTransitioningInternal) { setIsTransitioningInternal(false); }
        // If we are in a non-rendered state, ensure canvas is hidden and animations stopped
        if (renderState !== 'applying_config' && renderState !== 'fading_out') { // Don't hide during these active transitions
            if (isCanvasVisibleInternal) setIsCanvasVisibleInternal(false);
            if (animationStateRef.current !== 'stopped') {
                if (stopAllAnimations) stopAllAnimations();
                animationStateRef.current = 'stopped';
            }
        }
    }

    return () => {
        if (transitionEndTimeoutRef.current) { clearTimeout(transitionEndTimeoutRef.current); transitionEndTimeoutRef.current = null; }
        if (statusDisplayFadeTimeoutRef.current) { clearTimeout(statusDisplayFadeTimeoutRef.current); statusDisplayFadeTimeoutRef.current = null; }
    };
  }, [renderState, isTransitioningInternal, isCanvasVisibleInternal, isStatusFadingOut, setLoadingStatusMessage, restartCanvasAnimations, stopAllAnimations, logStateChange, logAction]);

  const showStatusDisplay = useMemo(() => {
    // Show status unless fully rendered AND not transitioning AND status isn't fading
    return renderState !== 'rendered' || isTransitioningInternal || isStatusFadingOut;
  }, [renderState, isTransitioningInternal, isStatusFadingOut]);

  const showRetryButton = useMemo(() => {
    const isRecoverableError = renderState === 'error' &&
                              !upInitializationError &&
                              !upFetchStateError &&
                              !(loadError && !isInitiallyResolved);
    return isRecoverableError;
  }, [renderState, upInitializationError, upFetchStateError, loadError, isInitiallyResolved]);

  return {
    renderState,
    loadingStatusMessage,
    isStatusFadingOut,
    showStatusDisplay,
    showRetryButton,
    isTransitioning: isTransitioningInternal,
    isCanvasVisible: isCanvasVisibleInternal,
    isAnimating: animationStateRef.current === 'running' || animationStateRef.current === 'running_during_transition',
    handleManualRetry,
    resetLifecycle,
  };
}