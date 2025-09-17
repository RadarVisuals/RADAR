// src/hooks/useRenderLifecycle.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const CANVAS_FADE_DURATION = 500;
const CONNECTING_MESSAGE = "Connecting";
const LOADING_CONFIG_MESSAGE = "Loading Workspace...";
const TRANSITION_MESSAGE = "Transitioning";

export function useRenderLifecycle(options) {
  const {
    managersReady, isInitiallyResolved, hasValidDimensions,
    isContainerObservedVisible, configLoadNonce, currentProfileAddress,
    layerConfigs,
    targetLayerConfigsForPreset,
    loadError, upInitializationError, upFetchStateError,
    stopAllAnimations,
    restartCanvasAnimations,
    isFullyLoaded,
  } = options;

  const [renderState, setRenderStateInternal] = useState('initializing');
  const [loadingStatusMessage, setLoadingStatusMessageState] = useState(CONNECTING_MESSAGE);
  const [isStatusFadingOut, setIsStatusFadingOut] = useState(false);
  const [isTransitioningInternal, setIsTransitioningInternal] = useState(false);
  const [makeIncomingCanvasVisible, setMakeIncomingCanvasVisible] = useState(false);

  const isMountedRef = useRef(false);
  const lastAppliedNonceRef = useRef(0);
  const statusDisplayFadeTimeoutRef = useRef(null);
  const transitionEndTimeoutRef = useRef(null);
  const animationStateRef = useRef('stopped');
  const outgoingLayerIdsOnTransitionStartRef = useRef(new Set());
  const prevAddressRef = useRef(currentProfileAddress);

  const logStateChange = useCallback((newState, reason) => {
    setRenderStateInternal(prevState => {
      if (prevState !== newState) {
        if (import.meta.env.DEV) {
          console.log(`%c[RenderLifecycle] State CHANGE: ${prevState} -> ${newState} (Reason: ${reason})`, 'color: #3498db; font-weight: bold;');
        }
        return newState;
      }
      return prevState;
    });
  }, []);

  // --- ADDED: Enhanced Logging for Inputs ---
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('%c[RenderLifecycle] Inputs Changed:', 'color: #9b59b6;', {
        renderState,
        managersReady,
        isInitiallyResolved,
        hasValidDimensions,
        isContainerObservedVisible,
        isFullyLoaded,
        loadError: !!loadError,
        upError: !!(upInitializationError || upFetchStateError),
      });
    }
  }, [renderState, managersReady, isInitiallyResolved, hasValidDimensions, isContainerObservedVisible, isFullyLoaded, loadError, upInitializationError, upFetchStateError]);
  // --- END LOGGING ---

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
    };
  }, []);

  const setLoadingStatusMessage = useCallback((message) => {
    if (isMountedRef.current) {
      setLoadingStatusMessageState(message);
      setIsStatusFadingOut(false);
      if (statusDisplayFadeTimeoutRef.current) {
        clearTimeout(statusDisplayFadeTimeoutRef.current);
      }
    }
  }, []);

  const resetLifecycle = useCallback(() => {
    if (!isMountedRef.current) return;
    setLoadingStatusMessage(CONNECTING_MESSAGE);
    logStateChange("initializing", "External Reset");
    lastAppliedNonceRef.current = 0;
    setIsTransitioningInternal(false);
    setMakeIncomingCanvasVisible(false);
    outgoingLayerIdsOnTransitionStartRef.current.clear();
    if (stopAllAnimations) stopAllAnimations();
    animationStateRef.current = 'stopped';
  }, [stopAllAnimations, setLoadingStatusMessage, logStateChange]);

  const handleManualRetry = useCallback(() => {
    if (import.meta.env.DEV) console.log("[RenderLifecycle] Manual retry triggered.");
    resetLifecycle();
  }, [resetLifecycle]);

  useEffect(() => {
    const previousAddress = prevAddressRef.current;
    if (previousAddress && currentProfileAddress && previousAddress !== currentProfileAddress) {
      resetLifecycle();
    }
    prevAddressRef.current = currentProfileAddress;
  }, [currentProfileAddress, resetLifecycle]);

  useEffect(() => {
    const currentState = renderState;
    if (loadError || upInitializationError || upFetchStateError) {
      if (currentState !== 'error') logStateChange('error', 'Critical error detected');
      return;
    }
    if (['rendered', 'error', 'fading_out'].includes(currentState)) {
      return;
    }
    if (!hasValidDimensions) {
      if (currentState !== 'waiting_layout') logStateChange('waiting_layout', 'Awaiting valid dimensions');
      return;
    }
    if (!managersReady) {
      if (currentState !== 'initializing_managers') logStateChange('initializing_managers', 'Awaiting Managers');
      return;
    }
    if (!isInitiallyResolved || !isFullyLoaded) {
      if (currentState !== 'resolving_initial_config') logStateChange('resolving_initial_config', 'Awaiting data resolution');
      return;
    }
    logStateChange('rendered', 'All prerequisites met');
  }, [renderState, managersReady, isInitiallyResolved, hasValidDimensions, isFullyLoaded, loadError, upInitializationError, upFetchStateError, logStateChange]);

  useEffect(() => {
    if (isInitiallyResolved && configLoadNonce > lastAppliedNonceRef.current && renderState === 'rendered') {
      if (targetLayerConfigsForPreset) {
        setLoadingStatusMessage(TRANSITION_MESSAGE);
        setIsTransitioningInternal(true);
        setMakeIncomingCanvasVisible(false);
        outgoingLayerIdsOnTransitionStartRef.current = new Set(Object.keys(layerConfigs || {}));
        logStateChange('fading_out', 'New Scene Selected');
      }
    }
  }, [configLoadNonce, isInitiallyResolved, renderState, layerConfigs, setLoadingStatusMessage, logStateChange, targetLayerConfigsForPreset]);
  
  useEffect(() => {
    if (renderState === 'fading_out') {
      const transitionTimer = setTimeout(() => {
        if (isMountedRef.current) {
          logStateChange('rendered', 'Transition fade-out complete');
          lastAppliedNonceRef.current = configLoadNonce;
        }
      }, CANVAS_FADE_DURATION);
      return () => clearTimeout(transitionTimer);
    }
  }, [renderState, configLoadNonce, logStateChange]);

  useEffect(() => {
    if (renderState !== "rendered") return;
    setMakeIncomingCanvasVisible(true);
    setIsStatusFadingOut(true);
    if (statusDisplayFadeTimeoutRef.current) {
      clearTimeout(statusDisplayFadeTimeoutRef.current);
    }
    if (isTransitioningInternal) {
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
      transitionEndTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setIsTransitioningInternal(false);
          outgoingLayerIdsOnTransitionStartRef.current.clear();
        }
      }, CANVAS_FADE_DURATION);
    }
    if (animationStateRef.current !== 'running' && isContainerObservedVisible) {
      if (restartCanvasAnimations) restartCanvasAnimations();
      animationStateRef.current = 'running';
    }
    return () => {
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
    };
  }, [renderState, isTransitioningInternal, isContainerObservedVisible, restartCanvasAnimations]);

  useEffect(() => {
    if (renderState === 'waiting_layout') setLoadingStatusMessage("Waiting for layout...");
    else if (renderState === 'initializing_managers') setLoadingStatusMessage("Initializing managers...");
    else if (renderState === 'resolving_initial_config') setLoadingStatusMessage(LOADING_CONFIG_MESSAGE);
    else if (renderState === 'error') setLoadingStatusMessage("Render failed. Please retry.");
  }, [renderState, setLoadingStatusMessage]);

  const showStatusDisplay = useMemo(() => {
    if (isTransitioningInternal || renderState === 'error') {
      return true;
    }
    return false;
  }, [renderState, isTransitioningInternal]);

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
    isAnimating: animationStateRef.current === 'running',
    handleManualRetry,
    resetLifecycle,
  }), [
    renderState, loadingStatusMessage, isStatusFadingOut, showStatusDisplay, showRetryButton,
    isTransitioningInternal, makeIncomingCanvasVisible, handleManualRetry, resetLifecycle
  ]);
}