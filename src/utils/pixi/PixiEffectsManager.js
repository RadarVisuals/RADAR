// src/utils/pixi/PixiEffectsManager.js
import { 
    AdvancedBloomFilter, 
    RGBSplitFilter, 
    PixelateFilter,
    TwistFilter,
    ZoomBlurFilter,
    CRTFilter,
    ShockwaveFilter, 
    GlitchFilter,
    OldFilmFilter 
} from 'pixi-filters';
import { ColorMatrixFilter } from 'pixi.js';
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
            twist: null, zoomBlur: null,
            crt: null, kaleidoscope: null,
            volumetric: null, waveDistort: null, liquid: null,
            shockwave: null, glitch: null,
            adversarial: null,
            ascii: null,
            oldFilm: null, 
            colorMatrix: null,
            feedback: null 
        };

        this.colorMatrixState = { threshold: 0, invert: 0 };
        this._activeOneShotEffects = [];
        this.screen = null;
        this.res = 1;
        this.paramTransformers = {};
    }

    init(screen) {
        this.screen = screen;
        this.res = window.devicePixelRatio || 1;

        // --- DEFINE TRANSFORMERS ---
        // Maps "EffectName.ParamName" -> Function(filter, value)
        this.paramTransformers = {
            // RGB Split: Maps amount to X/Y offsets + Auto Enable
            'rgb.amount': (filter, val) => {
                filter.red = { x: -val, y: -val };
                filter.blue = { x: val, y: val };
                if (val > 0.1 && !filter.enabled) filter.enabled = true;
            },
            
            // Pixelate: Safety check
            'pixelate.size': (filter, val) => {
                filter.size = Math.max(1, val);
            },

            // Bloom: Map generic param to internal prop + Auto Enable
            'bloom.intensity': (filter, val) => { 
                filter.bloomScale = val; 
                if (val > 0.1 && !filter.enabled) filter.enabled = true;
            },
            
            // Twist: Convert normalized coords + Auto Enable
            'twist.x': (filter, val) => { filter.offset.x = val * this.screen.width; },
            'twist.y': (filter, val) => { filter.offset.y = val * this.screen.height; },
            'twist.angle': (filter, val) => {
                filter.angle = val;
                // Auto-enable if there is a visible twist
                if (Math.abs(val) > 0.1 && !filter.enabled) filter.enabled = true;
            },

            // ZoomBlur: Auto Enable
            'zoomBlur.strength': (filter, val) => {
                filter.strength = val;
                if (val > 0.01 && !filter.enabled) filter.enabled = true;
            },

            // --- FIXED: KALEIDOSCOPE AUTO-ENABLE ---
            // This restores the logic: if sides > 0, turn it on.
            'kaleidoscope.sides': (filter, val) => {
                filter.sides = val;
                filter.enabled = val > 0;
            },

            // Color Matrix: Local State
            'colorMatrix.threshold': (_, val) => { this.colorMatrixState.threshold = val; },
            'colorMatrix.invert': (_, val) => { this.colorMatrixState.invert = val; },
        };
    }

    ensureFilter(name) {
        if (this.filters[name]) return this.filters[name];

        const res = this.res;
        
        switch (name) {
            case 'bloom': this.filters.bloom = new AdvancedBloomFilter({ threshold: 0.5, bloomScale: 1.0, brightness: 1.0, blur: 8, quality: 5, resolution: res }); break;
            case 'rgb': this.filters.rgb = new RGBSplitFilter({ red: {x:0,y:0}, green: {x:0,y:0}, blue: {x:0,y:0}, resolution: res }); break;
            case 'pixelate': this.filters.pixelate = new PixelateFilter(1); this.filters.pixelate.resolution = res; break;
            case 'twist': this.filters.twist = new TwistFilter({ radius: 400, angle: 4, padding: 20, resolution: res }); break;
            case 'zoomBlur': this.filters.zoomBlur = new ZoomBlurFilter({ strength: 0.1, innerRadius: 50, resolution: res }); break;
            case 'crt': this.filters.crt = new CRTFilter({ curvature: 0, lineWidth: 0, lineContrast: 0, noise: 0, vignetting: 0, vignettingAlpha: 0, resolution: res }); break;
            case 'kaleidoscope': this.filters.kaleidoscope = new KaleidoscopeFilter(); this.filters.kaleidoscope.resolution = res; break;
            case 'volumetric': this.filters.volumetric = new VolumetricLightFilter(); break;
            case 'waveDistort': this.filters.waveDistort = new WaveDistortFilter(); break;
            case 'liquid': this.filters.liquid = new LiquidFilter(); break;
            case 'adversarial': this.filters.adversarial = new AdversarialGlitchFilter(); break;
            case 'ascii': this.filters.ascii = new AsciiFilter(); break;
            case 'colorMatrix': this.filters.colorMatrix = new ColorMatrixFilter(); break;
            case 'shockwave': this.filters.shockwave = new ShockwaveFilter({ center: { x: 0, y: 0 }, speed: 500, amplitude: 30, wavelength: 160, radius: -1 }); break;
            case 'glitch': this.filters.glitch = new GlitchFilter({ slices: 10, offset: 10, direction: 0, fillMode: 2 }); break;
            case 'oldFilm': this.filters.oldFilm = new OldFilmFilter({ sepia: 0, noise: 0, scratch: 0, vignetting: 0 }, 0); break;
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
        if (effectName === 'global') return;

        const filter = this.ensureFilter(effectName);
        if (!filter) return;

        // 1. Handle Global Enabled Toggle
        if (param === 'enabled') {
            filter.enabled = value > 0.5;
            return;
        }

        // 2. Check Transformers (Complex mapping & Auto-Enables)
        const transformKey = `${effectName}.${param}`;
        if (this.paramTransformers[transformKey]) {
            this.paramTransformers[transformKey](filter, value);
            return;
        }

        // 3. Default Direct Assignment (1:1 mapping)
        if (param in filter) {
            filter[param] = value;
            
            // Implicit Auto-Enables for custom filters
            // These don't need complex transformers, just a check
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

        if (this.filters.crt?.enabled) this.filters.crt.time += ticker.deltaTime * 0.1;
        if (this.filters.liquid?.enabled) this.filters.liquid.time += filterDelta;
        if (this.filters.waveDistort?.enabled) this.filters.waveDistort.time += filterDelta;
        if (this.filters.ascii?.enabled) this.filters.ascii.time += filterDelta;
        
        if (this.filters.adversarial?.enabled) {
            this.filters.adversarial.time += filterDelta;
            this.filters.adversarial.seed = Math.random(); 
        }

        if (this.filters.oldFilm?.enabled) {
            this.filters.oldFilm.seed = Math.random();
            this.filters.oldFilm.time += ticker.deltaTime * 0.1;
        }

        if (this.filters.glitch?.enabled) {
            this.filters.glitch.seed = Math.random();
        }

        if (this.filters.colorMatrix) {
            const cm = this.filters.colorMatrix;
            const { threshold, invert } = this.colorMatrixState;
            
            if (threshold > 0.01 || invert > 0.5) {
                cm.enabled = true;
                cm.reset(); 
                if (threshold > 0.01) {
                    cm.desaturate();
                    cm.contrast(threshold * 5, false); 
                }
                if (invert > 0.5) {
                    cm.negative(false);
                }
            } else {
                cm.enabled = false;
            }
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
        else if (type === 'glitch') {
            const filter = this.ensureFilter('glitch');
            filter.enabled = true;
            filter.slices = config.slices || 15;
            filter.offset = config.offset || 50;
            this._activeOneShotEffects.push({ type: 'glitch', startTime: now, duration: config.duration || 600, filter });
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
            else if (effect.type === 'glitch') {
                effect.filter.seed = Math.random();
                effect.filter.offset = (1.0 - progress) * 50;
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