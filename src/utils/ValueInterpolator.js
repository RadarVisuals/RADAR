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
            // console.warn(`ValueInterpolator: Invalid newTargetValue (${newTargetValue}). Snapping to current value or default.`);
            // Snap to current or a sensible default if initialValue was also invalid.
            this.snap(this.currentValue || 0);
            return;
        }

        const targetIsEffectivelySameAsCurrentTarget = Math.abs(this.targetValue - newTargetValue) < this.epsilon;
        const currentValueIsEffectivelyAtNewTarget = Math.abs(this.currentValue - newTargetValue) < this.epsilon;

        if (this.isInterpolating) { // Currently moving/interpolating
            if (targetIsEffectivelySameAsCurrentTarget) {
                // Already interpolating to this same target (or very close). Let it continue.
                return;
            }
            // If target has changed significantly, fall through to restart interpolation.
        } else { // Not currently interpolating
            if (currentValueIsEffectivelyAtNewTarget) {
                // Not interpolating, and current value is already at (or very close to) the new target.
                // Snap values to ensure exactness and don't start a new interpolation.
                this.currentValue = newTargetValue;
                this.targetValue = newTargetValue;
                this.startValue = newTargetValue;
                // isInterpolating remains false.
                return;
            }
            // Not interpolating, and current value is not at the new target. Must start. Fall through.
        }

        this.startValue = this.currentValue; // Always start from the current visually perceived value.
        this.targetValue = newTargetValue;
        this.startTime = performance.now(); // Record start time for duration calculation.
        this.isInterpolating = true;
    }

    /**
     * Immediately sets the current and target value, stopping any ongoing interpolation.
     * @param {number} newValue - The value to snap to.
     */
    snap(newValue) {
        // Check if newValue is a valid number
        if (typeof newValue !== 'number' || isNaN(newValue)) {
            // console.warn(`ValueInterpolator: Invalid snap value (${newValue}). Current value or 0 will be used.`);
             // Fallback to current value, or 0 if current value is also problematic
            this.currentValue = (typeof this.currentValue === 'number' && !isNaN(this.currentValue)) ? this.currentValue : 0;
            this.targetValue = this.currentValue;
            this.startValue = this.currentValue;
            this.isInterpolating = false;
            return;
        }
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
            return this.currentValue; // No update needed if not interpolating.
        }

        const elapsed = currentTime - this.startTime;
        // Calculate progress, ensuring it stays within [0, 1].
        // If duration is 0 or less, progress becomes 1, effectively snapping.
        let progress = this.duration > 0 ? Math.min(1, Math.max(0, elapsed / this.duration)) : 1;

        // Apply easing (currently linear). Future: Could add easing functions here.
        const easedProgress = progress;

        // Calculate the interpolated value.
        this.currentValue = lerp(this.startValue, this.targetValue, easedProgress);

        // Check if interpolation is complete.
        if (progress >= 1) {
            this.currentValue = this.targetValue; // Ensure it ends exactly at the target.
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