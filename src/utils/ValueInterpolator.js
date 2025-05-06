/** Simple linear interpolation function. */
const lerp = (start, end, t) => start * (1 - t) + end * t;

/**
 * Provides smooth interpolation between numerical values over a specified duration.
 * Useful for animating properties like position or angle towards a target value
 * instead of instantly snapping to it. Uses linear interpolation by default.
 */
class ValueInterpolator {
    currentValue;
    targetValue;
    startValue;
    duration;
    startTime = 0;
    isInterpolating = false;

    /**
     * Creates a new ValueInterpolator instance.
     * @param {number} initialValue - The starting value.
     * @param {number} [duration=150] - The duration of the interpolation in milliseconds.
     */
    constructor(initialValue, duration = 150) {
        this.currentValue = initialValue;
        this.targetValue = initialValue;
        this.startValue = initialValue;
        this.duration = duration;
    }

    /**
     * Starts or updates the interpolation towards a new target value.
     * If already interpolating to the same target, does nothing.
     * @param {number} newTargetValue - The target value to interpolate towards.
     */
    setTarget(newTargetValue) {
        // Avoid restarting interpolation if the target is already set and active
        if (this.targetValue === newTargetValue && this.isInterpolating) {
            return;
        }
        this.startValue = this.currentValue; // Start from the current visually perceived value
        this.targetValue = newTargetValue;
        this.startTime = performance.now(); // Record start time for duration calculation
        this.isInterpolating = true;
    }

    /**
     * Immediately sets the current and target value, stopping any ongoing interpolation.
     * @param {number} newValue - The value to snap to.
     */
    snap(newValue) {
        this.currentValue = newValue;
        this.targetValue = newValue;
        this.startValue = newValue;
        this.isInterpolating = false;
    }

    /**
     * Updates the internal `currentValue` based on the elapsed time since interpolation started.
     * Should be called on each frame (e.g., within `requestAnimationFrame`).
     * Stops interpolating automatically when the duration is reached.
     * @param {number} currentTime - The current timestamp (e.g., from `performance.now()`).
     * @returns {number} The updated `currentValue`.
     */
    update(currentTime) {
        if (!this.isInterpolating) {
            return this.currentValue; // No update needed if not interpolating
        }

        const elapsed = currentTime - this.startTime;
        // Calculate progress, ensuring it stays within [0, 1]
        let progress = this.duration > 0 ? Math.min(1, Math.max(0, elapsed / this.duration)) : 1;

        // Apply easing (currently linear)
        const easedProgress = progress; // Placeholder for potential easing functions

        // Calculate the interpolated value
        this.currentValue = lerp(this.startValue, this.targetValue, easedProgress);

        // Check if interpolation is complete
        if (progress >= 1) {
            this.currentValue = this.targetValue; // Ensure it ends exactly at the target
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