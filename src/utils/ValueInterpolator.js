// src/utils/ValueInterpolator.js

/**
 * ValueInterpolator: Professional Slew-Rate Limiter
 * 
 * Bridging the gap between 7-bit MIDI (128 steps) and high-def rendering.
 * Uses exponential decay to provide a "liquid" feel while maintaining 
 * high-speed responsiveness.
 */
class ValueInterpolator {
    constructor(initialValue, smoothing = 0.2) {
        this.currentValue = initialValue;
        this.targetValue = initialValue;
        this.smoothing = smoothing;
        this.isInterpolating = false;
        
        // Epsilon: 0.001 is the "Sweet Spot" for precision vs performance
        this.epsilon = 0.001; 
    }

    setTarget(val) {
        // Prevent unnecessary processing for micro-changes
        if (Math.abs(val - this.targetValue) < 0.000001) return;
        this.targetValue = val;
        this.isInterpolating = true;
    }

    snap(val) {
        this.currentValue = val;
        this.targetValue = val;
        this.isInterpolating = false;
    }

    /**
     * Frame-rate independent update
     * deltaTime usually fluctuates between 0.9 and 1.1 at 60fps
     */
    update(deltaTime = 1) {
        if (!this.isInterpolating) return;

        const diff = this.targetValue - this.currentValue;

        // Termination condition
        if (Math.abs(diff) < this.epsilon) {
            this.currentValue = this.targetValue;
            this.isInterpolating = false;
            return;
        }

        /**
         * WEIGHTED SPEED CALCULATION
         * This formula ensures the slider moves 
         * faster when the gap is large, and slows down 
         * perfectly as it approaches the target.
         */
        const lerpFactor = 1 - Math.pow(1 - this.smoothing, deltaTime);
        this.currentValue += diff * lerpFactor;
    }

    getCurrentValue() {
        return this.currentValue;
    }
}

export default ValueInterpolator;