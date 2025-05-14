// src/hooks/useAudioVisualizer.js
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

import throttle from 'lodash-es/throttle';

const UI_UPDATE_THROTTLE_MS = 100; // Update UI max 10 times per second (100ms)

/**
 * @typedef {object} AudioVisualizerSettings
 * @property {number} bassIntensity - Intensity multiplier for the bass frequency band.
 * @property {number} midIntensity - Intensity multiplier for the mid frequency band.
 * @property {number} trebleIntensity - Intensity multiplier for the treble frequency band.
 * @property {number} smoothingFactor - Smoothing factor for audio data changes.
 */

/**
 * @typedef {object} AudioFrequencyBands
 * @property {number} bass - Bass frequency level.
 * @property {number} mid - Mid frequency level.
 * @property {number} treble - Treble frequency level.
 */

/**
 * @typedef {object} RawAudioAnalyzerData
 * @property {number} level - Overall audio level.
 * @property {AudioFrequencyBands} frequencyBands - Audio levels for different frequency bands.
 */

/**
 * @typedef {object} AudioVisualizerAPI
 * @property {boolean} isAudioActive - Whether audio processing is currently active.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setIsAudioActive - Function to set the audio active state.
 * @property {AudioVisualizerSettings} audioSettings - Current settings for audio processing.
 * @property {React.Dispatch<React.SetStateAction<AudioVisualizerSettings>>} setAudioSettings - Function to update audio settings.
 * @property {RawAudioAnalyzerData} analyzerData - Processed and throttled audio analysis data for UI consumption.
 * @property {(data: RawAudioAnalyzerData) => void} handleAudioDataUpdate - Callback to feed new raw audio data into the visualizer.
 */

// Helper to compare frequency band objects shallowly
const areFrequencyBandsEqual = (bandsA, bandsB) => {
  if (!bandsA || !bandsB) return bandsA === bandsB;
  return bandsA.bass === bandsB.bass && bandsA.mid === bandsB.mid && bandsA.treble === bandsB.treble;
};

/**
 * Custom hook to manage audio visualization state, including activity status,
 * settings, and processed analyzer data. It throttles UI updates for performance.
 *
 * @returns {AudioVisualizerAPI} An object containing audio visualizer state and control functions.
 */
export function useAudioVisualizer() {
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [audioSettings, setAudioSettings] = useState({
    bassIntensity: 1.0,
    midIntensity: 1.0,
    trebleIntensity: 1.0,
    smoothingFactor: 0.6,
  });

  // Internal state that is updated by the throttled function
  /** @type {[RawAudioAnalyzerData, React.Dispatch<React.SetStateAction<RawAudioAnalyzerData>>]} */
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

  /** @type {React.RefObject<RawAudioAnalyzerData>} */
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
    [] // setInternalAnalyzerData is stable from useState, latestRawDataRef is a ref
  );

  /**
   * Handles incoming raw audio data, stores it in a ref, and triggers a throttled state update.
   * @param {RawAudioAnalyzerData} data - The latest raw audio data.
   */
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

  return useMemo(() => ({
    isAudioActive,
    setIsAudioActive,
    audioSettings,
    setAudioSettings,
    analyzerData: uiPropAnalyzerData, // Expose the memoized, more stable data for UI
    handleAudioDataUpdate,
  }), [
    isAudioActive,
    audioSettings,
    uiPropAnalyzerData,
    handleAudioDataUpdate,
    // setIsAudioActive and setAudioSettings are stable
  ]);
}