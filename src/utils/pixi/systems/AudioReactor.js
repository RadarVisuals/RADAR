// src/utils/pixi/systems/AudioReactor.js
import SignalBus from '../../SignalBus';
import { useEngineStore } from '../../../store/useEngineStore';

export class AudioReactor {
    constructor() {
        this.audioFrequencyFactors = { '1': 1.0, '2': 1.0, '3': 1.0 };
        this.beatPulseFactor = 1.0;
        this.beatPulseEndTime = 0;
        this.latestAudioData = { level: 0, frequencyBands: { bass: 0, mid: 0, treble: 0 } };
        
        this._unsubscribers = [];
        this.init();
    }

    init() {
        // Subscribe to the unified audio analysis signal (works for local mic OR synced data)
        this._unsubscribers.push(
            SignalBus.on('audio:analysis', (data) => {
                this.latestAudioData = data;
                this._applyReactionLogic(data);
            })
        );
    }

    /**
     * INTERNAL REACTION LOGIC
     * This was previously in AudioAnalyzer.jsx. 
     * Moving it here ensures the Projector tab reacts to synced audio data.
     */
    _applyReactionLogic(data) {
        const settings = useEngineStore.getState().audioSettings;
        const { bass, mid, treble } = data.frequencyBands;
        const level = data.level;

        const { bassIntensity = 1.0, midIntensity = 1.0, trebleIntensity = 1.0 } = settings;

        // Calculate factors using your original formulas
        const bassFactor = 1 + (bass * 0.8 * bassIntensity);
        const midFactor = 1 + (mid * 1.0 * midIntensity);
        const trebleFactor = 1 + (treble * 2.0 * trebleIntensity);

        // Update internal state
        this.audioFrequencyFactors['1'] = Math.max(0.1, bassFactor);
        this.audioFrequencyFactors['2'] = Math.max(0.1, midFactor);
        this.audioFrequencyFactors['3'] = Math.max(0.1, trebleFactor);

        // Handle Beat Pulse logic
        if (level > 0.4 && bass > 0.6) {
            const pulseMultiplier = 1 + level * 0.8;
            this.triggerBeatPulse(Math.max(0.1, pulseMultiplier), 80);
        }
    }

    setAudioFactors(factors) {
        this.audioFrequencyFactors = { ...this.audioFrequencyFactors, ...factors };
    }

    triggerBeatPulse(factor, duration) {
        this.beatPulseFactor = factor;
        this.beatPulseEndTime = performance.now() + duration;
    }

    getCombinedBeatFactor(layerId) {
        const now = performance.now();
        const currentBeatFactor = this.beatPulseEndTime > now ? this.beatPulseFactor : 1.0;
        const audioScale = this.audioFrequencyFactors[layerId] || 1.0;
        return currentBeatFactor * audioScale;
    }

    getAudioData() {
        return this.latestAudioData;
    }

    destroy() {
        this._unsubscribers.forEach(unsub => unsub());
        this._unsubscribers = [];
    }
}