// src/utils/LFO.js

export class LFO {
    constructor() {
        this.startTime = Date.now();
    }

    /**
     * Generates normalized waveforms based on current time.
     * @returns {Object} { 'lfo.sine': -1..1, 'lfo.saw': 0..1, ... }
     */
    update() {
        const now = (Date.now() - this.startTime) / 1000; // Time in seconds
        
        // We create a few different speeds/shapes
        // You can expand this list easily
        return {
            'lfo.slow.sine': Math.sin(now * 0.5),        // 0.5 Hz (-1 to 1)
            'lfo.mid.sine':  Math.sin(now * 2.0),        // 2.0 Hz (-1 to 1)
            'lfo.fast.sine': Math.sin(now * 8.0),        // 8.0 Hz (-1 to 1)
            
            'lfo.slow.saw':  (now * 0.5) % 1,            // 0 to 1 ramp
            'lfo.fast.saw':  (now * 2.0) % 1,            // 0 to 1 ramp
            
            'lfo.pulse':     Math.sin(now * 4.0) > 0 ? 1 : 0, // 0 or 1 square wave
            
            // Random Chaos (Smoothed noise would be better, but random works for glitch)
            'lfo.chaos':     Math.random()
        };
    }
}