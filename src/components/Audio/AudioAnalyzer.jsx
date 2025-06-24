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
  /** @type {React.RefObject<boolean>} */
  const isTransitioningRef = useRef(false); // Flag to dampen audio effects during preset transitions
  /** @type {React.RefObject<{bass: number, mid: number, treble: number}>} */
  const lastBandDataRef = useRef({ bass: 0, mid: 0, treble: 0 }); // For smoothing during transitions
  /** @type {React.RefObject<number>} */
  const lastLevelRef = useRef(0); // For smoothing during transitions

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

  // Update base layer values and handle transition state when a new preset is loaded
  useEffect(() => {
    if (layerConfigsProp && configLoadNonce !== capturedNonceRef.current) {
        // --- START: TEMPORARILY DISABLED TRANSITION LOGIC ---
        // if (capturedNonceRef.current !== -1 && import.meta.env.DEV) { // If not the very first load
        //     // console.log("[AudioAnalyzer] New configLoadNonce detected, entering transition phase for audio reactivity.");
        //     isTransitioningRef.current = true;
        //     // Transition phase to smooth out audio reactivity changes
        //     setTimeout(() => {
        //         if (isTransitioningRef.current) {
        //             isTransitioningRef.current = false;
        //             // if (import.meta.env.DEV) console.log("[AudioAnalyzer] Audio reactivity transition phase ended.");
        //         }
        //     }, 1000); // Duration of the transition dampening
        // }
        // --- END: TEMPORARILY DISABLED TRANSITION LOGIC ---
        isTransitioningRef.current = false; // Explicitly set to false for testing responsiveness

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

    // --- START: TEMPORARILY DISABLED TRANSITION LOGIC ---
    // Dampen effect intensity during preset transitions
    // const transitionFactor = isTransitioningRef.current ? 0.2 : 1.0;
    const transitionFactor = 1.0; // Force no dampening for testing responsiveness
    // --- END: TEMPORARILY DISABLED TRANSITION LOGIC ---
    const { bassIntensity = 1.0, midIntensity = 1.0, trebleIntensity = 1.0 } = currentSettings;

    // Apply bass frequency to layer 1 size
    const bassEffectMagnitude = bands.bass * 0.8 * bassIntensity * transitionFactor;
    const finalBassFactor = 1 + bassEffectMagnitude; // Multiplier around base size
    if (managers['1'] && typeof managers['1'].setAudioFrequencyFactor === 'function') {
        managers['1'].setAudioFrequencyFactor(Math.max(0.1, finalBassFactor));
    }

    // Apply mid frequency to layer 2 size
    const midEffectMagnitude = bands.mid * 1.0 * midIntensity * transitionFactor;
    const finalMidFactor = 1 + midEffectMagnitude;
    if (managers['2'] && typeof managers['2'].setAudioFrequencyFactor === 'function') {
        managers['2'].setAudioFrequencyFactor(Math.max(0.1, finalMidFactor));
    }

    // Apply treble frequency to layer 3 size
    const trebleEffectMagnitude = bands.treble * 2.0 * trebleIntensity * transitionFactor;
    const finalTrebleFactor = 1 + trebleEffectMagnitude;
    if (managers['3'] && typeof managers['3'].setAudioFrequencyFactor === 'function') {
        managers['3'].setAudioFrequencyFactor(Math.max(0.1, finalTrebleFactor));
    }

    // Trigger a beat pulse effect on all layers if conditions are met
    // --- START: TEMPORARILY DISABLED TRANSITION LOGIC in beat pulse ---
    // if (level > 0.4 && bands.bass > 0.6 && !isTransitioningRef.current) {
    if (level > 0.4 && bands.bass > 0.6) { // Always allow beat pulse if conditions met for testing
    // --- END: TEMPORARILY DISABLED TRANSITION LOGIC in beat pulse ---
      const pulseMultiplier = 1 + level * 0.8; // Stronger pulse for higher levels
      Object.keys(managers).forEach(layerIdStr => {
        const manager = managers[layerIdStr];
        if (manager && typeof manager.triggerBeatPulse === 'function') {
          manager.triggerBeatPulse(Math.max(0.1, pulseMultiplier), 80); // Short pulse duration
        }
      });
    }
  }, [managerInstancesRef]); // audioSettingsRef and isTransitioningRef are refs

  // Processes raw frequency data from AnalyserNode into level and bands
  const processAudioData = useCallback((dataArray) => {
    if (!dataArray || !analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    if (bufferLength === 0) return; // Should not happen if analyser is set up

    let sum = 0; for (let i = 0; i < bufferLength; i++) { sum += dataArray[i]; }
    const averageLevel = sum / bufferLength / 255; // Normalize to 0-1 range

    // Define frequency band ranges (these can be tuned)
    const bassEndIndex = Math.floor(bufferLength * 0.08); // ~0-200Hz for 2048 FFT / 48kHz sample rate
    const midEndIndex = bassEndIndex + Math.floor(bufferLength * 0.35); // ~200Hz-1.8kHz

    let bassSum = 0, midSum = 0, trebleSum = 0;
    let bassCount = 0, midCount = 0, trebleCount = 0;

    for (let i = 0; i < bufferLength; i++) {
        if (i < bassEndIndex) { bassSum += dataArray[i]; bassCount++; }
        else if (i < midEndIndex) { midSum += dataArray[i]; midCount++; }
        else { trebleSum += dataArray[i]; trebleCount++; }
    }

    // Normalize band values to 0-1 range
    const bass = Math.min(1, bassCount > 0 ? (bassSum / bassCount / 255) : 0);
    const mid = Math.min(1, midCount > 0 ? (midSum / midCount / 255) : 0);
    const treble = Math.min(1, trebleCount > 0 ? (trebleSum / trebleCount / 255) : 0);

    let newBass = bass, newMid = mid, newTreble = treble, newLevel = averageLevel;

    // --- START: TEMPORARILY DISABLED TRANSITION LOGIC ---
    // Smooth values during transitions to avoid jarring visual changes
    // if (isTransitioningRef.current) {
    //     const blendFactor = 0.8; // How much of the previous value to keep
    //     newBass = lastBandDataRef.current.bass * blendFactor + bass * (1 - blendFactor);
    //     newMid = lastBandDataRef.current.mid * blendFactor + mid * (1 - blendFactor);
    //     newTreble = lastBandDataRef.current.treble * blendFactor + treble * (1 - blendFactor);
    //     newLevel = lastLevelRef.current * blendFactor + averageLevel * (1 - blendFactor);
    // }
    // --- END: TEMPORARILY DISABLED TRANSITION LOGIC ---
    // When transition logic is disabled, newBass, newMid, etc., will just be the raw band values

    lastBandDataRef.current = { bass: newBass, mid: newMid, treble: newTreble };
    lastLevelRef.current = newLevel;

    const newFrequencyBands = { bass: newBass, mid: newMid, treble: newTreble };

    applyAudioToLayers(newFrequencyBands, newLevel);

    if (typeof onAudioData === "function") {
      onAudioData({ level: newLevel, frequencyBands: newFrequencyBands, timestamp: Date.now() });
    }
  }, [onAudioData, applyAudioToLayers]); // isTransitioningRef, lastBandDataRef, lastLevelRef are refs

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
  }, [isActive, processAudioData]); // processAudioData is memoized

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
      analyserRef.current.minDecibels = -90; // Typical range for audio analysis
      analyserRef.current.maxDecibels = -10;

      const bufferLength = analyserRef.current.frequencyBinCount;
      if (bufferLength === 0) {
          if (import.meta.env.DEV) console.error("[AudioAnalyzer setupAudioAnalyzer] Analyser frequencyBinCount is 0. FFT setup issue?");
          return;
      }
      dataArrayRef.current = new Uint8Array(bufferLength);
      if (import.meta.env.DEV) console.log(`[AudioAnalyzer setupAudioAnalyzer] Data array created with length: ${bufferLength}`);

      if (sourceRef.current) { // Disconnect previous source if exists
        try {
            sourceRef.current.disconnect();
            if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] Disconnected previous source.");
        } catch (disconnectError) {
            if (import.meta.env.DEV) console.warn("[AudioAnalyzer setupAudioAnalyzer] Error disconnecting previous source:", disconnectError);
        }
      }
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current); // Connect new stream to analyser
      if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] MediaStreamSource created and connected to analyser.");

      if (animationFrameRef.current) { // Cancel any existing animation loop
          cancelAnimationFrame(animationFrameRef.current);
      }
      if (typeof requestAnimationFrame === 'function') {
        animationFrameRef.current = requestAnimationFrame(analyzeAudio); // Start new loop
        if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] Audio analysis loop started.");
      }
      isCleanupScheduledRef.current = false; // Reset cleanup flag

    } catch (e) {
      if (import.meta.env.DEV) console.error("[AudioAnalyzer setupAudioAnalyzer] Error setting up audio analyzer:", e);
    }
  }, [analyzeAudio]); // analyzeAudio is memoized, audioSettingsRef is a ref

  // Requests microphone access from the user
  const requestMicrophoneAccess = useCallback(async () => {
    if (import.meta.env.DEV) console.log("[AudioAnalyzer requestMicrophoneAccess] Requesting microphone access...");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (import.meta.env.DEV) console.error("[AudioAnalyzer requestMicrophoneAccess] Microphone access not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { // Desired audio constraints
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false, // No video needed
      });
      if (import.meta.env.DEV) console.log("[AudioAnalyzer requestMicrophoneAccess] Microphone access granted.");
      streamRef.current = stream;
      await setupAudioAnalyzer(stream);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[AudioAnalyzer requestMicrophoneAccess] Error accessing microphone:", err.name, err.message);
      // Potentially update UI or notify user of permission denial
    }
  }, [setupAudioAnalyzer]); // setupAudioAnalyzer is memoized

  // Cleans up audio resources (stream, nodes, context)
  const cleanupAudio = useCallback(() => {
    if (isCleanupScheduledRef.current) return; // Prevent redundant cleanups
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
        track.stop(); // Stop each track in the stream
        if (import.meta.env.DEV) console.log(`[AudioAnalyzer cleanupAudio] MediaStreamTrack stopped: ${track.label || track.id}`);
      });
      streamRef.current = null;
    }

    // Suspend AudioContext instead of closing, to allow potential re-activation
    if (audioContextRef.current) {
        if (audioContextRef.current.state === "running") {
            audioContextRef.current.suspend().then(() => {
                if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] AudioContext suspended.");
                isCleanupScheduledRef.current = false; // Allow cleanup again if re-activated
            }).catch((e) => {
                if (import.meta.env.DEV) console.error("[AudioAnalyzer cleanupAudio] Error suspending AudioContext:", e);
                isCleanupScheduledRef.current = false;
            });
        } else {
            if (import.meta.env.DEV) console.log(`[AudioAnalyzer cleanupAudio] AudioContext not running (state: ${audioContextRef.current.state}), no suspend needed.`);
            isCleanupScheduledRef.current = false;
        }
    } else {
        isCleanupScheduledRef.current = false; // No context to suspend
    }
    if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] Cleanup process finished.");
  }, [managerInstancesRef]); // managerInstancesRef is a ref

  // Effect to manage audio setup/teardown based on `isActive` prop
  useEffect(() => {
    if (isActive) {
      if (import.meta.env.DEV) console.log("[AudioAnalyzer] isActive is true. Requesting microphone access.");
      requestMicrophoneAccess();
    } else {
      if (import.meta.env.DEV) console.log("[AudioAnalyzer] isActive is false. Cleaning up audio.");
      cleanupAudio();
    }
    // This return function is for when `isActive` changes from true to false,
    // or when the component unmounts while `isActive` was true.
    return () => {
        if (isActive) { // Only cleanup if it was active before this effect re-ran or unmounted
            cleanupAudio();
        }
    };
  }, [isActive, requestMicrophoneAccess, cleanupAudio]);

  // Final cleanup on component unmount
  useEffect(() => {
    return () => {
      if (import.meta.env.DEV) console.log("[AudioAnalyzer] Component unmounting. Performing final cleanup.");
      cleanupAudio(); // Ensure all resources are released
      // Close AudioContext fully on unmount
      if (audioContextRef.current) {
        audioContextRef.current.close().then(() => {
            if (import.meta.env.DEV) console.log("[AudioAnalyzer] AudioContext closed on unmount.");
        }).catch(e => {
            if (import.meta.env.DEV) console.error("[AudioAnalyzer] Error closing AudioContext on unmount:", e);
        });
        audioContextRef.current = null;
      }
    };
  }, [cleanupAudio]); // cleanupAudio is memoized

  return null; // This component does not render any visible UI
};

AudioAnalyzer.propTypes = {
  onAudioData: PropTypes.func,
  isActive: PropTypes.bool,
  layerConfigs: PropTypes.object,
  audioSettings: PropTypes.object,
  configLoadNonce: PropTypes.number,
  managerInstancesRef: PropTypes.object.isRequired, // Typically React.RefObject
};

export default AudioAnalyzer;