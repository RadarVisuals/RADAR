// src/utils/pixi/PixiEffectsManager.js
import { 
    AdvancedBloomFilter, 
    RGBSplitFilter, 
    PixelateFilter,
    TwistFilter,
    ZoomBlurFilter,
    CRTFilter,
    ShockwaveFilter, 
    GlitchFilter
} from 'pixi-filters';
import { VolumetricLightFilter, LiquidFilter, WaveDistortFilter, KaleidoscopeFilter } from './PixiFilters';
import { lerp } from '../helpers'; // Assuming helpers exist here

export class PixiEffectsManager {
    constructor() {
        this.filters = {
            bloom: null, rgb: null, pixelate: null,
            twist: null, zoomBlur: null,
            crt: null, kaleidoscope: null,
            volumetric: null, waveDistort: null, liquid: null,
            shockwave: null, glitch: null
        };
        this._activeOneShotEffects = [];
    }

    init(screen) {
        const res = window.devicePixelRatio || 1;
        
        this.filters.bloom = new AdvancedBloomFilter({ threshold: 0.5, bloomScale: 1.0, brightness: 1.0, blur: 8, quality: 5, resolution: res });
        this.filters.rgb = new RGBSplitFilter({ red: {x:-2,y:-2}, green: {x:0,y:0}, blue: {x:2,y:2}, resolution: res });
        this.filters.pixelate = new PixelateFilter(10); this.filters.pixelate.resolution = res;
        this.filters.twist = new TwistFilter({ radius: 400, angle: 4, padding: 20, resolution: res });
        this.filters.zoomBlur = new ZoomBlurFilter({ strength: 0.1, innerRadius: 50, resolution: res });
        this.filters.crt = new CRTFilter({ curvature: 1, lineWidth: 1, resolution: res });
        this.filters.kaleidoscope = new KaleidoscopeFilter(); this.filters.kaleidoscope.resolution = res;
        
        // PREMIUM CUSTOM SHADERS
        this.filters.volumetric = new VolumetricLightFilter(); 
        this.filters.waveDistort = new WaveDistortFilter();
        this.filters.liquid = new LiquidFilter();

        // EVENT REACTION FILTERS (Initialize disabled)
        this.filters.shockwave = new ShockwaveFilter({
            center: { x: screen.width / 2, y: screen.height / 2 },
            speed: 500,
            amplitude: 30,
            wavelength: 160,
            radius: -1 // Start hidden
        });
        
        this.filters.glitch = new GlitchFilter({
            slices: 10,
            offset: 10,
            direction: 0,
            fillMode: 2 // Loop
        });
        this.filters.glitch.enabled = false;

        Object.values(this.filters).forEach(f => f.enabled = false);
    }

    getFilterList() {
        // Return active filters in specific order for rendering
        return [
            this.filters.liquid,
            this.filters.kaleidoscope, 
            this.filters.twist, 
            this.filters.zoomBlur,
            this.filters.shockwave, 
            this.filters.glitch,    
            this.filters.volumetric,
            this.filters.waveDistort,
            this.filters.rgb, 
            this.filters.bloom,
            this.filters.pixelate,
            this.filters.crt
        ];
    }

    updateConfig(effectName, param, value) {
        const filter = this.filters[effectName];
        if (!filter) return;

        if (param === 'enabled') {
            filter.enabled = !!value;
        } else if (effectName === 'rgb' && param === 'amount') {
            filter.red = { x: -value, y: -value };
            filter.green = { x: 0, y: 0 };
            filter.blue = { x: value, y: value };
        } else if (effectName === 'bloom' && param === 'intensity') {
            filter.bloomScale = value;
        } else if (effectName === 'liquid') {
            if (param === 'speed') filter.speed = value;
            if (param === 'scale') filter.scale = value;
            if (param === 'intensity') filter.intensity = value;
        } else if (effectName === 'volumetric') {
            if (param === 'exposure') filter.exposure = value;
            if (param === 'decay') filter.decay = value;
            if (param === 'density') filter.density = value;
            if (param === 'threshold') filter.threshold = value;
            if (param === 'x') filter.lightX = value;
            if (param === 'y') filter.lightY = value;
        } else if (effectName === 'waveDistort') {
            if (param === 'intensity') filter.intensity = value;
        } else {
            if (param in filter) {
                filter[param] = value;
            }
        }
    }

