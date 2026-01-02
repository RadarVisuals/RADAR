import { RGBSplitFilter } from 'pixi-filters';
import { AbstractShaderEffect } from '../AbstractShaderEffect';

export default class RGBEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new RGBSplitFilter({
            red: {x:0, y:0},
            green: {x:0, y:0},
            blue: {x:0, y:0},
            resolution: resolution
        });
        return this.filter;
    }

    setParam(key, value) {
        if (key === 'amount') {
            this.filter.red = { x: -value, y: -value };
            this.filter.blue = { x: value, y: value };
            
            this.active = Math.abs(value) > 0.1;
            this.filter.enabled = this.active;
        }
    }

    static get manifest() {
        return {
            label: 'RGB Split (Chromatic)',
            category: 'Light & Color', // <-- Categorized
            params: {
                amount: { id: 'rgb.amount', label: 'Offset', type: 'float', min: 0, max: 50.0, default: 0.0, hardMin: -100, hardMax: 100 },
            }
        };
    }
}