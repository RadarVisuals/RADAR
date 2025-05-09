// src/components/Audio/AudioAnalyzer.jsx
import React, { useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";

// Default values for layer parameters
const DEFAULT_LAYER_VALUES = {
    size: 1.0,
};
const DEFAULT_SMOOTHING = 0.6; // Default if not provided

const AudioAnalyzer = ({
  onAudioData,
  isActive = false,
  layerConfigs: layerConfigsProp, // This is the live config from context
  audioSettings: audioSettingsProp,
  configLoadNonce,
  managerInstancesRef,
}) => {
  const audioSettingsRef = useRef(audioSettingsProp);
  const baseLayerValuesRef = useRef({ // Stores original preset values, used for transition blending
      '1': { size: DEFAULT_LAYER_VALUES.size },
      '2': { size: DEFAULT_LAYER_VALUES.size },
      '3': { size: DEFAULT_LAYER_VALUES.size },
  });
  const capturedNonceRef = useRef(-1);
  const isTransitioningRef = useRef(false);
  const lastBandDataRef = useRef({ bass: 0, mid: 0, treble: 0 });
  const lastLevelRef = useRef(0);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);
  const dataArrayRef = useRef(null);
  const streamRef = useRef(null);

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

  useEffect(() => {
    // This effect updates baseLayerValuesRef for transition blending.
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

  const applyAudioToLayers = useCallback((bands, level) => {
    const managers = managerInstancesRef?.current;
    const currentSettings = audioSettingsRef.current;

    if (!managers) return;
    const transitionFactor = isTransitioningRef.current ? 0.2 : 1.0;
    const { bassIntensity = 1.0, midIntensity = 1.0, trebleIntensity = 1.0 } = currentSettings || {};

    // Apply frequency band factors
    const bassEffectMagnitude = bands.bass * 0.8 * bassIntensity * transitionFactor;
    const finalBassFactor = 1 + bassEffectMagnitude;
    if (managers['1'] && typeof managers['1'].setAudioFrequencyFactor === 'function') {
        managers['1'].setAudioFrequencyFactor(Math.max(0.1, finalBassFactor));
    }

    const midEffectMagnitude = bands.mid * 1.0 * midIntensity * transitionFactor;
    const finalMidFactor = 1 + midEffectMagnitude;
    if (managers['2'] && typeof managers['2'].setAudioFrequencyFactor === 'function') {
        managers['2'].setAudioFrequencyFactor(Math.max(0.1, finalMidFactor));
    }

    const trebleEffectMagnitude = bands.treble * 2.0 * trebleIntensity * transitionFactor;
    const finalTrebleFactor = 1 + trebleEffectMagnitude;
    if (managers['3'] && typeof managers['3'].setAudioFrequencyFactor === 'function') {
        managers['3'].setAudioFrequencyFactor(Math.max(0.1, finalTrebleFactor));
    }

    // Trigger beat pulse
    if (level > 0.4 && bands.bass > 0.6 && !isTransitioningRef.current) {
      const pulseMultiplier = 1 + level * 0.8; // This is the factor for the pulse
      Object.keys(managers).forEach(layerIdStr => {
        const manager = managers[layerIdStr];
        if (manager && typeof manager.triggerBeatPulse === 'function') {
          manager.triggerBeatPulse(Math.max(0.1, pulseMultiplier), 80);
        }
      });
    }
  }, [managerInstancesRef]);

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

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !isActive || !audioContextRef.current) {
      if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
      return;
    }
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    processAudioData(dataArrayRef.current);
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [isActive, processAudioData]);

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
    }
  }, [analyzeAudio]);

  const requestMicrophoneAccess = useCallback(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("Microphone access not supported.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false })
    .then((stream) => { streamRef.current = stream; setupAudioAnalyzer(stream); })
    .catch((err) => {
      console.error("Error accessing microphone:", err);
    });
  }, [setupAudioAnalyzer]);

  const cleanupAudio = useCallback(() => {
    if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }

    const managers = managerInstancesRef?.current;
    if (managers) {
        Object.values(managers).forEach(manager => {
            if (manager && typeof manager.resetAudioModifications === 'function') {
                manager.resetAudioModifications();
            }
        });
    }

    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); sourceRef.current = null; }
      // eslint-disable-next-line no-unused-vars
      catch (_) { /* Ignore disconnection errors */ }
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
    if (audioContextRef.current && audioContextRef.current.state === "running") {
      audioContextRef.current.suspend().catch((e) => console.error("Error suspending audio context:", e) );
    }
  }, [managerInstancesRef]);

  useEffect(() => {
    if (isActive) { requestMicrophoneAccess(); }
    else { cleanupAudio(); }
    return cleanupAudio;
  }, [isActive, requestMicrophoneAccess, cleanupAudio]);

  useEffect(() => {
    return () => {
      cleanupAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(e => console.error("Error closing AudioContext on unmount:", e) );
        audioContextRef.current = null;
      }
    };
  }, [cleanupAudio]);

  useEffect(() => {
    if (configLoadNonce !== capturedNonceRef.current && capturedNonceRef.current !== -1) {
      console.log("[AudioAnalyzer] Configuration changed, enabling transition mode");
      isTransitioningRef.current = true;
      setTimeout(() => { isTransitioningRef.current = false; console.log("[AudioAnalyzer] Transition mode completed"); }, 1000);
    }
  }, [configLoadNonce]);

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