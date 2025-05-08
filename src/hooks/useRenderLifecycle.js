import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// Constants for timing and display messages
const LOADING_FADE_DURATION = 600;
const CANVAS_FADE_DURATION = 1000; // Duration for canvas fade in/out
const FORCE_REPAINT_DELAY = 50; // Small delay before redraw after config apply
const ANIMATION_CONTINUE_DURING_TRANSITION = true; // Configurable: Keep animations running during fade transitions
const IDLE_MESSAGE = "Connect Universal Profile or load a preset."; // Kept for reference, but prompt_connect takes precedence
const CONNECTING_MESSAGE = "Connecting...";
const LOADING_MESSAGE = "Loading preset...";
const APPLYING_MESSAGE = "Applying configuration...";
const RENDERING_MESSAGE = "Rendering visuals..."; // Currently unused but kept for potential future use
const TRANSITION_MESSAGE = "Transitioning...";
const PROMPT_CONNECT_MESSAGE = "Please connect your Universal Profile via the parent application."; // New message

/**
 * @typedef {'initializing' | 'waiting_layout' | 'applying_config' | 'drawing' | 'rendered' | 'error' | 'prompt_connect'} RenderState - Possible states of the rendering lifecycle. Added 'prompt_connect'.
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
 * @property {string|null} currentProfileAddress - The address of the profile being viewed. **NEW**
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

/**
 * Manages the complex state transitions involved in initializing, loading, applying,
 * and rendering visual configurations onto the canvases. It coordinates dependencies
 * like manager readiness, image loading, configuration data, and container visibility
 * to provide a robust state machine for the rendering process. Includes handling for
 * loading/error states, transitions between presets, and manual retries.
 * It uses internal logging functions (`logStateChange`, `logAction`, `logCheck`) for debugging.
 *
 * @param {RenderLifecycleOptions} options - Dependencies and control functions required by the lifecycle manager.
 * @returns {RenderLifecycleAPI} An object containing the current render state and related control functions/flags.
 */
