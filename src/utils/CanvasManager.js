// src/utils/CanvasManager.js
import { BLEND_MODES } from '../config/global-config';
import ValueInterpolator from './ValueInterpolator';
import { sliderParams } from '../components/Panels/EnhancedControlPanel'; // Import slider definitions

const SETUP_CANVAS_POLL_INTERVAL = 100;
const SETUP_CANVAS_POLL_TIMEOUT = 3000;
const MAX_TOTAL_OFFSET = 10000;
const DELTA_TIME_BUFFER_SIZE = 5;
const MIDI_INTERPOLATION_DURATION = 80; // A single duration for all MIDI-driven parameter smoothing

class CanvasManager {
    canvas = null;
    ctx = null;
    layerId;
    image = null;
    config;
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

    continuousRotationAngle = 0;
    audioFrequencyFactor = 1.0;
    beatPulseFactor = 1.0;
    beatPulseEndTime = 0;

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
        this.config = this.getDefaultConfig();
        this.lastDPR = 1;

        this.interpolators = {};
        sliderParams.forEach(param => {
            const initialValue = this.config[param.prop] ?? param.defaultValue ?? 0;
            this.interpolators[param.prop] = new ValueInterpolator(initialValue, MIDI_INTERPOLATION_DURATION);
        });

        this.animationLoop = this.animationLoop.bind(this);
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
        defaultConfig.driftState = { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false };
        return defaultConfig;
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
            this.interpolators[key]?.snap(this.config[key]);
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
        mergedConfig.driftState.enabled = (mergedConfig.drift || 0) > 0;
        if (!mergedConfig.driftState.enabled) {
            mergedConfig.driftState.x = 0;
            mergedConfig.driftState.y = 0;
        }
        this.config = mergedConfig;
        if (this.canvas?.style) this.canvas.style.mixBlendMode = this.config.blendMode || "normal";
        
