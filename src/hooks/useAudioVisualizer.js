// src/hooks/useAudioVisualizer.js
import { useState, useCallback } from 'react';

/**
 * @typedef {object} AudioAnalyzerData Raw data from the audio analysis process.
 * @property {number} level - Overall audio level (0-1).
 * @property {{bass: number, mid: number, treble: number}} frequencyBands - Normalized frequency band levels (0-1).
 */

/**
 * @typedef {object} AudioSettings Configuration for how audio affects visuals.
 * @property {number} bassIntensity - Multiplier for bass impact on visuals.
 * @property {number} midIntensity - Multiplier for mid-range impact on visuals.
 * @property {number} trebleIntensity - Multiplier for treble impact on visuals.
 * @property {number} smoothingFactor - Smoothing factor for the audio analysis algorithm (0-1). Affects responsiveness vs smoothness.
 */

/**
 * Manages the state related to the audio visualization feature.
 * This includes whether audio input is active, settings that control
 * how audio influences visuals (like frequency band intensity), and the
 * latest analyzed audio data (level, bass, mid, treble).
 *
 * @returns {{
 *   isAudioActive: boolean,
 *   setIsAudioActive: React.Dispatch<React.SetStateAction<boolean>>,
 *   audioSettings: AudioSettings,
 *   setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>,
 *   analyzerData: AudioAnalyzerData,
 *   handleAudioDataUpdate: (data: AudioAnalyzerData) => void
 * }} An object containing the audio visualizer state and functions to update it.
 */
export function useAudioVisualizer() {
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [audioSettings, setAudioSettings] = useState({
    bassIntensity: 1.0,
    midIntensity: 1.0,
    trebleIntensity: 1.0,
    smoothingFactor: 0.6,
  });
  const [analyzerData, setAnalyzerData] = useState({
    level: 0,
    frequencyBands: { bass: 0, mid: 0, treble: 0 },
  });

  /**
   * Callback function designed to be passed to the AudioAnalyzer component.
   * Updates the internal state with the latest audio level and frequency data.
   * @param {AudioAnalyzerData} data - The latest audio data from the analyzer.
   */
  const handleAudioDataUpdate = useCallback((data) => {
    setAnalyzerData({
      level: data.level ?? 0,
      frequencyBands: data.frequencyBands ?? { bass: 0, mid: 0, treble: 0 },
    });
  }, []);

  return {
    isAudioActive,
    setIsAudioActive,
    audioSettings,
    setAudioSettings,
    analyzerData,
    handleAudioDataUpdate,
  };
}