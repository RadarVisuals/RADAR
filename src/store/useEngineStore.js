// src/store/useEngineStore.js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const DEFAULT_AUDIO_SETTINGS = {
  bassIntensity: 1.0,
  midIntensity: 1.0,
  trebleIntensity: 1.0,
  smoothingFactor: 0.6,
};

const DEFAULT_INDUSTRIAL_MAPPING = {
    rgbStrength: { source: 'bass', amount: 1.2, enabled: true },
    zoomStrength: { source: 'bass', amount: 0.7, enabled: true },
    glitchIntensity: { source: 'treble', amount: 1.0, enabled: true },
    crtNoise: { source: 'mid', amount: 0.5, enabled: true },
    crtGeometry: { source: 'bass', amount: 0.0, enabled: true },
    binaryThreshold: { source: 'level', amount: 0.0, enabled: false }, 
    invertStrobe: { source: 'treble', amount: 0.8, enabled: true },
    crossfaderShred: { source: 'bass', amount: 0.0, enabled: false },
};

// --- NEW CONSTANT ---
const DEFAULT_SEQUENCER_INTERVAL = 2000; // 2 seconds default

export const useEngineStore = create(
  subscribeWithSelector((set, get) => ({
    // ... (Standard Visual Engine Slice) ...
    crossfader: 0.0,
    renderedCrossfader: 0.0,
    sideA: { config: null },
    sideB: { config: null },
    isAutoFading: false,
    transitionMode: 'crossfade',
    targetSceneName: null,
    
    // --- NEW: SEQUENCER SLICE ---
    sequencerState: {
        active: false,
        intervalMs: DEFAULT_SEQUENCER_INTERVAL,
        nextIndex: 0,
    },

    setSequencerActive: (isActive) => set((state) => ({
        sequencerState: { ...state.sequencerState, active: isActive }
    })),

    setSequencerInterval: (ms) => set((state) => ({
        sequencerState: { ...state.sequencerState, intervalMs: Math.max(100, ms) } // Min 100ms safety
    })),

    setSequencerNextIndex: (index) => set((state) => ({
        sequencerState: { ...state.sequencerState, nextIndex: index }
    })),
    // ----------------------------
    
    // INDUSTRIAL CONFIG
    industrialConfig: {
        enabled: false,
        chaos: 0.0,
        masterDrive: 1.0,
        mappings: DEFAULT_INDUSTRIAL_MAPPING
    },

    // Global Effects
    effectsConfig: {
        feedback: { 
            enabled: false, 
            amount: 0.9,    // Decay (Opacity of previous frame)
            scale: 1.02,    // Zoom speed (Creates the tunnel)
            rotation: 0.0,  // Spin speed (Creates the spiral)
            xOffset: 0,     // Drift X
            yOffset: 0      // Drift Y
        },
        bloom: { enabled: false, intensity: 1.0, blur: 8, threshold: 0.5 },
        rgb: { enabled: false, amount: 2 },
        pixelate: { enabled: false, size: 10 },
        twist: { enabled: false, radius: 400, angle: 4, offset: { x: 0, y: 0 } },
        zoomBlur: { enabled: false, strength: 0.1, innerRadius: 50 },
        crt: { enabled: false, curvature: 1, lineWidth: 1, noise: 0.1 },
        kaleidoscope: { enabled: false, sides: 6, angle: 0 },
        liquid: { enabled: false, intensity: 0.02, scale: 3.0, speed: 0.5 },
        volumetric: { enabled: false, exposure: 0.3, decay: 0.95, density: 0.8, weight: 0.4, threshold: 0.5, x: 0.5, y: 0.5 },
        waveDistort: { enabled: false, intensity: 0.5 },
        oldFilm: { enabled: false, noise: 0.3, scratch: 0.1, vignetting: 0.3 },
        adversarial: { enabled: false, intensity: 0.8, bands: 24, shift: 12, noiseScale: 3.0, chromatic: 1.5, scanline: 0.35, qNoise: 2.0, seed: 0.42 },
        ascii: { enabled: false, size: 12, invert: 0, charSet: 0, colorMode: 0 }
    },

    // Actions
    setCrossfader: (value) => set({ crossfader: Math.max(0, Math.min(1, value)) }),
    setRenderedCrossfader: (value) => set({ renderedCrossfader: value }),
    setIsAutoFading: (isFading) => set({ isAutoFading: isFading }),
    setTransitionMode: (mode) => set({ transitionMode: mode }),
    setTargetSceneName: (name) => set({ targetSceneName: name }),
    
    setIndustrialEnabled: (enabled) => set((state) => ({ 
        industrialConfig: { ...state.industrialConfig, enabled } 
    })),
    
    setIndustrialChaos: (value) => set((state) => ({ 
        industrialConfig: { ...state.industrialConfig, chaos: value } 
    })),

    setIndustrialMasterDrive: (value) => set((state) => ({ 
        industrialConfig: { ...state.industrialConfig, masterDrive: value } 
    })),

    updateIndustrialMapping: (target, updates) => set((state) => ({
        industrialConfig: {
            ...state.industrialConfig,
            mappings: {
                ...state.industrialConfig.mappings,
                [target]: { ...state.industrialConfig.mappings[target], ...updates }
            }
        }
    })),
    
    setDeckConfig: (side, config) => set((state) => ({ 
      [side === 'A' ? 'sideA' : 'sideB']: { config } 
    })),

    updateEffectConfig: (effectName, param, value) => set((state) => ({
        effectsConfig: {
            ...state.effectsConfig,
            [effectName]: {
                ...state.effectsConfig[effectName],
                [param]: value
            }
        }
    })),

    // Audio Slice
    isAudioActive: false,
    audioSettings: DEFAULT_AUDIO_SETTINGS,
    analyzerData: { level: 0, frequencyBands: { bass: 0, mid: 0, treble: 0 } },

    setIsAudioActive: (input) => set((state) => ({ 
        isAudioActive: typeof input === 'function' ? input(state.isAudioActive) : input 
    })),
    
    setAudioSettings: (settingsOrFn) => set((state) => ({
        audioSettings: typeof settingsOrFn === 'function' 
            ? settingsOrFn(state.audioSettings) 
            : settingsOrFn
    })),
    
    updateAnalyzerData: (data) => set({ analyzerData: data }),

    // MIDI Slice
    midiAccess: null,
    midiInputs: [],
    isConnected: false,
    isConnecting: false,
    midiError: null,
    midiLearning: null, 
    learningLayer: null, 
    selectedChannel: 0,
    showMidiMonitor: false,
    midiMonitorData: [],
    pendingActions: [], 

    setMidiAccess: (access) => set({ midiAccess: access }),
    setMidiInputs: (inputs) => set({ midiInputs: inputs }),
    setMidiConnectionStatus: (isConnected, isConnecting, error = null) => 
        set({ isConnected, isConnecting, midiError: error }),
    setMidiLearning: (learningState) => set({ midiLearning: learningState }),
    setLearningLayer: (layer) => set({ learningLayer: layer }),
    setSelectedChannel: (channel) => set({ selectedChannel: channel }),
    setShowMidiMonitor: (show) => set({ showMidiMonitor: show }),
    addMidiMonitorData: (entry) => set((state) => {
        const updated = [...state.midiMonitorData, entry];
        return { midiMonitorData: updated.length > 50 ? updated.slice(-50) : updated };
    }),
    clearMidiMonitorData: () => set({ midiMonitorData: [] }),
    queueMidiAction: (action) => set((state) => ({
        pendingActions: [...state.pendingActions, action]
    })),
    clearPendingActions: () => set({ pendingActions: [] }),
  }))
);