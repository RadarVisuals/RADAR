// src/hooks/usePLockSequencer.js
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

const TRANSITION_ANIMATION_DURATION = 1000;
const lerp = (start, end, t) => start * (1 - t) + end * t;

const SPEED_DURATIONS = {
  fast: 4000,
  medium: 8000,
  slow: 12000,
};

export const usePLockSequencer = ({ onValueUpdate, onAnimationEnd }) => {
  const [pLockState, setPLockState] = useState('idle');
  // REMOVED: const [loopProgress, setLoopProgress] = useState(0); 
  const [pLockSpeed, setPLockSpeed] = useState('medium');

  const stateRef = useRef(pLockState);
  const animationDataRef = useRef({});
  const transitionDataRef = useRef(null);
  const startTimeRef = useRef(0);
  const loopDurationRef = useRef(SPEED_DURATIONS.medium);
  const rafRef = useRef(null);
  const onValueUpdateRef = useRef(onValueUpdate);
  const onAnimationEndRef = useRef(onAnimationEnd);
  const initialStateSnapshotRef = useRef(null);
  
  const prevProgressRef = useRef(0);

  useEffect(() => { stateRef.current = pLockState; }, [pLockState]);
  useEffect(() => { onValueUpdateRef.current = onValueUpdate; }, [onValueUpdate]);
  useEffect(() => { onAnimationEndRef.current = onAnimationEnd; }, [onAnimationEnd]);

  const stopAndClear = useCallback((stateToApplyOnEnd = null) => {
    if (onAnimationEndRef.current) {
      onAnimationEndRef.current(stateToApplyOnEnd);
    }
    setPLockState('idle');
    
    // Dispatch 0 to reset UI immediately (Zero-Render logic)
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('plock-progress', { detail: 0 }));
    }

    animationDataRef.current = {};
    initialStateSnapshotRef.current = null;
    transitionDataRef.current = null;
    startTimeRef.current = 0;
    prevProgressRef.current = 0;
  }, []);

  const armSequencer = useCallback((snapshot) => {
    stopAndClear(null);
    setPLockState('armed');
    initialStateSnapshotRef.current = snapshot;
  }, [stopAndClear]);

  const initiatePlayback = useCallback((finalConfigs) => {
    const initialConfigs = initialStateSnapshotRef.current;
    if (!initialConfigs) {
      stopAndClear(null);
      return;
    }

    const newAnimationData = {};
    let hasChanges = false;
    for (const layerId in initialConfigs) {
      if (!finalConfigs[layerId]) continue;
      const layerAnimationData = {};
      
      for (const paramName in initialConfigs[layerId]) {
        const initialValue = initialConfigs[layerId][paramName];
        const finalValue = finalConfigs[layerId]?.[paramName];
        
        if (finalValue !== undefined && JSON.stringify(initialValue) !== JSON.stringify(finalValue)) {
          layerAnimationData[paramName] = { initialValue, targetValue: finalValue };
          hasChanges = true;
        }
      }
      
      if (Object.keys(layerAnimationData).length > 0) {
        newAnimationData[layerId] = layerAnimationData;
      }
    }

    if (!hasChanges) {
      stopAndClear(null);
      return;
    }

    animationDataRef.current = newAnimationData;
    loopDurationRef.current = SPEED_DURATIONS[pLockSpeed];
    prevProgressRef.current = 0;
    setPLockState('playing');
    
    if (!startTimeRef.current) {
        startTimeRef.current = performance.now();
    }
  }, [stopAndClear, pLockSpeed]);

  const initiateStopAnimation = useCallback(() => {
    const currentAnimationData = animationDataRef.current;
    if (Object.keys(currentAnimationData).length === 0) {
      stopAndClear(null);
      return;
    }
    const lastKnownValues = {};
    const targetValuesToRestore = {};
    const loopElapsedTime = (performance.now() - startTimeRef.current) % loopDurationRef.current;
    const performanceDuration = loopDurationRef.current / 2;

    for (const layerId in currentAnimationData) {
      lastKnownValues[layerId] = {};
      targetValuesToRestore[layerId] = {};
      for (const paramName in currentAnimationData[layerId]) {
        const { initialValue, targetValue } = currentAnimationData[layerId][paramName];
        targetValuesToRestore[layerId][paramName] = initialValue;
        
        if (typeof initialValue === 'number' && typeof targetValue === 'number') {
            lastKnownValues[layerId][paramName] = loopElapsedTime < performanceDuration
              ? lerp(targetValue, initialValue, loopElapsedTime / performanceDuration)
              : lerp(initialValue, targetValue, (loopElapsedTime - performanceDuration) / performanceDuration);
        } else {
            lastKnownValues[layerId][paramName] = loopElapsedTime < performanceDuration ? targetValue : initialValue;
        }
      }
    }
    transitionDataRef.current = { startTime: performance.now(), fromValues: lastKnownValues, toValues: targetValuesToRestore };
    animationDataRef.current = {};
    setPLockState('stopping');
  }, [stopAndClear]);

  const toggle = useCallback((currentLiveConfigs) => {
    const currentState = stateRef.current;
    if (currentState === 'idle') {
      armSequencer(JSON.parse(JSON.stringify(currentLiveConfigs)));
    } else if (currentState === 'armed') {
      initiatePlayback(currentLiveConfigs);
    } else if (currentState === 'playing') {
      initiateStopAnimation();
    }
  }, [armSequencer, initiatePlayback, initiateStopAnimation]);

  // --- NEW: Exposed Stop Function ---
  const stop = useCallback(() => {
    stopAndClear(null);
  }, [stopAndClear]);

  useEffect(() => {
    const animationLoop = (timestamp) => {
      const currentState = stateRef.current;
      let continueLoop = false;

      if (currentState === 'stopping') {
        continueLoop = true;
        const transitionData = transitionDataRef.current;
        if (!transitionData) { stopAndClear(null); return; }
        const elapsed = timestamp - transitionData.startTime;
        const progress = Math.min(1.0, elapsed / TRANSITION_ANIMATION_DURATION);
        
        for (const layerId in transitionData.fromValues) {
          for (const paramName in transitionData.fromValues[layerId]) {
            const from = transitionData.fromValues[layerId][paramName];
            const to = transitionData.toValues[layerId][paramName];
            
            if (typeof from === 'number' && typeof to === 'number') {
                onValueUpdateRef.current(layerId, paramName, lerp(from, to, progress));
            } else {
                onValueUpdateRef.current(layerId, paramName, progress < 1.0 ? from : to);
            }
          }
        }

        if (progress >= 1.0) {
          stopAndClear(transitionData.toValues);
          transitionDataRef.current = null;
        }
      } else if (currentState === 'playing') {
        continueLoop = true;
        const duration = loopDurationRef.current;
        
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        
        const startTime = startTimeRef.current;
        const loopElapsedTime = (timestamp - startTime) % duration;
        const currentProgress = loopElapsedTime / duration;
        
        // Zero-Render Update
        window.dispatchEvent(new CustomEvent('plock-progress', { detail: currentProgress }));
        
        const performanceDuration = duration / 2;
        const isFirstHalf = loopElapsedTime < performanceDuration;

        for (const layerId in animationDataRef.current) {
          const layerData = animationDataRef.current[layerId];
          for (const paramName in layerData) {
            const { initialValue, targetValue } = layerData[paramName];
            
            if (typeof initialValue === 'number' && typeof targetValue === 'number') {
              const value = isFirstHalf
                ? lerp(targetValue, initialValue, loopElapsedTime / performanceDuration)
                : lerp(initialValue, targetValue, (loopElapsedTime - performanceDuration) / performanceDuration);
              onValueUpdateRef.current(layerId, paramName, value);
            } else {
              onValueUpdateRef.current(layerId, paramName, isFirstHalf ? targetValue : initialValue);
            }
          }
        }
        prevProgressRef.current = currentProgress;
      }

      if (continueLoop) rafRef.current = requestAnimationFrame(animationLoop);
      else rafRef.current = null;
    };

    const shouldLoop = ['playing', 'stopping'].includes(pLockState);
    if (shouldLoop && !rafRef.current) {
      if (pLockState === 'playing' && !startTimeRef.current) startTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(animationLoop);
    }

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [pLockState, stopAndClear]);

  const hasLockedParams = useMemo(() => {
    const data = animationDataRef.current;
    return data && Object.keys(data).length > 0;
  }, [pLockState]);

  return useMemo(() => ({
    pLockState, 
    hasLockedParams, toggle, stop, // Expose stop here
    animationDataRef, pLockSpeed, setPLockSpeed,
  }), [pLockState, hasLockedParams, toggle, stop, pLockSpeed]);
};