export function useRenderLifecycle(options) {
  const {
    managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
    isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress, // Added currentProfileAddress dependency
    layerConfigs, tokenAssignments, loadError, upInitializationError, upFetchStateError,
    stopAllAnimations, applyConfigurationsToManagers,
    applyTokenAssignments, // This function should now await image loads internally
    redrawAllCanvases,
    restartCanvasAnimations,
  } = options;

  const [renderState, setRenderStateInternal] = useState('initializing');
  const [loadingStatusMessage, setLoadingStatusMessageState] = useState(CONNECTING_MESSAGE);
  const [isStatusFadingOut, setIsStatusFadingOut] = useState(false);
  const [isTransitioningInternal, setIsTransitioningInternal] = useState(false);
  const [isCanvasVisibleInternal, setIsCanvasVisibleInternal] = useState(false);
  const isMountedRef = useRef(false);
  const lastAppliedNonceRef = useRef(-1);
  const statusDisplayFadeTimeoutRef = useRef(null);
  const transitionEndTimeoutRef = useRef(null);
  const fadeOutTimeoutRef = useRef(null);
  const repaintDelayTimeoutRef = useRef(null);
  const applyConfigPromiseRef = useRef(null);
  const animationStateRef = useRef('stopped');
  const stateEntryTimeRef = useRef(Date.now());

  // Internal logging helpers
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
     console.log(`%c[RenderLifecycle] State Check (${currentState}):`, 'color: #888;', JSON.parse(JSON.stringify(conditions || {}))); // Stringify complex objects for better logging
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    logAction("Component Mounted");
    return () => {
      logAction("Component Unmounting - Cleaning up timers");
      isMountedRef.current = false;
      // Clear all potentially active timers
      if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
      if (fadeOutTimeoutRef.current) clearTimeout(fadeOutTimeoutRef.current);
      if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current);
      applyConfigPromiseRef.current = null; // Clear promise ref
    };
  }, [logAction]); // logAction is stable

  // Track state entry time
  useEffect(() => {
    stateEntryTimeRef.current = Date.now();
  }, [renderState]);

  /** Safely updates the loading status message. */
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

  /** Attempts to recover from a recoverable error state. */
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

  /** Resets the entire render lifecycle state, typically used on fatal errors or major context changes. */
  const resetLifecycle = useCallback(() => {
      if (!isMountedRef.current) return;
      logAction(`!!! Resetting Lifecycle Triggered !!!`);
      try { throw new Error("Reset Trace"); } catch (e) { console.warn(e.stack); } // Trace where reset was called

      animationStateRef.current = 'pending_stop';
      logStateChange("initializing", "External Reset");
      setLoadingStatusMessage(CONNECTING_MESSAGE);
      setIsStatusFadingOut(false);
      lastAppliedNonceRef.current = -1;
      setIsTransitioningInternal(false);
      setIsCanvasVisibleInternal(false);
      applyConfigPromiseRef.current = null;

      // Delay stopping animations to allow visual feedback during reset if needed
      setTimeout(() => {
        if (isMountedRef.current && animationStateRef.current === 'pending_stop') {
          logAction(`Executing delayed animation stop after reset`);
          if (stopAllAnimations) stopAllAnimations(); else console.error("stopAllAnimations function is missing in resetLifecycle!");
          animationStateRef.current = 'stopped';
        }
      }, CANVAS_FADE_DURATION);

      // Clear all timeouts
      if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
      if (fadeOutTimeoutRef.current) clearTimeout(fadeOutTimeoutRef.current);
      if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current);
      statusDisplayFadeTimeoutRef.current = null;
      transitionEndTimeoutRef.current = null;
      fadeOutTimeoutRef.current = null;
      repaintDelayTimeoutRef.current = null;
  }, [stopAllAnimations, setLoadingStatusMessage, logAction, logStateChange]); // Dependencies for reset

  // Effect to handle critical initialization or load errors
  useEffect(() => {
    // Critical error if UP provider fails OR if the initial config load fails
    const criticalError = upInitializationError || upFetchStateError || (loadError && !isInitiallyResolved); // Check against isInitiallyResolved
    if (criticalError) {
      const errorSource = upInitializationError ? 'UP Init Error' : upFetchStateError ? 'UP Fetch Error' : 'Initial Load Error';
      logAction(`Critical Error Detected: ${errorSource}: ${criticalError.message}`);
      setLoadingStatusMessage(`⚠ Critical Error: ${criticalError.message}`);
      logStateChange('error', errorSource);
      animationStateRef.current = 'stopped'; // Ensure animations are stopped
    }
  }, [upInitializationError, upFetchStateError, loadError, isInitiallyResolved, setLoadingStatusMessage, logAction, logStateChange]); // Added isInitiallyResolved

  // Main state machine logic driving transitions between RenderStates
  useEffect(() => {
    const currentState = renderState;
    logCheck(currentState, {
      managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
      isContainerObservedVisible, configLoadNonce, currentProfileAddress,
      lastAppliedNonce: lastAppliedNonceRef.current
    });

    // Skip checks if in a terminal state or an intermediate async state
    if (currentState === 'error' || currentState === 'fading_out' || currentState === 'applying_config' || currentState === 'prompt_connect') {
        logAction(`Skipping state machine check (Current State: ${currentState})`);
        return;
    }

    const conditionsMetForDraw = managersReady && defaultImagesLoaded && isInitiallyResolved && hasValidDimensions && isContainerObservedVisible;
    const hasNewConfig = configLoadNonce > lastAppliedNonceRef.current;
    const configNameDisplay = currentConfigName || (configLoadNonce > 0 ? 'New' : 'Default');

    switch (currentState) {
      case 'initializing':
        if (!hasValidDimensions) { setLoadingStatusMessage("Waiting for layout..."); logStateChange('waiting_layout', 'Init -> No Layout'); }
        else if (!managersReady) { setLoadingStatusMessage("Initializing managers..."); }
        else if (!defaultImagesLoaded) { setLoadingStatusMessage("Loading defaults..."); }
        else if (!isInitiallyResolved) { setLoadingStatusMessage("Resolving config..."); }
        // --- ADDED: Check for resolved state WITHOUT a profile address ---
        else if (isInitiallyResolved && !currentProfileAddress) {
          logAction(`Init -> PROMPT_CONNECT (Resolved, no address)`);
          setLoadingStatusMessage(PROMPT_CONNECT_MESSAGE);
          logStateChange('prompt_connect', 'Init -> Prompt Connect');
          animationStateRef.current = 'stopped';
          if (stopAllAnimations) stopAllAnimations();
        }
        // --- END ADDED CHECK ---
        else if (conditionsMetForDraw && !hasNewConfig && currentProfileAddress) { logAction(`Init -> RENDERED (Conditions met, no new config, has address)`); logStateChange('rendered', 'Init -> Rendered (No New Conf)'); }
        else if (conditionsMetForDraw && hasNewConfig && currentProfileAddress) { logAction(`Init -> APPLYING_CONFIG (Conditions met, has initial config Nonce ${configLoadNonce})`); setLoadingStatusMessage(`Applying '${configNameDisplay}'...`); logStateChange('applying_config', 'Init -> Apply Initial'); }
        else { logAction(`Init -> Still waiting for conditions...`); }
        break;

      case 'waiting_layout':
        if (hasValidDimensions) {
            logAction(`Waiting Layout -> Dimensions now valid.`);
            // Re-evaluate conditions now that layout is ready
            if (!managersReady) { setLoadingStatusMessage("Initializing managers..."); logStateChange('initializing', 'Layout -> Init Wait Mgr'); }
            else if (!defaultImagesLoaded) { setLoadingStatusMessage("Loading defaults..."); logStateChange('initializing', 'Layout -> Init Wait Img'); }
            else if (!isInitiallyResolved) { setLoadingStatusMessage("Resolving config..."); logStateChange('initializing', 'Layout -> Init Wait Res'); }
            // --- ADDED: Check for resolved state WITHOUT a profile address ---
            else if (isInitiallyResolved && !currentProfileAddress) {
              logAction(`Layout Ready -> PROMPT_CONNECT (Resolved, no address)`);
              setLoadingStatusMessage(PROMPT_CONNECT_MESSAGE);
              logStateChange('prompt_connect', 'Layout -> Prompt Connect');
              animationStateRef.current = 'stopped';
              if (stopAllAnimations) stopAllAnimations();
            }
            // --- END ADDED CHECK ---
            else if (conditionsMetForDraw && hasNewConfig && currentProfileAddress) { logAction(`Layout Ready -> APPLYING_CONFIG (Has config Nonce ${configLoadNonce})`); setLoadingStatusMessage(`Applying '${configNameDisplay}'...`); logStateChange('applying_config', 'Layout -> Apply'); }
            else if (conditionsMetForDraw && !hasNewConfig && currentProfileAddress) { logAction(`Layout Ready -> RENDERED (No new config)`); logStateChange('rendered', 'Layout -> Rendered (No New Conf)'); }
            else { logAction(`Layout Ready -> Still waiting...`); } // Should be rare
        }
        break;

      // Removed 'idle' state as 'prompt_connect' covers the no-address scenario after resolution

      case 'rendered':
          if (hasNewConfig && currentProfileAddress) { // Only transition if we have an address
              logAction(`Rendered -> FADING_OUT (New config Nonce ${configLoadNonce})`);
              if (ANIMATION_CONTINUE_DURING_TRANSITION) { animationStateRef.current = 'running_during_transition'; }
              logStateChange('fading_out', 'Rendered -> New Config');
              setLoadingStatusMessage(TRANSITION_MESSAGE);
          } else if (!currentProfileAddress) { // If address disappears while rendered
              logAction(`Rendered -> Address lost. Resetting.`);
              resetLifecycle(); // Trigger a full reset
          }
          break;
      default:
         logAction(`Unhandled state in main machine: ${currentState}`);
         break;
    }

  }, [renderState, managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions, isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress, stopAllAnimations, setLoadingStatusMessage, logStateChange, logAction, logCheck, resetLifecycle]);

  // Effect to handle the 'fading_out' transition state
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

  // Effect to handle the 'applying_config' state: apply visual config, apply tokens, redraw
  useEffect(() => {
    if (renderState !== 'applying_config') return;
    if (applyConfigPromiseRef.current) { logAction(`Apply config already in progress.`); return; }

    logAction(`Starting configuration application process.`);
    setLoadingStatusMessage(APPLYING_MESSAGE);

    const applyAndDrawLogic = async () => {
        if (!isMountedRef.current || renderState !== 'applying_config') { logAction(`Core apply/draw aborted (unmounted or state changed).`); return; }

        let configApplySuccess = true, tokenApplySuccess = true, redrawSuccess = false;
        const currentNonce = configLoadNonce; // Capture nonce for this attempt

        try {
            logAction(`APPLYING_CONFIG Nonce: ${currentNonce}`);

            logAction(`Calling applyConfigurationsToManagers...`);
            if (typeof applyConfigurationsToManagers !== 'function') throw new Error("applyConfigurationsToManagers is not a function");
            applyConfigurationsToManagers(layerConfigs);
            logAction(`Visual configs applied to managers.`);

            logAction(`Calling applyTokenAssignments...`);
            if (typeof applyTokenAssignments !== 'function') throw new Error("applyTokenAssignments is not a function");
            await applyTokenAssignments(tokenAssignments); // Await token/image loading
            logAction(`Token assignment process completed.`);
            tokenApplySuccess = true; // Assume success if no error thrown

            await new Promise(resolve => setTimeout(resolve, FORCE_REPAINT_DELAY));
            if (!isMountedRef.current || renderState !== 'applying_config') { logAction(`Redraw aborted after delay (unmounted or state changed).`); return; }

            logAction(`Calling redrawAllCanvases with current layerConfigs...`);
            if (typeof redrawAllCanvases !== 'function') throw new Error("redrawAllCanvases is not a function");
            redrawSuccess = await redrawAllCanvases(layerConfigs); // Redraw with applied configs
            logAction(`redrawAllCanvases finished. Success: ${redrawSuccess}.`);
            if (!redrawSuccess) throw new Error("Redraw after config/token application failed.");

        } catch (error) {
            logAction(`Error during apply/redraw: ${error.message}`);
            setLoadingStatusMessage(`⚠ Error applying config: ${error.message}`);
            configApplySuccess = false;
            redrawSuccess = false;
        } finally {
            applyConfigPromiseRef.current = null; // Allow subsequent attempts
        }

        // Transition to next state based on success/failure
        if (isMountedRef.current && renderState === 'applying_config') {
            if (configApplySuccess && tokenApplySuccess && redrawSuccess) {
                logAction(`Apply & Redraw SUCCESS (Nonce ${currentNonce}). Starting animations...`);
                animationStateRef.current = 'running';
                if (typeof restartCanvasAnimations === 'function') { restartCanvasAnimations(); logAction(`Animations restarted.`); }
                else { logAction(`ERROR: restartCanvasAnimations function is missing!`); }

                logAction(`Moving to RENDERED state.`);
                logStateChange('rendered', 'Apply Success');
                lastAppliedNonceRef.current = currentNonce; // Mark this nonce as applied
            } else {
                logAction(`Apply or Redraw FAILED (Config: ${configApplySuccess}, Token: ${tokenApplySuccess}, Redraw: ${redrawSuccess}). Moving to 'error' state.`);
                logStateChange('error', 'Apply/Redraw Failed');
                setIsTransitioningInternal(false); // Ensure transition state is cleared on error
                animationStateRef.current = 'stopped'; // Ensure animations are stopped
            }
        } else {
            logAction(`Apply/Draw finished, but state changed during process (Current: ${renderState}). No final state transition from this effect run.`);
        }
    };

    applyConfigPromiseRef.current = applyAndDrawLogic(); // Store the promise
  }, [renderState, configLoadNonce, layerConfigs, tokenAssignments, applyConfigurationsToManagers, applyTokenAssignments, redrawAllCanvases, restartCanvasAnimations, setLoadingStatusMessage, logStateChange, logAction]);

  // Effect for managing state transitions *after* reaching 'rendered' or 'prompt_connect'
  useEffect(() => {
    // Clear any potentially lingering timeouts from previous states
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
            setLoadingStatusMessage("Render complete."); // Optional: Update message
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
    } else if (renderState === "prompt_connect") {
        logAction(`State is 'prompt_connect'. Ensuring canvas hidden, animations stopped.`);
        if (isCanvasVisibleInternal) setIsCanvasVisibleInternal(false);
        if (animationStateRef.current !== 'stopped') {
            if (stopAllAnimations) stopAllAnimations();
            animationStateRef.current = 'stopped';
        }
        setLoadingStatusMessage(PROMPT_CONNECT_MESSAGE); // Ensure correct message
        setIsStatusFadingOut(false); // Keep message visible
    } else {
        // If not in 'rendered' or 'prompt_connect', ensure post-render flags/timers are cleared
        if (isStatusFadingOut) { setIsStatusFadingOut(false); }
        if (transitionEndTimeoutRef.current) { clearTimeout(transitionEndTimeoutRef.current); transitionEndTimeoutRef.current = null; }
        if (isTransitioningInternal) { setIsTransitioningInternal(false); }
    }

    // Cleanup timers set in this specific effect
    return () => {
        if (transitionEndTimeoutRef.current) { clearTimeout(transitionEndTimeoutRef.current); transitionEndTimeoutRef.current = null; }
        if (statusDisplayFadeTimeoutRef.current) { clearTimeout(statusDisplayFadeTimeoutRef.current); statusDisplayFadeTimeoutRef.current = null; }
    };
  }, [renderState, isTransitioningInternal, isCanvasVisibleInternal, isStatusFadingOut, setLoadingStatusMessage, restartCanvasAnimations, stopAllAnimations, logStateChange, logAction]); // Added stopAllAnimations

  // Derived state for UI consumption
  const showStatusDisplay = useMemo(() => {
    // Show status unless fully rendered AND not transitioning AND status isn't fading
    // ADDED: Also show for 'prompt_connect' state
    return renderState === 'prompt_connect' || renderState !== 'rendered' || isTransitioningInternal || isStatusFadingOut;
  }, [renderState, isTransitioningInternal, isStatusFadingOut]);

  const showRetryButton = useMemo(() => {
    // Show retry only for recoverable errors (not initial UP/Load errors or prompt connect)
    const isRecoverableError = renderState === 'error' &&
                              !upInitializationError &&
                              !upFetchStateError &&
                              !(loadError && !isInitiallyResolved); // Use isInitiallyResolved here
    return isRecoverableError;
  }, [renderState, upInitializationError, upFetchStateError, loadError, isInitiallyResolved]); // Added isInitiallyResolved

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