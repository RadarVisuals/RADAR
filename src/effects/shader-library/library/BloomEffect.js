import { AdvancedBloomFilter } from 'pixi-filters';
import { AbstractShaderEffect } from '../AbstractShaderEffect';

export default class BloomEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new AdvancedBloomFilter({
            threshold: 0.5,
            bloomScale: 1.0,
            brightness: 1.0,
            blur: 8,
            quality: 5,
            resolution: resolution
        });
        return this.filter;
    }

    setParam(key, value) {
        switch(key) {
            case 'intensity':
                this.filter.bloomScale = value;
                this.active = value > 0.1;
                this.filter.enabled = this.active;
                break;
            case 'threshold':
                this.filter.threshold = value;
                break;
            case 'blur':
                this.filter.blur = value;
                break;
        }
    }

    static get manifest() {
        return {
            label: 'Bloom (Glow)',
            category: 'Light & Color', // <-- Categorized
            params: {
                intensity: { id: 'bloom.intensity', label: 'Intensity', type: 'float', min: 0, max: 5.0, default: 0.0, hardMin: 0, hardMax: 10.0 },
                threshold: { id: 'bloom.threshold', label: 'Threshold', type: 'float', min: 0, max: 1.0, default: 0.5, hardMin: 0, hardMax: 1.0 },
                blur:      { id: 'bloom.blur',      label: 'Blur',      type: 'float', min: 0, max: 20.0, default: 8.0, hardMin: 0, hardMax: 40.0 },
            }
        };
    }
}