// src/hooks/usePLockSequencer.js
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

const LERP_THRESHOLD = 1e-5;
const TRANSITION_ANIMATION_DURATION = 250; // ms for smooth start and reset animations
const lerp = (start, end, t) => start * (1 - t) + end * t;

const SPEED_DURATIONS = {
  fast: 4000,
  medium: 8000,
  slow: 12000,
};

export const usePLockSequencer = ({ onValueUpdate }) => {
  const [pLockState, setPLockState] = useState('idle');
  const [loopProgress, setLoopProgress] = useState(0);
  const [pLockSpeed, setPLockSpeed] = useState('medium');

  const stateRef = useRef(pLockState);
  const animationDataRef = useRef({});
  const transitionDataRef = useRef(null); // For pre-roll and reset animations
  const startTimeRef = useRef(0);
  const loopDurationRef = useRef(SPEED_DURATIONS.medium);
  const rafRef = useRef(null);
  const onValueUpdateRef = useRef(onValueUpdate);
  const initialStateSnapshotRef = useRef(null);

  useEffect(() => { stateRef.current = pLockState; }, [pLockState]);
  useEffect(() => { onValueUpdateRef.current = onValueUpdate; }, [onValueUpdate]);

  const stopAndClear = useCallback(() => {
    setPLockState('idle');
    setLoopProgress(0);
    animationDataRef.current = {};
    initialStateSnapshotRef.current = null;
    transitionDataRef.current = null;
    startTimeRef.current = 0;
  }, []);

  const armSequencer = useCallback((snapshot) => {
    stopAndClear();
    setPLockState('armed');
    initialStateSnapshotRef.current = snapshot;
  }, [stopAndClear]);

  const initiatePlayback = useCallback((finalConfigs) => {
    const initialConfigs = initialStateSnapshotRef.current;
    if (!initialConfigs) {
      stopAndClear();
      return;
    }

    const newAnimationData = {};
    const finalValues = {};
    let hasChanges = false;
    for (const layerId in initialConfigs) {
      if (!finalConfigs[layerId]) continue;
      const layerAnimationData = {};
      finalValues[layerId] = {};
      for (const paramName in initialConfigs[layerId]) {
        const initialValue = initialConfigs[layerId][paramName];
        const finalValue = finalConfigs[layerId]?.[paramName];
        finalValues[layerId][paramName] = finalValue;
        if (finalValue !== undefined && typeof initialValue === 'number' && Math.abs(initialValue - finalValue) > LERP_THRESHOLD) {
          layerAnimationData[paramName] = { initialValue, targetValue: finalValue };
          hasChanges = true;
        }
      }
      if (Object.keys(layerAnimationData).length > 0) {
        newAnimationData[layerId] = layerAnimationData;
      }
    }

    if (!hasChanges) {
      stopAndClear();
      return;
    }

    animationDataRef.current = newAnimationData;
    transitionDataRef.current = {
      startTime: performance.now(),
      fromValues: finalValues,
      toValues: initialConfigs,
    };
    loopDurationRef.current = SPEED_DURATIONS[pLockSpeed];
    setPLockState('arming_to_play');
  }, [stopAndClear, pLockSpeed]);

  const initiateResetAnimation = useCallback(() => {
    const currentAnimationData = animationDataRef.current;
    if (Object.keys(currentAnimationData).length === 0) {
      stopAndClear();
      return;
    }
    const lastKnownValues = {};
    const initialValuesToRestore = {};
    const loopElapsedTime = (performance.now() - startTimeRef.current) % loopDurationRef.current;
    const performanceDuration = loopDurationRef.current / 2;

    for (const layerId in currentAnimationData) {
      lastKnownValues[layerId] = {};
      initialValuesToRestore[layerId] = {};
      for (const paramName in currentAnimationData[layerId]) {
        const { initialValue, targetValue } = currentAnimationData[layerId][paramName];
        initialValuesToRestore[layerId][paramName] = initialValue;
        if (loopElapsedTime < performanceDuration) {
          lastKnownValues[layerId][paramName] = lerp(initialValue, targetValue, loopElapsedTime / performanceDuration);
        } else {
          lastKnownValues[layerId][paramName] = lerp(targetValue, initialValue, (loopElapsedTime - performanceDuration) / performanceDuration);
        }
      }
    }
    transitionDataRef.current = { startTime: performance.now(), fromValues: lastKnownValues, toValues: initialValuesToRestore };
    animationDataRef.current = {};
    setPLockState('resetting');
  }, [stopAndClear]);

  const toggle = useCallback((currentLiveConfigs) => {
    const currentState = stateRef.current;
    if (currentState === 'idle') {
      armSequencer(JSON.parse(JSON.stringify(currentLiveConfigs)));
    } else if (currentState === 'armed') {
      initiatePlayback(currentLiveConfigs);
    } else if (currentState === 'playing') {
      initiateResetAnimation();
    }
  }, [armSequencer, initiatePlayback, initiateResetAnimation]);

  const clear = useCallback(() => {
    if (stateRef.current === 'playing' || stateRef.current === 'armed') {
      initiateResetAnimation();
    } else {
      stopAndClear();
    }
  }, [initiateResetAnimation, stopAndClear]);

  useEffect(() => {
    const animationLoop = (timestamp) => {
      const currentState = stateRef.current;
      let continueLoop = false;

      if (currentState === 'arming_to_play' || currentState === 'resetting') {
        continueLoop = true;
        const transitionData = transitionDataRef.current;
        if (!transitionData) { stopAndClear(); return; }
        const elapsed = timestamp - transitionData.startTime;
        const progress = Math.min(1.0, elapsed / TRANSITION_ANIMATION_DURATION);
        
        for (const layerId in transitionData.fromValues) {
          for (const paramName in transitionData.fromValues[layerId]) {
            const from = transitionData.fromValues[layerId][paramName];
            const to = transitionData.toValues[layerId][paramName];
            const value = lerp(from, to, progress);
            onValueUpdateRef.current(layerId, paramName, value);
          }
        }

        if (progress >= 1.0) {
          for (const layerId in transitionData.toValues) {
            for (const paramName in transitionData.toValues[layerId]) {
               onValueUpdateRef.current(layerId, paramName, transitionData.toValues[layerId][paramName]);
            }
          }
          if (currentState === 'arming_to_play') {
            setPLockState('playing');
            startTimeRef.current = performance.now();
          } else {
            stopAndClear();
          }
          transitionDataRef.current = null;
        }
      } else if (currentState === 'playing') {
        continueLoop = true;
        const duration = loopDurationRef.current;
        const startTime = startTimeRef.current;
        const loopElapsedTime = (timestamp - startTime) % duration;
        setLoopProgress(loopElapsedTime / duration);
        const performanceDuration = duration / 2;

        for (const layerId in animationDataRef.current) {
          const layerData = animationDataRef.current[layerId];
          for (const paramName in layerData) {
            const { initialValue, targetValue } = layerData[paramName];
            const value = loopElapsedTime < performanceDuration
              ? lerp(initialValue, targetValue, loopElapsedTime / performanceDuration)
              : lerp(targetValue, initialValue, (loopElapsedTime - performanceDuration) / performanceDuration);
            onValueUpdateRef.current(layerId, paramName, value);
          }
        }
      }

      if (continueLoop) rafRef.current = requestAnimationFrame(animationLoop);
      else rafRef.current = null;
    };

    const shouldLoop = ['playing', 'resetting', 'arming_to_play'].includes(pLockState);
    if (shouldLoop && !rafRef.current) {
      startTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(animationLoop);
    }

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [pLockState, stopAndClear]);

  const hasLockedParams = useMemo(() => {
    return stateRef.current !== 'idle' && stateRef.current !== 'armed';
  }, [pLockState]);

  return useMemo(() => ({
    pLockState, loopProgress, hasLockedParams, toggle, clear,
    animationDataRef, pLockSpeed, setPLockSpeed,
  }), [pLockState, loopProgress, hasLockedParams, toggle, clear, pLockSpeed]);
};