// src/utils/CanvasManager.js
import { BLEND_MODES } from '../config/global-config';
import ValueInterpolator from './ValueInterpolator';
import { sliderParams } from '../components/Panels/EnhancedControlPanel';
import { getDecodedImage } from './imageDecoder';

const SETUP_CANVAS_POLL_INTERVAL = 100;
const SETUP_CANVAS_POLL_TIMEOUT = 3000;
const MAX_TOTAL_OFFSET = 10000;
const DELTA_TIME_BUFFER_SIZE = 5;

const MIDI_INTERPOLATION_DURATION = 300; 
const MAX_DELTA_TIME = 1 / 30;

const lerp = (start, end, t) => {
    if (typeof start !== 'number' || typeof end !== 'number') return start;
    return start * (1 - t) + end * t;
};

class CanvasManager {
    canvas = null;
    ctx = null;
    layerId;
    imageA = null; // Will now hold an ImageBitmap
    configA;
    animationFrameId = null;
    lastTimestamp = 0;
    isDrawing = false;
    isDestroyed = false;
    lastImageSrc = null;
    lastValidWidth = 0;
    lastValidHeight = 0;
    lastDPR = 1;
    deltaTimeBuffer = [];
    smoothedDeltaTime = 1 / 60;
    
    interpolators = {};
    interpolatorsB = {};
    playbackValues = {};

    continuousRotationAngleA = 0;
    continuousRotationAngleB = 0;

    driftStateA = { x: 0, y: 0, phase: 0 };
    driftStateB = { x: 0, y: 0, phase: 0 };

    audioFrequencyFactor = 1.0;
    beatPulseFactor = 1.0;
    beatPulseEndTime = 0;

    isTransitioning = false;
    transitionStartTime = 0;
    transitionDuration = 500;
    outgoingImage = null;
    outgoingConfig = null;
    outgoingImageSrc = null; 
    outgoingContinuousRotationAngle = 0;
    outgoingDriftState = null;

    imageB = null; // Will now hold an ImageBitmap
    configB = null;
    crossfadeValue = 0.0;
    
    parallaxOffset = { x: 0, y: 0 }; 
    renderedParallaxOffset = { x: 0, y: 0 };
    parallaxFactor = 1;
    internalParallaxFactor = 0;

    constructor(canvas, layerId) {
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            throw new Error(`[CM L${layerId}] Invalid canvas element provided.`);
        }
        this.canvas = canvas;
        try {
            this.ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
            if (!this.ctx) throw new Error(`Failed to get 2D context for Layer ${layerId}`);
        } catch (e) {
            if (import.meta.env.DEV) console.error(`[CM L${layerId}] Error getting context:`, e);
            throw new Error(`Failed to get 2D context for Layer ${layerId}: ${e.message}`);
        }
        this.layerId = layerId;
        
        if (layerId === '1') { this.parallaxFactor = 10; this.internalParallaxFactor = 10; }
        if (layerId === '2') { this.parallaxFactor = 25; this.internalParallaxFactor = 20; }
        if (layerId === '3') { this.parallaxFactor = 50; this.internalParallaxFactor =30; }

        this.configA = this.getDefaultConfig();
        this.lastDPR = 1;
        this.playbackValues = {};

        this.driftStateA = { x: 0, y: 0, phase: Math.random() * Math.PI * 2 };
        this.driftStateB = { x: 0, y: 0, phase: Math.random() * Math.PI * 2 };

        this.interpolators = {};
        this.interpolatorsB = {};
        sliderParams.forEach(param => {
            if (typeof (this.configA[param.prop]) === 'number') {
                const initialValue = this.configA[param.prop] ?? param.defaultValue ?? 0;
                this.interpolators[param.prop] = new ValueInterpolator(initialValue, MIDI_INTERPOLATION_DURATION);
                this.interpolatorsB[param.prop] = new ValueInterpolator(initialValue, MIDI_INTERPOLATION_DURATION);
            }
        });

