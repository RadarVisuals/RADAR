import { PixelateFilter } from 'pixi-filters';
import { AbstractShaderEffect } from '../AbstractShaderEffect';

export default class PixelateEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new PixelateFilter(1);
        this.filter.resolution = resolution;
        return this.filter;
    }

    setParam(key, value) {
        if (key === 'enabled') {
            this.active = value > 0.5;
            this.filter.enabled = this.active;
        } else if (key === 'size') {
            this.filter.size = Math.max(1, value);
        }
    }

    static get manifest() {
        return {
            label: 'Pixelate (Bitcrush)',
            category: 'Distortion', // <-- Categorized
            params: {
                enabled: { id: 'pixelate.enabled', label: 'Active', type: 'bool', min: 0, max: 1, default: 0 },
                size:    { id: 'pixelate.size',    label: 'Block Size', type: 'int', min: 2, max: 100, default: 10, hardMin: 1, hardMax: 500 },
            }
        };
    }
}