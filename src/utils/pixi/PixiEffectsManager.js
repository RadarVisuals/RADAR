// src/utils/pixi/PixiEffectsManager.js
import { 
    AdvancedBloomFilter, 
    RGBSplitFilter, 
    PixelateFilter,
    ZoomBlurFilter,
    ShockwaveFilter, 
} from 'pixi-filters';
import { 
    VolumetricLightFilter, 
    LiquidFilter, 
    WaveDistortFilter, 
    KaleidoscopeFilter, 
    AdversarialGlitchFilter, 
    AsciiFilter 
} from './PixiFilters';
import { lerp } from '../helpers';

export class PixiEffectsManager {
    constructor() {
        this.filters = {
            bloom: null, rgb: null, pixelate: null,
            zoomBlur: null,
            kaleidoscope: null,
            volumetric: null, waveDistort: null, liquid: null,
            shockwave: null,
            adversarial: null,
            ascii: null,
            feedback: null 
        };

        this._activeOneShotEffects = [];
        this.screen = null;
        this.res = 1; // Default
        this.paramTransformers = {};
    }

    init(screen) {
        this.screen = screen;
        // FIX: Force Filter resolution to 1.0. 
        // Rendering Bloom or Chromatic Aberration at 3x resolution (Mac native) 
        // is the primary reason for the performance drop.
        this.res = 1.0; 

        this.paramTransformers = {
            'rgb.amount': (filter, val) => {
                filter.red = { x: -val, y: -val };
                filter.blue = { x: val, y: val };
                if (val > 0.1 && !filter.enabled) filter.enabled = true;
            },
            'pixelate.size': (filter, val) => {
                filter.size = Math.max(1, val);
            },
            'bloom.intensity': (filter, val) => { 
                filter.bloomScale = val; 
                if (val > 0.1 && !filter.enabled) filter.enabled = true;
            },
            'zoomBlur.strength': (filter, val) => {
                filter.strength = val;
                if (val > 0.01 && !filter.enabled) filter.enabled = true;
            },
            'kaleidoscope.sides': (filter, val) => {
                filter.sides = val;
                filter.enabled = val > 0;
            },
        };
    }

    ensureFilter(name) {
        if (this.filters[name]) return this.filters[name];

        const res = this.res;
        
        switch (name) {
            case 'bloom': this.filters.bloom = new AdvancedBloomFilter({ threshold: 0.5, bloomScale: 1.0, brightness: 1.0, blur: 8, quality: 5, resolution: res }); break;
            case 'rgb': this.filters.rgb = new RGBSplitFilter({ red: {x:0,y:0}, green: {x:0,y:0}, blue: {x:0,y:0}, resolution: res }); break;
            case 'pixelate': this.filters.pixelate = new PixelateFilter(1); this.filters.pixelate.resolution = res; break;
            case 'zoomBlur': this.filters.zoomBlur = new ZoomBlurFilter({ strength: 0.1, innerRadius: 50, resolution: res }); break;
            case 'kaleidoscope': this.filters.kaleidoscope = new KaleidoscopeFilter(); this.filters.kaleidoscope.resolution = res; break;
            case 'volumetric': this.filters.volumetric = new VolumetricLightFilter(); break;
            case 'waveDistort': this.filters.waveDistort = new WaveDistortFilter(); break;
            case 'liquid': this.filters.liquid = new LiquidFilter(); break;
            case 'adversarial': this.filters.adversarial = new AdversarialGlitchFilter(); break;
            case 'ascii': this.filters.ascii = new AsciiFilter(); break;
            case 'shockwave': this.filters.shockwave = new ShockwaveFilter({ center: { x: 0, y: 0 }, speed: 500, amplitude: 30, wavelength: 160, radius: -1 }); break;
        }

        if (this.filters[name]) {
            this.filters[name].enabled = false; 
        }

        return this.filters[name];
    }

    applyValues(values) {
        Object.entries(values).forEach(([fullId, value]) => {
            const [effectName, param] = fullId.split('.');
            this.updateConfig(effectName, param, value);
        });
    }

