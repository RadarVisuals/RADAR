// src/components/Audio/AudioAnalyzer.jsx
import React, { useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { useEngineStore } from "../../store/useEngineStore";
import { useProjectStore } from "../../store/useProjectStore";
import SignalBus from "../../utils/SignalBus";

const FFT_SIZE = 2048;

const AudioAnalyzer = ({ managerInstancesRef }) => {
  // Read state directly from store to avoid parent re-render interference
  const isActive = useEngineStore((state) => state.isAudioActive);
  const audioSettings = useEngineStore((state) => state.audioSettings);
  
  // We grab layerConfigs from ProjectStore directly
  const layerConfigs = useProjectStore((state) => state.stagedWorkspace?.layers);

  const audioSettingsRef = useRef(audioSettings);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);
  const dataArrayRef = useRef(null);
  const streamRef = useRef(null);
  const isCleanupScheduledRef = useRef(false);

  // Keep settings ref up to date for the processing loop
  useEffect(() => {
    audioSettingsRef.current = audioSettings;
    if (analyserRef.current && audioContextRef.current && audioContextRef.current.state === "running") {
        try {
            const smoothing = audioSettings.smoothingFactor ?? 0.6;
            analyserRef.current.smoothingTimeConstant = Math.max(0, Math.min(1, smoothing));
        } catch (e) {
            console.warn("[AudioAnalyzer] Error setting smoothing:", e);
        }
    }
  }, [audioSettings]);

  const applyAudioToLayers = useCallback((bands, level) => {
    const managers = managerInstancesRef?.current;
    const currentSettings = audioSettingsRef.current;

    if (!managers || !currentSettings) return;

    const { bassIntensity = 1.0, midIntensity = 1.0, trebleIntensity = 1.0 } = currentSettings;

    const bassFactor = 1 + (bands.bass * 0.8 * bassIntensity);
    const midFactor = 1 + (bands.mid * 1.0 * midIntensity);
    const trebleFactor = 1 + (bands.treble * 2.0 * trebleIntensity);

    // Apply to Pixi Managers via Proxy
    if (managers['1']) managers['1'].setAudioFrequencyFactor(Math.max(0.1, bassFactor));
    if (managers['2']) managers['2'].setAudioFrequencyFactor(Math.max(0.1, midFactor));
    if (managers['3']) managers['3'].setAudioFrequencyFactor(Math.max(0.1, trebleFactor));

    // Beat Pulse logic
    if (level > 0.4 && bands.bass > 0.6) {
      const pulseMultiplier = 1 + level * 0.8;
      if (managers['1']) managers['1'].triggerBeatPulse(Math.max(0.1, pulseMultiplier), 80);
    }
  }, [managerInstancesRef]);

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
    
    const newFrequencyBands = { bass, mid, treble };
    
    applyAudioToLayers(newFrequencyBands, averageLevel);

    SignalBus.emit('audio:analysis', { 
        level: averageLevel, 
        frequencyBands: newFrequencyBands 
    });

  }, [applyAudioToLayers]);

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !isActive || !audioContextRef.current || audioContextRef.current.state !== 'running') {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    processAudioData(dataArrayRef.current);
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [isActive, processAudioData]);

  const setupAudioAnalyzer = useCallback(async (stream) => {
    try {
      if (!audioContextRef.current) {
        const AudioContextGlobal = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContextGlobal();
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
      }

      analyserRef.current.fftSize = FFT_SIZE;
      analyserRef.current.smoothingTimeConstant = audioSettingsRef.current?.smoothingFactor ?? 0.6;
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;

      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);

      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch(e) {}
      }
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      isCleanupScheduledRef.current = false;

    } catch (e) {
      console.error("[AudioAnalyzer] Setup error:", e);
    }
  }, [analyzeAudio]);

  const requestMicrophoneAccess = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      streamRef.current = stream;
      await setupAudioAnalyzer(stream);
    } catch (err) {
      console.error("[AudioAnalyzer] Mic access error:", err);
    }
  }, [setupAudioAnalyzer]);

  const cleanupAudio = useCallback(() => {
    if (isCleanupScheduledRef.current) return;
    isCleanupScheduledRef.current = true;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch(e) {}
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state === "running") {
        audioContextRef.current.suspend().catch(() => {}).finally(() => {
            isCleanupScheduledRef.current = false;
        });
    } else {
        isCleanupScheduledRef.current = false;
    }
  }, []);

  // ONLY restart/cleanup when the global "isActive" flag changes
  useEffect(() => {
    if (isActive) {
        if (!streamRef.current) requestMicrophoneAccess();
    } else {
        cleanupAudio();
    }
  }, [isActive, requestMicrophoneAccess, cleanupAudio]);

  useEffect(() => {
    return () => {
      cleanupAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [cleanupAudio]);

  return null;
};

AudioAnalyzer.propTypes = {
  managerInstancesRef: PropTypes.object.isRequired,
};

export default React.memo(AudioAnalyzer);