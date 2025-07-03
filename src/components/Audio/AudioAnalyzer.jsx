// src/components/Audio/AudioAnalyzer.jsx
import React, { useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";

// Default values for layer parameters if not provided by layerConfigs
const DEFAULT_LAYER_VALUES = {
    size: 1.0, // Default base size for layers if not specified in their config
};
const DEFAULT_SMOOTHING = 0.6; // Default smoothing factor for the AnalyserNode
const FFT_SIZE = 2048; // Standard FFT size for frequency analysis

/**
 * @typedef {object} AudioAnalyzerProps
 * @property {(data: import('../../hooks/useAudioVisualizer').RawAudioAnalyzerData) => void} [onAudioData] - Callback function invoked with new audio analysis data (level, frequency bands, timestamp).
 * @property {boolean} [isActive=false] - If true, the component attempts to access the microphone and start audio analysis.
 * @property {import('../../context/VisualConfigContext').AllLayerConfigs} [layerConfigs] - Current configurations for all visual layers. Used to get base values for audio-reactive parameters.
 * @property {import('../../hooks/useAudioVisualizer').AudioVisualizerSettings} [audioSettings] - Current settings for audio processing and analysis (e.g., intensity multipliers, smoothing factor).
 * @property {number} [configLoadNonce] - A nonce that changes when a new global configuration (preset) is loaded. Used to detect preset changes and potentially reset or adjust audio reactivity baselines.
 * @property {React.RefObject<Object.<string, import('../../utils/CanvasManager').default>>} managerInstancesRef - Ref to the canvas manager instances, used to apply audio-driven visual modifications directly.
 */

/**
 * AudioAnalyzer: A non-visual component responsible for capturing microphone input,
 * analyzing the audio stream to extract level and frequency band data, and then
 * applying these data to visual layers via `CanvasManager` instances.
 * It also calls `onAudioData` with the processed information for other consumers.
 * The component manages the lifecycle of the `AudioContext` and `AnalyserNode`.
 *
 * @param {AudioAnalyzerProps} props - The component's props.
 * @returns {null} This component does not render any visible UI.
 */
const AudioAnalyzer = ({
  onAudioData,
  isActive = false,
  layerConfigs: layerConfigsProp,
  audioSettings: audioSettingsProp,
  configLoadNonce,
  managerInstancesRef,
}) => {
  /** @type {React.RefObject<import('../../hooks/useAudioVisualizer').AudioVisualizerSettings | undefined>} */
  const audioSettingsRef = useRef(audioSettingsProp);
  /** @type {React.RefObject<Object.<string, {size: number}>>} */
  const baseLayerValuesRef = useRef({ // Stores base 'size' for each layer before audio modulation
      '1': { size: DEFAULT_LAYER_VALUES.size },
      '2': { size: DEFAULT_LAYER_VALUES.size },
      '3': { size: DEFAULT_LAYER_VALUES.size },
  });
  /** @type {React.RefObject<number>} */
  const capturedNonceRef = useRef(-1); // Tracks the last processed configLoadNonce
  
  // --- REMOVED: Transition refs ---
  // const isTransitioningRef = useRef(false);
  // const lastBandDataRef = useRef({ bass: 0, mid: 0, treble: 0 });
  // const lastLevelRef = useRef(0);
  
  /** @type {React.RefObject<AudioContext | null>} */
  const audioContextRef = useRef(null);
  /** @type {React.RefObject<AnalyserNode | null>} */
  const analyserRef = useRef(null);
  /** @type {React.RefObject<MediaStreamAudioSourceNode | null>} */
  const sourceRef = useRef(null);
  /** @type {React.RefObject<number | null>} */
  const animationFrameRef = useRef(null);
  /** @type {React.RefObject<Uint8Array | null>} */
  const dataArrayRef = useRef(null);
  /** @type {React.RefObject<MediaStream | null>} */
  const streamRef = useRef(null);
  /** @type {React.RefObject<boolean>} */
  const isCleanupScheduledRef = useRef(false); // Prevents redundant cleanup calls

  // Update audio settings ref and AnalyserNode smoothing when props change
  useEffect(() => {
    audioSettingsRef.current = audioSettingsProp;
    if (analyserRef.current && audioContextRef.current && audioContextRef.current.state === "running") {
        try {
            const smoothing = audioSettingsRef.current?.smoothingFactor ?? DEFAULT_SMOOTHING;
            analyserRef.current.smoothingTimeConstant = Math.max(0, Math.min(1, smoothing));
        }
        catch (e) {
            if (import.meta.env.DEV) console.warn("[AudioAnalyzer] Error setting smoothingTimeConstant:", e);
        }
    }
  }, [audioSettingsProp]);

  // Update base layer values when a new preset is loaded
  useEffect(() => {
    if (layerConfigsProp && configLoadNonce !== capturedNonceRef.current) {
        // --- REMOVED: Transition logic ---
        const newBaseValues = {};
        for (const layerIdStr of ['1', '2', '3']) { // Assuming fixed layer IDs
            const config = layerConfigsProp[layerIdStr] || {};
            newBaseValues[layerIdStr] = { size: config.size ?? DEFAULT_LAYER_VALUES.size };
        }
        baseLayerValuesRef.current = newBaseValues;
        capturedNonceRef.current = configLoadNonce;
    }
  }, [configLoadNonce, layerConfigsProp]);

  // Applies calculated audio data (bands, level) to canvas managers for visual effects
  const applyAudioToLayers = useCallback((bands, level) => {
    const managers = managerInstancesRef?.current;
    const currentSettings = audioSettingsRef.current;

    if (!managers || !currentSettings) {
        return;
    }

    // --- REMOVED: Transition logic ---
    const { bassIntensity = 1.0, midIntensity = 1.0, trebleIntensity = 1.0 } = currentSettings;

    // Apply bass frequency to layer 1 size
    const bassEffectMagnitude = bands.bass * 0.8 * bassIntensity;
    const finalBassFactor = 1 + bassEffectMagnitude;
    if (managers['1'] && typeof managers['1'].setAudioFrequencyFactor === 'function') {
        managers['1'].setAudioFrequencyFactor(Math.max(0.1, finalBassFactor));
    }

    // Apply mid frequency to layer 2 size
    const midEffectMagnitude = bands.mid * 1.0 * midIntensity;
    const finalMidFactor = 1 + midEffectMagnitude;
    if (managers['2'] && typeof managers['2'].setAudioFrequencyFactor === 'function') {
        managers['2'].setAudioFrequencyFactor(Math.max(0.1, finalMidFactor));
    }

    // Apply treble frequency to layer 3 size
    const trebleEffectMagnitude = bands.treble * 2.0 * trebleIntensity;
    const finalTrebleFactor = 1 + trebleEffectMagnitude;
    if (managers['3'] && typeof managers['3'].setAudioFrequencyFactor === 'function') {
        managers['3'].setAudioFrequencyFactor(Math.max(0.1, finalTrebleFactor));
    }

    // Trigger a beat pulse effect on all layers if conditions are met
    if (level > 0.4 && bands.bass > 0.6) {
      const pulseMultiplier = 1 + level * 0.8;
      Object.keys(managers).forEach(layerIdStr => {
        const manager = managers[layerIdStr];
        if (manager && typeof manager.triggerBeatPulse === 'function') {
          manager.triggerBeatPulse(Math.max(0.1, pulseMultiplier), 80);
        }
      });
    }
  }, [managerInstancesRef]);

  // Processes raw frequency data from AnalyserNode into level and bands
  const processAudioData = useCallback((dataArray) => {
    if (!dataArray || !analyserRef.current) return;
    const bufferLength = analyserRef.current.frequencyBinCount;
    if (bufferLength === 0) return;

    let sum = 0; for (let i = 0; i < bufferLength; i++) { sum += dataArray[i]; }
    const averageLevel = sum / bufferLength / 255;

    const bassEndIndex = Math.floor(bufferLength * 0.08);
    const midEndIndex = bassEndIndex + Math.floor(bufferLength * 0.35);

    let bassSum = 0, midSum = 0, trebleSum = 0;
    let bassCount = 0, midCount = 0, trebleCount = 0;

    for (let i = 0; i < bufferLength; i++) {
        if (i < bassEndIndex) { bassSum += dataArray[i]; bassCount++; }
        else if (i < midEndIndex) { midSum += dataArray[i]; midCount++; }
        else { trebleSum += dataArray[i]; trebleCount++; }
    }

    const bass = Math.min(1, bassCount > 0 ? (bassSum / bassCount / 255) : 0);
    const mid = Math.min(1, midCount > 0 ? (midSum / midCount / 255) : 0);
    const treble = Math.min(1, trebleCount > 0 ? (trebleSum / trebleCount / 255) : 0);
    
    // --- REMOVED: Transition logic ---

    const newFrequencyBands = { bass, mid, treble };
    applyAudioToLayers(newFrequencyBands, averageLevel);

    if (typeof onAudioData === "function") {
      onAudioData({ level: averageLevel, frequencyBands: newFrequencyBands, timestamp: Date.now() });
    }
  }, [onAudioData, applyAudioToLayers]);

  // Main audio analysis loop using requestAnimationFrame
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !isActive || !audioContextRef.current || audioContextRef.current.state !== 'running') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }
    try {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        processAudioData(dataArrayRef.current);
    } catch (e) {
        if (import.meta.env.DEV) console.error("[AudioAnalyzer analyzeAudio] Error in getByteFrequencyData or processAudioData:", e);
    }
    if (typeof requestAnimationFrame === 'function') {
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, [isActive, processAudioData]);

  // Sets up the AudioContext, AnalyserNode, and connects the microphone stream
  const setupAudioAnalyzer = useCallback(async (stream) => {
    if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] Attempting to set up audio analyzer...");
    try {
      if (!audioContextRef.current) {
        const AudioContextGlobal = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextGlobal) {
            if (import.meta.env.DEV) console.error("[AudioAnalyzer setupAudioAnalyzer] AudioContext not supported!");
            return;
        }
        audioContextRef.current = new AudioContextGlobal();
        if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] AudioContext created. Sample rate:", audioContextRef.current.sampleRate);
      }

      if (audioContextRef.current.state === "suspended") {
        if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] AudioContext is suspended, attempting to resume...");
        await audioContextRef.current.resume();
        if (import.meta.env.DEV) console.log(`[AudioAnalyzer setupAudioAnalyzer] AudioContext resumed. State: ${audioContextRef.current.state}`);
      }
      if (audioContextRef.current.state !== "running") {
          if (import.meta.env.DEV) console.error(`[AudioAnalyzer setupAudioAnalyzer] AudioContext not running after resume attempt. State: ${audioContextRef.current.state}`);
          return;
      }

      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
        if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] AnalyserNode created.");
      }

      const initialSmoothing = audioSettingsRef.current?.smoothingFactor ?? DEFAULT_SMOOTHING;
      analyserRef.current.fftSize = FFT_SIZE;
      analyserRef.current.smoothingTimeConstant = Math.max(0, Math.min(1, initialSmoothing));
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;

      const bufferLength = analyserRef.current.frequencyBinCount;
      if (bufferLength === 0) {
          if (import.meta.env.DEV) console.error("[AudioAnalyzer setupAudioAnalyzer] Analyser frequencyBinCount is 0. FFT setup issue?");
          return;
      }
      dataArrayRef.current = new Uint8Array(bufferLength);
      if (import.meta.env.DEV) console.log(`[AudioAnalyzer setupAudioAnalyzer] Data array created with length: ${bufferLength}`);

      if (sourceRef.current) {
        try {
            sourceRef.current.disconnect();
            if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] Disconnected previous source.");
        } catch (disconnectError) {
            if (import.meta.env.DEV) console.warn("[AudioAnalyzer setupAudioAnalyzer] Error disconnecting previous source:", disconnectError);
        }
      }
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] MediaStreamSource created and connected to analyser.");

      if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
      }
      if (typeof requestAnimationFrame === 'function') {
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
        if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] Audio analysis loop started.");
      }
      isCleanupScheduledRef.current = false;

    } catch (e) {
      if (import.meta.env.DEV) console.error("[AudioAnalyzer setupAudioAnalyzer] Error setting up audio analyzer:", e);
    }
  }, [analyzeAudio]);

  const requestMicrophoneAccess = useCallback(async () => {
    if (import.meta.env.DEV) console.log("[AudioAnalyzer requestMicrophoneAccess] Requesting microphone access...");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (import.meta.env.DEV) console.error("[AudioAnalyzer requestMicrophoneAccess] Microphone access not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      if (import.meta.env.DEV) console.log("[AudioAnalyzer requestMicrophoneAccess] Microphone access granted.");
      streamRef.current = stream;
      await setupAudioAnalyzer(stream);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[AudioAnalyzer requestMicrophoneAccess] Error accessing microphone:", err.name, err.message);
    }
  }, [setupAudioAnalyzer]);

  const cleanupAudio = useCallback(() => {
    if (isCleanupScheduledRef.current) return;
    isCleanupScheduledRef.current = true;
    if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] Initiating audio resources cleanup...");

    if (animationFrameRef.current && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] Animation frame cancelled.");
    }

    const managers = managerInstancesRef?.current;
    if (managers) {
        Object.values(managers).forEach(manager => {
            if (manager && typeof manager.resetAudioModifications === 'function') {
                manager.resetAudioModifications();
            }
        });
        if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] Audio modifications reset on managers.");
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
        if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] Source node disconnected.");
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[AudioAnalyzer cleanupAudio] Error disconnecting source node:", e.message);
      }
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        if (import.meta.env.DEV) console.log(`[AudioAnalyzer cleanupAudio] MediaStreamTrack stopped: ${track.label || track.id}`);
      });
      streamRef.current = null;
    }

    if (audioContextRef.current) {
        if (audioContextRef.current.state === "running") {
            audioContextRef.current.suspend().then(() => {
                if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] AudioContext suspended.");
                isCleanupScheduledRef.current = false;
            }).catch((e) => {
                if (import.meta.env.DEV) console.error("[AudioAnalyzer cleanupAudio] Error suspending AudioContext:", e);
                isCleanupScheduledRef.current = false;
            });
        } else {
            if (import.meta.env.DEV) console.log(`[AudioAnalyzer cleanupAudio] AudioContext not running (state: ${audioContextRef.current.state}), no suspend needed.`);
            isCleanupScheduledRef.current = false;
        }
    } else {
        isCleanupScheduledRef.current = false;
    }
    if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] Cleanup process finished.");
  }, [managerInstancesRef]);

  useEffect(() => {
    if (isActive) {
      if (import.meta.env.DEV) console.log("[AudioAnalyzer] isActive is true. Requesting microphone access.");
      requestMicrophoneAccess();
    } else {
      if (import.meta.env.DEV) console.log("[AudioAnalyzer] isActive is false. Cleaning up audio.");
      cleanupAudio();
    }
    return () => {
        if (isActive) {
            cleanupAudio();
        }
    };
  }, [isActive, requestMicrophoneAccess, cleanupAudio]);

  useEffect(() => {
    return () => {
      if (import.meta.env.DEV) console.log("[AudioAnalyzer] Component unmounting. Performing final cleanup.");
      cleanupAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close().then(() => {
            if (import.meta.env.DEV) console.log("[AudioAnalyzer] AudioContext closed on unmount.");
        }).catch(e => {
            if (import.meta.env.DEV) console.error("[AudioAnalyzer] Error closing AudioContext on unmount:", e);
        });
        audioContextRef.current = null;
      }
    };
  }, [cleanupAudio]);

  return null;
};

AudioAnalyzer.propTypes = {
  onAudioData: PropTypes.func,
  isActive: PropTypes.bool,
  layerConfigs: PropTypes.object,
  audioSettings: PropTypes.object,
  configLoadNonce: PropTypes.number,
  managerInstancesRef: PropTypes.object.isRequired,
};

export default AudioAnalyzer;