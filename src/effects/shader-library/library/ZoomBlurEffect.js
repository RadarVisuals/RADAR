import { ZoomBlurFilter } from 'pixi-filters';
import { AbstractShaderEffect } from '../AbstractShaderEffect';

export default class ZoomBlurEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new ZoomBlurFilter({
            strength: 0.1,
            innerRadius: 50,
            resolution: resolution
        });
        return this.filter;
    }

    setParam(key, value) {
        if (key === 'strength') {
            this.filter.strength = value;
            this.active = value > 0.01;
            this.filter.enabled = this.active;
        } else if (key === 'innerRadius') {
            this.filter.innerRadius = value;
        }
    }

    setCenter(x, y) {
        if (this.filter) {
            this.filter.center = { x, y };
        }
    }

    static get manifest() {
        return {
            label: 'Warp Drive (Zoom)',
            category: 'Distortion', // <-- Categorized
            params: {
                strength:    { id: 'zoomBlur.strength',    label: 'Strength',  type: 'float', min: 0, max: 0.5, default: 0.0, hardMin: 0, hardMax: 2.0 },
                innerRadius: { id: 'zoomBlur.innerRadius', label: 'Safe Zone', type: 'float', min: 0, max: 200, default: 50, hardMin: 0, hardMax: 1000 },
            }
        };
    }
}