    triggerOneShot(type, config, screen) {
        const now = performance.now();
        const width = screen.width;
        const height = screen.height;
        
        if (type === 'shockwave') {
            this.filters.shockwave.center = { 
                x: Math.random() * width, 
                y: Math.random() * height 
            };
            this.filters.shockwave.time = 0;
            this.filters.shockwave.radius = -1; 
            this.filters.shockwave.amplitude = config.amplitude || 30;
            this.filters.shockwave.wavelength = config.wavelength || 160;
            
            const duration = config.duration || 1000;
            const maxRadius = Math.max(width, height) * 1.5;
            
            this._activeOneShotEffects.push({
                type: 'shockwave', startTime: now, duration, maxRadius
            });
        }
        else if (type === 'glitch') {
            this.filters.glitch.enabled = true;
            this.filters.glitch.slices = config.slices || 15;
            this.filters.glitch.offset = config.offset || 50;
            
            this._activeOneShotEffects.push({
                type: 'glitch', startTime: now, duration: config.duration || 600
            });
        }
        else if (type === 'bloomFlash') {
            if (!this.filters.bloom.enabled) {
                this.filters.bloom.enabled = true;
                this.filters.bloom._wasDisabled = true;
            }
            const baseIntensity = this.filters.bloom.bloomScale;
            
            this._activeOneShotEffects.push({
                type: 'bloomFlash', startTime: now, duration: config.duration || 500, baseIntensity, peakIntensity: config.intensity || 6.0
            });
        }
    }

    update(ticker, renderer) {
        const now = performance.now();
        const filterDelta = ticker.deltaTime * 0.01;

        // Continuous Filter Updates
        if (this.filters.crt && this.filters.crt.enabled) {
            this.filters.crt.seed = Math.random();
            this.filters.crt.time += ticker.deltaTime * 0.1;
        }
        if (this.filters.liquid && this.filters.liquid.enabled) this.filters.liquid.time += filterDelta;
        if (this.filters.waveDistort && this.filters.waveDistort.enabled) this.filters.waveDistort.time += filterDelta;

        // Resize helpers
        const logicalW = renderer.width / renderer.resolution;
        const logicalH = renderer.height / renderer.resolution;
        if (this.filters.kaleidoscope) this.filters.kaleidoscope.screenSize = { x: renderer.width, y: renderer.height };
        if (this.filters.zoomBlur) this.filters.zoomBlur.center = { x: logicalW/2, y: logicalH/2 };
        if (this.filters.twist) this.filters.twist.offset = { x: logicalW/2, y: logicalH/2 };

        // One-Shot Effect Processing
        if (this._activeOneShotEffects.length > 0) {
            this._activeOneShotEffects = this._activeOneShotEffects.filter(effect => {
                const elapsed = now - effect.startTime;
                const progress = Math.max(0, Math.min(elapsed / effect.duration, 1.0));
                
                if (effect.type === 'shockwave') {
                    this.filters.shockwave.radius = effect.maxRadius * progress;
                    if (progress > 0.8) {
                        const fade = (1.0 - progress) / 0.2;
                        this.filters.shockwave.amplitude = fade * 30;
                    }
                }
                else if (effect.type === 'glitch') {
                    this.filters.glitch.seed = Math.random();
                    this.filters.glitch.offset = (1.0 - progress) * 50;
                    if (progress >= 1.0) this.filters.glitch.enabled = false;
                }
                else if (effect.type === 'bloomFlash') {
                    const current = lerp(effect.peakIntensity, effect.baseIntensity, progress);
                    this.filters.bloom.bloomScale = current;
                    if (progress >= 1.0 && this.filters.bloom._wasDisabled) {
                        this.filters.bloom.enabled = false;
                        delete this.filters.bloom._wasDisabled;
                    }
                }
                return progress < 1.0;
            });
        }
    }
}