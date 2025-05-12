// src/hooks/useRenderLifecycle.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import fallbackConfig from '../config/fallback-config.js'; 

// Constants for timing and display messages
const LOADING_FADE_DURATION = 600;
const CANVAS_FADE_DURATION = 1000;
const FORCE_REPAINT_DELAY = 50; 
const ANIMATION_CONTINUE_DURING_TRANSITION = true;
const CONNECTING_MESSAGE = "Connecting..."; 
const LOADING_CONFIG_MESSAGE = "Loading Configuration..."; 
const APPLYING_MESSAGE = "Applying configuration...";
const TRANSITION_MESSAGE = "Transitioning...";

/**
 * @typedef {object} RenderLifecycleOptions
 * @property {boolean} managersReady - True if all CanvasManagers are initialized.
 * @property {boolean} defaultImagesLoaded - True if default images for canvases have been loaded.
 * @property {boolean} isInitiallyResolved - True once the initial attempt to load a preset (or fallback) is complete.
 * @property {boolean} hasValidDimensions - True if the main canvas container has valid (non-zero) dimensions.
 * @property {boolean} isContainerObservedVisible - True if the canvas container is currently visible in the viewport.
 * @property {number} configLoadNonce - A number that increments each time a new configuration preset is successfully loaded and ready to be applied.
 * @property {string|null} currentConfigName - The name of the currently loaded configuration preset.
 * @property {string|null} currentProfileAddress - The address of the Universal Profile whose configuration is being managed.
 * @property {object} layerConfigs - The current live layer configurations (typically from VisualConfigContext).
 * @property {object} tokenAssignments - The current live token assignments (typically from VisualConfigContext).
 * @property {object|null} targetLayerConfigsForPreset - The definitive layer configurations for a newly loaded preset (from PresetManagementContext).
 * @property {object|null} targetTokenAssignmentsForPreset - The definitive token assignments for a newly loaded preset (from PresetManagementContext).
 * @property {Error|string|null} loadError - Error object if preset loading failed.
 * @property {Error|null} upInitializationError - Error object if Universal Profile provider initialization failed.
 * @property {Error|null} upFetchStateError - Error object if fetching state from Universal Profile provider failed.
 * @property {() => void} stopAllAnimations - Function to stop all canvas animations.
 * @property {(configs: object) => void} applyConfigurationsToManagers - Function to apply full layer configurations to CanvasManagers.
 * @property {(assignments: object) => Promise<void>} applyTokenAssignments - Function to apply token assignments to CanvasManagers.
 * @property {(configs?: object|null) => Promise<boolean>} redrawAllCanvases - Function to force a redraw of all canvases.
 * @property {() => void} restartCanvasAnimations - Function to restart all canvas animations.
 * @property {boolean} [isLoading] - Optional flag indicating if configuration data is currently being loaded (e.g., from PresetManagementContext). Defaults to true.
 */

/**
 * @typedef {object} RenderLifecycleState
 * @property {'initializing'|'waiting_layout'|'applying_config'|'fading_out'|'rendered'|'error'} renderState - The current state of the rendering lifecycle.
 * @property {string} loadingStatusMessage - User-facing message describing the current loading/rendering status.
 * @property {boolean} isStatusFadingOut - True if the status message is currently animating its fade-out.
 * @property {boolean} showStatusDisplay - True if the status message display should be visible.
 * @property {boolean} showRetryButton - True if a retry button should be shown (typically in recoverable error states).
 * @property {boolean} isTransitioning - True if a visual transition (e.g., preset change fade) is in progress.
 * @property {boolean} isCanvasVisible - True if the main canvases should be visually rendered (opacity 1, display block).
 * @property {boolean} isAnimating - True if canvas animations are expected to be running.
 * @property {() => void} handleManualRetry - Function to attempt a manual retry from an error state.
 * @property {() => void} resetLifecycle - Function to force a reset of the entire render lifecycle to its initial state.
 */

/**
 * Manages the complex state machine for the application's main visual rendering pipeline.
 * It orchestrates transitions between states like initializing, waiting for layout, applying configurations,
 * rendering, and handling errors. It coordinates with canvas managers, preset loading,
 * and UI visibility to ensure smooth visual updates and transitions.
 *
 * @param {RenderLifecycleOptions} options - Configuration and callback options for the hook.
 * @returns {RenderLifecycleState} The current state and control functions for the render lifecycle.
 */
