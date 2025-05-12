// src/hooks/useRenderLifecycle.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import fallbackConfig from '../config/fallback-config.js'; // Import fallback for safety

// Constants for timing and display messages
const LOADING_FADE_DURATION = 600;
const CANVAS_FADE_DURATION = 1000;
const FORCE_REPAINT_DELAY = 50;
const ANIMATION_CONTINUE_DURING_TRANSITION = true;
const CONNECTING_MESSAGE = "Connecting..."; // Initial message
const LOADING_CONFIG_MESSAGE = "Loading Configuration..."; // Message while waiting for initial preset
const APPLYING_MESSAGE = "Applying configuration...";
const RENDERING_MESSAGE = "Rendering visuals...";
const TRANSITION_MESSAGE = "Transitioning...";

export function useRenderLifecycle(options) {
  const {
    managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
    isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress,
    layerConfigs, // This is from VisualConfigContext
    tokenAssignments, // This is from VisualConfigContext
    targetLayerConfigsForPreset, // New: definitive from PresetManagementContext for preset loads
    targetTokenAssignmentsForPreset, // New: definitive from PresetManagementContext for preset loads
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
  const applyConfigPromiseRef = useRef(null);
  const animationStateRef = useRef('stopped');
  const stateEntryTimeRef = useRef(Date.now());


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

  const logAction = useCallback((actionName, details = '') => {
    if (import.meta.env.DEV) {
      console.log(`%c[DEBUG RenderLifecycle] Action: ${actionName}`, 'color: purple;', details);
    }
  }, []);

  const logCheck = useCallback((currentState, conditions) => {
    if (import.meta.env.DEV) {
     console.log(`%c[DEBUG RenderLifecycle] State Check (${currentState}):`, 'color: #888;', JSON.parse(JSON.stringify(conditions || {})));
    }
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
      try { throw new Error("Reset Trace"); } catch (e) { 
        if (import.meta.env.DEV) {
          console.warn(e.stack); 
        }
      }

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
          if (stopAllAnimations) stopAllAnimations(); else {
            if (import.meta.env.DEV) {
              console.error("stopAllAnimations function is missing in resetLifecycle!");
            }
          }
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

  useEffect(() => {
    const currentState = renderState;
    logCheck(currentState, {
      managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
      isContainerObservedVisible, configLoadNonce, currentProfileAddress,
      lastAppliedNonce: lastAppliedNonceRef.current, isLoading: currentIsLoading
    });

    if (currentState === 'error' || currentState === 'fading_out' || currentState === 'applying_config') {
        logAction(`Skipping state machine check (Current State: ${currentState})`);
        return;
    }

    const hasNewConfigToApply = configLoadNonce > lastAppliedNonceRef.current;
    const configNameDisplay = currentConfigName || (configLoadNonce > 0 ? 'New' : 'Default');

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
    } else { 
        if (hasNewConfigToApply) {
            if (currentState === 'rendered') {
                logAction(`Rendered -> FADING_OUT (New config Nonce ${configLoadNonce})`);
                if (ANIMATION_CONTINUE_DURING_TRANSITION) { animationStateRef.current = 'running_during_transition'; }
                logStateChange('fading_out', 'Rendered -> New Config');
                setLoadingStatusMessage(TRANSITION_MESSAGE);
            } else {
                logAction(`${currentState} -> APPLYING_CONFIG (All systems ready, new config Nonce ${configLoadNonce})`);
                setLoadingStatusMessage(`Applying '${configNameDisplay}'...`);
                logStateChange('applying_config', `${currentState} -> Apply New/Fallback`);
            }
        } else if (currentState !== 'rendered') { 
            logAction(`${currentState} -> RENDERED (All systems ready, no *new* nonce-driven config)`);
            logStateChange('rendered', `${currentState} -> Rendered (No New Conf / Initial Fallback)`);
        }
    }
  }, [
      renderState, managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions,
      isContainerObservedVisible, configLoadNonce, currentConfigName, currentProfileAddress,
      setLoadingStatusMessage, logStateChange, logAction, logCheck, resetLifecycle,
      currentIsLoading
    ]);


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

      return () => { if (fadeOutTimeoutRef.current) { clearTimeout(fadeOutTimeoutRef.current); fadeOutTimeoutRef.current = null; } };
  }, [renderState, configLoadNonce, stopAllAnimations, setLoadingStatusMessage, logStateChange, logAction]);

  useEffect(() => {
    if (renderState !== 'applying_config') return;
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

    if (isApplyingForNewNonce) {
        logAction(`Applying NEW preset (Nonce ${configLoadNonce} vs LastApplied ${lastAppliedNonceRef.current}). Prioritizing targetLayerConfigsForPreset and targetTokenAssignmentsForPreset.`);
        // Prioritize definitive preset data. Fallback to VisualConfigContext data, then to empty/default.
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
    } else {
        logAction(`Re-applying current config or manual retry (Nonce ${configLoadNonce} same as LastApplied ${lastAppliedNonceRef.current}). Using layerConfigs from VisualConfigContext.`);
        capturedLayerConfigsToApply = layerConfigs ?? fallbackConfig.layers ?? {};
        capturedTokenAssignmentsToApply = tokenAssignments ?? fallbackConfig.tokenAssignments ?? {};
    }
    
    const nonceForThisApplicationCycle = configLoadNonce;

    const applyAndDrawLogic = async () => {
        if (!isMountedRef.current || renderState !== 'applying_config') { logAction(`Core apply/draw aborted (unmounted or state changed).`); return; }

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
            tokenApplySuccess = true;

            await new Promise(resolve => setTimeout(resolve, FORCE_REPAINT_DELAY));
            if (!isMountedRef.current || renderState !== 'applying_config') { logAction(`Redraw aborted after delay (unmounted or state changed).`); return; }

            logAction(`Calling redrawAllCanvases with (again) capturedLayerConfigsToApply...`);
            if (typeof redrawAllCanvases !== 'function') throw new Error("redrawAllCanvases is not a function");
            redrawSuccess = await redrawAllCanvases(capturedLayerConfigsToApply);
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
                setIsTransitioningInternal(false);
                animationStateRef.current = 'stopped';
            }
        } else {
            logAction(`Apply/Draw finished, but state changed during process (Current: ${renderState}). No final state transition from this effect run.`);
        }
    };

    applyConfigPromiseRef.current = applyAndDrawLogic();
  }, [
      renderState, 
      configLoadNonce, layerConfigs, tokenAssignments, targetLayerConfigsForPreset, targetTokenAssignmentsForPreset,
      applyConfigurationsToManagers, applyTokenAssignments, redrawAllCanvases, 
      restartCanvasAnimations, setLoadingStatusMessage, logStateChange, logAction
    ]);

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
    } else { 
        if (isStatusFadingOut) { setIsStatusFadingOut(false); }
        if (transitionEndTimeoutRef.current) { clearTimeout(transitionEndTimeoutRef.current); transitionEndTimeoutRef.current = null; }
        if (isTransitioningInternal) { setIsTransitioningInternal(false); }
        if (renderState !== 'applying_config' && renderState !== 'fading_out') {
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