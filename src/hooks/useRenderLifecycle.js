// src/hooks/useRenderLifecycle.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import fallbackConfig from '../config/fallback-config.js'; // Local config

const CANVAS_FADE_DURATION = 250; // User's desired duration for preset fade
const LOADING_FADE_DURATION = 400; // Duration for the loading status message to fade out
const FORCE_REPAINT_DELAY = 50; // Small delay before redrawing to allow DOM updates
const ANIMATION_CONTINUE_DURING_TRANSITION = true;
const CONNECTING_MESSAGE = "Connecting";
const LOADING_CONFIG_MESSAGE = "Loading Configuration";
const APPLYING_CONFIG_MESSAGE = "Applying Configuration";
const TRANSITION_MESSAGE = "Transitioning"; // Ensure this is the message used

/**
 * @typedef {object} RenderLifecycleOptions
 * @property {boolean} managersReady - Indicates if canvas managers are initialized.
 * @property {boolean} defaultImagesLoaded - Indicates if default images for canvases have loaded.
 * @property {boolean} isInitiallyResolved - Indicates if the initial configuration (preset or fallback) has been resolved.
 * @property {boolean} hasValidDimensions - Indicates if the canvas container has valid dimensions.
 * @property {boolean} isContainerObservedVisible - Indicates if the canvas container is visible in the viewport.
 * @property {number} configLoadNonce - A nonce that changes when a new configuration preset is loaded.
 * @property {string|null} [currentConfigName] - The name of the currently loaded configuration preset.
 * @property {string|null} currentProfileAddress - The address of the current Universal Profile being viewed.
 * @property {object} [layerConfigs] - The current layer configurations active in the `VisualConfigContext`.
 * @property {object|null} targetLayerConfigsForPreset - The layer configurations to be applied from a newly loaded preset.
 * @property {object|null} targetTokenAssignmentsForPreset - The token assignments to be applied from a newly loaded preset.
 * @property {Error|string|null} loadError - Error object or message from preset loading.
 * @property {Error|null} upInitializationError - Error from `UpProvider` initialization.
 * @property {Error|null} upFetchStateError - Error from `UpProvider` client fetching.
 * @property {() => void} stopAllAnimations - Function to stop all canvas animations.
 * @property {(configs: object) => void} applyConfigurationsToManagers - Function to apply full configurations to canvas managers.
 * @property {(assignments: object) => Promise<void>} applyTokenAssignments - Function to apply token assignments to canvas managers.
 * @property {(configs?: object|null) => Promise<boolean>} redrawAllCanvases - Function to force redraw all canvases.
 * @property {() => void} restartCanvasAnimations - Function to restart all canvas animations.
 * @property {React.RefObject<Object.<string, import('../utils/CanvasManager').default>>} managerInstancesRef - Ref to the canvas manager instances.
 * @property {boolean} [isLoading] - Optional: Explicit loading state, typically from preset management. Defaults to true if undefined.
 */

/**
 * @typedef {'initializing' | 'waiting_layout' | 'initializing_managers' | 'loading_defaults' | 'resolving_initial_config' | 'fading_out' | 'applying_config' | 'rendered' | 'error'} RenderStateValue - Possible states of the render lifecycle.
 */

/**
 * @typedef {object} RenderLifecycleAPI
 * @property {RenderStateValue} renderState - The current state of the rendering lifecycle.
 * @property {string} loadingStatusMessage - A message indicating the current loading or status.
 * @property {boolean} isStatusFadingOut - True if the status message display is currently fading out.
 * @property {boolean} showStatusDisplay - True if the loading/status display should be visible.
 * @property {boolean} showRetryButton - True if a retry button should be shown (typically in a recoverable error state).
 * @property {boolean} isTransitioning - True if a preset transition (fade-out/fade-in) is currently active.
 * @property {Set<string>} outgoingLayerIdsOnTransitionStart - A set of layer IDs that were active when a transition started, used to manage their fade-out.
 * @property {boolean} makeIncomingCanvasVisible - A flag to signal when incoming canvases (for a new preset) should become visible after a transition.
 * @property {boolean} isAnimating - True if canvas animations are considered to be (or should be) running.
 * @property {() => void} handleManualRetry - Function to attempt a manual retry from an error state.
 * @property {() => void} resetLifecycle - Function to reset the entire render lifecycle to its initial state.
 */
