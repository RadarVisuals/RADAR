// src/utils/LFO.js

export class LFO {
    constructor() {
        this.startTime = Date.now();
        
        // Define 3 mutable LFO states with defaults
        this.configs = {
            'lfo_1': { frequency: 0.2, type: 'sine' }, // Slow
            'lfo_2': { frequency: 1.0, type: 'sine' }, // Mid
            'lfo_3': { frequency: 4.0, type: 'pulse' } // Fast
        };
    }

    /**
     * Update configuration for a specific LFO
     * @param {string} id - 'lfo_1', 'lfo_2', or 'lfo_3'
     * @param {string} param - 'frequency' or 'type'
     * @param {any} value 
     */
    setConfig(id, param, value) {
        if (this.configs[id]) {
            this.configs[id][param] = value;
        }
    }

    getWaveValue(type, t) {
        // t is expected to be a continuous time value scaled by frequency
        switch (type) {
            case 'sine': 
                return Math.sin(t * Math.PI * 2);
            case 'saw':  
                // Ramp from -1 to 1
                return (t % 1) * 2 - 1; 
            case 'pulse': 
                // Square wave: -1 or 1
                return Math.sin(t * Math.PI * 2) > 0 ? 1 : -1; 
            case 'tri':  
                // Triangle wave: Linear ramp up and down between -1 and 1
                return Math.abs((t % 1) * 2 - 1) * 2 - 1; 
            case 'chaos': 
                // Random noise
                return Math.random() * 2 - 1; 
            default: 
                return Math.sin(t * Math.PI * 2);
        }
    }

    /**
     * Generates normalized waveforms based on current time.
     * @returns {Object} { 'lfo_1': val, 'lfo_2': val, 'lfo_3': val, 'lfo.chaos': val }
     */
    update() {
        const now = (Date.now() - this.startTime) / 1000; // Time in seconds
        
        const signals = {};

        for (const [id, config] of Object.entries(this.configs)) {
            // t = total elapsed "cycles" based on frequency
            // Note: Changing frequency simply scales time here. 
            // For a perfectly smooth frequency ramp, we'd need to integrate phase (dt * freq),
            // but this is sufficient for a visualizer.
            const t = now * config.frequency;
            signals[id] = this.getWaveValue(config.type, t);
        }

        // Keep chaos separate as a raw noise source
        signals['lfo.chaos'] = Math.random();

        return signals;
    }
}