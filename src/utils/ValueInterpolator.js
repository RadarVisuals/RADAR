// src/utils/ValueInterpolator.js
const lerp = (start, end, t) => start * (1 - t) + end * t;

class ValueInterpolator {
    currentValue = 0;
    startValue = 0;
    targetValue = 0;
    duration = 100; // ms
    startTime = 0;
    isInterpolating = false;

    constructor(initialValue, duration) {
        this.currentValue = initialValue;
        this.startValue = initialValue;
        this.targetValue = initialValue;
        this.duration = duration;
        this.isInterpolating = false;
    }

    setTarget(newTargetValue) {
        if (newTargetValue === this.targetValue) return;

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

    snap(newValue) {
        this.isInterpolating = false;
        this.currentValue = newValue;
        this.targetValue = newValue;
        this.startValue = newValue;
    }

    getCurrentValue() {
        return this.currentValue;
    }

    isCurrentlyInterpolating() {
        return this.isInterpolating;
    }
}

export default ValueInterpolator;