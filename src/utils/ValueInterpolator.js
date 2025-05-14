// src/utils/ValueInterpolator.js

/**
 * Performs linear interpolation between two values.
 * @param {number} start - The starting value.
 * @param {number} end - The ending value.
 * @param {number} t - The interpolation factor (0.0 to 1.0).
 * @returns {number} The interpolated value.
 */
const lerp = (start, end, t) => start * (1 - t) + end * t;

/**
 * Provides smooth linear interpolation between numerical values over a specified duration.
 * Useful for animating properties like position or angle towards a target value
 * instead of instantly snapping to it.
 */
class ValueInterpolator {
    /** @type {number} The current, possibly interpolated, value. */
    currentValue;
    /** @type {number} The target value towards which interpolation is occurring. */
    targetValue;
    /** @type {number} The value at the start of the current interpolation. */
    startValue;
    /** @type {number} The duration of the interpolation in milliseconds. */
    duration;
    /** @type {number} The timestamp (from `performance.now()`) when the current interpolation started. */
    startTime = 0;
    /** @type {boolean} Flag indicating if an interpolation is currently in progress. */
    isInterpolating = false;
    /** @type {number} A small tolerance value for floating-point comparisons to determine if values are "close enough". */
    epsilon;

    /**
     * Creates a new ValueInterpolator instance.
     * @param {number} initialValue - The starting value.
     * @param {number} [duration=150] - The duration of the interpolation in milliseconds. Must be non-negative.
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
     * If the new target is very close to the current value and no interpolation is active,
     * it will snap to the target. If already interpolating towards a very similar target,
     * the current interpolation continues.
     * @param {number} newTargetValue - The target value to interpolate towards.
     */
    setTarget(newTargetValue) {
        if (typeof newTargetValue !== 'number' || isNaN(newTargetValue)) {
            if (import.meta.env.DEV) {
                console.warn(`[ValueInterpolator] Invalid newTargetValue (${newTargetValue}). Snapping to current value or 0.`);
            }
            // Snap to current valid value or 0 if current is also invalid
            this.snap(typeof this.currentValue === 'number' && !isNaN(this.currentValue) ? this.currentValue : 0);
            return;
        }

        // If not currently interpolating and already effectively at the new target, snap for exactness and exit.
        if (!this.isInterpolating && Math.abs(this.currentValue - newTargetValue) < this.epsilon) {
            if (this.currentValue !== newTargetValue) { // Ensure exactness if within epsilon but not identical
                 this.snap(newTargetValue);
            }
            return;
        }

        // If already interpolating towards this exact (or very close) target, let it continue.
        // This prevents restarting the interpolation unnecessarily if setTarget is called multiple times with the same target.
        if (this.isInterpolating && Math.abs(this.targetValue - newTargetValue) < this.epsilon) {
            return;
        }

        // If current value is already effectively the new target (e.g., after a previous snap or completed interpolation),
        // but a new, slightly different target is set (or we weren't interpolating), snap to ensure exactness.
        if (Math.abs(this.currentValue - newTargetValue) < this.epsilon) {
            this.snap(newTargetValue); // Snap ensures isInterpolating is false and values are exact.
            return; // No new interpolation needed if already at the target.
        }

        // Start a new interpolation
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
                console.warn(`[ValueInterpolator] Invalid snap value (${newValue}). Current value or 0 will be used.`);
            }
            const fallbackValue = (typeof this.currentValue === 'number' && !isNaN(this.currentValue)) ? this.currentValue : 0;
            // Only update if necessary to avoid redundant operations
            if (this.isInterpolating || this.currentValue !== fallbackValue || this.targetValue !== fallbackValue) {
                this.currentValue = fallbackValue;
                this.targetValue = fallbackValue;
                this.startValue = fallbackValue; // Align startValue as well
                this.isInterpolating = false;
            }
            return;
        }

        // If not interpolating and already at the exact snap value (and target is aligned), do nothing.
        if (!this.isInterpolating && this.currentValue === newValue && this.targetValue === newValue) {
            return;
        }

        // Snap values and stop interpolation.
        this.currentValue = newValue;
        this.targetValue = newValue;
        this.startValue = newValue; // Align startValue for consistency
        this.isInterpolating = false;
    }

    /**
     * Updates the internal `currentValue` based on the elapsed time since interpolation started.
     * If interpolation is not active, it returns the current value without changes.
     * @param {number} currentTime - The current timestamp (e.g., from `performance.now()`).
     * @returns {number} The updated `currentValue`.
     */
    update(currentTime) {
        if (!this.isInterpolating) {
            return this.currentValue;
        }

        const elapsed = currentTime - this.startTime;
        // Calculate progress, ensuring it's between 0 and 1.
        // If duration is 0, progress is immediately 1 (snap to target).
        let progress = this.duration > 0 ? Math.min(1, Math.max(0, elapsed / this.duration)) : 1;

        // Easing function can be applied here if desired (e.g., ease-out, ease-in-out)
        // For now, using linear progress.
        const easedProgress = progress;

        this.currentValue = lerp(this.startValue, this.targetValue, easedProgress);

        // If interpolation is complete
        if (progress >= 1) {
            this.currentValue = this.targetValue; // Ensure exact target value is set
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