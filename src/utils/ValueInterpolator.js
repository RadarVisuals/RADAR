// src/utils/ValueInterpolator.js
const lerp = (start, end, t) => start * (1 - t) + end * t;

class ValueInterpolator {
    currentValue = 0;
    startValue = 0;
    targetValue = 0;
    duration = 300; // ms
    startTime = 0;
    isInterpolating = false;

    constructor(initialValue, duration = 300) {
        this.currentValue = initialValue;
        this.startValue = initialValue;
        this.targetValue = initialValue;
        this.duration = duration;
        this.isInterpolating = false;
    }

    setTarget(newTargetValue) {
        // Epsilon check to prevent re-triggering for tiny jitter
        if (Math.abs(newTargetValue - this.targetValue) < 0.0001) return;

        this.startTime = performance.now();
        this.startValue = this.currentValue;
        this.targetValue = newTargetValue;
        this.isInterpolating = true;
    }

    update(currentTime) {
        if (!this.isInterpolating) return;

        const elapsed = currentTime - this.startTime;
        let progress = this.duration > 0 ? elapsed / this.duration : 1;

        if (progress >= 1) {
            progress = 1;
            this.isInterpolating = false;
            this.currentValue = this.targetValue;
        } else {
            this.currentValue = lerp(this.startValue, this.targetValue, progress);
        }
    }

    /**
     * Absolute snap: used during scene loads and initialization.
     * Kills any active interpolation instantly to prevent "fighting" the store.
     */
    snap(newValue) {
        this.isInterpolating = false;
        this.currentValue = newValue;
        this.targetValue = newValue;
        this.startValue = newValue;
        this.startTime = 0;
    }

    getCurrentValue() {
        return this.currentValue;
    }

    isCurrentlyInterpolating() {
        return this.isInterpolating;
    }
}

export default ValueInterpolator;