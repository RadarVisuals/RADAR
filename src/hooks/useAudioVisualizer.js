// src/hooks/useAudioVisualizer.js
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import throttle from 'lodash-es/throttle';

const UI_UPDATE_THROTTLE_MS = 100; // Update UI max 10 times per second (100ms)

// Helper to compare frequency band objects shallowly
const areFrequencyBandsEqual = (bandsA, bandsB) => {
  if (!bandsA || !bandsB) return bandsA === bandsB; // Handle null/undefined cases
  return bandsA.bass === bandsB.bass && bandsA.mid === bandsB.mid && bandsA.treble === bandsB.treble;
};

export function useAudioVisualizer() {
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [audioSettings, setAudioSettings] = useState({
    bassIntensity: 1.0,
    midIntensity: 1.0,
    trebleIntensity: 1.0,
    smoothingFactor: 0.6,
  });

  // Internal state that is updated by the throttled function
  const [internalAnalyzerData, setInternalAnalyzerData] = useState({
    level: 0,
    frequencyBands: { bass: 0, mid: 0, treble: 0 },
  });

  // Memoized version of analyzerData to be passed as props.
  // This ensures the object reference only changes if the actual values change.
  const uiPropAnalyzerData = useMemo(() => ({
    level: internalAnalyzerData.level,
    frequencyBands: { // Always create a new object for frequencyBands for immutability
      bass: internalAnalyzerData.frequencyBands.bass,
      mid: internalAnalyzerData.frequencyBands.mid,
      treble: internalAnalyzerData.frequencyBands.treble,
    }
  }), [
    internalAnalyzerData.level,
    internalAnalyzerData.frequencyBands.bass, // Depend on individual primitive values
    internalAnalyzerData.frequencyBands.mid,
    internalAnalyzerData.frequencyBands.treble
  ]);

  const latestRawDataRef = useRef({
    level: 0,
    frequencyBands: { bass: 0, mid: 0, treble: 0 },
  });

  // Throttled function to update the internal state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const throttledUpdateInternalState = useCallback(
    throttle(() => {
      // Read the latest data from the ref when the throttled function executes
      const newDataFromRef = latestRawDataRef.current;
      setInternalAnalyzerData(prevData => {
        // Only update if the values have actually changed
        if (prevData.level !== newDataFromRef.level || !areFrequencyBandsEqual(prevData.frequencyBands, newDataFromRef.frequencyBands)) {
          return newDataFromRef; // Return new data, causing a state change
        }
        return prevData; // Return old data, preventing unnecessary state change & re-render
      });
    }, UI_UPDATE_THROTTLE_MS, { leading: true, trailing: true }),
    [] // setInternalAnalyzerData is stable from useState
  );

  const handleAudioDataUpdate = useCallback((data) => {
    // Always update the ref with the absolute latest raw data
    latestRawDataRef.current = {
      level: data.level ?? 0,
      frequencyBands: data.frequencyBands ?? { bass: 0, mid: 0, treble: 0 },
    };
    // Call the throttled function, which will then decide whether to update state
    throttledUpdateInternalState();
  }, [throttledUpdateInternalState]);

  useEffect(() => {
    // Cleanup the throttle function on unmount
    return () => {
      throttledUpdateInternalState.cancel();
    };
  }, [throttledUpdateInternalState]);

  return {
    isAudioActive,
    setIsAudioActive,
    audioSettings,
    setAudioSettings,
    analyzerData: uiPropAnalyzerData, // Expose the memoized, more stable data for UI
    handleAudioDataUpdate,
  };
}