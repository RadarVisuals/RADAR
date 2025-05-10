// src/components/Audio/AudioAnalyzer.jsx
import React, { useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";

// Default values for layer parameters
const DEFAULT_LAYER_VALUES = {
    size: 1.0,
};
const DEFAULT_SMOOTHING = 0.6; 
const FFT_SIZE = 2048; 

const AudioAnalyzer = ({
  onAudioData,
  isActive = false,
  layerConfigs: layerConfigsProp, 
  audioSettings: audioSettingsProp,
  configLoadNonce,
  managerInstancesRef,
}) => {
  const audioSettingsRef = useRef(audioSettingsProp);
  const baseLayerValuesRef = useRef({ 
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
  const isCleanupScheduledRef = useRef(false);


  useEffect(() => {
    audioSettingsRef.current = audioSettingsProp;
    if (analyserRef.current && audioContextRef.current && audioContextRef.current.state === "running") {
        try {
            const smoothing = audioSettingsRef.current?.smoothingFactor ?? DEFAULT_SMOOTHING;
            analyserRef.current.smoothingTimeConstant = Math.max(0, Math.min(1, smoothing));
        }
        catch (e) { console.warn("[AudioAnalyzer] Error setting smoothingTimeConstant:", e); }
    }
  }, [audioSettingsProp]);

  useEffect(() => {
    if (layerConfigsProp && configLoadNonce !== capturedNonceRef.current) {
        if (capturedNonceRef.current !== -1) { 
            isTransitioningRef.current = true;
            setTimeout(() => {
                if (isTransitioningRef.current) { 
                    isTransitioningRef.current = false;
                }
            }, 1000); 
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

    if (!managers) {
        return;
    }

    const transitionFactor = isTransitioningRef.current ? 0.2 : 1.0; 
    const { bassIntensity = 1.0, midIntensity = 1.0, trebleIntensity = 1.0 } = currentSettings || {};

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

    if (level > 0.4 && bands.bass > 0.6 && !isTransitioningRef.current) {
      const pulseMultiplier = 1 + level * 0.8;
      Object.keys(managers).forEach(layerIdStr => {
        const manager = managers[layerIdStr];
        if (manager && typeof manager.triggerBeatPulse === 'function') {
          manager.triggerBeatPulse(Math.max(0.1, pulseMultiplier), 80); 
        }
      });
    }
  }, [managerInstancesRef]); 

  const processAudioData = useCallback((dataArray) => {
    if (!dataArray || !analyserRef.current) {
        return;
    }
    const bufferLength = analyserRef.current.frequencyBinCount;
    if (bufferLength === 0) {
        return;
    }

    let sum = 0; for (let i = 0; i < bufferLength; i++) { sum += dataArray[i]; }
    const averageLevel = sum / bufferLength / 255; 

    // Original band definitions (more broad)
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

    applyAudioToLayers(newFrequencyBands, newLevel); // This uses the raw, unamplified data for visuals

    if (typeof onAudioData === "function") {
      onAudioData({ level: newLevel, frequencyBands: newFrequencyBands, timestamp: Date.now() });
    }
  }, [onAudioData, applyAudioToLayers]);

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
        console.error("[AudioAnalyzer analyzeAudio] Error in getByteFrequencyData or processAudioData:", e);
    }
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [isActive, processAudioData]);

  const setupAudioAnalyzer = useCallback(async (stream) => {
    console.log("[AudioAnalyzer setupAudioAnalyzer] Attempting to set up audio analyzer...");
    try {
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            console.error("[AudioAnalyzer setupAudioAnalyzer] AudioContext not supported!");
            return;
        }
        audioContextRef.current = new AudioContext();
        console.log("[AudioAnalyzer setupAudioAnalyzer] AudioContext created. Sample rate:", audioContextRef.current.sampleRate);
      }

      if (audioContextRef.current.state === "suspended") {
        console.log("[AudioAnalyzer setupAudioAnalyzer] AudioContext is suspended, attempting to resume...");
        await audioContextRef.current.resume();
        console.log(`[AudioAnalyzer setupAudioAnalyzer] AudioContext resumed. State: ${audioContextRef.current.state}`);
      }
      if (audioContextRef.current.state !== "running") {
          console.error(`[AudioAnalyzer setupAudioAnalyzer] AudioContext not running after resume attempt. State: ${audioContextRef.current.state}`);
          return;
      }

      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
        console.log("[AudioAnalyzer setupAudioAnalyzer] AnalyserNode created.");
      }

      const initialSmoothing = audioSettingsRef.current?.smoothingFactor ?? DEFAULT_SMOOTHING;
      analyserRef.current.fftSize = FFT_SIZE;
      analyserRef.current.smoothingTimeConstant = Math.max(0, Math.min(1, initialSmoothing));
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;

      const bufferLength = analyserRef.current.frequencyBinCount;
      if (bufferLength === 0) {
          console.error("[AudioAnalyzer setupAudioAnalyzer] Analyser frequencyBinCount is 0. FFT setup issue?");
          return;
      }
      dataArrayRef.current = new Uint8Array(bufferLength);
      console.log(`[AudioAnalyzer setupAudioAnalyzer] Data array created with length: ${bufferLength}`);

      if (sourceRef.current) {
        try {
            sourceRef.current.disconnect();
            console.log("[AudioAnalyzer setupAudioAnalyzer] Disconnected previous source.");
        } catch (disconnectError) {
            console.warn("[AudioAnalyzer setupAudioAnalyzer] Error disconnecting previous source:", disconnectError);
        }
      }
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      console.log("[AudioAnalyzer setupAudioAnalyzer] MediaStreamSource created and connected to analyser.");

      if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      console.log("[AudioAnalyzer setupAudioAnalyzer] Audio analysis loop started.");
      isCleanupScheduledRef.current = false;

    } catch (e) {
      console.error("[AudioAnalyzer setupAudioAnalyzer] Error setting up audio analyzer:", e);
    }
  }, [analyzeAudio]); 

  const requestMicrophoneAccess = useCallback(async () => {
    console.log("[AudioAnalyzer requestMicrophoneAccess] Requesting microphone access...");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("[AudioAnalyzer requestMicrophoneAccess] Microphone access not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, 
          noiseSuppression: false, 
          autoGainControl: false,  
        },
        video: false,
      });
      console.log("[AudioAnalyzer requestMicrophoneAccess] Microphone access granted.");
      streamRef.current = stream;
      await setupAudioAnalyzer(stream);
    } catch (err) {
      console.error("[AudioAnalyzer requestMicrophoneAccess] Error accessing microphone:", err.name, err.message);
    }
  }, [setupAudioAnalyzer]);

  const cleanupAudio = useCallback(() => {
    if (isCleanupScheduledRef.current) {
        return;
    }
    isCleanupScheduledRef.current = true;
    console.log("[AudioAnalyzer cleanupAudio] Initiating audio resources cleanup...");

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      console.log("[AudioAnalyzer cleanupAudio] Animation frame cancelled.");
    }

    const managers = managerInstancesRef?.current;
    if (managers) {
        Object.values(managers).forEach(manager => {
            if (manager && typeof manager.resetAudioModifications === 'function') {
                manager.resetAudioModifications();
            }
        });
        console.log("[AudioAnalyzer cleanupAudio] Audio modifications reset on managers.");
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
        console.log("[AudioAnalyzer cleanupAudio] Source node disconnected.");
      } catch (e) {
        console.warn("[AudioAnalyzer cleanupAudio] Error disconnecting source node:", e.message);
      }
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`[AudioAnalyzer cleanupAudio] MediaStreamTrack stopped: ${track.label || track.id}`);
      });
      streamRef.current = null;
    }

    if (audioContextRef.current) {
        if (audioContextRef.current.state === "running") {
            audioContextRef.current.suspend().then(() => {
                console.log("[AudioAnalyzer cleanupAudio] AudioContext suspended.");
                isCleanupScheduledRef.current = false;
            }).catch((e) => {
                console.error("[AudioAnalyzer cleanupAudio] Error suspending AudioContext:", e);
                isCleanupScheduledRef.current = false;
            });
        } else {
            console.log(`[AudioAnalyzer cleanupAudio] AudioContext not running (state: ${audioContextRef.current.state}), no suspend needed.`);
            isCleanupScheduledRef.current = false;
        }
    } else {
        isCleanupScheduledRef.current = false;
    }
    console.log("[AudioAnalyzer cleanupAudio] Cleanup process finished.");
  }, [managerInstancesRef]);

  useEffect(() => {
    if (isActive) {
      console.log("[AudioAnalyzer] isActive is true. Requesting microphone access.");
      requestMicrophoneAccess();
    } else {
      console.log("[AudioAnalyzer] isActive is false. Cleaning up audio.");
      cleanupAudio();
    }
    return () => {
        cleanupAudio();
    };
  }, [isActive, requestMicrophoneAccess, cleanupAudio]);

  useEffect(() => {
    return () => {
      console.log("[AudioAnalyzer] Component unmounting. Performing final cleanup.");
      cleanupAudio(); 
      if (audioContextRef.current) {
        audioContextRef.current.close().then(() => {
        }).catch(e => console.error("[AudioAnalyzer] Error closing AudioContext on unmount:", e));
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