// src/utils/LogicController.js
import { ModulationEngine } from './ModulationEngine';
import { LFO } from './LFO';
import { EventSignalGenerator } from './EventSignalGenerator';
import SignalBus from './SignalBus';

export class LogicController {
    constructor() {
        this.modulationEngine = new ModulationEngine();
        this.lfo = new LFO();
        this.eventSignalGenerator = new EventSignalGenerator();

        // Zero-allocation signal container (reused every frame)
        this._signals = {
            'audio.bass': 0, 'audio.mid': 0, 'audio.treble': 0, 'audio.level': 0,
            'lfo.slow.sine': 0, 'lfo.mid.sine': 0, 'lfo.fast.sine': 0,
            'lfo.slow.saw': 0, 'lfo.fast.saw': 0,
            'lfo.pulse': 0, 'lfo.chaos': 0,
            'event.any': 0
        };
    }

    /**
     * Updates all logic systems and computes the final parameter values for this frame.
     * @param {number} deltaTime - Time scaling factor from Pixi ticker.
     * @param {Object} audioData - Latest analysis data from AudioReactor.
     * @returns {Object} The computed parameters map.
     */
    update(deltaTime, audioData) {
        // 1. Update LFOs
        const lfoData = this.lfo.update();
        for (const key in lfoData) {
            this._signals[key] = lfoData[key];
        }

        // 2. Map Audio Data to Signals
        this._signals['audio.bass'] = audioData.frequencyBands.bass;
        this._signals['audio.mid'] = audioData.frequencyBands.mid;
        this._signals['audio.treble'] = audioData.frequencyBands.treble;
        this._signals['audio.level'] = audioData.level;

        // 3. Update Event Signals (Decay)
        // Convert Pixi Ticker deltaTime (frame based) to seconds for the decay logic
        // 1.0 deltaTime ≈ 16.6ms => 0.01666 seconds
        const dtSeconds = deltaTime * 0.01666;
        const eventSignals = this.eventSignalGenerator.update(dtSeconds);
        for (const key in eventSignals) {
            this._signals[key] = eventSignals[key];
        }

        // 4. Emit Raw Signals for Debugger (Dev Mode Only)
        if (import.meta.env.DEV) {
            SignalBus.emit('signals:update', this._signals);
        }

        // 5. Compute Final Parameters via Matrix
        const finalParams = this.modulationEngine.compute(this._signals);
        
        // 6. Emit computed params for UI sliders (e.g., PerformanceSlider)
        SignalBus.emit('modulation:update', finalParams);

        return finalParams;
    }

    triggerEvent(eventType) {
        this.eventSignalGenerator.trigger(eventType);
    }

    // --- Proxy Methods for Context ---
    
    setBaseValue(paramId, value) {
        this.modulationEngine.setBaseValue(paramId, value);
    }

    addPatch(source, target, amount) {
        this.modulationEngine.addPatch(source, target, amount);
    }

    removePatch(patchId) {
        this.modulationEngine.removePatch(patchId);
    }

    clearPatches() {
        this.modulationEngine.clearAllPatches();
    }

    resetDefaults() {
        this.modulationEngine.resetToDefaults();
    }

    setLfoConfig(lfoId, param, value) {
        this.lfo.setConfig(lfoId, param, value);
    }
}