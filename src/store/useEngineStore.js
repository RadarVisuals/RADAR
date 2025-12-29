// src/store/useEngineStore.js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { EFFECT_MANIFEST } from '../config/EffectManifest';
import { midiManager } from '../utils/MidiManager';

const DEFAULT_AUDIO_SETTINGS = {
  bassIntensity: 1.0,
  midIntensity: 1.0,
  trebleIntensity: 1.0,
  smoothingFactor: 0.6,
};

const DEFAULT_SEQUENCER_INTERVAL = 2000;

/**
 * Helper to generate initial base values for all parameters defined in the manifest.
 */
export const getInitialBaseValues = () => {
    const values = {};
    Object.values(EFFECT_MANIFEST).forEach(effect => {
        Object.values(effect.params).forEach(param => {
            values[param.id] = param.default;
        });
    });
    values['global.crossfader'] = 0.0;
    return values;
};

export const useEngineStore = create(
  subscribeWithSelector((set, get) => ({
    // =========================================
    // 1. VISUAL ENGINE CORE
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

    /**
     * Optimized Configuration Update
     * Replaces expensive deep clones (JSON.parse) with shallow target updates.
     * This is crucial for zero-latency MIDI performance.
     */
    updateActiveDeckConfig: (layerId, key, value) => {
        const { crossfader } = get();
        const activeSideKey = crossfader < 0.5 ? 'sideA' : 'sideB';
        const currentDeck = get()[activeSideKey];

        if (!currentDeck?.config) return;

        // Shallow clone the layers map and the specific modified layer
        const newLayers = { ...currentDeck.config.layers };
        newLayers[layerId] = { 
            ...newLayers[layerId], 
            [key]: value 
        };

        set({
            [activeSideKey]: {
                config: {
                    ...currentDeck.config,
                    layers: newLayers
                }
            }
        });
    },

    // =========================================
    // 2. MODULATION SYSTEM (The Missing Functions)
    // =========================================
    baseValues: getInitialBaseValues(),
    patches: [],
    modulationLoadNonce: 0, 

    setEffectBaseValue: (paramId, value) => set((state) => ({
        baseValues: { ...state.baseValues, [paramId]: value }
    })),

    addPatch: (sourceId, targetId, amount = 1.0) => set((state) => {
        const patchId = `${sourceId}->${targetId}`;
        const existingIndex = state.patches.findIndex(p => p.id === patchId);
        if (existingIndex !== -1) {
            const updatedPatches = [...state.patches];
            updatedPatches[existingIndex] = { ...updatedPatches[existingIndex], amount };
            return { patches: updatedPatches };
        }
        return { patches: [...state.patches, { id: patchId, source: sourceId, target: targetId, amount }] };
    }),

    removePatch: (patchId) => set((state) => ({
        patches: state.patches.filter(p => p.id !== patchId)
    })),

    clearAllPatches: () => set({ patches: [] }),
    resetBaseValues: () => set({ baseValues: getInitialBaseValues() }),

    /**
     * Hydrates the modulation engine when a workspace is loaded.
     * This was the function causing your TypeError.
     */
    loadModulationState: (savedBaseValues, savedPatches) => set((state) => {
        const freshDefaults = getInitialBaseValues();
        const mergedBaseValues = { ...freshDefaults };
        
        if (savedBaseValues) {
            Object.keys(savedBaseValues).forEach(key => {
                if (Object.prototype.hasOwnProperty.call(freshDefaults, key)) {
                    mergedBaseValues[key] = savedBaseValues[key];
                }
            });
        }

        const validPatches = (savedPatches || []).filter(patch => 
            Object.prototype.hasOwnProperty.call(freshDefaults, patch.target)
        );

        return {
            baseValues: mergedBaseValues,
            patches: validPatches,
            modulationLoadNonce: state.modulationLoadNonce + 1
        };
    }),

    // =========================================
    // 3. AUDIO SYSTEM
    // =========================================
    isAudioActive: false,
    audioSettings: DEFAULT_AUDIO_SETTINGS,
    analyzerData: { level: 0, frequencyBands: { bass: 0, mid: 0, treble: 0 } },
    setIsAudioActive: (input) => set((state) => ({ isAudioActive: typeof input === 'function' ? input(state.isAudioActive) : input })),
    setAudioSettings: (settingsOrFn) => set((state) => ({ audioSettings: typeof settingsOrFn === 'function' ? settingsOrFn(state.audioSettings) : settingsOrFn })),
    updateAnalyzerData: (data) => set({ analyzerData: data }),

    // =========================================
    // 4. SEQUENCER
    // =========================================
    sequencerState: { active: false, intervalMs: DEFAULT_SEQUENCER_INTERVAL, nextIndex: 0 },
    setSequencerActive: (isActive) => set((state) => ({ sequencerState: { ...state.sequencerState, active: isActive } })),
    setSequencerInterval: (ms) => set((state) => ({ sequencerState: { ...state.sequencerState, intervalMs: Math.max(100, ms) } })),
    setSequencerNextIndex: (index) => set((state) => ({ sequencerState: { ...state.sequencerState, nextIndex: index } })),

    // =========================================
    // 5. MIDI SYSTEM
    // =========================================
    isConnected: false,
    isConnecting: false,
    midiError: null,
    midiInputs: [],
    midiLearning: null, 
    learningLayer: null, 
    selectedChannel: 0,
    showMidiMonitor: false,
    midiMonitorData: [],
    pendingActions: [], 

    connectMIDI: async () => {
      if (get().isConnecting) return;
      set({ isConnecting: true, midiError: null });
      try {
        await midiManager.connect();
        set({ isConnected: true, isConnecting: false });
      } catch (err) {
        set({ isConnected: false, isConnecting: false, midiError: err.message });
      }
    },

    disconnectMIDI: () => {
      midiManager.disconnect();
      set({ isConnected: false, midiInputs: [] });
    },

    setMidiInputs: (inputs) => set({ midiInputs: inputs }),
    setMidiLearning: (val) => set({ midiLearning: val }),
    setLearningLayer: (val) => set({ learningLayer: val }),
    setSelectedChannel: (ch) => set({ selectedChannel: ch }),
    setShowMidiMonitor: (val) => set({ showMidiMonitor: val }),
    addMidiMonitorData: (entry) => set((state) => {
        const updated = [entry, ...state.midiMonitorData];
        return { midiMonitorData: updated.length > 50 ? updated.slice(0, 50) : updated };
    }),
    clearMidiMonitorData: () => set({ midiMonitorData: [] }),
    queueMidiAction: (action) => set((state) => ({ pendingActions: [...state.pendingActions, action] })),
    clearPendingActions: () => set({ pendingActions: [] }),

    lfoSettings: {
        'lfo_1': { frequency: 0.2, type: 'sine' },
        'lfo_2': { frequency: 1.0, type: 'sine' },
        'lfo_3': { frequency: 4.0, type: 'pulse' },
    },
    setLfoSetting: (lfoId, param, value) => set((state) => ({
        lfoSettings: { ...state.lfoSettings, [lfoId]: { ...state.lfoSettings[lfoId], [param]: value } }
    })),
  }))
);