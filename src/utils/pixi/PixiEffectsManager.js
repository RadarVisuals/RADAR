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
            ascii: null 
        };
        
        this.filters.destruction = {
            rgb: null,
            glitch: null,
            pixelate: null,
            crt: null,
            zoom: null,
            colorMatrix: null 
        };

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
        const screen = this.screen;

        switch (name) {
            case 'bloom': this.filters.bloom = new AdvancedBloomFilter({ threshold: 0.5, bloomScale: 1.0, brightness: 1.0, blur: 8, quality: 5, resolution: res }); break;
            case 'rgb': this.filters.rgb = new RGBSplitFilter({ red: {x:0,y:0}, green: {x:0,y:0}, blue: {x:0,y:0}, resolution: res }); break;
            case 'pixelate': this.filters.pixelate = new PixelateFilter(1); this.filters.pixelate.resolution = res; break;
            case 'twist': this.filters.twist = new TwistFilter({ radius: 400, angle: 4, padding: 20, resolution: res }); break;
            case 'zoomBlur': this.filters.zoomBlur = new ZoomBlurFilter({ strength: 0.1, innerRadius: 50, resolution: res }); break;
            
            // --- FIX: Explicitly zero out ALL CRT properties on init ---
            case 'crt': this.filters.crt = new CRTFilter({ 
                curvature: 0, lineWidth: 0, lineContrast: 0, 
                noise: 0, noiseSize: 1.0, 
                vignetting: 0, vignettingAlpha: 0, vignettingBlur: 0, 
                resolution: res 
            }); break;
            
            case 'kaleidoscope': this.filters.kaleidoscope = new KaleidoscopeFilter(); this.filters.kaleidoscope.resolution = res; break;
            case 'volumetric': this.filters.volumetric = new VolumetricLightFilter(); break;
            case 'waveDistort': this.filters.waveDistort = new WaveDistortFilter(); break;
            case 'liquid': this.filters.liquid = new LiquidFilter(); break;
            case 'adversarial': this.filters.adversarial = new AdversarialGlitchFilter(); break;
            case 'ascii': this.filters.ascii = new AsciiFilter(); break;
            case 'shockwave': this.filters.shockwave = new ShockwaveFilter({ center: { x: screen.width / 2, y: screen.height / 2 }, speed: 500, amplitude: 30, wavelength: 160, radius: -1 }); break;
            case 'glitch': this.filters.glitch = new GlitchFilter({ slices: 10, offset: 10, direction: 0, fillMode: 2 }); this.filters.glitch.enabled = false; break;
        }

        if (this.filters[name]) {
            if (name !== 'glitch') this.filters[name].enabled = false; 
        }

        return this.filters[name];
    }

    ensureDestructionChain() {
        if (!this.filters.destruction.rgb) this.filters.destruction.rgb = this.ensureFilter('rgb');
        if (!this.filters.destruction.glitch) this.filters.destruction.glitch = this.ensureFilter('adversarial');
        if (!this.filters.destruction.pixelate) this.filters.destruction.pixelate = this.ensureFilter('pixelate');
        if (!this.filters.destruction.crt) this.filters.destruction.crt = this.ensureFilter('crt');
        if (!this.filters.destruction.zoom) this.filters.destruction.zoom = this.ensureFilter('zoomBlur');
        if (!this.filters.destruction.colorMatrix) {
            this.filters.destruction.colorMatrix = new ColorMatrixFilter();
            this.filters.destruction.colorMatrix.enabled = false;
        }
    }

    updateDestructionMode(audioData, config) {
        this.ensureDestructionChain();
        const { rgb, glitch, pixelate, crt, zoom, colorMatrix } = this.filters.destruction;
        const enabled = config && config.enabled;

        // Cleanup if disabled
        if (!enabled) {
            [rgb, glitch, pixelate, crt, zoom, colorMatrix].forEach(f => {
                if (f && f._isDestructionControlled) f.enabled = false;
            });
            if (rgb) rgb._isDestructionControlled = false;
            if (crt) crt._isDestructionControlled = false;
            
            // Re-enable if was manually set before
            if (rgb && rgb._wasManuallyEnabled) rgb.enabled = true;
            if (crt && crt._wasManuallyEnabled) crt.enabled = true;
            return;
        }

        const map = config.mappings || {};
        const chaos = config.chaos || 0; 
        const masterDrive = config.masterDrive !== undefined ? config.masterDrive : 1.0;

        // Force enable chain
        [rgb, glitch, pixelate, crt, zoom, colorMatrix].forEach(f => {
            f.enabled = true; 
            f._isDestructionControlled = true; 
        });

        const bands = audioData.frequencyBands; 
        const level = audioData.level;

        const getSourceValue = (source) => {
            if (source === 'level') return level;
            return bands[source] || 0;
        };

        const calcVal = (targetKey, base, rangeScale) => {
            const m = map[targetKey];
            if (!m || !m.enabled) return base;
            
            const input = getSourceValue(m.source);
            
            // Apply Chaos
            const chaosFactor = chaos > 0 ? 1 + (Math.random() * chaos * 3.0) : 1; 
            
            // Audio Curve
            const signalStrength = Math.pow(input, 2) * m.amount * 3.0; 
            
            // Result = Base + (Signal * Scale * Chaos)
            // Apply Master Drive to the added effect portion
            const addedEffect = (signalStrength * rangeScale * chaosFactor);
            return base + (addedEffect * masterDrive);
        };

        // 1. RGB SPLIT
        const rgbVal = calcVal('rgbStrength', 0.0, 40.0); 
        rgb.red = { x: rgbVal, y: -rgbVal * 0.5 };
        rgb.blue = { x: -rgbVal, y: rgbVal * 0.5 };
        
        // 2. KICK ZOOM
        const zoomVal = calcVal('zoomStrength', 0.0, 0.4);
        zoom.strength = Math.min(zoomVal, 0.8); 
        if (this.screen) zoom.center = { x: this.screen.width/2, y: this.screen.height/2 };

        // 3. GLITCH
        const glitchInt = calcVal('glitchIntensity', 0.0, 5.0);
        glitch.intensity = glitchInt;
        glitch.bands = 5 + Math.floor(glitchInt * 20);
        glitch.shift = Math.floor(glitchInt * 100);
        glitch.chromatic = calcVal('chromaticShift', 1.0, 15.0) * masterDrive; 

        // 4. CRT - SPLIT INTO NOISE AND GEOMETRY
        
        // A. Noise
        const noiseMap = map['crtNoise'];
        if (noiseMap && noiseMap.enabled && masterDrive > 0.01) {
            const calculatedNoise = calcVal('crtNoise', 0.0, 1.5);
            // Noise Gate: only apply if significant to prevent static hiss when clean
            crt.noise = calculatedNoise > 0.01 ? calculatedNoise : 0;
            if (crt.noise > 0) crt.time += 0.5 + (level * 5.0) + chaos; 
        } else {
            crt.noise = 0;
        }

        // B. Geometry & Vignette (The "Retro Look")
        // We use calcVal here so it responds to Master Drive correctly. 
        const geomIntensity = calcVal('crtGeometry', 0.0, 1.0); 

        // Stronger Noise Gate for Geometry (0.01) to prevent default vignetting
        if (geomIntensity > 0.01 && masterDrive > 0.01) {
            // Apply physics-based look
            crt.curvature = geomIntensity * 2.0; 
            crt.lineWidth = geomIntensity * 8.0;
            crt.lineContrast = geomIntensity * 0.5;
            
            // Explicitly control vignette intensity
            const vignetteAmount = geomIntensity * 0.45;
            crt.vignetting = vignetteAmount;
            crt.vignettingAlpha = vignetteAmount;
            crt.vignettingBlur = vignetteAmount * 0.5;
        } else {
            // Completely clean - FORCIBLY ZERO EVERYTHING
            crt.curvature = 0;
            crt.lineWidth = 0;
            crt.lineContrast = 0;
            crt.vignetting = 0;
            crt.vignettingAlpha = 0;
            crt.vignettingBlur = 0;
        }

        // 5. VIDEO NASTY: BINARY THRESHOLD & INVERT
        const threshVal = calcVal('binaryThreshold', 0, 1.0);
        const invertVal = calcVal('invertStrobe', 0, 1.0);
        
        colorMatrix.reset();
        
        if (threshVal > 0.1) {
            colorMatrix.desaturate();
            colorMatrix.contrast(threshVal * 5, true); 
        }

        if (invertVal > 0.5) {
            colorMatrix.negative(true);
        }

        // 6. PIXELATE
        const pixVal = Math.max(1, calcVal('pixelateSize', 1, 40)); 
        pixelate.size = pixVal;

        // Chaos Seeds
        glitch.seed = Math.random();
    }

    getFilterList() {
        const list = [
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
            this.filters.pixelate,
            this.filters.destruction.colorMatrix,
            this.filters.crt,
            this.filters.rgb, 
            this.filters.bloom
        ];
        return [...new Set(list.filter(f => f !== null && f.enabled))];
    }

    updateConfig(effectName, param, value) {
        const filter = this.ensureFilter(effectName);
        if (!filter) return;
        if (filter._isDestructionControlled) return;

        if (param === 'enabled') {
            filter.enabled = !!value;
            if (value) filter._wasManuallyEnabled = true;
            else delete filter._wasManuallyEnabled;
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
            filter.center = { x: Math.random() * width, y: Math.random() * height };
            filter.time = 0;
            filter.radius = -1; 
            filter.amplitude = config.amplitude || 30;
            filter.wavelength = config.wavelength || 160;
            const duration = config.duration || 1000;
            const maxRadius = Math.max(width, height) * 1.5;
            this._activeOneShotEffects.push({ type: 'shockwave', startTime: now, duration, maxRadius });
        }
        else if (type === 'glitch') {
            const filter = this.ensureFilter('glitch');
            filter.enabled = true;
            filter.slices = config.slices || 15;
            filter.offset = config.offset || 50;
            this._activeOneShotEffects.push({ type: 'glitch', startTime: now, duration: config.duration || 600 });
        }
        else if (type === 'bloomFlash') {
            const filter = this.ensureFilter('bloom');
            if (!filter.enabled) { filter.enabled = true; filter._wasDisabled = true; }
            const baseIntensity = filter.bloomScale;
            this._activeOneShotEffects.push({ type: 'bloomFlash', startTime: now, duration: config.duration || 500, baseIntensity, peakIntensity: config.intensity || 6.0 });
        }
    }

    update(ticker, renderer) {
        const now = performance.now();
        const filterDelta = ticker.deltaTime * 0.01;

        if (this.filters.crt && this.filters.crt.enabled) {
            this.filters.crt.seed = Math.random();
            this.filters.crt.time += ticker.deltaTime * 0.1;
        }
        if (this.filters.liquid && this.filters.liquid.enabled) this.filters.liquid.time += filterDelta;
        if (this.filters.waveDistort && this.filters.waveDistort.enabled) this.filters.waveDistort.time += filterDelta;
        if (this.filters.adversarial && this.filters.adversarial.enabled) this.filters.adversarial.time += filterDelta;
        if (this.filters.ascii && this.filters.ascii.enabled) this.filters.ascii.time += filterDelta;

        const logicalW = renderer.width / renderer.resolution;
        const logicalH = renderer.height / renderer.resolution;
        
        if (this.filters.kaleidoscope) this.filters.kaleidoscope.screenSize = { x: renderer.width, y: renderer.height };
        if (this.filters.zoomBlur) this.filters.zoomBlur.center = { x: logicalW/2, y: logicalH/2 };
        if (this.filters.twist) this.filters.twist.offset = { x: logicalW/2, y: logicalH/2 };

        if (this._activeOneShotEffects.length > 0) {
            this._activeOneShotEffects = this._activeOneShotEffects.filter(effect => {
                const elapsed = now - effect.startTime;
                const progress = Math.max(0, Math.min(elapsed / effect.duration, 1.0));
                
                if (effect.type === 'shockwave') {
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