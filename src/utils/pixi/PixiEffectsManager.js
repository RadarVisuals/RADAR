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
import { VolumetricLightFilter, LiquidFilter, WaveDistortFilter, KaleidoscopeFilter, AdversarialGlitchFilter, AsciiFilter } from './PixiFilters';
import { lerp } from '../helpers';

export class PixiEffectsManager {
    constructor() {
        // Initialize as null to save memory
        this.filters = {
            bloom: null, rgb: null, pixelate: null,
            twist: null, zoomBlur: null,
            crt: null, kaleidoscope: null,
            volumetric: null, waveDistort: null, liquid: null,
            shockwave: null, glitch: null,
            adversarial: null,
            ascii: null 
        };
        this._activeOneShotEffects = [];
        this.screen = null;
        this.res = 1;
    }

    init(screen) {
        this.screen = screen;
        this.res = window.devicePixelRatio || 1;
        
        // We DO NOT instantiate filters here anymore. 
        // They are instantiated on demand in 'ensureFilter'.
    }

    // --- NEW HELPER: Lazy Loader ---
    ensureFilter(name) {
        if (this.filters[name]) return this.filters[name];

        const res = this.res;
        const screen = this.screen;

        // Instantiate specific filter on demand
        switch (name) {
            case 'bloom':
                this.filters.bloom = new AdvancedBloomFilter({ threshold: 0.5, bloomScale: 1.0, brightness: 1.0, blur: 8, quality: 5, resolution: res });
                break;
            case 'rgb':
                this.filters.rgb = new RGBSplitFilter({ red: {x:-2,y:-2}, green: {x:0,y:0}, blue: {x:2,y:2}, resolution: res });
                break;
            case 'pixelate':
                this.filters.pixelate = new PixelateFilter(10);
                this.filters.pixelate.resolution = res;
                break;
            case 'twist':
                this.filters.twist = new TwistFilter({ radius: 400, angle: 4, padding: 20, resolution: res });
                break;
            case 'zoomBlur':
                this.filters.zoomBlur = new ZoomBlurFilter({ strength: 0.1, innerRadius: 50, resolution: res });
                break;
            case 'crt':
                this.filters.crt = new CRTFilter({ curvature: 1, lineWidth: 1, resolution: res });
                break;
            case 'kaleidoscope':
                this.filters.kaleidoscope = new KaleidoscopeFilter();
                this.filters.kaleidoscope.resolution = res;
                break;
            case 'volumetric':
                this.filters.volumetric = new VolumetricLightFilter();
                break;
            case 'waveDistort':
                this.filters.waveDistort = new WaveDistortFilter();
                break;
            case 'liquid':
                this.filters.liquid = new LiquidFilter();
                break;
            case 'adversarial':
                this.filters.adversarial = new AdversarialGlitchFilter();
                break;
            case 'ascii':
                this.filters.ascii = new AsciiFilter();
                break;
            case 'shockwave':
                this.filters.shockwave = new ShockwaveFilter({
                    center: { x: screen.width / 2, y: screen.height / 2 },
                    speed: 500, amplitude: 30, wavelength: 160, radius: -1 
                });
                break;
            case 'glitch':
                this.filters.glitch = new GlitchFilter({
                    slices: 10, offset: 10, direction: 0, fillMode: 2 
                });
                // Glitch usually starts disabled
                this.filters.glitch.enabled = false;
                break;
        }

        // Default to disabled upon creation, unless logic dictates otherwise
        if (this.filters[name]) {
            // Glitch is special case handled above, others start disabled
            if (name !== 'glitch') this.filters[name].enabled = false; 
        }

        return this.filters[name];
    }

    getFilterList() {
        // Only return filters that have been instantiated and are not null
        // This is efficient because Pixi won't even try to traverse null filters
        return [
            this.filters.liquid,
            this.filters.kaleidoscope, 
            this.filters.twist, 
            this.filters.zoomBlur,
            this.filters.shockwave, 
            this.filters.glitch,    
            this.filters.adversarial,
            
            this.filters.ascii, 
            
            this.filters.volumetric,
            this.filters.waveDistort,
            this.filters.rgb, 
            this.filters.bloom,
            this.filters.pixelate,
            this.filters.crt
        ].filter(f => f !== null); // <--- Key change: Filter out nulls
    }