        this.animationLoop = this.animationLoop.bind(this);
    }
    
    setParallaxOffset(x, y) {
        this.parallaxOffset.x = x;
        this.parallaxOffset.y = y;
    }

    async transitionTo(newImageSrc, newConfig) {
        if (this.isTransitioning) {
            this.isTransitioning = false;
        }

        this.outgoingImage = this.imageA;
        this.outgoingConfig = this.getConfigData();
        this.outgoingImageSrc = this.lastImageSrc; 
        this.outgoingContinuousRotationAngle = this.continuousRotationAngleA;
        this.outgoingDriftState = { ...this.driftStateA };

        try {
            await this.setImage(newImageSrc);
            this.applyFullConfig(newConfig);
        } catch (error) {
            if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] Failed to load new image/config for transition:`, error);
            this.imageA = this.outgoingImage;
            this.applyFullConfig(this.outgoingConfig);
            this.outgoingImage = null;
            this.outgoingConfig = null;
            this.outgoingImageSrc = null; 
            this.outgoingContinuousRotationAngle = 0;
            this.outgoingDriftState = null;
            return;
        }

        this.isTransitioning = true;
        this.transitionStartTime = performance.now();

        return new Promise(resolve => {
            setTimeout(() => {
                this.isTransitioning = false;
                this.outgoingImage = null;
                this.outgoingConfig = null;
                this.outgoingImageSrc = null; 
                this.outgoingContinuousRotationAngle = 0;
                this.outgoingDriftState = null;
                resolve();
            }, this.transitionDuration);
        });
    }

    async setCrossfadeTarget(imageSrc, config) {
        if (this.isDestroyed) throw new Error("Manager destroyed");
        
        if (!imageSrc || typeof imageSrc !== 'string') {
            this.imageB = null; this.configB = config || null;
            return;
        }
        
        try {
            const decodedBitmap = await getDecodedImage(imageSrc);
            if (this.isDestroyed) return;
            if (decodedBitmap.width === 0 || decodedBitmap.height === 0) {
                 this.imageB = null; this.configB = config;
                 throw new Error(`Loaded crossfade image bitmap has zero dimensions: ${imageSrc.substring(0, 100)}`);
            }
            this.imageB = decodedBitmap;
            this.configB = config;
            Object.keys(this.interpolatorsB).forEach(key => {
                const interpolator = this.interpolatorsB[key];
                const value = this.configB?.[key];
                if (interpolator && value !== undefined) {
                    interpolator.snap(value);
                }
            });
        } catch (error) {
            if (this.isDestroyed) throw new Error("Manager destroyed during crossfade image load");
            this.imageB = null; this.configB = config;
            throw error;
        }
    }

    setCrossfadeValue(value) {
        this.crossfadeValue = Math.max(0, Math.min(1, Number(value) || 0));
    }

    getDefaultConfig() {
        const defaultConfig = {};
        sliderParams.forEach(p => {
            defaultConfig[p.prop] = p.defaultValue ?? (p.min + p.max) / 2;
            if (p.prop === 'speed') defaultConfig[p.prop] = 0.01;
            if (p.prop === 'size') defaultConfig[p.prop] = 1.0;
        });
        defaultConfig.enabled = true;
        defaultConfig.blendMode = 'normal';
        defaultConfig.direction = 1;
        // Add default FX config here
        defaultConfig.fx = {
            activeFilter: 'none',
            intensity: 0,
            grain: 0.02
        };
        return defaultConfig;
    }

    applyPlaybackValue(key, value) {
        if (this.isDestroyed) return;
        this.playbackValues[key] = value;
    }

    clearPlaybackValues() {
        if (this.isDestroyed) return;
        this.playbackValues = {};
    }

    async setupCanvas() {
        const logPrefix = `[CM L${this.layerId}] setupCanvas:`;
        if (!this.canvas || this.isDestroyed) {
            if (import.meta.env.DEV) console.warn(`${logPrefix} Aborted - canvas null or destroyed.`);
            this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false;
        }
        const parent = this.canvas.parentElement;
        if (!parent) {
            if (import.meta.env.DEV) console.warn(`${logPrefix} Aborted - no parent element.`);
            this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false;
        }

        const dprForBuffer = 1;

        const parentRectImmediate = parent.getBoundingClientRect();
        const currentLogicalWidth = Math.floor(parentRectImmediate.width);
        const currentLogicalHeight = Math.floor(parentRectImmediate.height);

        if (
            currentLogicalWidth === this.lastValidWidth &&
            currentLogicalHeight === this.lastValidHeight &&
            this.canvas.width === currentLogicalWidth &&
            this.canvas.height === currentLogicalHeight &&
            currentLogicalWidth > 0 && currentLogicalHeight > 0 &&
            this.lastDPR === dprForBuffer
        ) {
            return true;
        }

        let logicalWidth = currentLogicalWidth;
        let logicalHeight = currentLogicalHeight;

        if (logicalWidth <= 0 || logicalHeight <= 0) {
            let attempts = 0;
            const maxAttempts = SETUP_CANVAS_POLL_TIMEOUT / SETUP_CANVAS_POLL_INTERVAL;
            while (attempts < maxAttempts) {
                attempts++;
                if (!parent.isConnected) { if (import.meta.env.DEV) console.warn(`${logPrefix} Parent disconnected during poll.`); this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false; }
                const rect = parent.getBoundingClientRect();
                logicalWidth = Math.floor(rect.width);
                logicalHeight = Math.floor(rect.height);
                if (logicalWidth > 0 && logicalHeight > 0) break;
                await new Promise(resolve => setTimeout(resolve, SETUP_CANVAS_POLL_INTERVAL));
            }
        }

        if (logicalWidth <= 0 || logicalHeight <= 0) {
             if (import.meta.env.DEV) console.error(`${logPrefix} FAILED - Zero Dimensions after timeout/check (${logicalWidth}x${logicalHeight}).`);
             this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0;
             if (this.canvas && (this.canvas.width > 0 || this.canvas.height > 0)) { try { this.canvas.width = 0; this.canvas.height = 0; } catch(e) { if (import.meta.env.DEV) console.error(`${logPrefix} Error zeroing canvas w/h during failed setup:`, e); } }
             return false;
        }

        const targetRenderWidth = logicalWidth;
        const targetRenderHeight = logicalHeight;
        if (!this.canvas) { if (import.meta.env.DEV) console.error(`${logPrefix} Canvas became null unexpectedly during setup.`); this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false; }
        let resized = false;
        if (this.canvas.width !== targetRenderWidth || this.canvas.height !== targetRenderHeight) {
            try { this.canvas.width = targetRenderWidth; this.canvas.height = targetRenderHeight; resized = true; } catch(e) { if (import.meta.env.DEV) console.error(`${logPrefix} Error setting canvas buffer w/h:`, e); return false; }
        }

        if (this.canvas.style.width !== `${logicalWidth}px` || this.canvas.style.height !== `${logicalHeight}px`) {
             try { this.canvas.style.width = `${logicalWidth}px`; this.canvas.style.height = `${logicalHeight}px`; } catch (e) { if (import.meta.env.DEV) console.warn(`${logPrefix} Error setting canvas style w/h:`, e); }
        }

        if ((resized || this.ctx) && this.ctx) {
            try { this.ctx.setTransform(dprForBuffer, 0, 0, dprForBuffer, 0, 0); } catch (e) { if (import.meta.env.DEV) console.error(`${logPrefix} Context transform error:`, e); }
        }

        this.lastValidWidth = logicalWidth;
        this.lastValidHeight = logicalHeight;
        this.lastDPR = dprForBuffer;

        Object.keys(this.interpolators).forEach(key => {
            this.interpolators[key]?.snap(this.configA[key]);
        });
        return true;
    }

    applyFullConfig(newConfig) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        const mergedConfig = { ...defaultConfig };

        for (const key in defaultConfig) {
            if (Object.prototype.hasOwnProperty.call(defaultConfig, key)) {
                if (newConfig && Object.prototype.hasOwnProperty.call(newConfig, key) && newConfig[key] !== undefined && newConfig[key] !== null) {
                    mergedConfig[key] = this.validateValue(key, newConfig[key], defaultConfig[key]);
                } else {
                    mergedConfig[key] = defaultConfig[key];
                }
            }
        }
        if (!BLEND_MODES.includes(mergedConfig.blendMode)) { mergedConfig.blendMode = 'normal'; }

        this.configA = mergedConfig;
        
        this.continuousRotationAngleA = this.continuousRotationAngleB;
        this.driftStateA = { ...this.driftStateB };

        Object.keys(this.interpolators).forEach(key => {
            this.interpolators[key]?.snap(this.configA[key]);
        });
        
        this.handleEnabledToggle(this.configA.enabled);
    }
    
    validateValue(key, value, defaultValue) {
        let validated = value;
        const defaultValueType = typeof defaultValue;

        if (defaultValueType === 'number') {
            validated = Number(value);
            if (isNaN(validated)) validated = defaultValue;
            if (key === 'opacity') validated = Math.max(0, Math.min(1, validated));
            if (key === 'size') validated = Math.max(0.01, validated);
        } else if (defaultValueType === 'string') {
            validated = String(value);
            if (key === 'blendMode' && !BLEND_MODES.includes(validated)) {
                validated = defaultValue;
            }
        } else if (defaultValueType === 'boolean') {
            validated = Boolean(value);
        }
        return validated;
    }

    handleEnabledToggle(isEnabled) {
        if (isEnabled && !this.animationFrameId) {
            this.startAnimationLoop();
        } else if (!isEnabled && this.animationFrameId) {
            this.stopAnimationLoop();
            if (this.ctx && this.canvas?.width > 0 && this.canvas?.height > 0) {
                try { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
                catch (e) {
                    if (import.meta.env.DEV) {
                        console.error(`[CM L${this.layerId}] Error clearing canvas on disable:`, e);
                    }
                }
            }
        }
    }

    snapVisualProperty(key, value) {
        if (this.interpolators[key]?.isCurrentlyInterpolating()) {
            return;
        }

        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) return;

        const validatedValue = this.validateValue(key, value, defaultConfig[key]);
        this.configA[key] = validatedValue;

        if (this.interpolators[key]) {
            this.interpolators[key].snap(validatedValue);
        }

        if (key === 'blendMode' && this.canvas?.style) this.canvas.style.mixBlendMode = validatedValue || 'normal';
        else if (key === 'enabled') this.handleEnabledToggle(validatedValue);
    }
    
    updateConfigProperty(key, value) {
        this.snapVisualProperty(key, value);
    }

    updateConfigBProperty(key, value) {
        if (this.interpolatorsB[key]?.isCurrentlyInterpolating()) {
            return;
        }
        
        if (this.isDestroyed || !this.configB) return;
        const defaultConfig = this.getDefaultConfig();
        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) return;

        const validatedValue = this.validateValue(key, value, defaultConfig[key]);
        this.configB[key] = validatedValue;
        
        this.interpolatorsB[key]?.snap(validatedValue);
    }
    
    setTargetValue(param, targetValue) {
        if (this.isDestroyed) return;
        
        const validatedValue = this.validateValue(param, targetValue, this.configA[param]);
        
        this.configA[param] = validatedValue;
        
        const interpolator = this.interpolators[param];
        if (interpolator) {
            interpolator.setTarget(validatedValue);
        } else if (import.meta.env.DEV) {
            console.warn(`[CM L${this.layerId}] No interpolator found for parameter '${param}' in setTargetValue.`);
        }
    }

    setTargetValueB(param, targetValue) {
        if (this.isDestroyed || !this.configB) return;
        
        const validatedValue = this.validateValue(param, targetValue, this.configB[param]);
        
        this.configB[param] = validatedValue;
        
        const interpolator = this.interpolatorsB[param];
        if (interpolator) {
            interpolator.setTarget(validatedValue);
        } else if (import.meta.env.DEV) {
            console.warn(`[CM L${this.layerId}] No interpolator found for parameter '${param}' in setTargetValueB.`);
        }
    }

    startAnimationLoop() {
        if (this.isDestroyed || this.animationFrameId !== null) return;
        this.lastTimestamp = performance.now();
        this.deltaTimeBuffer = [];
        this.smoothedDeltaTime = 1 / 60;
        this.animationFrameId = requestAnimationFrame(this.animationLoop);
    }

    stopAnimationLoop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isDrawing = false;
    }

    async drawStaticFrame(configToUse = null) {
        if (this.isDestroyed || this.isDrawing) return false;
        const setupSuccess = await this.setupCanvas();
        if (!setupSuccess) return false;

        this.smoothedDeltaTime = 1 / 60;
        const currentConfig = configToUse || this.configA;

        Object.keys(this.interpolators).forEach(key => {
            this.interpolators[key]?.snap(currentConfig[key]);
        });
        this.continuousRotationAngleA = 0;
        this.continuousRotationAngleB = 0;

        return this.draw(performance.now());
    }

    async setImage(src) {
        if (this.isDestroyed) return Promise.reject(new Error("Manager destroyed"));
        
        if (!src || typeof src !== 'string') {
            this.imageA = null;
            this.lastImageSrc = null;
            return Promise.resolve();
        }

        if (src === this.lastImageSrc && this.imageA) {
            return Promise.resolve();
        }

        try {
            const decodedBitmap = await getDecodedImage(src);
            if (this.isDestroyed) return;
            if (decodedBitmap.width === 0 || decodedBitmap.height === 0) {
                this.imageA = null; this.lastImageSrc = null;
                throw new Error(`Loaded image bitmap has zero dimensions: ${src.substring(0, 100)}`);
            }
            this.imageA = decodedBitmap;
            this.lastImageSrc = src;
        } catch (error) {
            if (this.isDestroyed) return;
            this.imageA = null; this.lastImageSrc = null;
            console.error(`[CM L${this.layerId}] setImage failed:`, error.message);
            throw error;
        }
    }
    
    setAudioFrequencyFactor(factor) { if (this.isDestroyed) return; this.audioFrequencyFactor = Number(factor) || 1.0; }
    triggerBeatPulse(pulseFactor, duration) { if (this.isDestroyed) return; this.beatPulseFactor = Number(pulseFactor) || 1.0; this.beatPulseEndTime = performance.now() + (Number(duration) || 0); }
    resetAudioModifications() { if (this.isDestroyed) return; this.audioFrequencyFactor = 1.0; this.beatPulseFactor = 1.0; this.beatPulseEndTime = 0; }
    getConfigData() { return JSON.parse(JSON.stringify(this.configA)); }
    
    _drawFrame(image, frameConfig, continuousRotationAngle, driftState) {
        if (!image || !frameConfig) return;
    
        const fxConfig = frameConfig.fx;
        const activeFilterId = fxConfig?.activeFilter;
    
        if (activeFilterId && activeFilterId !== 'none') {
            const filterElement = document.getElementById(activeFilterId);
            
            if (filterElement) {
                if (activeFilterId === 'filter-datamosh') {
                    const displacementMap = filterElement.querySelector('feDisplacementMap');
                    if (displacementMap) {
                        const intensity = fxConfig.intensity || 0;
                        displacementMap.setAttribute('scale', String(intensity));
                    }
                }
                this.ctx.filter = `url(#${activeFilterId})`;
            } else {
                this.ctx.filter = 'none';
            }
        } else {
            this.ctx.filter = 'none';
        }

        const width = this.lastValidWidth; const height = this.lastValidHeight;
        const halfWidth = Math.floor(width / 2); const halfHeight = Math.floor(height / 2);
        const remainingWidth = width - halfWidth; const remainingHeight = height - halfHeight;
    
        const currentSize = frameConfig.size;
        const currentX = frameConfig.xaxis;
        const currentY = frameConfig.yaxis;
        const baseAngle = frameConfig.angle;
        
        const imgNaturalWidth = image.width; const imgNaturalHeight = image.height;
        const imgAspectRatio = (imgNaturalWidth > 0 && imgNaturalHeight > 0) ? imgNaturalWidth / imgNaturalHeight : 1;
    
        let finalDrawSize = currentSize * this.audioFrequencyFactor;
        const timestamp = performance.now();
        if (this.beatPulseEndTime && timestamp < this.beatPulseEndTime) {
            finalDrawSize *= this.beatPulseFactor;
        } else if (this.beatPulseEndTime && timestamp >= this.beatPulseEndTime) {
            this.beatPulseFactor = 1.0; this.beatPulseEndTime = 0;
        }
        finalDrawSize = Math.max(0.01, finalDrawSize);
    
        let imgDrawWidth = halfWidth * finalDrawSize;
        let imgDrawHeight = imgDrawWidth / imgAspectRatio;
        if (imgAspectRatio > 0 && imgDrawHeight > halfHeight * finalDrawSize) {
            imgDrawHeight = halfHeight * finalDrawSize; imgDrawWidth = imgDrawHeight * imgAspectRatio;
        } else if (isNaN(imgDrawHeight) || imgAspectRatio <= 0) {
            imgDrawWidth = halfWidth * finalDrawSize; imgDrawHeight = halfHeight * finalDrawSize;
        }
        imgDrawWidth = Math.max(1, Math.floor(imgDrawWidth));
        imgDrawHeight = Math.max(1, Math.floor(imgDrawHeight));
        
        const driftX = driftState?.x ?? 0;
        const driftY = driftState?.y ?? 0;
        
        const internalParallaxX = this.renderedParallaxOffset.x * this.internalParallaxFactor;
        const internalParallaxY = this.renderedParallaxOffset.y * this.internalParallaxFactor;

        const offsetX = currentX / 10;
        const offsetY = currentY / 10;
        
        const finalCenterX_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfWidth / 2 + offsetX + driftX + internalParallaxX));
        const finalCenterY_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfHeight / 2 + offsetY + driftY + internalParallaxY));

        const finalAngle = baseAngle + continuousRotationAngle;
        const angleRad = (finalAngle % 360) * Math.PI / 180;
    
        const drawImageWithRotation = () => {
             try {
                this.ctx.save();
                this.ctx.rotate(angleRad);
                if (image) {
                    this.ctx.drawImage(image, 0, 0, imgNaturalWidth, imgNaturalHeight, -imgDrawWidth / 2, -imgDrawHeight / 2, imgDrawWidth, imgDrawHeight);
                }
                this.ctx.restore();
            } catch (e) { if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] draw: drawImage error:`, e); }
        };
    
        this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(0,0,halfWidth,halfHeight); this.ctx.clip();
        this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
    
        this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(halfWidth,0,remainingWidth,halfHeight); this.ctx.clip();
        this.ctx.translate(width,0); this.ctx.scale(-1,1);
        this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
    
        this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(0,halfHeight,halfWidth,remainingHeight); this.ctx.clip();
        this.ctx.translate(0,height); this.ctx.scale(1,-1);
        this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
    
        this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(halfWidth,halfHeight,remainingWidth,remainingHeight); this.ctx.clip();
        this.ctx.translate(width,height); this.ctx.scale(-1,-1);
        this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
    }
    
    draw(timestamp) {
        if (this.isDestroyed || this.isDrawing || !this.canvas || !this.ctx || this.lastValidWidth <= 0 || this.lastValidHeight <= 0) {
            this.isDrawing = false;
            return false;
        }
        this.isDrawing = true;
    
        try {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
            if (this.isTransitioning && this.outgoingImage && this.outgoingConfig) {
                const elapsed = timestamp - this.transitionStartTime;
                const progress = Math.min(1.0, elapsed / this.transitionDuration);
                const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
    
                const imagesAreTheSame = this.outgoingImageSrc === this.lastImageSrc;
                const blendModesAreEqual = this.outgoingConfig.blendMode === this.configA.blendMode;
    
                if (imagesAreTheSame && blendModesAreEqual) {
                    this.canvas.style.mixBlendMode = this.configA.blendMode || "normal";
                    this.ctx.globalAlpha = 1.0;
                    
                    const morphedConfig = {};
                    for (const key in this.configA) {
                        const startVal = this.outgoingConfig[key];
                        const endVal = this.configA[key];
                        if (typeof startVal === 'number' && typeof endVal === 'number') {
                            morphedConfig[key] = lerp(startVal, endVal, easedProgress);
                        } else {
                            morphedConfig[key] = easedProgress < 0.5 ? startVal : endVal;
                        }
                    }
                    morphedConfig.fx = easedProgress < 0.5 ? this.outgoingConfig.fx : this.configA.fx;
                    
                    const morphedAngle = lerp(this.outgoingContinuousRotationAngle, this.continuousRotationAngleA, easedProgress);
                    const morphedDrift = {
                        x: lerp(this.outgoingDriftState.x, this.driftStateA.x, easedProgress),
                        y: lerp(this.outgoingDriftState.y, this.driftStateA.y, easedProgress),
                    };

                    if (this.configA.enabled && this.imageA) {
                         this._drawFrame(this.imageA, morphedConfig, morphedAngle, morphedDrift);
                    }
                } else if (blendModesAreEqual) {
                    this.canvas.style.mixBlendMode = this.configA.blendMode || "normal";
                    if (this.outgoingConfig.enabled) {
                        this.ctx.globalAlpha = (this.outgoingConfig.opacity || 1) * (1 - easedProgress);
                        if (this.ctx.globalAlpha > 0.001) {
                            this._drawFrame(this.outgoingImage, this.outgoingConfig, this.outgoingContinuousRotationAngle, this.outgoingDriftState);
                        }
                    }
                    if (this.configA.enabled && this.imageA) {
                        this.ctx.globalAlpha = (this.configA.opacity || 1) * easedProgress;
                        if (this.ctx.globalAlpha > 0.001) {
                            this._drawFrame(this.imageA, this.configA, this.continuousRotationAngleA, this.driftStateA);
                        }
                    }
                } else {
                    if (easedProgress < 0.5) {
                        const fadeOutProgress = easedProgress * 2;
                        this.canvas.style.mixBlendMode = this.outgoingConfig.blendMode || "normal";
                        this.ctx.globalAlpha = (this.outgoingConfig.opacity || 1) * (1 - fadeOutProgress);
                         if (this.outgoingConfig.enabled && this.outgoingImage && this.ctx.globalAlpha > 0.001) {
                            this._drawFrame(this.outgoingImage, this.outgoingConfig, this.outgoingContinuousRotationAngle, this.outgoingDriftState);
                        }
                    } else {
                        const fadeInProgress = (easedProgress - 0.5) * 2;
                        this.canvas.style.mixBlendMode = this.configA.blendMode || "normal";
                        this.ctx.globalAlpha = (this.configA.opacity || 1) * fadeInProgress;
                         if (this.configA.enabled && this.imageA && this.ctx.globalAlpha > 0.001) {
                            this._drawFrame(this.imageA, this.configA, this.continuousRotationAngleA, this.driftStateA);
                        }
                    }
                }
            } else if (this.crossfadeValue > 0.001 && this.imageB && this.configB) {
                const liveConfigA = { ...this.configA };
                for (const key in this.interpolators) liveConfigA[key] = this.playbackValues[key] ?? this.interpolators[key].getCurrentValue();
                const liveConfigB = { ...this.configB };
                for (const key in this.interpolatorsB) liveConfigB[key] = this.interpolatorsB[key].getCurrentValue();
                const t = this.crossfadeValue;
                const blendModesAreDifferent = liveConfigA.blendMode !== liveConfigB.blendMode;
                const morphedConfig = {};
                sliderParams.forEach(param => {
                    const valA = liveConfigA[param.prop];
                    const valB = liveConfigB[param.prop];
                    if (typeof valA === 'number' && typeof valB === 'number') morphedConfig[param.prop] = lerp(valA, valB, t);
                    else morphedConfig[param.prop] = t < 0.5 ? valA : valB;
                });
                morphedConfig.fx = {
                    activeFilter: t < 0.5 ? liveConfigA.fx?.activeFilter : liveConfigB.fx?.activeFilter,
                    intensity: lerp(liveConfigA.fx?.intensity || 0, liveConfigB.fx?.intensity || 0, t)
                };
                const interpolatedAngle = lerp(this.continuousRotationAngleA, this.continuousRotationAngleB, t);
                const interpolatedDrift = { x: lerp(this.driftStateA.x, this.driftStateB.x, t), y: lerp(this.driftStateA.y, this.driftStateB.y, t) };
                if (blendModesAreDifferent) {
                    if (t < 0.5) {
                        const progress = 1 - t * 2;
                        this.canvas.style.mixBlendMode = liveConfigA.blendMode;
                        this.ctx.globalAlpha = (liveConfigA.opacity ?? 1.0) * progress;
                        if (this.imageA && liveConfigA.enabled && this.ctx.globalAlpha > 0.001) this._drawFrame(this.imageA, morphedConfig, interpolatedAngle, interpolatedDrift);
                    } else {
                        const progress = (t - 0.5) * 2;
                        this.canvas.style.mixBlendMode = liveConfigB.blendMode;
                        this.ctx.globalAlpha = (liveConfigB.opacity ?? 1.0) * progress;
                        if (this.imageB && liveConfigB.enabled && this.ctx.globalAlpha > 0.001) this._drawFrame(this.imageB, morphedConfig, interpolatedAngle, interpolatedDrift);
                    }
                } else {
                    this.canvas.style.mixBlendMode = liveConfigA.blendMode;
                    if (this.imageA && liveConfigA.enabled) {
                        this.ctx.globalAlpha = (liveConfigA.opacity ?? 1.0) * (1 - t);
                        if (this.ctx.globalAlpha > 0.001) this._drawFrame(this.imageA, morphedConfig, interpolatedAngle, interpolatedDrift);
                    }
                    if (this.imageB && liveConfigB.enabled) {
                        this.ctx.globalAlpha = (liveConfigB.opacity ?? 1.0) * t;
                        if (this.ctx.globalAlpha > 0.001) this._drawFrame(this.imageB, morphedConfig, interpolatedAngle, interpolatedDrift);
                    }
                }
            } else {
                const liveConfigA = { ...this.configA };
                for (const key in this.interpolators) liveConfigA[key] = this.playbackValues[key] ?? this.interpolators[key].getCurrentValue();
                if (liveConfigA.enabled && this.imageA) {
                    this.canvas.style.mixBlendMode = liveConfigA.blendMode || "normal";
                    this.ctx.globalAlpha = liveConfigA.opacity ?? 1.0;
                    if (this.ctx.globalAlpha > 0.001) this._drawFrame(this.imageA, liveConfigA, this.continuousRotationAngleA, this.driftStateA);
                }
            }

            this.ctx.globalAlpha = 1.0;
            this.isDrawing = false;
            return true;
        } catch (e) {
            if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] draw: Unexpected draw error:`, e);
            this.isDrawing = false;
            return false;
        } finally {
            if (this.ctx) this.ctx.filter = 'none';
        }
    }
    
    _updateInternalDrift(config, driftState, deltaTime) {
        if (!config || !driftState) return;
        const driftAmount = config.drift;
        const driftSpeed = config.driftSpeed;

        if(driftAmount > 0){
            if(typeof driftState.phase !== "number" || isNaN(driftState.phase)) driftState.phase = Math.random() * Math.PI * 2;
            driftState.phase += deltaTime * driftSpeed * 1.0;
            const calculatedX = Math.sin(driftState.phase) * driftAmount * 1.5;
            const calculatedY = Math.cos(driftState.phase * 0.7 + Math.PI / 4) * driftAmount * 1.5;
            driftState.x = Math.max(-MAX_TOTAL_OFFSET / 2, Math.min(MAX_TOTAL_OFFSET / 2, calculatedX));
            driftState.y = Math.max(-MAX_TOTAL_OFFSET / 2, Math.min(MAX_TOTAL_OFFSET / 2, calculatedY));
        } else {
            const LERP_FACTOR = 0.05;
            driftState.x = lerp(driftState.x, 0, LERP_FACTOR);
            driftState.y = lerp(driftState.y, 0, LERP_FACTOR);
            if (Math.abs(driftState.x) < 0.01) driftState.x = 0;
            if (Math.abs(driftState.y) < 0.01) driftState.y = 0;
        }
    }

    animationLoop(timestamp) {
        if (this.isDestroyed || this.animationFrameId === null) return;
        this.animationFrameId = requestAnimationFrame(this.animationLoop);

        const isAnySideEnabled = this.configA?.enabled || (this.configB?.enabled && this.crossfadeValue > 0);
        if (!isAnySideEnabled && !this.isTransitioning) {
            if (this.ctx && this.canvas) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
            return;
        }

        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        const elapsed = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;

        const rawDeltaTime = Math.min(elapsed / 1000.0, MAX_DELTA_TIME);

        this.deltaTimeBuffer.push(rawDeltaTime);
        if (this.deltaTimeBuffer.length > DELTA_TIME_BUFFER_SIZE) this.deltaTimeBuffer.shift();
        this.smoothedDeltaTime = this.deltaTimeBuffer.reduce((a,b) => a+b,0) / this.deltaTimeBuffer.length;

        if (this.lastValidWidth <= 0 || this.lastValidHeight <= 0 || !this.canvas || !this.ctx) {
            this.setupCanvas().then(setupOk => { if (setupOk) this.draw(timestamp); });
            return;
        }

        const now = performance.now();
        for (const key in this.interpolators) {
            this.interpolators[key].update(now);
        }
        for (const key in this.interpolatorsB) {
            this.interpolatorsB[key].update(now);
        }

        const parallaxLerpFactor = 0.05;
        this.renderedParallaxOffset.x = lerp(this.renderedParallaxOffset.x, this.parallaxOffset.x, parallaxLerpFactor);
        this.renderedParallaxOffset.y = lerp(this.renderedParallaxOffset.y, this.parallaxOffset.y, parallaxLerpFactor);

        if (this.canvas) {
            const parallaxX = this.renderedParallaxOffset.x * this.parallaxFactor;
            const parallaxY = this.renderedParallaxOffset.y * this.parallaxFactor;
            this.canvas.style.transform = `translate(${parallaxX}px, ${parallaxY}px) scale(1)`;
        }

        if (this.configA) {
            const speedA = this.playbackValues.speed ?? this.interpolators.speed.getCurrentValue();
            const directionA = this.configA.direction ?? 1;
            const angleDeltaA = speedA * directionA * this.smoothedDeltaTime * 600;
            this.continuousRotationAngleA = (this.continuousRotationAngleA + angleDeltaA) % 360;
            this._updateInternalDrift(this.configA, this.driftStateA, this.smoothedDeltaTime);
        }

        if (this.configB) {
            const speedB = this.interpolatorsB.speed.getCurrentValue();
            const directionB = this.configB.direction ?? 1;
            const angleDeltaB = speedB * directionB * this.smoothedDeltaTime * 600;
            this.continuousRotationAngleB = (this.continuousRotationAngleB + angleDeltaB) % 360;
            this._updateInternalDrift(this.configB, this.driftStateB, this.smoothedDeltaTime);
        }

        this.draw(timestamp);
    }

    async forceRedraw(configToUse = null) {
        if (this.isDestroyed || this.isDrawing) return false;
        return this.drawStaticFrame(configToUse || this.configA);
    }

    destroy() {
        this.isDestroyed = true;
        this.stopAnimationLoop();
        this.imageA?.close();
        this.imageB?.close();
        this.imageA = null;
        this.imageB = null;
        this.ctx = null;
        this.canvas = null;
        this.deltaTimeBuffer = [];
        this.interpolators = {};
        this.interpolatorsB = {};
        this.playbackValues = {};
        this.lastDPR = 0;
        this.lastValidWidth = 0;
        this.lastValidHeight = 0;
        if (import.meta.env.DEV) console.log(`[CM L${this.layerId}] Destroyed.`);
    }
}
export default CanvasManager;