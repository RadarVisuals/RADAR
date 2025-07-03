// src/hooks/useRenderLifecycle.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import fallbackConfig from '../config/fallback-config.js';

const CANVAS_FADE_DURATION = 250;
const LOADING_FADE_DURATION = 400;
const FORCE_REPAINT_DELAY = 50;
const ANIMATION_CONTINUE_DURING_TRANSITION = true;
const CONNECTING_MESSAGE = "Connecting";
const LOADING_CONFIG_MESSAGE = "Loading Configuration";
const APPLYING_CONFIG_MESSAGE = "Applying Configuration";
const TRANSITION_MESSAGE = "Transitioning";

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
    return () => {
      isMountedRef.current = false;
      if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
      if (fadeOutCompletionTimeoutRef.current) clearTimeout(fadeOutCompletionTimeoutRef.current);
      if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current);
      applyConfigPromiseRef.current = null;
    };
  }, []);

  const setLoadingStatusMessage = useCallback((message, forceNoFade = false) => {
    if (isMountedRef.current) {
      setLoadingStatusMessageState(prev => {
        if (prev !== message || forceNoFade) {
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
  }, []);

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
        if (stopAllAnimations) stopAllAnimations();
        animationStateRef.current = 'stopped';
      }
    }, CANVAS_FADE_DURATION);
  }, [stopAllAnimations, setLoadingStatusMessage, logAction, logStateChange]);

  // --- THIS IS THE FIX ---
  // The definition for handleManualRetry was missing.
  const handleManualRetry = useCallback(() => {
    if (!isMountedRef.current || renderState !== 'error') return;
    logAction(`Manual Retry Triggered.`);
    
    // Check for critical, unrecoverable errors first
    const criticalError = upInitializationError || upFetchStateError;
    if (criticalError) {
        logAction(`Manual Retry: Blocked by critical UP error.`);
        // Optionally show a toast to the user
        return;
    }

    logAction(`Manual Retry: Attempting to recover by moving to 'applying_config'.`);
    setLoadingStatusMessage(APPLYING_CONFIG_MESSAGE, true);
    logStateChange('applying_config', 'Manual Retry');

  }, [renderState, upInitializationError, upFetchStateError, setLoadingStatusMessage, logAction, logStateChange]);
  // --- END FIX ---

  useEffect(() => {
    const criticalError = upInitializationError || upFetchStateError || (loadError && !isInitiallyResolved);
    if (criticalError && renderState !== 'error') {
      const errorSource = upInitializationError ? 'UP Init Error' : upFetchStateError ? 'UP Fetch Error' : 'Initial Load Error';
      const errorMessage = criticalError.message || "Unknown critical error.";
      setLoadingStatusMessage(`⚠ Critical Error: ${errorMessage}`, true);
      logStateChange('error', `${errorSource}: ${errorMessage}`);
      animationStateRef.current = 'stopped';
      if (stopAllAnimations) stopAllAnimations();
    }
  }, [upInitializationError, upFetchStateError, loadError, isInitiallyResolved, renderState, setLoadingStatusMessage, logStateChange, stopAllAnimations]);

  useEffect(() => {
    if (isMountedRef.current) {
      const previousAddress = prevAddressRef.current;
      if (previousAddress !== currentProfileAddress) {
        logAction(`Profile address changed from ${previousAddress || 'null'} to ${currentProfileAddress || 'null'}. Resetting lifecycle.`);
        resetLifecycle();
        prevAddressRef.current = currentProfileAddress;
      }
    }
  }, [currentProfileAddress, resetLifecycle, logAction]);

  useEffect(() => {
    const currentState = renderState;
    if (['error', 'fading_out', 'applying_config'].includes(currentState)) {
      return;
    }
    const hasNewConfigToApply = configLoadNonce > lastAppliedNonceRef.current;
    if (!isInitiallyResolved) {
      if (!hasValidDimensions) {
        if (currentState !== 'waiting_layout') logStateChange('waiting_layout', 'Awaiting Layout');
      } else if (!managersReady) {
        if (currentState !== 'initializing_managers') logStateChange('initializing_managers', 'Awaiting Managers');
      } else if (!defaultImagesLoaded) {
        if (currentState !== 'loading_defaults') logStateChange('loading_defaults', 'Awaiting Default Assets');
      } else {
        if (currentState !== 'resolving_initial_config') logStateChange('resolving_initial_config', 'Awaiting Workspace Resolution');
      }
      return;
    }
    if (hasNewConfigToApply) {
      if (currentState === 'rendered') {
        logAction(`New config nonce ${configLoadNonce} detected while rendered. Starting visual transition.`);
        setLoadingStatusMessage(TRANSITION_MESSAGE, true);
        setIsTransitioningInternal(true);
        setMakeIncomingCanvasVisible(false);
        outgoingLayerIdsOnTransitionStartRef.current = new Set(Object.keys(layerConfigs || {}));
        logStateChange('fading_out', 'New Preset Selected');
      } else {
        logAction(`Initial config (nonce ${configLoadNonce}) resolved. Applying directly.`);
        logStateChange('applying_config', 'Initial Config Resolved');
      }
    } else if (currentState !== 'rendered') {
      logAction(`Initial resolution complete with no new data. Moving to rendered state.`);
      logStateChange('rendered', `Initial Empty Workspace Resolved`);
    }
  }, [renderState, managersReady, defaultImagesLoaded, isInitiallyResolved, hasValidDimensions, configLoadNonce, layerConfigs, logStateChange, logAction, stopAllAnimations]);

  useEffect(() => {
    if (renderState === 'waiting_layout') setLoadingStatusMessage("Waiting for layout...", true);
    else if (renderState === 'initializing_managers') setLoadingStatusMessage("Initializing managers...", true);
    else if (renderState === 'loading_defaults') setLoadingStatusMessage("Loading defaults...", true);
    else if (renderState === 'resolving_initial_config') setLoadingStatusMessage(currentIsLoading ? LOADING_CONFIG_MESSAGE : CONNECTING_MESSAGE, true);
  }, [renderState, currentIsLoading, setLoadingStatusMessage]);

  useEffect(() => {
    if (renderState !== 'fading_out') return;
    const timer = setTimeout(() => {
      if (isMountedRef.current && renderState === 'fading_out') {
        logStateChange('applying_config', 'Fade Out Complete');
      }
    }, CANVAS_FADE_DURATION);
    return () => clearTimeout(timer);
  }, [renderState, logStateChange]);

  useEffect(() => {
    if (renderState !== 'applying_config') return;
    if (applyConfigPromiseRef.current) return;
    const nonceForThisCycle = configLoadNonce;
    const applyAndDrawLogic = async () => {
      const configsToApply = targetLayerConfigsForPreset || fallbackConfig.layers;
      const tokensToApply = targetTokenAssignmentsForPreset || fallbackConfig.tokenAssignments;
      try {
        if (applyConfigurationsToManagers) applyConfigurationsToManagers(configsToApply);
        if (applyTokenAssignments) await applyTokenAssignments(tokensToApply);
        await new Promise(resolve => {
          repaintDelayTimeoutRef.current = setTimeout(resolve, FORCE_REPAINT_DELAY);
        });
        if (!isMountedRef.current || renderState !== 'applying_config') return;
        const redrawSuccess = redrawAllCanvases ? await redrawAllCanvases(configsToApply) : true;
        if (!redrawSuccess) throw new Error("Redraw after config application failed.");
        if (isMountedRef.current && renderState === 'applying_config') {
          logStateChange('rendered', 'Apply Success');
          lastAppliedNonceRef.current = nonceForThisCycle;
        }
      } catch (error) {
        logAction(`APPLYING_CONFIG: Error during apply/redraw: ${error.message}`);
        if (isMountedRef.current) logStateChange('error', 'Apply/Redraw Failed');
      } finally {
        applyConfigPromiseRef.current = null;
      }
    };
    applyConfigPromiseRef.current = applyAndDrawLogic();
    return () => { if (repaintDelayTimeoutRef.current) clearTimeout(repaintDelayTimeoutRef.current); };
  }, [renderState, configLoadNonce, targetLayerConfigsForPreset, targetTokenAssignmentsForPreset, applyConfigurationsToManagers, applyTokenAssignments, redrawAllCanvases, logStateChange, logAction]);

  useEffect(() => {
    if (renderState !== "rendered") return;
    setMakeIncomingCanvasVisible(true);
    setLoadingStatusMessage("Render complete");
    setIsStatusFadingOut(true);
    const cleanupTimer = setTimeout(() => {
      if (isMountedRef.current) setIsStatusFadingOut(false);
    }, LOADING_FADE_DURATION);

    if (isTransitioningInternal) {
      const transitionTimer = setTimeout(() => {
        if (isMountedRef.current && renderState === "rendered") {
          setIsTransitioningInternal(false);
          outgoingLayerIdsOnTransitionStartRef.current.clear();
        }
      }, CANVAS_FADE_DURATION);
      return () => clearTimeout(transitionTimer);
    }

    if (animationStateRef.current !== 'running' && isContainerObservedVisible) {
      if (restartCanvasAnimations) restartCanvasAnimations();
      animationStateRef.current = 'running';
    }
    return () => clearTimeout(cleanupTimer);
  }, [renderState, isTransitioningInternal, isContainerObservedVisible, restartCanvasAnimations, setLoadingStatusMessage]);

  const showStatusDisplay = useMemo(() => renderState !== 'rendered' || isTransitioningInternal || isStatusFadingOut, [renderState, isTransitioningInternal, isStatusFadingOut]);
  const showRetryButton = useMemo(() => renderState === 'error' && !upInitializationError && !upFetchStateError && !(loadError && !isInitiallyResolved), [renderState, upInitializationError, upFetchStateError, loadError, isInitiallyResolved]);

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