export function useRenderLifecycle(options) {
  const {
    managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
    isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress, 
    layerConfigs, 
    tokenAssignments, 
    targetLayerConfigsForPreset, 
    targetTokenAssignmentsForPreset, 
    loadError, upInitializationError, upFetchStateError,
    stopAllAnimations, applyConfigurationsToManagers,
    applyTokenAssignments, 
    redrawAllCanvases,
    restartCanvasAnimations,
  } = options;

  const currentIsLoading = options.isLoading === undefined ? true : options.isLoading;

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
  const applyConfigPromiseRef = useRef(null); // Stores the promise of the ongoing applyAndDrawLogic
  const animationStateRef = useRef('stopped'); // Tracks desired animation state: 'stopped', 'running', 'pending_stop', 'running_during_transition'

  /**
   * Development-only: Logs a state change with a reason.
   * @param {'initializing'|'waiting_layout'|'applying_config'|'fading_out'|'rendered'|'error'} newState
   * @param {string} reason
   */
  const logStateChange = useCallback((newState, reason) => {
    setRenderStateInternal(prevState => {
      if (prevState !== newState) {
        if (import.meta.env.DEV) {
          console.log(`%c[DEBUG RenderLifecycle] State CHANGE: ${prevState} -> ${newState} (Reason: ${reason})`, 'color: blue; font-weight: bold;');
        }
        return newState;
      }
      return prevState;
    });
  }, []);

  /**
   * Development-only: Logs an action taken by the hook.
   * @param {string} actionName
   * @param {any} [details]
   */
  const logAction = useCallback((actionName, details = '') => {
    if (import.meta.env.DEV) {
      console.log(`%c[DEBUG RenderLifecycle] Action: ${actionName}`, 'color: purple;', details);
    }
  }, []);

  /**
   * Development-only: Logs the current conditions being checked by the state machine.
   * @param {string} currentState
   * @param {object} [conditions]
   */
  const logCheck = useCallback((currentState, conditions) => {
    if (import.meta.env.DEV) {
     console.log(`%c[DEBUG RenderLifecycle] State Check (${currentState}):`, 'color: #888;', JSON.parse(JSON.stringify(conditions || {})));
    }
  }, []);

  // Effect for component mount and unmount cleanup.
  useEffect(() => {
    isMountedRef.current = true;
    logAction("Component Mounted");
    return () => {
      logAction("Component Unmounting - Cleaning up ALL timers");
      isMountedRef.current = false;
      // Clear all potentially active timeouts
      if (statusDisplayFadeTimeoutRef.current) { clearTimeout(statusDisplayFadeTimeoutRef.current); statusDisplayFadeTimeoutRef.current = null; }
      if (transitionEndTimeoutRef.current) { clearTimeout(transitionEndTimeoutRef.current); transitionEndTimeoutRef.current = null; }
      if (fadeOutTimeoutRef.current) { clearTimeout(fadeOutTimeoutRef.current); fadeOutTimeoutRef.current = null; }
      if (repaintDelayTimeoutRef.current) { clearTimeout(repaintDelayTimeoutRef.current); repaintDelayTimeoutRef.current = null; }
      applyConfigPromiseRef.current = null; // Nullify promise ref, actual promise cannot be cancelled
    };
  }, [logAction]); // logAction is stable

  /**
   * Sets the user-facing loading status message.
   * @param {string} message
   */
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
  }, [logAction]); // logAction is stable

  /**
   * Handles a manual retry attempt, typically from an error state.
   * Transitions to 'applying_config' if layout dimensions are valid.
   */
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
  }, [renderState, hasValidDimensions, setLoadingStatusMessage, logAction, logStateChange]); // Stable deps

  /**
   * Resets the entire render lifecycle to its initial state.
   * Clears all timers, resets state variables, and stops animations.
   */
  const resetLifecycle = useCallback(() => {
      if (!isMountedRef.current) return;
      logAction(`!!! Resetting Lifecycle Triggered !!!`);
      if (import.meta.env.DEV) {
          try { throw new Error("Reset Trace"); } catch (e) { 
              console.warn(e.stack); 
          }
      }

      animationStateRef.current = 'pending_stop'; // Signal intent to stop animations
      logStateChange("initializing", "External Reset");
      setLoadingStatusMessage(CONNECTING_MESSAGE); 
      setIsStatusFadingOut(false);
      lastAppliedNonceRef.current = 0;
      setIsTransitioningInternal(false);
      setIsCanvasVisibleInternal(false);
      applyConfigPromiseRef.current = null; // Clear any pending apply operation

      // Delay actual animation stop to allow UI to fade if needed
      setTimeout(() => {
        if (isMountedRef.current && animationStateRef.current === 'pending_stop') {
          logAction(`Executing delayed animation stop after reset`);
          if (stopAllAnimations) stopAllAnimations(); else {
            if (import.meta.env.DEV) {
              console.error("stopAllAnimations function is missing in resetLifecycle!");
            }
          }
          animationStateRef.current = 'stopped';
        }
      }, CANVAS_FADE_DURATION);

      // Clear all timers
      if (statusDisplayFadeTimeoutRef.current) { clearTimeout(statusDisplayFadeTimeoutRef.current); statusDisplayFadeTimeoutRef.current = null; }
      if (transitionEndTimeoutRef.current) { clearTimeout(transitionEndTimeoutRef.current); transitionEndTimeoutRef.current = null; }
      if (fadeOutTimeoutRef.current) { clearTimeout(fadeOutTimeoutRef.current); fadeOutTimeoutRef.current = null; }
      if (repaintDelayTimeoutRef.current) { clearTimeout(repaintDelayTimeoutRef.current); repaintDelayTimeoutRef.current = null; }
      
  }, [stopAllAnimations, setLoadingStatusMessage, logAction, logStateChange]); // Stable deps

  // Effect to handle critical initialization or loading errors.
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

  // Main state machine effect.
  useEffect(() => {
    const currentState = renderState;
    logCheck(currentState, {
      managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
      isContainerObservedVisible, configLoadNonce, currentProfileAddress,
      lastAppliedNonce: lastAppliedNonceRef.current, isLoading: currentIsLoading
    });

    // Skip state machine logic if in a terminal or intermediate async state
    if (currentState === 'error' || currentState === 'fading_out' || currentState === 'applying_config') {
        logAction(`Skipping state machine check (Current State: ${currentState})`);
        return;
    }

    const hasNewConfigToApply = configLoadNonce > lastAppliedNonceRef.current;
    const configNameDisplay = currentConfigName || (configLoadNonce > 0 ? 'New' : 'Default');

    // Determine next state based on current conditions
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
        setLoadingStatusMessage(currentIsLoading ? LOADING_CONFIG_MESSAGE : CONNECTING_MESSAGE);
        if (currentState !== 'initializing') logStateChange('initializing', `Layout -> Init Wait Res (isInitiallyResolved: ${isInitiallyResolved}, isLoading: ${currentIsLoading})`);
    } else { // All prerequisites met, initial resolution complete
        if (hasNewConfigToApply) { // A new preset has been loaded
            if (currentState === 'rendered') { // Transition from rendered state
                logAction(`Rendered -> FADING_OUT (New config Nonce ${configLoadNonce})`);
                if (ANIMATION_CONTINUE_DURING_TRANSITION) { animationStateRef.current = 'running_during_transition'; }
                logStateChange('fading_out', 'Rendered -> New Config');
                setLoadingStatusMessage(TRANSITION_MESSAGE);
            } else { // Transition from a non-rendered state (e.g., initializing directly to new config)
                logAction(`${currentState} -> APPLYING_CONFIG (All systems ready, new config Nonce ${configLoadNonce})`);
                setLoadingStatusMessage(`Applying '${configNameDisplay}'...`);
                logStateChange('applying_config', `${currentState} -> Apply New/Fallback`);
            }
        } else if (currentState !== 'rendered') { // All ready, no new config, but not yet in 'rendered' state
            logAction(`${currentState} -> RENDERED (All systems ready, no *new* nonce-driven config)`);
            logStateChange('rendered', `${currentState} -> Rendered (No New Conf / Initial Fallback)`);
        }
    }
    // No specific cleanup needed for this effect as it only sets state.
  }, [
      renderState, managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
      isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress,
      setLoadingStatusMessage, logStateChange, logAction, logCheck, resetLifecycle, // resetLifecycle is stable
      currentIsLoading
    ]);

  // Effect to reset lifecycle if the profile address changes after initial resolution.
  const prevAddressRef = useRef(currentProfileAddress);
  useEffect(() => {
    if (isMountedRef.current && isInitiallyResolved) { 
      const previousAddress = prevAddressRef.current;
      if (previousAddress !== currentProfileAddress) { // Address has changed
         // If old address existed and new is null, or if both exist and are different
         if ( (previousAddress && !currentProfileAddress) || (previousAddress && currentProfileAddress && previousAddress !== currentProfileAddress) ) {
              logAction(`Address Change Detected: ${previousAddress || 'null'} -> ${currentProfileAddress || 'null'}. Resetting Lifecycle.`);
              resetLifecycle(); 
         }
         prevAddressRef.current = currentProfileAddress; 
      }
    }
     else if (prevAddressRef.current !== currentProfileAddress) { // Update ref even if not resolved yet
         prevAddressRef.current = currentProfileAddress; 
     }
  }, [currentProfileAddress, isInitiallyResolved, resetLifecycle, logAction]); // resetLifecycle, logAction are stable

  // Effect to handle 'fading_out' state (visual transition for preset changes).
  useEffect(() => {
      if (renderState !== 'fading_out') return;
      logAction(`Starting fade out transition for Nonce ${configLoadNonce}.`);

      if (!ANIMATION_CONTINUE_DURING_TRANSITION) {
        logAction("Fading Out: Stopping animations.");
        if (stopAllAnimations) stopAllAnimations(); else {
          if (import.meta.env.DEV) {
            console.error("stopAllAnimations function is missing!");
          }
        }
        animationStateRef.current = 'stopped';
      } else {
        logAction("Fading Out: Keeping animations running during transition.");
        animationStateRef.current = 'running_during_transition';
      }

      setIsTransitioningInternal(true);
      setIsCanvasVisibleInternal(false); // Hide canvas to start fade out
      logAction(`Canvas visibility set to FALSE - fade out animation starts.`);
      setLoadingStatusMessage(TRANSITION_MESSAGE);

      // Clear any existing fadeOutTimeout before setting a new one
      if (fadeOutTimeoutRef.current) { clearTimeout(fadeOutTimeoutRef.current); fadeOutTimeoutRef.current = null; }
      fadeOutTimeoutRef.current = setTimeout(() => {
        fadeOutTimeoutRef.current = null; // Timer has fired
        if (isMountedRef.current && renderState === 'fading_out') {
          logAction(`Fade out complete. -> APPLYING_CONFIG.`);
          if (ANIMATION_CONTINUE_DURING_TRANSITION && animationStateRef.current === 'running_during_transition') {
             logAction("Fade Out Complete: Stopping transition animations before apply.");
             if (stopAllAnimations) stopAllAnimations(); else {
               if (import.meta.env.DEV) {
                 console.error("stopAllAnimations function is missing!");
               }
             }
             animationStateRef.current = 'stopped';
          }
          logStateChange('applying_config', 'Fade Out Complete');
        } else {
            logAction(`Fade out timeout finished, but state is no longer 'fading_out' (Current: ${renderState}). No state change action.`);
        }
      }, CANVAS_FADE_DURATION);

      // Cleanup function for this effect
      return () => { if (fadeOutTimeoutRef.current) { clearTimeout(fadeOutTimeoutRef.current); fadeOutTimeoutRef.current = null; } };
  }, [renderState, configLoadNonce, stopAllAnimations, setLoadingStatusMessage, logStateChange, logAction]); // Stable deps

  // Effect to handle 'applying_config' state (applying preset data and redrawing).
  useEffect(() => {
    if (renderState !== 'applying_config') {
        // If state changes away from 'applying_config', ensure any pending repaint delay is cancelled.
        if (repaintDelayTimeoutRef.current) {
            clearTimeout(repaintDelayTimeoutRef.current);
            repaintDelayTimeoutRef.current = null;
            logAction("Cleared repaintDelayTimeoutRef as state is no longer 'applying_config'.");
        }
        return; // Not in applying_config state, do nothing.
    }

    // Prevent concurrent application processes if one is already running.
    if (applyConfigPromiseRef.current) { 
      if (import.meta.env.DEV) {
        logAction(`Apply config already in progress.`); 
      }
      return; 
    }

    logAction(`Starting configuration application process.`);
    setLoadingStatusMessage(APPLYING_MESSAGE);

    const isApplyingForNewNonce = configLoadNonce > lastAppliedNonceRef.current;
    let capturedLayerConfigsToApply;
    let capturedTokenAssignmentsToApply;

    // Determine which configuration data to apply based on whether it's a new preset load.
    if (isApplyingForNewNonce) {
        logAction(`Applying NEW preset (Nonce ${configLoadNonce} vs LastApplied ${lastAppliedNonceRef.current}). Prioritizing targetLayerConfigsForPreset and targetTokenAssignmentsForPreset.`);
        capturedLayerConfigsToApply = targetLayerConfigsForPreset ?? layerConfigs ?? fallbackConfig.layers ?? {};
        capturedTokenAssignmentsToApply = targetTokenAssignmentsForPreset ?? tokenAssignments ?? fallbackConfig.tokenAssignments ?? {};
        
        if (import.meta.env.DEV) {
            if (!targetLayerConfigsForPreset) {
                console.warn("[RenderLifecycle] targetLayerConfigsForPreset was null/undefined during new preset load. Used fallback chain (current VisualConfig or default).", { targetLayerConfigsForPreset, layerConfigs });
            }
            if (!targetTokenAssignmentsForPreset) {
                console.warn("[RenderLifecycle] targetTokenAssignmentsForPreset was null/undefined during new preset load. Used fallback chain (current VisualConfig or default).", { targetTokenAssignmentsForPreset, tokenAssignments });
            }
        }
    } else { // Re-applying current config (e.g., manual retry)
        logAction(`Re-applying current config or manual retry (Nonce ${configLoadNonce} same as LastApplied ${lastAppliedNonceRef.current}). Using layerConfigs from VisualConfigContext.`);
        capturedLayerConfigsToApply = layerConfigs ?? fallbackConfig.layers ?? {};
        capturedTokenAssignmentsToApply = tokenAssignments ?? fallbackConfig.tokenAssignments ?? {};
    }
    
    const nonceForThisApplicationCycle = configLoadNonce; // Capture nonce for this specific application cycle
    
    /** Async function to apply configurations and redraw canvases. */
    const applyAndDrawLogic = async () => {
        // Abort if component unmounted or state changed during async operations.
        if (!isMountedRef.current || renderState !== 'applying_config') { 
            logAction(`Core apply/draw aborted (unmounted or state changed from 'applying_config').`); 
            return; 
        }

        let configApplySuccess = true, tokenApplySuccess = true, redrawSuccess = false;
        
        try {
            logAction(`APPLYING_CONFIG based on Nonce: ${nonceForThisApplicationCycle}`);
            if (import.meta.env.DEV) {
                console.log(`[RenderLifecycle applyAndDrawLogic] Using layerConfigsToApply:`, JSON.parse(JSON.stringify(capturedLayerConfigsToApply)));
                console.log(`[RenderLifecycle applyAndDrawLogic] Using tokenAssignmentsToApply:`, JSON.parse(JSON.stringify(capturedTokenAssignmentsToApply)));
            }
            
            logAction(`Calling applyConfigurationsToManagers...`);
            if (typeof applyConfigurationsToManagers !== 'function') throw new Error("applyConfigurationsToManagers is not a function");
            applyConfigurationsToManagers(capturedLayerConfigsToApply);
            logAction(`Visual configs applied to managers.`);

            logAction(`Calling applyTokenAssignments...`);
            if (typeof applyTokenAssignments !== 'function') throw new Error("applyTokenAssignments is not a function");
            await applyTokenAssignments(capturedTokenAssignmentsToApply); 
            logAction(`Token assignment process completed.`);
            tokenApplySuccess = true; // Assuming success if no error thrown

            // Wait for a short delay to allow browser to repaint/reflow if needed.
            await new Promise(resolve => {
                if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current); 
                repaintDelayTimeoutRef.current = setTimeout(() => {
                    resolve(); // Resolve the promise after the delay
                }, FORCE_REPAINT_DELAY);
            });
            repaintDelayTimeoutRef.current = null; // Timer has served its purpose or was cleared.
            
            // Re-check mount and state after async delay.
            if (!isMountedRef.current || renderState !== 'applying_config') { 
                logAction(`Redraw aborted after repaint delay (unmounted or state changed from 'applying_config').`); 
                return; 
            }

            logAction(`Calling redrawAllCanvases with capturedLayerConfigsToApply...`);
            if (typeof redrawAllCanvases !== 'function') throw new Error("redrawAllCanvases is not a function");
            redrawSuccess = await redrawAllCanvases(capturedLayerConfigsToApply);
            logAction(`redrawAllCanvases finished. Success: ${redrawSuccess}.`);
            if (!redrawSuccess) throw new Error("Redraw after config/token application failed.");

        } catch (error) {
            logAction(`Error during apply/redraw: ${error.message}`);
            setLoadingStatusMessage(`⚠ Error applying config: ${error.message}`);
            configApplySuccess = false; // Mark as failed
            redrawSuccess = false; 
        } finally {
            applyConfigPromiseRef.current = null; // Clear promise ref once logic completes or fails
            // Ensure repaintDelayTimeoutRef is cleared if an error occurred before it resolved naturally
            if (repaintDelayTimeoutRef.current) {
                clearTimeout(repaintDelayTimeoutRef.current);
                repaintDelayTimeoutRef.current = null;
            }
        }

        // Final state transition based on success/failure, only if still in 'applying_config'.
        if (isMountedRef.current && renderState === 'applying_config') {
            if (configApplySuccess && tokenApplySuccess && redrawSuccess) {
                logAction(`Apply & Redraw SUCCESS (Nonce ${nonceForThisApplicationCycle}). Starting animations...`);
                animationStateRef.current = 'running';
                if (typeof restartCanvasAnimations === 'function') { restartCanvasAnimations(); logAction(`Animations restarted.`); }
                else { logAction(`ERROR: restartCanvasAnimations function is missing!`); }

                logAction(`Moving to RENDERED state.`);
                logStateChange('rendered', 'Apply Success');
                lastAppliedNonceRef.current = nonceForThisApplicationCycle; 
            } else {
                logAction(`Apply or Redraw FAILED (Config: ${configApplySuccess}, Token: ${tokenApplySuccess}, Redraw: ${redrawSuccess}). Moving to 'error' state.`);
                logStateChange('error', 'Apply/Redraw Failed');
                setIsTransitioningInternal(false); // Ensure transition flag is reset on error
                animationStateRef.current = 'stopped';
            }
        } else {
            logAction(`Apply/Draw finished, but state changed during process (Current: ${renderState}). No final state transition from this effect run.`);
        }
    };

    applyConfigPromiseRef.current = applyAndDrawLogic(); // Store the promise

    // Cleanup function for this 'applying_config' effect.
    return () => {
        // If the effect re-runs or component unmounts while applyAndDrawLogic is "pending"
        // (specifically, while repaintDelayTimeoutRef might be active), clear the timer.
        if (repaintDelayTimeoutRef.current) {
            clearTimeout(repaintDelayTimeoutRef.current);
            repaintDelayTimeoutRef.current = null;
            logAction("Cleaned up repaintDelayTimeoutRef from applying_config effect's OWN cleanup.");
        }
        // The async function applyAndDrawLogic itself checks isMountedRef and renderState
        // to prevent state updates if it completes after cleanup.
    };

  }, [ // Dependencies for the 'applying_config' effect
      renderState, 
      configLoadNonce, layerConfigs, tokenAssignments, targetLayerConfigsForPreset, targetTokenAssignmentsForPreset,
      applyConfigurationsToManagers, applyTokenAssignments, redrawAllCanvases, 
      restartCanvasAnimations, setLoadingStatusMessage, logStateChange, logAction // Stable deps
    ]);

  // Effect to handle 'rendered' state (finalizing UI, starting animations, fading status message).
  useEffect(() => {
    // Clear any timers from previous runs of this effect or other states before proceeding.
    if (transitionEndTimeoutRef.current) { clearTimeout(transitionEndTimeoutRef.current); transitionEndTimeoutRef.current = null; }
    if (statusDisplayFadeTimeoutRef.current) { clearTimeout(statusDisplayFadeTimeoutRef.current); statusDisplayFadeTimeoutRef.current = null; }
    
    if (renderState === "rendered") {
        logAction(`State is 'rendered'. Handling post-render updates.`);
        // Make canvas visible if it's not already.
        if (!isCanvasVisibleInternal) {
            requestAnimationFrame(() => { // Use RAF for smoother visual update
                if (isMountedRef.current && renderState === "rendered") {
                    logAction(`Setting canvas VISIBLE (via RAF).`);
                    setIsCanvasVisibleInternal(true);
                    // Ensure animations are running if they should be.
                    if (animationStateRef.current !== 'running') {
                        logAction(`Ensuring animations are running post-render visibility set.`);
                        if (restartCanvasAnimations) restartCanvasAnimations();
                        animationStateRef.current = 'running';
                    }
                }
            });
        } else { // Canvas already visible, ensure animations are running.
             if (animationStateRef.current !== 'running') {
                 logAction(`Canvas already visible, ensuring animations are running.`);
                 if (restartCanvasAnimations) restartCanvasAnimations();
                 animationStateRef.current = 'running';
             }
        }
        // If transitioning, set a timer to clear the transition flag.
        if (isTransitioningInternal) { 
            logAction(`Transition flag active. Scheduling clear after ${CANVAS_FADE_DURATION}ms.`);
            transitionEndTimeoutRef.current = setTimeout(() => {
                transitionEndTimeoutRef.current = null; // Timer has fired
                if (isMountedRef.current && renderState === "rendered") { 
                    logAction(`Clearing transition flag.`);
                    setIsTransitioningInternal(false);
                }
            }, CANVAS_FADE_DURATION);
        }
        // If not fading status and not transitioning, start fading out the status message.
        if (!isStatusFadingOut && !isTransitioningInternal) { 
            logAction(`Starting status message fade out.`);
            setLoadingStatusMessage("Render complete."); 
            setIsStatusFadingOut(true);
            statusDisplayFadeTimeoutRef.current = setTimeout(() => {
                statusDisplayFadeTimeoutRef.current = null; // Timer has fired
                if (isMountedRef.current) { 
                    setIsStatusFadingOut(false);
                    logAction(`Status message fade out complete.`);
                }
            }, LOADING_FADE_DURATION);
        } else if (isTransitioningInternal && isStatusFadingOut) { // If transition starts during status fade, cancel fade.
            logAction(`Transition started during status fade. Cancelling fade out.`);
            setIsStatusFadingOut(false);
            // Explicitly clear the statusDisplayFadeTimeoutRef if it was active
            if(statusDisplayFadeTimeoutRef.current) {clearTimeout(statusDisplayFadeTimeoutRef.current); statusDisplayFadeTimeoutRef.current = null;}
        }
    } else { // Not in 'rendered' state
        // Reset flags and stop animations if not in a transition or application state.
        if (isStatusFadingOut) { setIsStatusFadingOut(false); }
        // Only reset transition flag if not actively fading out (which is a type of transition)
        if (isTransitioningInternal && renderState !== 'fading_out') { setIsTransitioningInternal(false); } 
        
        if (renderState !== 'applying_config' && renderState !== 'fading_out') {
            if (isCanvasVisibleInternal) setIsCanvasVisibleInternal(false);
            if (animationStateRef.current !== 'stopped') {
                if (stopAllAnimations) stopAllAnimations();
                animationStateRef.current = 'stopped';
            }
        }
    }

    // Cleanup function for this 'rendered' state effect.
    return () => { 
        if (transitionEndTimeoutRef.current) { clearTimeout(transitionEndTimeoutRef.current); transitionEndTimeoutRef.current = null; }
        if (statusDisplayFadeTimeoutRef.current) { clearTimeout(statusDisplayFadeTimeoutRef.current); statusDisplayFadeTimeoutRef.current = null; }
    };
  }, [renderState, isTransitioningInternal, isCanvasVisibleInternal, isStatusFadingOut, setLoadingStatusMessage, restartCanvasAnimations, stopAllAnimations, logStateChange, logAction]); // Stable deps

  // Memoized values for external consumption.
  const showStatusDisplay = useMemo(() => {
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