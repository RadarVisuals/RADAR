// src/components/Audio/AudioAnalyzer.jsx
import React, { useEffect, useRef, useCallback } from "react"; // Removed useState
import PropTypes from "prop-types";

// Default values for layer parameters
const DEFAULT_LAYER_VALUES = {
    size: 1.0,
};
const DEFAULT_SMOOTHING = 0.6; // Default if not provided

const AudioAnalyzer = ({
  onAudioData,
  isActive = false,
  layerConfigs: layerConfigsProp,
  audioSettings: audioSettingsProp, // Receive the full settings object
  configLoadNonce,
  managerInstancesRef,
}) => {
  // --- Core Refs ---
  const audioSettingsRef = useRef(audioSettingsProp); // Store the passed settings
  const baseLayerValuesRef = useRef({
      '1': { size: DEFAULT_LAYER_VALUES.size },
      '2': { size: DEFAULT_LAYER_VALUES.size },
      '3': { size: DEFAULT_LAYER_VALUES.size },
  });
  const capturedNonceRef = useRef(-1);
  const isTransitioningRef = useRef(false);
  const lastBandDataRef = useRef({ bass: 0, mid: 0, treble: 0 });
  const lastLevelRef = useRef(0);

  // --- Audio Processing Refs ---
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);
  const dataArrayRef = useRef(null);
  const streamRef = useRef(null);
  const beatPulseTimeoutRefs = useRef({});

  // --- Update Refs and Apply Smoothing ---
  useEffect(() => {
    audioSettingsRef.current = audioSettingsProp;
    if (analyserRef.current) {
        try {
            const smoothing = audioSettingsRef.current?.smoothingFactor ?? DEFAULT_SMOOTHING;
            analyserRef.current.smoothingTimeConstant = smoothing;
        }
        catch (e) { console.warn("Error setting smoothingTimeConstant:", e); }
    }
  }, [audioSettingsProp]);

  // --- Capture Base Values ---
  useEffect(() => {
    if (layerConfigsProp && configLoadNonce !== capturedNonceRef.current) {
        if (capturedNonceRef.current !== -1) {
            isTransitioningRef.current = true;
            setTimeout(() => { isTransitioningRef.current = false; }, 1000);
        }
        const newBaseValues = {};
        for (const layerIdStr of ['1', '2', '3']) {
            const config = layerConfigsProp[layerIdStr] || {};
            newBaseValues[layerIdStr] = { size: config.size ?? DEFAULT_LAYER_VALUES.size };
        }
        baseLayerValuesRef.current = newBaseValues;
        capturedNonceRef.current = configLoadNonce;
    }
  }, [configLoadNonce, layerConfigsProp]);

  // --- Apply Audio To Layers (Enhanced with transition handling) ---
  const applyAudioToLayers = useCallback((bands, level) => {
    const managers = managerInstancesRef?.current;
    const currentSettings = audioSettingsRef.current;
    const baseValues = baseLayerValuesRef.current;
    if (!managers) return;
    const transitionFactor = isTransitioningRef.current ? 0.2 : 1.0;
    const { bassIntensity = 1.0, midIntensity = 1.0, trebleIntensity = 1.0 } = currentSettings || {};

    const setManagerSize = (layerId, size) => {
        const manager = managers[layerId];
        if (manager && typeof manager.setReactiveSize === 'function') { manager.setReactiveSize(size); }
    };

    const baseSize1 = baseValues['1']?.size || DEFAULT_LAYER_VALUES.size;
    const targetSize1 = Math.max(0.1, baseSize1 * (1 + bands.bass * 0.8 * bassIntensity * transitionFactor));
    if (!beatPulseTimeoutRefs.current['1']) setManagerSize('1', targetSize1);

    const baseSize2 = baseValues['2']?.size || DEFAULT_LAYER_VALUES.size;
    const targetSize2 = Math.max(0.1, baseSize2 * (1 + bands.mid * 1.0 * midIntensity * transitionFactor));
    if (!beatPulseTimeoutRefs.current['2']) setManagerSize('2', targetSize2);

    const baseSize3 = baseValues['3']?.size || DEFAULT_LAYER_VALUES.size;
    const targetSize3 = Math.max(0.1, baseSize3 * (1 + bands.treble * 2.0 * trebleIntensity * transitionFactor));
    if (!beatPulseTimeoutRefs.current['3']) setManagerSize('3', targetSize3);

    if (level > 0.4 && bands.bass > 0.6 && !isTransitioningRef.current) {
      const pulseMultiplier = 1 + level * 0.8;
      Object.keys(baseValues).forEach(layerIdStr => {
        const layerBaseSize = baseValues[layerIdStr]?.size || DEFAULT_LAYER_VALUES.size;
        const pulsedSize = Math.max(0.1, layerBaseSize * pulseMultiplier);
        if (beatPulseTimeoutRefs.current[layerIdStr]) clearTimeout(beatPulseTimeoutRefs.current[layerIdStr]);
        setManagerSize(layerIdStr, pulsedSize);
        beatPulseTimeoutRefs.current[layerIdStr] = setTimeout(() => {
          const currentBase = baseLayerValuesRef.current[layerIdStr]?.size || DEFAULT_LAYER_VALUES.size;
          setManagerSize(layerIdStr, currentBase);
          delete beatPulseTimeoutRefs.current[layerIdStr];
        }, 80);
      });
    }
  }, [managerInstancesRef]);

  // --- Process Audio Data ---
  const processAudioData = useCallback((dataArray) => {
    if (!dataArray || !analyserRef.current) return;
    const bufferLength = analyserRef.current.frequencyBinCount;
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
    let newBass = bass, newMid = mid, newTreble = treble, newLevel = averageLevel;
    if (isTransitioningRef.current) {
        const blendFactor = 0.8;
        newBass = lastBandDataRef.current.bass * blendFactor + bass * (1 - blendFactor);
        newMid = lastBandDataRef.current.mid * blendFactor + mid * (1 - blendFactor);
        newTreble = lastBandDataRef.current.treble * blendFactor + treble * (1 - blendFactor);
        newLevel = lastLevelRef.current * blendFactor + averageLevel * (1 - blendFactor);
    }
    lastBandDataRef.current = { bass: newBass, mid: newMid, treble: newTreble };
    lastLevelRef.current = newLevel;
    const newFrequencyBands = { bass: newBass, mid: newMid, treble: newTreble };
    applyAudioToLayers(newFrequencyBands, newLevel);
    if (typeof onAudioData === "function") {
      onAudioData({ level: newLevel, frequencyBands: newFrequencyBands, timestamp: Date.now() });
    }
  }, [onAudioData, applyAudioToLayers]);

  // --- Audio Analysis Loop ---
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !isActive || !audioContextRef.current) {
      if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
      return;
    }
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    processAudioData(dataArrayRef.current);
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [isActive, processAudioData]);

  // --- Setup Audio Analyzer ---
  const setupAudioAnalyzer = useCallback((stream) => {
    try {
      if (!audioContextRef.current) { const AudioContext = window.AudioContext || window.webkitAudioContext; audioContextRef.current = new AudioContext(); }
      if (audioContextRef.current.state === "suspended") { audioContextRef.current.resume(); }
      if (!analyserRef.current) { analyserRef.current = audioContextRef.current.createAnalyser(); }
      const initialSmoothing = audioSettingsRef.current?.smoothingFactor ?? DEFAULT_SMOOTHING;
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = initialSmoothing;
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      if (sourceRef.current) { sourceRef.current.disconnect(); }
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      if (!animationFrameRef.current) { animationFrameRef.current = requestAnimationFrame(analyzeAudio); }
    } catch (e) {
      console.error("Error setting up audio analyzer:", e);
      // Error state was removed, so no need to set it
    }
  }, [analyzeAudio]);

  // --- Request Mic Access ---
  const requestMicrophoneAccess = useCallback(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("Microphone access not supported.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false })
    .then((stream) => { streamRef.current = stream; setupAudioAnalyzer(stream); })
    .catch((err) => {
      console.error("Error accessing microphone:", err);
      // Error state was removed, so no need to set it
    });
  }, [setupAudioAnalyzer]);

  // --- Cleanup Audio ---
  const cleanupAudio = useCallback(() => {
    if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
    Object.values(beatPulseTimeoutRefs.current).forEach(clearTimeout); beatPulseTimeoutRefs.current = {};
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); sourceRef.current = null; }
      // eslint-disable-next-line no-unused-vars
      catch (_) { /* Ignore disconnection errors */ }
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
    if (audioContextRef.current && audioContextRef.current.state === "running") {
      audioContextRef.current.suspend().catch((e) => console.error("Error suspending audio context:", e) );
    }
  }, []);

  // --- Effect for Audio Setup/Teardown ---
  useEffect(() => {
    if (isActive) { requestMicrophoneAccess(); }
    else { cleanupAudio(); }
    return cleanupAudio;
  }, [isActive, requestMicrophoneAccess, cleanupAudio]);

  // --- Unmount Cleanup ---
  useEffect(() => {
    return () => {
      cleanupAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(e => console.error("Error closing AudioContext on unmount:", e) );
        audioContextRef.current = null;
      }
    };
  }, [cleanupAudio]);

  // --- Effect for Reset on Configuration Change ---
  useEffect(() => {
    if (configLoadNonce !== capturedNonceRef.current && capturedNonceRef.current !== -1) {
      console.log("[AudioAnalyzer] Configuration changed, enabling transition mode");
      isTransitioningRef.current = true;
      setTimeout(() => { isTransitioningRef.current = false; console.log("[AudioAnalyzer] Transition mode completed"); }, 1000);
    }
  }, [configLoadNonce]);

  return null; // This component doesn't render anything visible
};

// --- PropTypes ---
AudioAnalyzer.propTypes = {
  onAudioData: PropTypes.func,
  isActive: PropTypes.bool,
  layerConfigs: PropTypes.object,
  audioSettings: PropTypes.object,
  configLoadNonce: PropTypes.number,
  managerInstancesRef: PropTypes.object.isRequired,
};

export default AudioAnalyzer;