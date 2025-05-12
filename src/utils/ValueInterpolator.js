// src/utils/ValueInterpolator.js

/** Simple linear interpolation function. */
const lerp = (start, end, t) => start * (1 - t) + end * t;

/**
 * Provides smooth interpolation between numerical values over a specified duration.
 * Useful for animating properties like position or angle towards a target value
 * instead of instantly snapping to it.
 */
class ValueInterpolator {
    currentValue;
    targetValue;
    startValue;
    duration;
    startTime = 0;
    isInterpolating = false;
    epsilon; // For floating point comparisons

    /**
     * Creates a new ValueInterpolator instance.
     * @param {number} initialValue - The starting value.
     * @param {number} [duration=150] - The duration of the interpolation in milliseconds.
     * @param {number} [epsilon=1e-5] - A small value for float comparison tolerance.
     */
    constructor(initialValue, duration = 150, epsilon = 1e-5) {
        this.currentValue = initialValue;
        this.targetValue = initialValue;
        this.startValue = initialValue;
        this.duration = Math.max(0, duration); // Ensure duration is not negative
        this.epsilon = epsilon;
    }

    /**
     * Starts or updates the interpolation towards a new target value.
     * @param {number} newTargetValue - The target value to interpolate towards.
     */
    setTarget(newTargetValue) {
        // Check if newTargetValue is a valid number
        if (typeof newTargetValue !== 'number' || isNaN(newTargetValue)) {
            if (import.meta.env.DEV) {
                console.warn(`ValueInterpolator: Invalid newTargetValue (${newTargetValue}). Snapping to current value or default.`);
            }
            this.snap(typeof this.currentValue === 'number' && !isNaN(this.currentValue) ? this.currentValue : 0);
            return;
        }

        // If not currently interpolating and already at the new target, just snap and return.
        if (!this.isInterpolating && Math.abs(this.currentValue - newTargetValue) < this.epsilon) {
            if (this.currentValue !== newTargetValue) { // Only snap if not exactly identical, to ensure exactness
                 this.snap(newTargetValue);
            }
            return;
        }

        // If already interpolating towards this exact (or very close) target, let it continue.
        if (this.isInterpolating && Math.abs(this.targetValue - newTargetValue) < this.epsilon) {
            return;
        }

        // If current value is already effectively the new target, but we weren't interpolating (or target changed slightly but within epsilon)
        // snap to ensure exactness and potentially stop an old interpolation if target changed.
        if (Math.abs(this.currentValue - newTargetValue) < this.epsilon) {
            this.snap(newTargetValue); // Snap ensures isInterpolating is false.
            return; // No new interpolation needed if already at the target.
        }
        
        // Otherwise, start a new interpolation
        this.startValue = this.currentValue; 
        this.targetValue = newTargetValue;
        this.startTime = performance.now(); 
        this.isInterpolating = true;
    }

    /**
     * Immediately sets the current and target value, stopping any ongoing interpolation.
     * @param {number} newValue - The value to snap to.
     */
    snap(newValue) {
        if (typeof newValue !== 'number' || isNaN(newValue)) {
            if (import.meta.env.DEV) {
                console.warn(`ValueInterpolator: Invalid snap value (${newValue}). Current value or 0 will be used.`);
            }
            const fallbackValue = (typeof this.currentValue === 'number' && !isNaN(this.currentValue)) ? this.currentValue : 0;
            if (this.isInterpolating || this.currentValue !== fallbackValue || this.targetValue !== fallbackValue) {
                this.currentValue = fallbackValue;
                this.targetValue = fallbackValue;
                this.startValue = fallbackValue;
                this.isInterpolating = false;
            }
            return;
        }

        // If not currently interpolating and already at the snap value, do nothing.
        if (!this.isInterpolating && Math.abs(this.currentValue - newValue) < this.epsilon && this.currentValue === this.targetValue) {
            // If already at the value and target is also this value, no need to re-snap.
            // This helps prevent redundant state updates if snap is called multiple times with the same value.
            if (this.currentValue !== newValue) { // Ensure exactness if within epsilon but not identical
                this.currentValue = newValue;
                this.targetValue = newValue; // Also ensure target is aligned
                this.startValue = newValue;  // And start value
            }
            return;
        }
        
        // If we are here, it means either we are interpolating, or the value has changed significantly,
        // or we need to force an exact snap.
        this.currentValue = newValue;
        this.targetValue = newValue;
        this.startValue = newValue;
        this.isInterpolating = false;
    }

    /**
     * Updates the internal `currentValue` based on the elapsed time since interpolation started.
     * @param {number} currentTime - The current timestamp (e.g., from `performance.now()`).
     * @returns {number} The updated `currentValue`.
     */
    update(currentTime) {
        if (!this.isInterpolating) {
            return this.currentValue; 
        }

        const elapsed = currentTime - this.startTime;
        let progress = this.duration > 0 ? Math.min(1, Math.max(0, elapsed / this.duration)) : 1;

        const easedProgress = progress; // Linear for now

        this.currentValue = lerp(this.startValue, this.targetValue, easedProgress);

        if (progress >= 1) {
            this.currentValue = this.targetValue; 
            this.isInterpolating = false;
        }
        return this.currentValue;
    }

    /**
     * Gets the current interpolated value without performing an update.
     * @returns {number} The current value.
     */
    getCurrentValue() {
        return this.currentValue;
    }

    /**
     * Checks if the value is currently undergoing interpolation.
     * @returns {boolean} True if interpolating, false otherwise.
     */
    isCurrentlyInterpolating() {
        return this.isInterpolating;
    }
}

export default ValueInterpolator;