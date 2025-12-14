// src/store/useEngineStore.js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { EFFECT_MANIFEST } from '../config/EffectManifest';

const DEFAULT_AUDIO_SETTINGS = {
  bassIntensity: 1.0,
  midIntensity: 1.0,
  trebleIntensity: 1.0,
  smoothingFactor: 0.6,
};

const DEFAULT_SEQUENCER_INTERVAL = 2000;

// Helper: Flatten Manifest Defaults into a simple key-value object
const getInitialBaseValues = () => {
    const values = {};
    Object.values(EFFECT_MANIFEST).forEach(effect => {
        Object.values(effect.params).forEach(param => {
            values[param.id] = param.default;
        });
    });
    return values;
};

export const useEngineStore = create(
  subscribeWithSelector((set, get) => ({
    // =========================================
    // 1. VISUAL ENGINE CORE (Layers & Scenes)
    // =========================================
    crossfader: 0.0,
    renderedCrossfader: 0.0,
    sideA: { config: null },
    sideB: { config: null },
    isAutoFading: false,
    transitionMode: 'crossfade',
    targetSceneName: null,

    setCrossfader: (value) => set({ crossfader: Math.max(0, Math.min(1, value)) }),
    setRenderedCrossfader: (value) => set({ renderedCrossfader: value }),
    setIsAutoFading: (isFading) => set({ isAutoFading: isFading }),
    setTransitionMode: (mode) => set({ transitionMode: mode }),
    setTargetSceneName: (name) => set({ targetSceneName: name }),
    
    setDeckConfig: (side, config) => set((state) => ({ 
      [side === 'A' ? 'sideA' : 'sideB']: { config } 
    })),

    // =========================================
    // 2. MODULATION SYSTEM
    // =========================================
    
    baseValues: getInitialBaseValues(),
    patches: [],

    // Action: User moves a slider
    setEffectBaseValue: (paramId, value) => set((state) => ({
        baseValues: { ...state.baseValues, [paramId]: value }
    })),

    // Action: User creates a wire OR updates existing (Fixed for stability)
    addPatch: (sourceId, targetId, amount = 1.0) => set((state) => {
        const patchId = `${sourceId}->${targetId}`;
        const existingIndex = state.patches.findIndex(p => p.id === patchId);
        
        if (existingIndex !== -1) {
            // Update in place to preserve array order (Fixes UI jumping bug)
            const updatedPatches = [...state.patches];
            updatedPatches[existingIndex] = { ...updatedPatches[existingIndex], amount };
            return { patches: updatedPatches };
        }
        
        // Add new patch to the end
        return {
            patches: [...state.patches, { id: patchId, source: sourceId, target: targetId, amount }]
        };
    }),

    // Action: User removes a wire
    removePatch: (patchId) => set((state) => ({
        patches: state.patches.filter(p => p.id !== patchId)
    })),

    clearAllPatches: () => set({ patches: [] }),

    // =========================================
    // 3. AUDIO SYSTEM
    // =========================================
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

    // =========================================
    // 4. SEQUENCER
    // =========================================
    sequencerState: {
        active: false,
        intervalMs: DEFAULT_SEQUENCER_INTERVAL,
        nextIndex: 0,
    },

    setSequencerActive: (isActive) => set((state) => ({
        sequencerState: { ...state.sequencerState, active: isActive }
    })),

    setSequencerInterval: (ms) => set((state) => ({
        sequencerState: { ...state.sequencerState, intervalMs: Math.max(100, ms) }
    })),

    setSequencerNextIndex: (index) => set((state) => ({
        sequencerState: { ...state.sequencerState, nextIndex: index }
    })),

    // =========================================
    // 5. MIDI SYSTEM
    // =========================================
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