export function useRenderLifecycle(options) {
  const {
    managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
    isContainerObservedVisible, configLoadNonce, currentProfileAddress,
    layerConfigs,
    targetLayerConfigsForPreset,
    targetTokenAssignmentsForPreset,
    loadError, upInitializationError, upFetchStateError,
    stopAllAnimations, applyConfigurationsToManagers,
    applyTokenAssignments,
    redrawAllCanvases,
    restartCanvasAnimations,
    managerInstancesRef,
  } = options;

  const currentIsLoading = options.isLoading === undefined ? true : options.isLoading;

  const [renderState, setRenderStateInternal] = useState('initializing');
  const [loadingStatusMessage, setLoadingStatusMessageState] = useState(CONNECTING_MESSAGE);
  const [isStatusFadingOut, setIsStatusFadingOut] = useState(false);
  const [isTransitioningInternal, setIsTransitioningInternal] = useState(false);
  const [makeIncomingCanvasVisible, setMakeIncomingCanvasVisible] = useState(false);

  const isMountedRef = useRef(false);
  const lastAppliedNonceRef = useRef(0);
  const statusDisplayFadeTimeoutRef = useRef(null);
  const transitionEndTimeoutRef = useRef(null);
  const fadeOutCompletionTimeoutRef = useRef(null);
  const repaintDelayTimeoutRef = useRef(null);
  const applyConfigPromiseRef = useRef(null);
  const animationStateRef = useRef('stopped');
  const outgoingLayerIdsOnTransitionStartRef = useRef(new Set());
  const prevAddressRef = useRef(currentProfileAddress);


  const logAction = useCallback((actionName, details = '') => {
    if (import.meta.env.DEV) {
      console.log(`%c[RenderLifecycle] Action: ${actionName}`, 'color: purple;', details);
    }
  }, []);

  const logStateChange = useCallback((newState, reason) => {
    setRenderStateInternal(prevState => {
      if (prevState !== newState) {
        if (import.meta.env.DEV) {
          console.log(`%c[RenderLifecycle] State CHANGE: ${prevState} -> ${newState} (Reason: ${reason})`, 'color: blue; font-weight: bold;');
        }
        return newState;
      }
      return prevState;
    });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    logAction("Component Mounted");
    return () => {
      logAction("Component Unmounting - Cleaning up ALL timers");
      isMountedRef.current = false;
      if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
      if (fadeOutCompletionTimeoutRef.current) clearTimeout(fadeOutCompletionTimeoutRef.current);
      if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current);
      applyConfigPromiseRef.current = null;
    };
  }, [logAction]);

  const setLoadingStatusMessage = useCallback((message, forceNoFade = false) => {
    if (isMountedRef.current) {
      setLoadingStatusMessageState(prev => {
          if (prev !== message || forceNoFade) { 
              logAction("Set Status Message", `${message}${forceNoFade ? ' (forced, no fade reset)' : ''}`);
              if (message !== "Render complete" || forceNoFade) {
                setIsStatusFadingOut(false);
                if (statusDisplayFadeTimeoutRef.current) {
                    clearTimeout(statusDisplayFadeTimeoutRef.current);
                    statusDisplayFadeTimeoutRef.current = null;
                }
              }
              return message;
          }
          return prev;
      });
    }
  }, [logAction]); 

  const resetLifecycle = useCallback(() => {
      if (!isMountedRef.current) return;
      logAction(`!!! Resetting Lifecycle Triggered !!!`);
      animationStateRef.current = 'pending_stop';
      logStateChange("initializing", "External Reset");
      setLoadingStatusMessage(CONNECTING_MESSAGE, true); 
      lastAppliedNonceRef.current = 0;
      setIsTransitioningInternal(false);
      setMakeIncomingCanvasVisible(false);
      outgoingLayerIdsOnTransitionStartRef.current.clear();
      applyConfigPromiseRef.current = null;
      setTimeout(() => {
        if (isMountedRef.current && animationStateRef.current === 'pending_stop') {
          logAction(`Executing delayed animation stop after reset`);
          if (stopAllAnimations) stopAllAnimations();
          animationStateRef.current = 'stopped';
        }
      }, CANVAS_FADE_DURATION);
      if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
      if (fadeOutCompletionTimeoutRef.current) clearTimeout(fadeOutCompletionTimeoutRef.current);
      if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current);
  }, [stopAllAnimations, setLoadingStatusMessage, logAction, logStateChange]);

  const handleManualRetry = useCallback(() => {
    if (!isMountedRef.current || renderState !== 'error') return;
    logAction(`Manual Retry Triggered.`);
    if (hasValidDimensions) {
      logAction(`Manual Retry: Dimensions valid -> 'applying_config'.`);
      setLoadingStatusMessage(LOADING_CONFIG_MESSAGE, true); 
      logStateChange('applying_config', 'Manual Retry (Valid Dim)');
    } else {
      logAction(`Manual Retry: No valid dimensions. -> 'waiting_layout'`);
      setLoadingStatusMessage("⚠ Still waiting for layout.", true); 
      logStateChange('waiting_layout', 'Manual Retry (No Valid Dim)');
    }
  }, [renderState, hasValidDimensions, setLoadingStatusMessage, logAction, logStateChange]);

  useEffect(() => {
    const criticalError = upInitializationError || upFetchStateError || (loadError && !isInitiallyResolved);
    if (criticalError && renderState !== 'error') {
      const errorSource = upInitializationError ? 'UP Init Error' : upFetchStateError ? 'UP Fetch Error' : 'Initial Load Error';
      const errorMessage = (criticalError)?.message || "Unknown critical error.";
      setLoadingStatusMessage(`⚠ Critical Error: ${errorMessage}`, true); 
      logStateChange('error', `${errorSource}: ${errorMessage}`);
      animationStateRef.current = 'stopped';
      if (stopAllAnimations) stopAllAnimations();
      setIsTransitioningInternal(false);
      setMakeIncomingCanvasVisible(false);
    }
  }, [upInitializationError, upFetchStateError, loadError, isInitiallyResolved, renderState, setLoadingStatusMessage, logStateChange, stopAllAnimations]);

  useEffect(() => {
    if (isMountedRef.current && isInitiallyResolved) {
      const previousAddress = prevAddressRef.current;
      if (previousAddress !== currentProfileAddress) {
         if ( (previousAddress && !currentProfileAddress) || (previousAddress && currentProfileAddress && previousAddress !== currentProfileAddress) ) {
              logAction(`Profile address changed from ${previousAddress||'null'} to ${currentProfileAddress||'null'}. Resetting lifecycle.`);
              resetLifecycle();
         }
         prevAddressRef.current = currentProfileAddress;
      }
    } else if (prevAddressRef.current !== currentProfileAddress) {
         prevAddressRef.current = currentProfileAddress;
     }
  }, [currentProfileAddress, isInitiallyResolved, resetLifecycle, logAction]);

  // Main state machine logic
  useEffect(() => {
    const currentState = renderState;
    if (currentState === 'error' || currentState === 'fading_out' || currentState === 'applying_config') {
        return;
    }

    const hasNewConfigToApply = configLoadNonce > lastAppliedNonceRef.current;

    if (!hasValidDimensions) {
        if (currentState !== 'waiting_layout') {
            setLoadingStatusMessage("Waiting for layout...", true);
            logStateChange('waiting_layout', 'No Layout');
        }
    } else if (!managersReady) {
        if (currentState !== 'initializing_managers') {
            setLoadingStatusMessage("Initializing managers...", true);
            logStateChange('initializing_managers', 'Layout OK -> Init Mgrs');
        }
    } else if (!defaultImagesLoaded) {
        if (currentState !== 'loading_defaults') {
            setLoadingStatusMessage("Loading defaults...", true);
            logStateChange('loading_defaults', 'Mgrs OK -> Load Defaults');
        }
    } else if (!isInitiallyResolved) {
        if (currentState !== 'resolving_initial_config') {
            setLoadingStatusMessage(currentIsLoading ? LOADING_CONFIG_MESSAGE : CONNECTING_MESSAGE, true);
            logStateChange('resolving_initial_config', `Defaults OK -> Resolve Initial (isLoading: ${currentIsLoading})`);
        }
    } else {
        if (hasNewConfigToApply) {
            if (currentState === 'rendered' || currentState === 'applying_config' || currentState === 'fading_out') {
                logAction(`New config nonce ${configLoadNonce} detected. Current state: ${currentState}. Starting transition.`);
                
                setLoadingStatusMessage(TRANSITION_MESSAGE, true); 

                setIsTransitioningInternal(true);
                setMakeIncomingCanvasVisible(false);
                outgoingLayerIdsOnTransitionStartRef.current = new Set(Object.keys(layerConfigs || {}));

                if (ANIMATION_CONTINUE_DURING_TRANSITION && animationStateRef.current === 'running') {
                    animationStateRef.current = 'running_during_transition';
                } else if (!ANIMATION_CONTINUE_DURING_TRANSITION && animationStateRef.current === 'running') {
                    if (stopAllAnimations) stopAllAnimations();
                    animationStateRef.current = 'stopped_for_transition';
                }
                logStateChange('fading_out', 'New Config Detected (from rendered/applying)');
            } else {
                logAction(`New config nonce ${configLoadNonce} detected during ${currentState}. Moving to applying_config directly.`);
                setLoadingStatusMessage(APPLYING_CONFIG_MESSAGE, true);
                logStateChange('applying_config', `${currentState} -> Apply New/Fallback (Direct)`);
            }
        } else if (currentState !== 'rendered') {
            logAction(`All prerequisites met, no new config. Current state ${currentState}. Moving to rendered.`);
            logStateChange('rendered', `${currentState} -> Rendered (Initial Fallback/Default Applied)`);
        }
    }
  }, [
      renderState, managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
      configLoadNonce, currentIsLoading, layerConfigs, 
      setLoadingStatusMessage, logStateChange, logAction, stopAllAnimations
    ]);

  // Effect for 'fading_out' state
  useEffect(() => {
      if (renderState !== 'fading_out') {
        if (fadeOutCompletionTimeoutRef.current) clearTimeout(fadeOutCompletionTimeoutRef.current);
        return;
      }
      logAction(`FADING_OUT: Outgoing canvases should be visually fading out (CSS opacity 0 over ${CANVAS_FADE_DURATION}ms). Message: ${loadingStatusMessage}`);
      if (loadingStatusMessage !== TRANSITION_MESSAGE) {
          setLoadingStatusMessage(TRANSITION_MESSAGE, true); 
      }
      if (fadeOutCompletionTimeoutRef.current) clearTimeout(fadeOutCompletionTimeoutRef.current);

      fadeOutCompletionTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && renderState === 'fading_out') {
          logAction(`FADING_OUT: Visual fade-out duration (${CANVAS_FADE_DURATION}ms) complete. -> APPLYING_CONFIG.`);
          if (!ANIMATION_CONTINUE_DURING_TRANSITION) {
            if (animationStateRef.current !== 'stopped') {
                if (stopAllAnimations) stopAllAnimations();
                animationStateRef.current = 'stopped';
            }
          } else {
            if (animationStateRef.current === 'stopped_for_transition' || animationStateRef.current === 'running') {
                animationStateRef.current = 'running_during_transition';
            }
          }
          setLoadingStatusMessage(APPLYING_CONFIG_MESSAGE, true); 
          logStateChange('applying_config', 'Fade Out Complete');
        }
      }, CANVAS_FADE_DURATION);
      return () => { if (fadeOutCompletionTimeoutRef.current) clearTimeout(fadeOutCompletionTimeoutRef.current); };
  }, [renderState, stopAllAnimations, logAction, logStateChange, setLoadingStatusMessage, loadingStatusMessage]);

  // Effect for 'applying_config' state
  useEffect(() => {
    if (renderState !== 'applying_config') {
      if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current);
      applyConfigPromiseRef.current = null;
      return;
    }
    if (applyConfigPromiseRef.current) {
      logAction(`APPLYING_CONFIG: Application process already in progress for nonce ${configLoadNonce}. Skipping.`);
      return;
    }

    logAction(`APPLYING_CONFIG: Starting configuration application process for nonce ${configLoadNonce}.`);
    if (loadingStatusMessage !== APPLYING_CONFIG_MESSAGE) {
        setLoadingStatusMessage(APPLYING_CONFIG_MESSAGE, true); 
    }

    const configsToApply = targetLayerConfigsForPreset || fallbackConfig.layers;
    const tokensToApply = targetTokenAssignmentsForPreset || fallbackConfig.tokenAssignments;
    const nonceForThisCycle = configLoadNonce;

    const applyAndDrawLogic = async () => {
        if (!isMountedRef.current || renderState !== 'applying_config') {
            logAction(`APPLYING_CONFIG: Aborted applyAndDrawLogic (unmounted or state changed).`);
            applyConfigPromiseRef.current = null; return;
        }
        let configApplySuccess = true, tokenApplySuccess = true, redrawSuccess = false;
        try {
            logAction(`APPLYING_CONFIG: Applying visual configs for nonce ${nonceForThisCycle}.`);
            if (applyConfigurationsToManagers) applyConfigurationsToManagers(configsToApply);

            logAction(`APPLYING_CONFIG: Applying token assignments for nonce ${nonceForThisCycle}.`);
            if (applyTokenAssignments) await applyTokenAssignments(tokensToApply);

            await new Promise(resolve => {
                if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current);
                repaintDelayTimeoutRef.current = setTimeout(resolve, FORCE_REPAINT_DELAY);
            });
            if (!isMountedRef.current || renderState !== 'applying_config') {
                logAction(`APPLYING_CONFIG: Aborted after repaint delay (unmounted or state changed).`);
                applyConfigPromiseRef.current = null; return;
            }
            repaintDelayTimeoutRef.current = null;

            logAction(`APPLYING_CONFIG: Redrawing all canvases with new config for nonce ${nonceForThisCycle}.`);
            if (redrawAllCanvases) redrawSuccess = await redrawAllCanvases(configsToApply);
            else redrawSuccess = true;

            if (!redrawSuccess) throw new Error("Redraw after config/token application failed.");

        } catch (error) {
            logAction(`APPLYING_CONFIG: Error during apply/redraw: ${error.message}`);
            if (import.meta.env.DEV) console.error(error);
            setLoadingStatusMessage(`⚠ Error applying config: ${error.message}`, true);
            configApplySuccess = false; redrawSuccess = false;
        } finally {
            applyConfigPromiseRef.current = null;
            if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current);
        }

        if (isMountedRef.current && renderState === 'applying_config') {
            if (configApplySuccess && tokenApplySuccess && redrawSuccess) {
                logAction(`APPLYING_CONFIG: Apply & Redraw SUCCESS (Nonce ${nonceForThisCycle}). -> RENDERED.`);
                // setMakeIncomingCanvasVisible(true); // Moved to 'rendered' state effect
                if (animationStateRef.current !== 'running') {
                    if (restartCanvasAnimations) restartCanvasAnimations();
                    animationStateRef.current = 'running';
                }
                logStateChange('rendered', 'Apply Success'); 
                lastAppliedNonceRef.current = nonceForThisCycle;
            } else {
                logAction(`APPLYING_CONFIG: Apply or Redraw FAILED. -> ERROR.`);
                logStateChange('error', 'Apply/Redraw Failed');
                setIsTransitioningInternal(false);
                setMakeIncomingCanvasVisible(false);
                animationStateRef.current = 'stopped';
                if (stopAllAnimations) stopAllAnimations();
            }
        }
    };
    applyConfigPromiseRef.current = applyAndDrawLogic();
    return () => { if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current); };
  }, [
      renderState, configLoadNonce, targetLayerConfigsForPreset, targetTokenAssignmentsForPreset,
      applyConfigurationsToManagers, applyTokenAssignments, redrawAllCanvases, restartCanvasAnimations,
      setLoadingStatusMessage, logStateChange, logAction, stopAllAnimations, loadingStatusMessage
  ]);

  // Effect for 'rendered' state
  useEffect(() => {
    if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);

    if (renderState === "rendered") {
      setMakeIncomingCanvasVisible(true); // Make visuals appear as soon as 'rendered' state is hit
      
      setLoadingStatusMessage("Render complete"); 
      setIsStatusFadingOut(true); 

      if (isTransitioningInternal) {
        logAction(`RENDERED: Transition was active. Waiting ${CANVAS_FADE_DURATION}ms for incoming canvas fade-in to visually complete.`);
        transitionEndTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && renderState === "rendered") {
            logAction(`RENDERED: Incoming canvas visual fade-in duration complete. Clearing isTransitioningInternal.`);
            setIsTransitioningInternal(false);
            
            if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
            statusDisplayFadeTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) setIsStatusFadingOut(false);
            }, LOADING_FADE_DURATION);

            outgoingLayerIdsOnTransitionStartRef.current.forEach(layerId => {
                const newConfigForThisLayer = targetLayerConfigsForPreset?.[layerId];
                if (!newConfigForThisLayer || !newConfigForThisLayer.enabled) {
                    const manager = managerInstancesRef?.current?.[layerId];
                    if (manager && typeof manager.applyFullConfig === 'function') {
                        manager.applyFullConfig({ ...(manager.getDefaultConfig?.() || {}), enabled: false });
                    }
                }
            });
            outgoingLayerIdsOnTransitionStartRef.current.clear();
          }
        }, CANVAS_FADE_DURATION);
      } else { // Not transitioning, e.g., initial load completion
        if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
        statusDisplayFadeTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setIsStatusFadingOut(false);
        }, LOADING_FADE_DURATION);
      }
      if (animationStateRef.current !== 'running' && isContainerObservedVisible) {
        logAction("RENDERED: Ensuring animations are running.");
        if (restartCanvasAnimations) restartCanvasAnimations();
        animationStateRef.current = 'running';
      }
    } else { 
      // If we move away from 'rendered', ensure makeIncomingCanvasVisible is false
      // unless we are in a state that explicitly manages it (like applying_config or fading_out)
      if (renderState !== 'applying_config' && renderState !== 'fading_out') {
        if (makeIncomingCanvasVisible) setMakeIncomingCanvasVisible(false);
      }

      if (renderState !== 'fading_out' && renderState !== 'applying_config') {
        if (isTransitioningInternal) setIsTransitioningInternal(false);
        if (animationStateRef.current === 'running') {
          logAction(`State changed from RENDERED to ${renderState}. Stopping animations.`);
          if (stopAllAnimations) stopAllAnimations();
          animationStateRef.current = 'stopped';
        }
      }
    }
    return () => {
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
      if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
    };
  }, [
      renderState, isTransitioningInternal, makeIncomingCanvasVisible, isContainerObservedVisible,
      setLoadingStatusMessage, restartCanvasAnimations, stopAllAnimations, logAction,
      managerInstancesRef, targetLayerConfigsForPreset, isStatusFadingOut, 
      setMakeIncomingCanvasVisible // Added setMakeIncomingCanvasVisible as a dependency
    ]);

  const showStatusDisplay = useMemo(() => {
    return renderState !== 'rendered' || isTransitioningInternal || isStatusFadingOut;
  }, [renderState, isTransitioningInternal, isStatusFadingOut]);

  const showRetryButton = useMemo(() => {
    return renderState === 'error' && !upInitializationError && !upFetchStateError && !(loadError && !isInitiallyResolved);
  }, [renderState, upInitializationError, upFetchStateError, loadError, isInitiallyResolved]);

  return useMemo(() => ({
    renderState,
    loadingStatusMessage,
    isStatusFadingOut,
    showStatusDisplay,
    showRetryButton,
    isTransitioning: isTransitioningInternal,
    outgoingLayerIdsOnTransitionStart: outgoingLayerIdsOnTransitionStartRef.current,
    makeIncomingCanvasVisible,
    isAnimating: animationStateRef.current === 'running' || animationStateRef.current === 'running_during_transition',
    handleManualRetry,
    resetLifecycle,
  }), [
    renderState, loadingStatusMessage, isStatusFadingOut, showStatusDisplay, showRetryButton,
    isTransitioningInternal, makeIncomingCanvasVisible, handleManualRetry, resetLifecycle
  ]);
}