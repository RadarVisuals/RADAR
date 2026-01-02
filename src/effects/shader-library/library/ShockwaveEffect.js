import { ShockwaveFilter } from 'pixi-filters';
import { AbstractShaderEffect } from '../AbstractShaderEffect';

// This effect is typically "Hidden" from the UI and triggered via OneShot events.
// However, we include it here so the Manager can instantiate it cleanly.
export default class ShockwaveEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new ShockwaveFilter({
            center: { x: 0, y: 0 },
            speed: 500,
            amplitude: 30,
            wavelength: 160,
            radius: -1
        });
        return this.filter;
    }

    // Shockwave is usually driven by OneShot logic in the manager, not UI params.
    // But we implement basic setters just in case.
    setParam(key, value) {
        if (key in this.filter) {
            this.filter[key] = value;
        }
    }

    static get manifest() {
        return {
            label: 'Shockwave (Hidden)',
            params: {} // No UI params exposed by default
        };
    }
}