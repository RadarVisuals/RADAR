// src/utils/CanvasManager.js
import { BLEND_MODES } from '../config/global-config';
import ValueInterpolator from './ValueInterpolator';
import { sliderParams } from '../config/sliderParams';
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
    canvasA = null;
    ctxA = null;
    canvasB = null;
    ctxB = null;
    layerId;
    imageA = null;
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

    imageB = null;
    configB = null;
    crossfadeValue = 0.0;

    parallaxOffset = { x: 0, y: 0 };
    renderedParallaxOffset = { x: 0, y: 0 };
    parallaxFactor = 1;
    internalParallaxFactor = 0;

    tokenA_id = null;
    tokenB_id = null;

    constructor(canvasA, canvasB, layerId) {
        if (!canvasA || !(canvasA instanceof HTMLCanvasElement) || !canvasB || !(canvasB instanceof HTMLCanvasElement)) {
            throw new Error(`[CM L${layerId}] Invalid canvas elements provided.`);
        }
        this.canvasA = canvasA;
        this.canvasB = canvasB;
        this.layerId = layerId;

        try {
            // --- START: FIX FOR PRE-MULTIPLIED ALPHA ---
            // Create the context with premultipliedAlpha set to true. This aligns the canvas
            // drawing with the browser's compositing engine, preventing opacity dips during CSS fades.
            const contextOptions = { alpha: true, willReadFrequently: false, premultipliedAlpha: true };
            this.ctxA = canvasA.getContext('2d', contextOptions);
            this.ctxB = canvasB.getContext('2d', contextOptions);
            // --- END: FIX FOR PRE-MULTIPLIED ALPHA ---

            if (!this.ctxA || !this.ctxB) throw new Error(`Failed to get 2D context for Layer ${layerId}`);
        } catch (e) {
            if (import.meta.env.DEV) console.error(`[CM L${layerId}] Error getting context:`, e);
            throw new Error(`Failed to get 2D context for Layer ${layerId}: ${e.message}`);
        }

        if (layerId === '1') { this.parallaxFactor = 10; this.internalParallaxFactor = 10; }
        if (layerId === '2') { this.parallaxFactor = 25; this.internalParallaxFactor = 20; }
        if (layerId === '3') { this.parallaxFactor = 50; this.internalParallaxFactor = 30; }

        this.configA = this.getDefaultConfig();
        this.configB = this.getDefaultConfig();
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

    async setCrossfadeTarget(imageSrc, config, tokenId) {
        if (this.isDestroyed) throw new Error("Manager destroyed");
        this.tokenB_id = tokenId || null;
        if (!imageSrc || typeof imageSrc !== 'string') {
            this.imageB = null; this.configB = config || this.getDefaultConfig();
            return;
        }
        try {
            const decodedBitmap = await getDecodedImage(imageSrc);
            if (this.isDestroyed) return;
            if (decodedBitmap.width === 0 || decodedBitmap.height === 0) {
                 this.imageB = null; this.configB = config || this.getDefaultConfig();
                 throw new Error(`Loaded crossfade image bitmap has zero dimensions: ${imageSrc.substring(0, 100)}`);
            }
            this.imageB = decodedBitmap;
            this.configB = config || this.getDefaultConfig();
            this.continuousRotationAngleB = 0;
            this.driftStateB = { x: 0, y: 0, phase: Math.random() * Math.PI * 2 };
            Object.keys(this.interpolatorsB).forEach(key => {
                const interpolator = this.interpolatorsB[key];
                const value = this.configB?.[key];
                if (interpolator && value !== undefined) interpolator.snap(value);
            });
        } catch (error) {
            if (this.isDestroyed) throw new Error("Manager destroyed during crossfade image load");
            this.imageB = null; this.configB = config || this.getDefaultConfig();
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
        const canvases = [this.canvasA, this.canvasB];
        for (const canvas of canvases) {
            if (!canvas || this.isDestroyed) continue;
            const parent = canvas.parentElement;
            if (!parent) continue;

            const dprForBuffer = 1;
            const parentRect = parent.getBoundingClientRect();
            let logicalWidth = Math.floor(parentRect.width);
            let logicalHeight = Math.floor(parentRect.height);

            if (logicalWidth <= 0 || logicalHeight <= 0) {
                await new Promise(resolve => setTimeout(resolve, 50)); // Wait a bit for layout
                const newRect = parent.getBoundingClientRect();
                logicalWidth = Math.floor(newRect.width);
                logicalHeight = Math.floor(newRect.height);
            }

            if (logicalWidth <= 0 || logicalHeight <= 0) {
                if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] FAILED - Zero Dimensions for canvas.`);
                continue;
            }

            const targetRenderWidth = logicalWidth;
            const targetRenderHeight = logicalHeight;

            if (canvas.width !== targetRenderWidth || canvas.height !== targetRenderHeight) {
                canvas.width = targetRenderWidth;
                canvas.height = targetRenderHeight;
            }
            if (canvas.style.width !== `${logicalWidth}px` || canvas.style.height !== `${logicalHeight}px`) {
                canvas.style.width = `${logicalWidth}px`;
                canvas.style.height = `${logicalHeight}px`;
            }
            const ctx = canvas === this.canvasA ? this.ctxA : this.ctxB;
            if (ctx) ctx.setTransform(dprForBuffer, 0, 0, dprForBuffer, 0, 0);
        }
        this.lastValidWidth = this.canvasA.width;
        this.lastValidHeight = this.canvasA.height;
        return this.lastValidWidth > 0 && this.lastValidHeight > 0;
    }

    applyFullConfig(newConfig) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        const mergedConfig = { ...defaultConfig, ...(newConfig || {}) };
        if (!BLEND_MODES.includes(mergedConfig.blendMode)) mergedConfig.blendMode = 'normal';
        this.configA = mergedConfig;
        this.continuousRotationAngleA = 0;
        this.driftStateA = newConfig?.driftState || { x: 0, y: 0, phase: Math.random() * Math.PI * 2 };
        Object.keys(this.interpolators).forEach(key => this.interpolators[key]?.snap(this.configA[key]));
        this.handleEnabledToggle(this.configA.enabled);
    }

    validateValue(key, value, defaultValue) {
        let validated = value;
        const defaultValueType = typeof defaultValue;
        if (defaultValueType === 'number') {
            validated = Number(value);
            if (isNaN(validated)) validated = defaultValue;
        } else if (defaultValueType === 'string') {
            validated = String(value);
            if (key === 'blendMode' && !BLEND_MODES.includes(validated)) validated = defaultValue;
        } else if (defaultValueType === 'boolean') {
            validated = Boolean(value);
        }
        return validated;
    }

    handleEnabledToggle(isEnabled) {
        if (isEnabled && !this.animationFrameId) this.startAnimationLoop();
        else if (!isEnabled && this.animationFrameId) {
            this.stopAnimationLoop();
            if (this.ctxA && this.canvasA) this.ctxA.clearRect(0, 0, this.canvasA.width, this.canvasA.height);
            if (this.ctxB && this.canvasB) this.ctxB.clearRect(0, 0, this.canvasB.width, this.canvasB.height);
        }
    }

    updateConfigProperty(key, value) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) return;
        const validatedValue = this.validateValue(key, value, defaultConfig[key]);
        this.configA[key] = validatedValue;
        if (this.interpolators[key]) this.interpolators[key].snap(validatedValue);
        if (key === 'enabled') this.handleEnabledToggle(validatedValue);
    }

    updateConfigBProperty(key, value) {
        if (this.isDestroyed || !this.configB) return;
        const defaultConfig = this.getDefaultConfig();
        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) return;
        const validatedValue = this.validateValue(key, value, defaultConfig[key]);
        this.configB[key] = validatedValue;
        if (this.interpolatorsB[key]) this.interpolatorsB[key].snap(validatedValue);
    }

    setTargetValue(param, targetValue) {
        if (this.isDestroyed) return;
        const validatedValue = this.validateValue(param, targetValue, this.configA[param]);
        this.configA[param] = validatedValue;
        if (this.interpolators[param]) this.interpolators[param].setTarget(validatedValue);
    }

    setTargetValueB(param, targetValue) {
        if (this.isDestroyed || !this.configB) return;
        const validatedValue = this.validateValue(param, targetValue, this.configB[param]);
        this.configB[param] = validatedValue;
        if (this.interpolatorsB[param]) this.interpolatorsB[param].setTarget(validatedValue);
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

    async setImage(src, tokenId) {
        if (this.isDestroyed) return Promise.reject(new Error("Manager destroyed"));
        this.tokenA_id = tokenId || null;
        if (!src || typeof src !== 'string') {
            this.imageA = null; this.lastImageSrc = null;
            return Promise.resolve();
        }
        if (src === this.lastImageSrc && this.imageA) return Promise.resolve();
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

    _drawFrame(ctx, image, frameConfig, continuousRotationAngle, driftState) {
        if (!ctx || !image || !frameConfig) return;
        const { width, height } = ctx.canvas;
        const halfWidth = Math.floor(width / 2); const halfHeight = Math.floor(height / 2);
        const remainingWidth = width - halfWidth; const remainingHeight = height - halfHeight;
        const { size, xaxis, yaxis, angle } = frameConfig;
        const { width: imgNaturalWidth, height: imgNaturalHeight } = image;
        const imgAspectRatio = (imgNaturalWidth > 0 && imgNaturalHeight > 0) ? imgNaturalWidth / imgNaturalHeight : 1;
        let finalDrawSize = size * this.audioFrequencyFactor;
        if (this.beatPulseEndTime && performance.now() < this.beatPulseEndTime) finalDrawSize *= this.beatPulseFactor;
        else if (this.beatPulseEndTime) { this.beatPulseFactor = 1.0; this.beatPulseEndTime = 0; }
        finalDrawSize = Math.max(0.01, finalDrawSize);
        let imgDrawWidth = halfWidth * finalDrawSize;
        let imgDrawHeight = imgDrawWidth / imgAspectRatio;
        if (imgAspectRatio > 0 && imgDrawHeight > halfHeight * finalDrawSize) {
            imgDrawHeight = halfHeight * finalDrawSize; imgDrawWidth = imgDrawHeight * imgAspectRatio;
        }
        imgDrawWidth = Math.max(1, Math.floor(imgDrawWidth));
        imgDrawHeight = Math.max(1, Math.floor(imgDrawHeight));
        const driftX = driftState?.x ?? 0; const driftY = driftState?.y ?? 0;
        const internalParallaxX = this.renderedParallaxOffset.x * this.internalParallaxFactor;
        const internalParallaxY = this.renderedParallaxOffset.y * this.internalParallaxFactor;
        const offsetX = xaxis / 10; const offsetY = yaxis / 10;
        const finalCenterX_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfWidth / 2 + offsetX + driftX + internalParallaxX));
        const finalCenterY_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfHeight / 2 + offsetY + internalParallaxY));
        const finalAngle = angle + continuousRotationAngle;
        const angleRad = (finalAngle % 360) * Math.PI / 180;
        const drawImageWithRotation = () => {
            ctx.save();
            ctx.rotate(angleRad);
            ctx.drawImage(image, 0, 0, imgNaturalWidth, imgNaturalHeight, -imgDrawWidth / 2, -imgDrawHeight / 2, imgDrawWidth, imgDrawHeight);
            ctx.restore();
        };
        ctx.save(); ctx.beginPath(); ctx.rect(0,0,halfWidth,halfHeight); ctx.clip();
        ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(halfWidth,0,remainingWidth,halfHeight); ctx.clip();
        ctx.translate(width,0); ctx.scale(-1,1);
        ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(0,halfHeight,halfWidth,remainingHeight); ctx.clip();
        ctx.translate(0,height); ctx.scale(1,-1);
        ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(halfWidth,halfHeight,remainingWidth,remainingHeight); ctx.clip();
        ctx.translate(width,height); ctx.scale(-1,-1);
        ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); ctx.restore();
    }

    draw() {
        if (this.isDestroyed || this.isDrawing || !this.canvasA || !this.ctxA || !this.canvasB || !this.ctxB || this.lastValidWidth <= 0) {
            this.isDrawing = false;
            return false;
        }
        this.isDrawing = true;
        try {
            this.ctxA.clearRect(0, 0, this.canvasA.width, this.canvasA.height);
            this.ctxB.clearRect(0, 0, this.canvasB.width, this.canvasB.height);
            const t = this.crossfadeValue;
            const liveConfigA = { ...this.configA };
            const liveConfigB = { ...this.configB };
            for (const key in this.interpolators) liveConfigA[key] = this.playbackValues[key] ?? this.interpolators[key].getCurrentValue();
            if (liveConfigB) for (const key in this.interpolatorsB) liveConfigB[key] = this.interpolatorsB[key].getCurrentValue();
            
            const morphedConfig = { ...liveConfigA };
            const morphedDrift = { ...this.driftStateA };
            let morphedAngle = this.continuousRotationAngleA;

            if (liveConfigA && liveConfigB) {
                for (const key in liveConfigA) {
                    if (typeof liveConfigA[key] === 'number' && typeof liveConfigB[key] === 'number') {
                        morphedConfig[key] = lerp(liveConfigA[key], liveConfigB[key], t);
                    }
                }
                morphedDrift.x = lerp(this.driftStateA.x, this.driftStateB.x, t);
                morphedDrift.y = lerp(this.driftStateA.y, this.driftStateB.y, t);
                let angleA = this.continuousRotationAngleA;
                let angleB = this.continuousRotationAngleB;
                if (angleB - angleA > 180) angleA += 360;
                else if (angleB - angleA < -180) angleA -= 360;
                morphedAngle = lerp(angleA, angleB, t);
            }

            if (this.imageA && liveConfigA?.enabled) {
                this._drawFrame(this.ctxA, this.imageA, morphedConfig, morphedAngle, morphedDrift);
            }
            if (this.imageB && liveConfigB?.enabled) {
                this._drawFrame(this.ctxB, this.imageB, morphedConfig, morphedAngle, morphedDrift);
            }

        } catch (e) {
            if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] draw: Unexpected draw error:`, e);
        } finally {
            this.isDrawing = false;
        }
        return true;
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
        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        const elapsed = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;
        const rawDeltaTime = Math.min(elapsed / 1000.0, MAX_DELTA_TIME);
        this.deltaTimeBuffer.push(rawDeltaTime);
        if (this.deltaTimeBuffer.length > DELTA_TIME_BUFFER_SIZE) this.deltaTimeBuffer.shift();
        this.smoothedDeltaTime = this.deltaTimeBuffer.reduce((a,b) => a+b,0) / this.deltaTimeBuffer.length;
        if (this.lastValidWidth <= 0 || this.lastValidHeight <= 0) {
            this.setupCanvas().then(setupOk => { if (setupOk) this.draw(); });
            return;
        }
        const now = performance.now();
        for (const key in this.interpolators) this.interpolators[key].update(now);
        for (const key in this.interpolatorsB) this.interpolatorsB[key].update(now);
        const parallaxLerpFactor = 0.05;
        this.renderedParallaxOffset.x = lerp(this.renderedParallaxOffset.x, this.parallaxOffset.x, parallaxLerpFactor);
        this.renderedParallaxOffset.y = lerp(this.renderedParallaxOffset.y, this.parallaxOffset.y, parallaxLerpFactor);
        const parallaxX = this.renderedParallaxOffset.x * this.parallaxFactor;
        const parallaxY = this.renderedParallaxOffset.y * this.parallaxFactor;
        const transformStyle = `translate(${parallaxX}px, ${parallaxY}px) scale(1)`;
        if (this.canvasA) this.canvasA.style.transform = transformStyle;
        if (this.canvasB) this.canvasB.style.transform = transformStyle;
        if (this.configA) {
            const speedA = this.playbackValues.speed ?? this.interpolators.speed.getCurrentValue();
            const directionA = this.configA.direction ?? 1;
            this.continuousRotationAngleA = (this.continuousRotationAngleA + (speedA * directionA * this.smoothedDeltaTime * 600)) % 360;
            this._updateInternalDrift(this.configA, this.driftStateA, this.smoothedDeltaTime);
        }
        if (this.configB) {
            const speedB = this.interpolatorsB.speed.getCurrentValue();
            const directionB = this.configB.direction ?? 1;
            this.continuousRotationAngleB = (this.continuousRotationAngleB + (speedB * directionB * this.smoothedDeltaTime * 600)) % 360;
            this._updateInternalDrift(this.configB, this.driftStateB, this.smoothedDeltaTime);
        }
        this.draw();
    }

    destroy() {
        this.isDestroyed = true;
        this.stopAnimationLoop();
        this.imageA?.close();
        this.imageB?.close();
        this.imageA = null; this.imageB = null;
        this.ctxA = null; this.ctxB = null;
        this.canvasA = null; this.canvasB = null;
        if (import.meta.env.DEV) console.log(`[CM L${this.layerId}] Destroyed.`);
    }
}
export default CanvasManager;