    updateConfig(effectName, param, value) {
        // If we are trying to enable a filter, or update a filter that exists, ensure it is created.
        // If we are updating a config for a filter that doesn't exist yet, AND we aren't enabling it, 
        // we can technically skip creation, but for simplicity, we create it to store the config.
        // Optimization: Only create if enabling or if value implies usage? 
        // Safer approach: Just create it. Memory cost is paid when user interacts.
        
        const filter = this.ensureFilter(effectName);
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
        } else if (effectName === 'ascii') { 
            if (param === 'size') filter.size = value;
            if (param === 'invert') filter.invert = value;
            if (param === 'charSet') filter.charSet = value;
            if (param === 'colorMode') filter.colorMode = value;
        } else if (effectName === 'adversarial') {
            if (param === 'intensity') filter.intensity = value;
            if (param === 'bands') filter.bands = value;
            if (param === 'shift') filter.shift = value;
            if (param === 'noiseScale') filter.noiseScale = value;
            if (param === 'chromatic') filter.chromatic = value;
            if (param === 'scanline') filter.scanline = value;
            if (param === 'qNoise') filter.qNoise = value;
            if (param === 'seed') filter.seed = value;
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
            const filter = this.ensureFilter('shockwave');
            filter.center = { 
                x: Math.random() * width, 
                y: Math.random() * height 
            };
            filter.time = 0;
            filter.radius = -1; 
            filter.amplitude = config.amplitude || 30;
            filter.wavelength = config.wavelength || 160;
            
            const duration = config.duration || 1000;
            const maxRadius = Math.max(width, height) * 1.5;
            
            this._activeOneShotEffects.push({
                type: 'shockwave', startTime: now, duration, maxRadius
            });
        }
        else if (type === 'glitch') {
            const filter = this.ensureFilter('glitch');
            filter.enabled = true;
            filter.slices = config.slices || 15;
            filter.offset = config.offset || 50;
            
            this._activeOneShotEffects.push({
                type: 'glitch', startTime: now, duration: config.duration || 600
            });
        }
        else if (type === 'bloomFlash') {
            const filter = this.ensureFilter('bloom');
            if (!filter.enabled) {
                filter.enabled = true;
                filter._wasDisabled = true;
            }
            const baseIntensity = filter.bloomScale;
            
            this._activeOneShotEffects.push({
                type: 'bloomFlash', startTime: now, duration: config.duration || 500, baseIntensity, peakIntensity: config.intensity || 6.0
            });
        }
    }

    update(ticker, renderer) {
        const now = performance.now();
        const filterDelta = ticker.deltaTime * 0.01;

        // Continuous Filter Updates - Only update if instantiated and enabled
        if (this.filters.crt && this.filters.crt.enabled) {
            this.filters.crt.seed = Math.random();
            this.filters.crt.time += ticker.deltaTime * 0.1;
        }
        if (this.filters.liquid && this.filters.liquid.enabled) this.filters.liquid.time += filterDelta;
        if (this.filters.waveDistort && this.filters.waveDistort.enabled) this.filters.waveDistort.time += filterDelta;
        if (this.filters.adversarial && this.filters.adversarial.enabled) this.filters.adversarial.time += filterDelta;
        if (this.filters.ascii && this.filters.ascii.enabled) this.filters.ascii.time += filterDelta;

        // Resize helpers - Only if filter exists
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
                    // Ensure filter exists (it should, triggered above)
                    if (this.filters.shockwave) {
                        this.filters.shockwave.radius = effect.maxRadius * progress;
                        if (progress > 0.8) {
                            const fade = (1.0 - progress) / 0.2;
                            this.filters.shockwave.amplitude = fade * 30;
                        }
                    }
                }
                else if (effect.type === 'glitch') {
                    if (this.filters.glitch) {
                        this.filters.glitch.seed = Math.random();
                        this.filters.glitch.offset = (1.0 - progress) * 50;
                        if (progress >= 1.0) this.filters.glitch.enabled = false;
                    }
                }
                else if (effect.type === 'bloomFlash') {
                    if (this.filters.bloom) {
                        const current = lerp(effect.peakIntensity, effect.baseIntensity, progress);
                        this.filters.bloom.bloomScale = current;
                        if (progress >= 1.0 && this.filters.bloom._wasDisabled) {
                            this.filters.bloom.enabled = false;
                            delete this.filters.bloom._wasDisabled;
                        }
                    }
                }
                return progress < 1.0;
            });
        }
    }
}