    updateConfig(effectName, param, value) {
        if (effectName === 'feedback') return;

        const filter = this.ensureFilter(effectName);
        if (!filter) return;

        if (param === 'enabled') {
            filter.enabled = value > 0.5;
            return;
        }

        const transformKey = `${effectName}.${param}`;
        if (this.paramTransformers[transformKey]) {
            this.paramTransformers[transformKey](filter, value);
            return;
        }

        if (param in filter) {
            filter[param] = value;
            if (effectName === 'liquid' && param === 'intensity') filter.enabled = value > 0.001;
            if (effectName === 'waveDistort' && param === 'intensity') filter.enabled = value > 0.001;
            if (effectName === 'volumetric' && param === 'exposure') filter.enabled = value > 0.01;
        }
    }

    getFilterList() {
        return Object.values(this.filters)
            .filter(f => f && f.enabled && f !== this.filters.feedback); 
    }

    update(ticker, renderer) {
        const now = performance.now();
        const filterDelta = ticker.deltaTime * 0.01;

        if (this.filters.liquid?.enabled) this.filters.liquid.time += filterDelta;
        if (this.filters.waveDistort?.enabled) this.filters.waveDistort.time += filterDelta;
        if (this.filters.ascii?.enabled) this.filters.ascii.time += filterDelta;
        if (this.filters.adversarial?.enabled) {
            this.filters.adversarial.time += filterDelta;
            this.filters.adversarial.seed = Math.random(); 
        }

        const logicalW = renderer.width / renderer.resolution;
        const logicalH = renderer.height / renderer.resolution;
        
        if (this.filters.kaleidoscope) this.filters.kaleidoscope.screenSize = { x: renderer.width, y: renderer.height };
        if (this.filters.zoomBlur) this.filters.zoomBlur.center = { x: logicalW/2, y: logicalH/2 };
        
        this._updateOneShots(now);
    }

    triggerOneShot(type, config, screen) {
        const now = performance.now();
        if (type === 'shockwave') {
            const filter = this.ensureFilter('shockwave');
            filter.center = { x: Math.random() * screen.width, y: Math.random() * screen.height };
            filter.time = 0;
            filter.radius = -1; 
            filter.amplitude = config.amplitude || 30;
            filter.wavelength = config.wavelength || 160;
            const duration = config.duration || 1000;
            const maxRadius = Math.max(screen.width, screen.height) * 1.5;
            filter.enabled = true;
            this._activeOneShotEffects.push({ type: 'shockwave', startTime: now, duration, maxRadius, filter });
        }
        else if (type === 'bloomFlash') {
            const filter = this.ensureFilter('bloom');
            if (!filter.enabled) { filter.enabled = true; filter._wasDisabled = true; }
            const baseIntensity = filter.bloomScale;
            this._activeOneShotEffects.push({ type: 'bloomFlash', startTime: now, duration: config.duration || 500, baseIntensity, peakIntensity: config.intensity || 6.0, filter });
        }
    }

    _updateOneShots(now) {
        if (this._activeOneShotEffects.length === 0) return;
        
        this._activeOneShotEffects = this._activeOneShotEffects.filter(effect => {
            const elapsed = now - effect.startTime;
            const progress = Math.max(0, Math.min(elapsed / effect.duration, 1.0));
            
            if (effect.type === 'shockwave') {
                effect.filter.radius = effect.maxRadius * progress;
                if (progress > 0.8) {
                    const fade = (1.0 - progress) / 0.2;
                    effect.filter.amplitude = fade * 30;
                }
            }
            else if (effect.type === 'bloomFlash') {
                const current = lerp(effect.peakIntensity, effect.baseIntensity, progress);
                effect.filter.bloomScale = current;
                if (progress >= 1.0 && effect.filter._wasDisabled) {
                    effect.filter.enabled = false;
                    delete effect.filter._wasDisabled;
                }
            }
            
            if (progress >= 1.0) {
                if (effect.type !== 'bloomFlash') effect.filter.enabled = false;
                return false;
            }
            return true;
        });
    }
}