        Object.keys(this.interpolators).forEach(key => {
            this.interpolators[key]?.snap(this.config[key]);
        });
        this.continuousRotationAngle = 0;
        this.handleEnabledToggle(this.config.enabled);
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
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) return;

        const validatedValue = this.validateValue(key, value, defaultConfig[key]);
        this.config[key] = validatedValue;

        if (this.interpolators[key]) {
            this.interpolators[key].snap(validatedValue);
        }

        if (key === 'blendMode' && this.canvas?.style) this.canvas.style.mixBlendMode = validatedValue || 'normal';
        else if (key === 'drift') {
            if (!this.config.driftState) this.config.driftState = { x:0,y:0,phase:Math.random()*Math.PI*2,enabled:false };
            this.config.driftState.enabled = validatedValue > 0;
            if (!this.config.driftState.enabled) { this.config.driftState.x = 0; this.config.driftState.y = 0; }
        } else if (key === 'enabled') this.handleEnabledToggle(validatedValue);
    }

    updateConfigProperty(key, value) {
        this.snapVisualProperty(key, value);
    }
    
    startAnimationLoop() {
        if (this.isDestroyed || this.animationFrameId !== null || !this.config.enabled) return;
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
        const currentConfig = configToUse || this.config;

        Object.keys(this.interpolators).forEach(key => {
            this.interpolators[key]?.snap(currentConfig[key]);
        });
        this.continuousRotationAngle = 0;

        return this.draw(performance.now(), currentConfig);
    }

    async setImage(src) {
        if (this.isDestroyed) return Promise.reject(new Error("Manager destroyed"));
        return new Promise((resolve, reject) => {
            if (!src || typeof src !== 'string') {
                this.image = null; this.lastImageSrc = null;
                return reject(new Error("Invalid image source"));
            }
            if (src === this.lastImageSrc && this.image?.complete && this.image?.naturalWidth > 0) {
                return resolve();
            }

            const img = new Image();
            if (src.startsWith('http') && !src.startsWith(window.location.origin)) {
                img.crossOrigin = "anonymous";
            }
            img.onload = () => {
                if (this.isDestroyed) return resolve();
                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                    this.image = null; this.lastImageSrc = null;
                    reject(new Error(`Loaded image has zero dimensions: ${src.substring(0, 100)}`)); return;
                }
                this.image = img; this.lastImageSrc = src;
                resolve();
            };
            img.onerror = (errEvent) => {
                if (this.isDestroyed) return reject(new Error("Manager destroyed during image load error"));
                this.image = null; this.lastImageSrc = null;
                const errorMsg = typeof errEvent === 'string' ? errEvent : (errEvent?.type || 'Unknown image load error');
                reject(new Error(`Failed to load image: ${src.substring(0, 50)}... Error: ${errorMsg}`));
            };
            img.src = src;
        });
    }

    setTargetValue(param, targetValue) {
        if (this.isDestroyed) return;
        const validatedValue = Number(targetValue);
        if (isNaN(validatedValue)) return;
        
        const interpolator = this.interpolators[param];
        if (interpolator) {
            this.config[param] = validatedValue;
            interpolator.setTarget(validatedValue);
        } else if (import.meta.env.DEV) {
            console.warn(`[CM L${this.layerId}] No interpolator found for parameter '${param}' in setTargetValue.`);
        }
    }
    
    setAudioFrequencyFactor(factor) { if (this.isDestroyed) return; this.audioFrequencyFactor = Number(factor) || 1.0; }
    triggerBeatPulse(pulseFactor, duration) { if (this.isDestroyed) return; this.beatPulseFactor = Number(pulseFactor) || 1.0; this.beatPulseEndTime = performance.now() + (Number(duration) || 0); }
    resetAudioModifications() { if (this.isDestroyed) return; this.audioFrequencyFactor = 1.0; this.beatPulseFactor = 1.0; this.beatPulseEndTime = 0; }
    getConfigData() { return JSON.parse(JSON.stringify(this.config)); }

    draw(timestamp, configToUse = null) {
        const currentConfig = configToUse || this.config;
        if (this.isDestroyed || !currentConfig?.enabled || this.isDrawing || !this.canvas || !this.ctx || !this.image || !this.image.complete || this.image.naturalWidth === 0 || this.lastValidWidth <= 0 || this.lastValidHeight <= 0) {
            this.isDrawing = false; return false;
        }
        this.isDrawing = true;

        try {
            const width = this.lastValidWidth; const height = this.lastValidHeight;
            const halfWidth = Math.floor(width / 2); const halfHeight = Math.floor(height / 2);
            const remainingWidth = width - halfWidth; const remainingHeight = height - halfHeight;

            const currentSize = this.interpolators.size.getCurrentValue();
            const currentOpacity = this.interpolators.opacity.getCurrentValue();
            const currentX = this.interpolators.xaxis.getCurrentValue();
            const currentY = this.interpolators.yaxis.getCurrentValue();
            const baseAngle = this.interpolators.angle.getCurrentValue();
            
            const imgNaturalWidth = this.image.naturalWidth; const imgNaturalHeight = this.image.naturalHeight;
            const imgAspectRatio = (imgNaturalWidth > 0 && imgNaturalHeight > 0) ? imgNaturalWidth / imgNaturalHeight : 1;

            let finalDrawSize = currentSize * this.audioFrequencyFactor;
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

            this.updateDrift(currentConfig, this.smoothedDeltaTime);
            const driftX = currentConfig.driftState?.x ?? 0;
            const driftY = currentConfig.driftState?.y ?? 0;
            
            const offsetX = currentX / 10;
            const offsetY = currentY / 10;
            const finalAngle = baseAngle + this.continuousRotationAngle;
            const angleRad = (finalAngle % 360) * Math.PI / 180;

            const finalCenterX_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfWidth / 2 + offsetX + driftX));
            const finalCenterY_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfHeight / 2 + offsetY + driftY));

            try { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
            catch (e) { if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] draw: Error clearing canvas:`, e); this.isDrawing = false; return false; }

            this.ctx.globalAlpha = currentOpacity;

            const drawImageWithRotation = () => {
                 try {
                    this.ctx.save();
                    this.ctx.rotate(angleRad);
                    if (this.image?.complete && this.image?.naturalWidth > 0) {
                        this.ctx.drawImage(this.image, 0, 0, imgNaturalWidth, imgNaturalHeight, -imgDrawWidth / 2, -imgDrawHeight / 2, imgDrawWidth, imgDrawHeight);
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

            this.ctx.globalAlpha = 1.0;
            this.isDrawing = false;
            return true;
        } catch (e) {
            if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] draw: Unexpected draw error:`, e);
            this.isDrawing = false;
            return false;
        }
    }

    updateDrift(config, deltaTime) {
        if (!config?.driftState) return;
        const {driftState} = config;
        const driftAmount = this.interpolators.drift.getCurrentValue();
        const driftSpeed = this.interpolators.driftSpeed.getCurrentValue();

        if(driftAmount > 0 && driftState.enabled){
            if(typeof driftState.phase !== "number" || isNaN(driftState.phase)) driftState.phase = Math.random() * Math.PI * 2;
            driftState.phase += deltaTime * driftSpeed * 1.0;
            const calculatedX = Math.sin(driftState.phase) * driftAmount * 1.5;
            const calculatedY = Math.cos(driftState.phase * 0.7 + Math.PI / 4) * driftAmount * 1.5;
            driftState.x = Math.max(-MAX_TOTAL_OFFSET / 2, Math.min(MAX_TOTAL_OFFSET / 2, calculatedX));
            driftState.y = Math.max(-MAX_TOTAL_OFFSET / 2, Math.min(MAX_TOTAL_OFFSET / 2, calculatedY));
        } else {
            driftState.x = 0;
            driftState.y = 0;
        }
    }

    animationLoop(timestamp) {
        if (this.isDestroyed || this.animationFrameId === null) return;
        this.animationFrameId = requestAnimationFrame(this.animationLoop);
        if (!this.config.enabled) return;

        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        const elapsed = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;
        const rawDeltaTime = Math.max(0.001, elapsed / 1000.0);
        this.deltaTimeBuffer.push(rawDeltaTime);
        if (this.deltaTimeBuffer.length > DELTA_TIME_BUFFER_SIZE) this.deltaTimeBuffer.shift();
        this.smoothedDeltaTime = this.deltaTimeBuffer.reduce((a,b) => a+b,0) / this.deltaTimeBuffer.length;
        
        if (this.lastValidWidth <= 0 || this.lastValidHeight <= 0 || !this.canvas || !this.ctx) {
            this.setupCanvas().then(setupOk => { if (setupOk && this.config.enabled) this.draw(timestamp, this.config); });
            return;
        }
        if (!this.image?.complete || this.image?.naturalWidth === 0) return;

        const now = performance.now();
        for (const key in this.interpolators) {
            this.interpolators[key].update(now);
        }
        
        const speed = this.interpolators.speed.getCurrentValue();
        const direction = this.config.direction ?? 1;
        const angleDelta = speed * direction * this.smoothedDeltaTime * 600;
        this.continuousRotationAngle = (this.continuousRotationAngle + angleDelta) % 360;

        this.draw(timestamp, this.config);
    }
    
    async forceRedraw(configToUse = null) {
        if (this.isDestroyed || this.isDrawing) return false;
        return this.drawStaticFrame(configToUse || this.config);
    }

    destroy() {
        this.isDestroyed = true;
        this.stopAnimationLoop();
        this.image = null;
        this.ctx = null;
        this.canvas = null;
        this.deltaTimeBuffer = [];
        this.interpolators = {};
        this.lastDPR = 0;
        this.lastValidWidth = 0;
        this.lastValidHeight = 0;
        if (import.meta.env.DEV) console.log(`[CM L${this.layerId}] Destroyed.`);
    }
}
export default CanvasManager;