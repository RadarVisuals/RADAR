import SignalBus from '../../SignalBus';

export class AudioReactor {
    constructor() {
        this.audioFrequencyFactors = { '1': 1.0, '2': 1.0, '3': 1.0 };
        this.beatPulseFactor = 1.0;
        this.beatPulseEndTime = 0;
        this.latestAudioData = { level: 0, frequencyBands: { bass: 0, mid: 0, treble: 0 } };
        
        this._unsubscribers = [];
        this.init();
    }

    init() {
        this._unsubscribers.push(
            SignalBus.on('audio:analysis', (data) => {
                this.latestAudioData = data;
            })
        );
    }

    setAudioFactors(factors) {
        this.audioFrequencyFactors = { ...this.audioFrequencyFactors, ...factors };
    }

    triggerBeatPulse(factor, duration) {
        this.beatPulseFactor = factor;
        this.beatPulseEndTime = performance.now() + duration;
    }

    getCombinedBeatFactor(layerId) {
        const now = performance.now();
        const currentBeatFactor = this.beatPulseEndTime > now ? this.beatPulseFactor : 1.0;
        const audioScale = this.audioFrequencyFactors[layerId] || 1.0;
        return currentBeatFactor * audioScale;
    }

    getAudioData() {
        return this.latestAudioData;
    }

    destroy() {
        this._unsubscribers.forEach(unsub => unsub());
        this._unsubscribers = [];
    }
}