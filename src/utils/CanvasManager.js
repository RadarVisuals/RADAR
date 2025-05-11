// src/utils/CanvasManager.js
import { BLEND_MODES } from '../config/global-config';
import ValueInterpolator from './ValueInterpolator';

const SETUP_CANVAS_POLL_INTERVAL = 100;
const SETUP_CANVAS_POLL_TIMEOUT = 3000;
const MAX_TOTAL_OFFSET = 10000;
const DELTA_TIME_BUFFER_SIZE = 5;

const MIDI_XY_INTERPOLATION_DURATION = 80;
const MIDI_ANGLE_INTERPOLATION_DURATION = 60;

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
    deltaTimeBuffer = [];
    smoothedDeltaTime = 1 / 60;
    xInterpolator;
    yInterpolator;
    angleInterpolator;
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
            if (!this.ctx) {
                throw new Error(`Failed to get 2D context for Layer ${layerId} (returned null)`);
            }
        } catch (e) {
            console.error(`[CM L${layerId}] Error getting context:`, e);
            throw new Error(`Failed to get 2D context for Layer ${layerId}: ${e.message}`);
        }
        this.layerId = layerId;
        this.config = this.getDefaultConfig();

        this.xInterpolator = new ValueInterpolator(this.config.xaxis, MIDI_XY_INTERPOLATION_DURATION);
        this.yInterpolator = new ValueInterpolator(this.config.yaxis, MIDI_XY_INTERPOLATION_DURATION);
        this.angleInterpolator = new ValueInterpolator(this.config.angle, MIDI_ANGLE_INTERPOLATION_DURATION);

        this.animationLoop = this.animationLoop.bind(this);
    }

    getDefaultConfig() {
        return {
            enabled: true,
            blendMode: 'normal',
            opacity: 1.0,
            size: 1.0,
            speed: 0.01,
            drift: 0,
            driftSpeed: 0.1,
            angle: 0,
            xaxis: 0,
            yaxis: 0,
            direction: 1,
            driftState: { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false },
            audioSource: 'level',
        };
    }

    async setupCanvas() {
        const logPrefix = `[CM L${this.layerId}] setupCanvas:`;
        if (!this.canvas || this.isDestroyed) {
            this.lastValidWidth = 0; this.lastValidHeight = 0; return false;
        }
        const parent = this.canvas.parentElement;
        if (!parent) {
            this.lastValidWidth = 0; this.lastValidHeight = 0; return false;
        }
        let logicalWidth = 0, logicalHeight = 0, attempts = 0;
        const maxAttempts = SETUP_CANVAS_POLL_TIMEOUT / SETUP_CANVAS_POLL_INTERVAL;
        while (attempts < maxAttempts) {
            attempts++;
            if (!parent.isConnected) {
                this.lastValidWidth = 0; this.lastValidHeight = 0; return false;
            }
            const rect = parent.getBoundingClientRect();
            logicalWidth = Math.floor(rect.width);
            logicalHeight = Math.floor(rect.height);
            if (logicalWidth > 0 && logicalHeight > 0) break;
            await new Promise(resolve => setTimeout(resolve, SETUP_CANVAS_POLL_INTERVAL));
        }
        if (logicalWidth <= 0 || logicalHeight <= 0) {
             console.error(`${logPrefix} FAILED - Zero Dimensions after timeout (${logicalWidth}x${logicalHeight}).`);
             this.lastValidWidth = 0; this.lastValidHeight = 0;
             if (this.canvas && (this.canvas.width > 0 || this.canvas.height > 0)) {
                 try { this.canvas.width = 0; this.canvas.height = 0; } catch(e) { console.error(`${logPrefix} Error zeroing canvas w/h during failed setup:`, e); }
             }
             return false;
        }
        const dpr = window.devicePixelRatio || 1;
        const targetRenderWidth = Math.floor(logicalWidth * dpr);
        const targetRenderHeight = Math.floor(logicalHeight * dpr);
        if (!this.canvas) {
            this.lastValidWidth = 0; this.lastValidHeight = 0; return false;
        }
        let resized = false;
        if (this.canvas.width !== targetRenderWidth || this.canvas.height !== targetRenderHeight) {
            try {
                this.canvas.width = targetRenderWidth;
                this.canvas.height = targetRenderHeight;
                resized = true;
            } catch(e) { 
                console.error(`${logPrefix} Error setting canvas w/h:`, e);
                return false; 
            }
        }
        if (this.canvas.style.width !== `${logicalWidth}px` || this.canvas.style.height !== `${logicalHeight}px`) {
             try {
                 this.canvas.style.width = `${logicalWidth}px`;
                 this.canvas.style.height = `${logicalHeight}px`;
             } catch (e) {
                 console.warn(`${logPrefix} Error setting canvas style w/h:`, e);
             }
        }
        if ((resized || this.ctx) && this.ctx) {
            try {
                const currentTransform = this.ctx.getTransform();
                if (!currentTransform || Math.abs(currentTransform.a - dpr) > 1e-6 || Math.abs(currentTransform.d - dpr) > 1e-6) {
                    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }
            } catch (e) {
                 console.error(`${logPrefix} Transform error:`, e);
            }
        }
        this.lastValidWidth = logicalWidth;
        this.lastValidHeight = logicalHeight;
        this.xInterpolator?.snap(this.config.xaxis);
        this.yInterpolator?.snap(this.config.yaxis);
        this.angleInterpolator?.snap(this.config.angle);
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
                    if (key === 'driftState' && typeof newConfig[key] === 'object' && defaultConfig[key] && typeof defaultConfig[key] === 'object') {
                        // Ensure proper merging of driftState
                        mergedConfig.driftState = { ...(defaultConfig[key].driftState || {}), ...(newConfig[key] || {}), };
                        mergedConfig.driftState.x = typeof mergedConfig.driftState.x === 'number' ? mergedConfig.driftState.x : 0;
                        mergedConfig.driftState.y = typeof mergedConfig.driftState.y === 'number' ? mergedConfig.driftState.y : 0;
                        mergedConfig.driftState.phase = typeof mergedConfig.driftState.phase === 'number' ? mergedConfig.driftState.phase : Math.random() * Math.PI * 2;
                        mergedConfig.driftState.enabled = typeof mergedConfig.driftState.enabled === 'boolean' ? mergedConfig.driftState.enabled : false;
                    }
                } else {
                    mergedConfig[key] = defaultConfig[key];
                }
            }
        }
        if (!BLEND_MODES.includes(mergedConfig.blendMode)) { mergedConfig.blendMode = 'normal'; }
        
        // Ensure driftState exists and is properly initialized before accessing its 'enabled' property
        if (!mergedConfig.driftState || typeof mergedConfig.driftState !== 'object') {
            mergedConfig.driftState = { x:0,y:0,phase:Math.random()*Math.PI*2,enabled:false };
        }
        mergedConfig.driftState.enabled = (mergedConfig.drift || 0) > 0;
        if (!mergedConfig.driftState.enabled) {
            mergedConfig.driftState.x = 0;
            mergedConfig.driftState.y = 0;
        }

        this.config = mergedConfig;

        if (this.canvas?.style) {
            this.canvas.style.mixBlendMode = this.config.blendMode || "normal";
        }

        this.xInterpolator?.snap(this.config.xaxis);
        this.yInterpolator?.snap(this.config.yaxis);
        this.angleInterpolator?.snap(this.config.angle);
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
                catch (e) { console.error(`[CM L${this.layerId}] Error clearing canvas on disable:`, e); }
            }
        }
    }

    snapVisualProperty(key, value) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) {
            console.warn(`[CM L${this.layerId}] snapVisualProperty: Unknown property '${key}'.`);
            return;
        }
        
        const validatedValue = this.validateValue(key, value, defaultConfig[key]);
        this.config[key] = validatedValue;

        if (key === 'xaxis' && this.xInterpolator) this.xInterpolator.snap(validatedValue);
        else if (key === 'yaxis' && this.yInterpolator) this.yInterpolator.snap(validatedValue);
        else if (key === 'angle' && this.angleInterpolator) this.angleInterpolator.snap(validatedValue);
        else if (key === 'blendMode' && this.canvas?.style) this.canvas.style.mixBlendMode = validatedValue || 'normal';
        else if (key === 'drift') {
            if (!this.config.driftState) this.config.driftState = { x:0,y:0,phase:Math.random()*Math.PI*2,enabled:false };
            this.config.driftState.enabled = validatedValue > 0;
            if (!this.config.driftState.enabled) { this.config.driftState.x = 0; this.config.driftState.y = 0; }
        } else if (key === 'enabled') this.handleEnabledToggle(validatedValue);
    }

    updateConfigProperty(key, value) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        if (key === 'xaxis' || key === 'yaxis' || key === 'angle') {
            // console.warn(`[CM L${this.layerId}] updateConfigProperty called for interpolated key '${key}'. Snapping instead.`);
            this.snapVisualProperty(key, value);
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) {
            // console.warn(`[CM L${this.layerId}] updateConfigProperty: Unknown property '${key}'.`);
            return;
        }
        const validatedValue = this.validateValue(key, value, defaultConfig[key]);
        this.config[key] = validatedValue;

        if (key === 'blendMode' && this.canvas?.style) this.canvas.style.mixBlendMode = validatedValue || 'normal';
        else if (key === 'drift') {
             if (!this.config.driftState) this.config.driftState = { x:0,y:0,phase:Math.random()*Math.PI*2,enabled:false };
             this.config.driftState.enabled = validatedValue > 0;
             if (!this.config.driftState.enabled) { this.config.driftState.x = 0; this.config.driftState.y = 0; }
        } else if (key === 'enabled') this.handleEnabledToggle(validatedValue);
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
        const config = configToUse || this.config;
        this.xInterpolator?.snap(config.xaxis);
        this.yInterpolator?.snap(config.yaxis);
        this.angleInterpolator?.snap(config.angle);
        this.continuousRotationAngle = 0;
        return this.draw(performance.now(), config);
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
                if (img.naturalWidth === 0) {
                    this.image = null; this.lastImageSrc = null;
                    reject(new Error(`Loaded image has zero dimensions: ${src.substring(0, 100)}`)); return;
                }
                this.image = img; this.lastImageSrc = src;
                resolve();
            };
            img.onerror = () => {
                if (this.isDestroyed) return reject(new Error("Manager destroyed during image load"));
                this.image = null; this.lastImageSrc = null;
                reject(new Error(`Failed to load image: ${src.substring(0, 50)}`));
            };
            img.src = src;
        });
    }

    setTargetValue(param, targetValue) {
        if (this.isDestroyed) return;
        const validatedValue = Number(targetValue);
        if (isNaN(validatedValue)) {
            console.warn(`[CM L${this.layerId}] Invalid MIDI target value for ${param}: ${targetValue}`);
            return;
        }
        if (Object.prototype.hasOwnProperty.call(this.config, param)) {
            this.config[param] = validatedValue; // Update internal config to reflect the MIDI target
        } else {
            console.warn(`[CM L${this.layerId}] Unknown MIDI parameter '${param}' for setTargetValue.`);
            return;
        }
        if (param === 'xaxis' && this.xInterpolator) this.xInterpolator.setTarget(validatedValue);
        else if (param === 'yaxis' && this.yInterpolator) this.yInterpolator.setTarget(validatedValue);
        else if (param === 'angle' && this.angleInterpolator) this.angleInterpolator.setTarget(validatedValue);
    }

    setAudioFrequencyFactor(factor) { if (this.isDestroyed) return; this.audioFrequencyFactor = Number(factor) || 1.0; }
    triggerBeatPulse(pulseFactor, duration) { if (this.isDestroyed) return; this.beatPulseFactor = Number(pulseFactor) || 1.0; this.beatPulseEndTime = performance.now() + (Number(duration) || 0); }
    resetAudioModifications() { if (this.isDestroyed) return; this.audioFrequencyFactor = 1.0; this.beatPulseFactor = 1.0; this.beatPulseEndTime = 0; }
    getConfigData() { return JSON.parse(JSON.stringify(this.config)); }

    draw(timestamp, configToUse = null) {
        const currentConfig = configToUse || this.config;
        if (this.isDestroyed || !currentConfig?.enabled || this.isDrawing ||
            !this.canvas || !this.ctx || !this.image || !this.image.complete ||
            this.image.naturalWidth === 0 || this.lastValidWidth <= 0 || this.lastValidHeight <= 0) {
            this.isDrawing = false; return false;
        }
        this.isDrawing = true;
        try {
            const width = this.lastValidWidth; const height = this.lastValidHeight;
            const halfWidth = Math.floor(width / 2); const halfHeight = Math.floor(height / 2);
            const remainingWidth = width - halfWidth; const remainingHeight = height - halfHeight;
            const imgNaturalWidth = this.image.naturalWidth; const imgNaturalHeight = this.image.naturalHeight;
            const imgAspectRatio = (imgNaturalWidth > 0 && imgNaturalHeight > 0) ? imgNaturalWidth / imgNaturalHeight : 1;
            let currentBaseSize = currentConfig.size ?? 1.0;
            let finalDrawSize = currentBaseSize * this.audioFrequencyFactor;
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
            imgDrawWidth = Math.max(1, Math.floor(imgDrawWidth)); imgDrawHeight = Math.max(1, Math.floor(imgDrawHeight));
            this.updateDrift(currentConfig, this.smoothedDeltaTime);
            const driftX = currentConfig.driftState?.x ?? 0; const driftY = currentConfig.driftState?.y ?? 0;

            // Use direct config value if interpolator isn't active (UI snap), else use interpolator's value (MIDI)
            const currentX = this.xInterpolator.isCurrentlyInterpolating() ? this.xInterpolator.getCurrentValue() : this.config.xaxis;
            const currentY = this.yInterpolator.isCurrentlyInterpolating() ? this.yInterpolator.getCurrentValue() : this.config.yaxis;
            const baseAngle = this.angleInterpolator.isCurrentlyInterpolating() ? this.angleInterpolator.getCurrentValue() : this.config.angle;
            
            const offsetX = currentX / 10; const offsetY = currentY / 10;
            const finalAngle = baseAngle + this.continuousRotationAngle;
            const angleRad = (finalAngle % 360) * Math.PI / 180;
            const finalCenterX_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfWidth / 2 + offsetX + driftX));
            const finalCenterY_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfHeight / 2 + offsetY + driftY));
            
            try { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); } 
            catch (e) { console.error(`[CM L${this.layerId}] Error clearing canvas:`, e); this.isDrawing = false; return false; }
            
            this.ctx.globalAlpha = currentConfig.opacity ?? 1.0;
            
            const drawImageWithRotation = () => {
                 try {
                    this.ctx.save(); this.ctx.rotate(angleRad);
                    if (this.image?.complete && this.image?.naturalWidth > 0) {
                        this.ctx.drawImage(this.image, 0, 0, imgNaturalWidth, imgNaturalHeight, -imgDrawWidth / 2, -imgDrawHeight / 2, imgDrawWidth, imgDrawHeight);
                    } this.ctx.restore();
                } catch (e) { console.error(`[CM L${this.layerId}] drawImage error:`, e); }
            };
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(0,0,halfWidth,halfHeight); this.ctx.clip();
            this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(halfWidth,0,remainingWidth,halfHeight); this.ctx.clip();
            this.ctx.translate(width,0); this.ctx.scale(-1,1); this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(0,halfHeight,halfWidth,remainingHeight); this.ctx.clip();
            this.ctx.translate(0,height); this.ctx.scale(1,-1); this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(halfWidth,halfHeight,remainingWidth,remainingHeight); this.ctx.clip();
            this.ctx.translate(width,height); this.ctx.scale(-1,-1); this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
            this.ctx.globalAlpha = 1.0; this.isDrawing = false; return true;
        } catch (e) { console.error(`[CM L${this.layerId}] Unexpected draw error:`, e); this.isDrawing = false; return false; }
    }

    updateDrift(config, deltaTime) {
        if (!config?.driftState) return; const {driftState} = config; const driftAmount = config.drift ?? 0; const driftSpeed = config.driftSpeed ?? 0.1; if(driftAmount > 0 && driftState.enabled){ if(typeof driftState.phase !== "number" || isNaN(driftState.phase)) { driftState.phase = Math.random() * Math.PI * 2; } driftState.phase += deltaTime * driftSpeed * 1.0; const calculatedX = Math.sin(driftState.phase) * driftAmount * 1.5; const calculatedY = Math.cos(driftState.phase * 0.7 + Math.PI / 4) * driftAmount * 1.5; driftState.x = Math.max(-MAX_TOTAL_OFFSET / 2, Math.min(MAX_TOTAL_OFFSET / 2, calculatedX)); driftState.y = Math.max(-MAX_TOTAL_OFFSET / 2, Math.min(MAX_TOTAL_OFFSET / 2, calculatedY)); } else { driftState.x = 0; driftState.y = 0; }
    }

    animationLoop(timestamp) {
        if (this.isDestroyed || this.animationFrameId === null) return; 
        this.animationFrameId = requestAnimationFrame(this.animationLoop); 
        if (!this.config.enabled) { return; } 
        if (!this.lastTimestamp) this.lastTimestamp = timestamp; 
        const elapsed = timestamp - this.lastTimestamp; 
        this.lastTimestamp = timestamp; 
        const rawDeltaTime = Math.max(0.001, elapsed / 1000.0); 
        this.deltaTimeBuffer.push(rawDeltaTime); 
        if (this.deltaTimeBuffer.length > DELTA_TIME_BUFFER_SIZE) { this.deltaTimeBuffer.shift(); } 
        this.smoothedDeltaTime = this.deltaTimeBuffer.reduce((a,b) => a+b,0) / this.deltaTimeBuffer.length; 
        if (this.lastValidWidth <= 0 || this.lastValidHeight <= 0 || !this.canvas || !this.ctx) { 
            this.setupCanvas().then(setupOk => { if (setupOk && this.config.enabled) this.draw(timestamp, this.config); }); 
            return; 
        } 
        if (!this.image?.complete || this.image?.naturalWidth === 0) { return; } 
        const now = performance.now(); 
        
        this.xInterpolator?.update(now); 
        this.yInterpolator?.update(now); 
        this.angleInterpolator?.update(now); 
        
        const speed = this.config.speed ?? 0; 
        const direction = this.config.direction ?? 1; 
        const angleDelta = speed * direction * this.smoothedDeltaTime * 600; 
        this.continuousRotationAngle = (this.continuousRotationAngle + angleDelta) % 360; 
        this.draw(timestamp, this.config);
    }
    
    async forceRedraw(configToUse = null) { if (this.isDestroyed || this.isDrawing) return false; return this.drawStaticFrame(configToUse || this.config); }
    destroy() { this.isDestroyed = true; this.stopAnimationLoop(); this.image = null; this.ctx = null; this.canvas = null; this.deltaTimeBuffer = []; this.xInterpolator = null; this.yInterpolator = null; this.angleInterpolator = null; }
}
export default CanvasManager;