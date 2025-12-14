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
import { VolumetricLightFilter, LiquidFilter, WaveDistortFilter, KaleidoscopeFilter, AdversarialGlitchFilter, AsciiFilter } from './PixiFilters';
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
    }

    init(screen) {
        this.screen = screen;
        this.res = window.devicePixelRatio || 1;
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

        // Filters default to disabled
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
        if (effectName === 'feedback') return; // Handled by FeedbackSystem
        if (effectName === 'global') return;   // Handled by CrossfaderSystem

        const filter = this.ensureFilter(effectName);
        if (!filter) return;

        // --- GLOBAL ENABLE TOGGLE ---
        if (param === 'enabled') {
            filter.enabled = value > 0.5;
            return;
        }

        // --- SPECIFIC MAPPINGS ---
        
        if (effectName === 'pixelate' && param === 'size') {
            // FIX: Removed implicit auto-enable logic (value > 1.5)
            // Ensure size is at least 1 to avoid divide-by-zero artifacts
            filter.size = Math.max(1, value); 
        }
        else if (effectName === 'rgb' && param === 'amount') {
            filter.red = { x: -value, y: -value };
            filter.blue = { x: value, y: value };
            // Allow implicit enable for RGB if amount is significant, 
            // as it's often used as a transient effect.
            // But relying on the 'enabled' toggle is safer if available.
            // Keeping implicit here for backward compat with Modulation Engine chaos.
            if (value > 0.1 && !filter.enabled) filter.enabled = true;
        }
        else if (effectName === 'bloom') {
            if (param === 'intensity') filter.bloomScale = value; 
            if (param === 'threshold') filter.threshold = value;
            if (param === 'blur') filter.blur = value;
            if (filter.bloomScale > 0.1 && !filter.enabled) filter.enabled = true;
        } 
        else if (effectName === 'twist') {
            if (param === 'angle') filter.angle = value;
            if (param === 'radius') filter.radius = value;
            if (param === 'x') filter.offset.x = value * this.screen.width;
            if (param === 'y') filter.offset.y = value * this.screen.height;
            // Twist has a clear "off" state at angle 0
            filter.enabled = Math.abs(filter.angle) > 0.1;
        }
        else if (effectName === 'zoomBlur') {
            if (param === 'strength') filter.strength = value;
            if (param === 'innerRadius') filter.innerRadius = value;
            filter.enabled = value > 0.01;
        }
        else if (effectName === 'crt') {
            if (param in filter) filter[param] = value;
            // CRT is complex, enable if any major component is active
            filter.enabled = (filter.curvature > 0.1 || filter.noise > 0.05 || filter.vignetting > 0.1 || filter.lineWidth > 0.1);
        }
        else if (effectName === 'colorMatrix') {
            if (param === 'threshold') this.colorMatrixState.threshold = value;
            if (param === 'invert') this.colorMatrixState.invert = value;
            filter.enabled = (this.colorMatrixState.threshold > 0.01 || this.colorMatrixState.invert > 0.5);
        }
        else if (effectName === 'glitch') {
            // Standard Glitch
            if (param === 'slices') filter.slices = value;
            if (param === 'offset') filter.offset = value;
            if (param === 'direction') filter.direction = value;
            filter.enabled = filter.slices > 2; 
        }
        else if (effectName === 'kaleidoscope') {
            if (param === 'sides') filter.sides = value;
            if (param === 'angle') filter.angle = value;
            filter.enabled = filter.sides > 0;
        }
        // --- GENERIC PARAM MAPPING ---
        else if (['liquid', 'waveDistort', 'volumetric', 'ascii', 'adversarial', 'oldFilm'].includes(effectName)) {
            if (param in filter) {
                filter[param] = value;
            }
            
            // Implicit enables for effects that might rely on intensity
            if (effectName === 'liquid') filter.enabled = filter.intensity > 0.001;
            if (effectName === 'waveDistort') filter.enabled = filter.intensity > 0.001;
            if (effectName === 'volumetric') filter.enabled = filter.exposure > 0.01;
            
            // For Adversarial/ASCII/OldFilm, we strongly prefer the explicit 'enabled' toggle
            // passed via the Modulation Panel, so we removed auto-enable logic here.
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

        // --- UPDATE COLOR MATRIX ---
        if (this.filters.colorMatrix?.enabled) {
            const cm = this.filters.colorMatrix;
            const { threshold, invert } = this.colorMatrixState;
            cm.reset(); 
            if (threshold > 0.01) {
                cm.desaturate();
                cm.contrast(threshold * 5, false); 
            }
            if (invert > 0.5) {
                cm.negative(false);
            }
        }

        const logicalW = renderer.width / renderer.resolution;
        const logicalH = renderer.height / renderer.resolution;
        
        if (this.filters.kaleidoscope) this.filters.kaleidoscope.screenSize = { x: renderer.width, y: renderer.height };
        if (this.filters.zoomBlur) this.filters.zoomBlur.center = { x: logicalW/2, y: logicalH/2 };
        if (this.filters.twist) this.filters.twist.offset = { x: logicalW/2, y: logicalH/2 };
        
        this._updateOneShots(now);
    }

    triggerOneShot(type, config, screen) {
        // ... (Keep existing OneShot logic) ...
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