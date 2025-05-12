// src/utils/CanvasManager.js
import { BLEND_MODES } from '../config/global-config';
import ValueInterpolator from './ValueInterpolator';

const SETUP_CANVAS_POLL_INTERVAL = 100;
const SETUP_CANVAS_POLL_TIMEOUT = 3000;
const MAX_TOTAL_OFFSET = 10000; // Max drift/offset to prevent extreme values
const DELTA_TIME_BUFFER_SIZE = 5; // For smoothing animation frame delta time

const MIDI_XY_INTERPOLATION_DURATION = 80; // ms
const MIDI_ANGLE_INTERPOLATION_DURATION = 60; // ms

/**
 * @file Manages an individual HTML5 Canvas element for rendering a visual layer.
 * Handles canvas setup, image loading, configuration application, animation loop,
 * drawing logic (including a 4-quadrant mirrored effect), and interaction with
 * audio reactivity and MIDI-controlled parameter interpolation.
 */

/**
 * @class CanvasManager
 * @description Manages rendering and animation for a single canvas layer.
 * It encapsulates the canvas context, current image, configuration,
 * animation loop, and drawing logic.
 */
class CanvasManager {
    /** @type {HTMLCanvasElement | null} The HTML canvas element. */
    canvas = null;
    /** @type {CanvasRenderingContext2D | null} The 2D rendering context of the canvas. */
    ctx = null;
    /** @type {string} Identifier for the layer this manager controls (e.g., '1', '2', '3'). */
    layerId;
    /** @type {HTMLImageElement | null} The current image object to be drawn. */
    image = null;
    /** @type {object} The current configuration object for this layer's visuals. */
    config;
    /** @type {number | null} ID of the current animation frame request. */
    animationFrameId = null;
    /** @type {number} Timestamp of the last animation frame. */
    lastTimestamp = 0;
    /** @type {boolean} Flag to prevent concurrent drawing operations. */
    isDrawing = false;
    /** @type {boolean} Flag indicating if the manager has been destroyed. */
    isDestroyed = false;
    /** @type {string | null} Source URL of the last successfully loaded image. */
    lastImageSrc = null;
    /** @type {number} Last known valid logical width of the canvas parent. */
    lastValidWidth = 0;
    /** @type {number} Last known valid logical height of the canvas parent. */
    lastValidHeight = 0;
    /** @type {number} Last known device pixel ratio used for canvas setup. */
    lastDPR = 0;
    /** @type {number[]} Buffer for smoothing delta time in the animation loop. */
    deltaTimeBuffer = [];
    /** @type {number} Smoothed delta time (in seconds) for animations. */
    smoothedDeltaTime = 1 / 60; // Initialize to 60 FPS assumption
    /** @type {ValueInterpolator} Interpolator for the x-axis position. */
    xInterpolator;
    /** @type {ValueInterpolator} Interpolator for the y-axis position. */
    yInterpolator;
    /** @type {ValueInterpolator} Interpolator for the angle. */
    angleInterpolator;
    /** @type {number} Continuously accumulating angle for rotation effect. */
    continuousRotationAngle = 0;
    /** @type {number} Factor applied to size based on audio frequency analysis. */
    audioFrequencyFactor = 1.0;
    /** @type {number} Factor applied to size during an audio beat pulse. */
    beatPulseFactor = 1.0;
    /** @type {number} Timestamp when the current audio beat pulse should end. */
    beatPulseEndTime = 0;

    /**
     * Creates an instance of CanvasManager.
     * @param {HTMLCanvasElement} canvas - The canvas element to manage.
     * @param {string} layerId - The identifier for this layer.
     * @throws {Error} If the canvas element is invalid or context cannot be obtained.
     */
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
            if (import.meta.env.DEV) console.error(`[CM L${layerId}] Error getting context:`, e);
            throw new Error(`Failed to get 2D context for Layer ${layerId}: ${e.message}`);
        }
        this.layerId = layerId;
        this.config = this.getDefaultConfig();
        this.lastDPR = window.devicePixelRatio || 1;

        this.xInterpolator = new ValueInterpolator(this.config.xaxis, MIDI_XY_INTERPOLATION_DURATION);
        this.yInterpolator = new ValueInterpolator(this.config.yaxis, MIDI_XY_INTERPOLATION_DURATION);
        this.angleInterpolator = new ValueInterpolator(this.config.angle, MIDI_ANGLE_INTERPOLATION_DURATION);

        this.animationLoop = this.animationLoop.bind(this);
    }

    /**
     * Returns the default configuration object for a layer.
     * @returns {object} The default configuration.
     */
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
            audioSource: 'level', // Currently unused, but part of the default structure
        };
    }

    /**
     * Sets up the canvas dimensions based on its parent element's size and device pixel ratio.
     * Includes an efficiency check to skip setup if dimensions and DPR are unchanged.
     * Uses polling as a fallback if initial parent dimensions are zero.
     * @async
     * @returns {Promise<boolean>} True if setup was successful or skipped due to no changes, false on failure.
     */
    async setupCanvas() {
        const logPrefix = `[CM L${this.layerId}] setupCanvas:`;
        if (!this.canvas || this.isDestroyed) {
            this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false;
        }
        const parent = this.canvas.parentElement;
        if (!parent) {
            this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false;
        }

        const currentDPR = window.devicePixelRatio || 1;
        const parentRectImmediate = parent.getBoundingClientRect();
        const currentLogicalWidth = Math.floor(parentRectImmediate.width);
        const currentLogicalHeight = Math.floor(parentRectImmediate.height);

        if (
            currentLogicalWidth === this.lastValidWidth &&
            currentLogicalHeight === this.lastValidHeight &&
            currentDPR === this.lastDPR &&
            this.canvas.width === Math.floor(currentLogicalWidth * currentDPR) &&
            this.canvas.height === Math.floor(currentLogicalHeight * currentDPR) &&
            currentLogicalWidth > 0 && currentLogicalHeight > 0
        ) {
            return true; 
        }

        let logicalWidth = 0, logicalHeight = 0, attempts = 0;
        const maxAttempts = SETUP_CANVAS_POLL_TIMEOUT / SETUP_CANVAS_POLL_INTERVAL;

        if (currentLogicalWidth <= 0 || currentLogicalHeight <= 0) {
            while (attempts < maxAttempts) {
                attempts++;
                if (!parent.isConnected) {
                    this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false;
                }
                const rect = parent.getBoundingClientRect();
                logicalWidth = Math.floor(rect.width);
                logicalHeight = Math.floor(rect.height);
                if (logicalWidth > 0 && logicalHeight > 0) break;
                await new Promise(resolve => setTimeout(resolve, SETUP_CANVAS_POLL_INTERVAL));
            }
        } else {
            logicalWidth = currentLogicalWidth;
            logicalHeight = currentLogicalHeight;
        }
        
        if (logicalWidth <= 0 || logicalHeight <= 0) {
             if (import.meta.env.DEV) console.error(`${logPrefix} FAILED - Zero Dimensions after timeout/check (${logicalWidth}x${logicalHeight}).`);
             this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0;
             if (this.canvas && (this.canvas.width > 0 || this.canvas.height > 0)) {
                 try { this.canvas.width = 0; this.canvas.height = 0; } catch(e) { 
                    if (import.meta.env.DEV) console.error(`${logPrefix} Error zeroing canvas w/h during failed setup:`, e);
                 }
             }
             return false;
        }

        const dpr = window.devicePixelRatio || 1; 
        const targetRenderWidth = Math.floor(logicalWidth * dpr);
        const targetRenderHeight = Math.floor(logicalHeight * dpr);

        if (!this.canvas) {
            this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false;
        }

        let resized = false;
        if (this.canvas.width !== targetRenderWidth || this.canvas.height !== targetRenderHeight) {
            try {
                this.canvas.width = targetRenderWidth;
                this.canvas.height = targetRenderHeight;
                resized = true;
            } catch(e) { 
                if (import.meta.env.DEV) console.error(`${logPrefix} Error setting canvas w/h:`, e);
                return false; 
            }
        }

        if (this.canvas.style.width !== `${logicalWidth}px` || this.canvas.style.height !== `${logicalHeight}px`) {
             try {
                 this.canvas.style.width = `${logicalWidth}px`;
                 this.canvas.style.height = `${logicalHeight}px`;
             } catch (e) {
                 if (import.meta.env.DEV) console.warn(`${logPrefix} Error setting canvas style w/h:`, e);
             }
        }
        
        if ((resized || this.ctx) && this.ctx) { 
            try {
                this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            } catch (e) {
                 if (import.meta.env.DEV) console.error(`${logPrefix} Transform error:`, e);
            }
        }

        this.lastValidWidth = logicalWidth;
        this.lastValidHeight = logicalHeight;
        this.lastDPR = dpr; 

        this.xInterpolator?.snap(this.config.xaxis);
        this.yInterpolator?.snap(this.config.yaxis);
        this.angleInterpolator?.snap(this.config.angle);
        
        return true;
    }

    /**
     * Applies a full new configuration object to the layer, merging with defaults.
     * Snaps interpolators to new values and resets continuous rotation.
     * @param {object} newConfig - The new configuration object.
     */
    applyFullConfig(newConfig) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        const mergedConfig = { ...defaultConfig };

        for (const key in defaultConfig) {
            if (Object.prototype.hasOwnProperty.call(defaultConfig, key)) {
                if (newConfig && Object.prototype.hasOwnProperty.call(newConfig, key) && newConfig[key] !== undefined && newConfig[key] !== null) {
                    mergedConfig[key] = this.validateValue(key, newConfig[key], defaultConfig[key]);
                    if (key === 'driftState' && typeof newConfig[key] === 'object' && defaultConfig[key] && typeof defaultConfig[key] === 'object') {
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
        this.continuousRotationAngle = 0; // Reset continuous rotation on full config apply

        this.handleEnabledToggle(this.config.enabled);
    }

    /**
     * Validates a configuration value against its expected type and constraints.
     * @param {string} key - The configuration key (e.g., 'opacity', 'size').
     * @param {*} value - The value to validate.
     * @param {*} defaultValue - The default value to use if validation fails.
     * @returns {*} The validated value or the default value.
     */
    validateValue(key, value, defaultValue) {
        let validated = value;
        const defaultValueType = typeof defaultValue;
        if (defaultValueType === 'number') {
            validated = Number(value);
            if (isNaN(validated)) validated = defaultValue;
            if (key === 'opacity') validated = Math.max(0, Math.min(1, validated));
            if (key === 'size') validated = Math.max(0.01, validated); // Ensure size is not zero
        } else if (defaultValueType === 'string') {
            validated = String(value);
            if (key === 'blendMode' && !BLEND_MODES.includes(validated)) {
                validated = defaultValue;
            }
        } else if (defaultValueType === 'boolean') {
            validated = Boolean(value);
        }
        // For object types like driftState, merging is handled in applyFullConfig
        return validated;
    }

    /**
     * Handles enabling or disabling the layer's animation loop and clearing the canvas.
     * @param {boolean} isEnabled - Whether the layer should be enabled.
     */
    handleEnabledToggle(isEnabled) {
        if (isEnabled && !this.animationFrameId) {
            this.startAnimationLoop();
        } else if (!isEnabled && this.animationFrameId) {
            this.stopAnimationLoop();
            if (this.ctx && this.canvas?.width > 0 && this.canvas?.height > 0) {
                try { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); } 
                catch (e) { 
                    if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] Error clearing canvas on disable:`, e); 
                }
            }
        }
    }

    /**
     * Immediately sets a visual property's value and snaps its interpolator if applicable.
     * Used for direct updates that should not be interpolated (e.g., from UI sliders for interpolated params).
     * @param {string} key - The configuration key to snap.
     * @param {*} value - The new value for the property.
     */
    snapVisualProperty(key, value) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) {
            if (import.meta.env.DEV) console.warn(`[CM L${this.layerId}] snapVisualProperty: Unknown property '${key}'.`);
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

    /**
     * Updates a non-interpolated configuration property directly.
     * For interpolated properties (xaxis, yaxis, angle), it calls `snapVisualProperty`.
     * @param {string} key - The configuration key to update.
     * @param {*} value - The new value for the property.
     */
    updateConfigProperty(key, value) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        // Interpolated properties should be snapped if updated directly via this method
        if (key === 'xaxis' || key === 'yaxis' || key === 'angle') {
            this.snapVisualProperty(key, value);
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) {
            // Silently ignore unknown properties to prevent errors from dynamic updates
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

    /** Starts the animation loop if not already running and layer is enabled. */
    startAnimationLoop() {
        if (this.isDestroyed || this.animationFrameId !== null || !this.config.enabled) return;
        this.lastTimestamp = performance.now();
        this.deltaTimeBuffer = []; // Reset buffer
        this.smoothedDeltaTime = 1 / 60; // Reset smoothed delta
        this.animationFrameId = requestAnimationFrame(this.animationLoop);
    }

    /** Stops the animation loop. */
    stopAnimationLoop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isDrawing = false; // Ensure drawing flag is reset
    }

    /**
     * Performs a single static draw of the current configuration.
     * Useful for redrawing after resize or when animation is not active.
     * @async
     * @param {object | null} [configToUse=null] - Optional specific config to draw with, otherwise uses internal config.
     * @returns {Promise<boolean>} True if drawing was successful, false otherwise.
     */
    async drawStaticFrame(configToUse = null) {
        if (this.isDestroyed || this.isDrawing) return false;
        const setupSuccess = await this.setupCanvas();
        if (!setupSuccess) return false;

        this.smoothedDeltaTime = 1 / 60; // Use a fixed delta for static frames
        const config = configToUse || this.config;

        // Ensure interpolators are at their target values for a static frame
        this.xInterpolator?.snap(config.xaxis);
        this.yInterpolator?.snap(config.yaxis);
        this.angleInterpolator?.snap(config.angle);
        this.continuousRotationAngle = 0; // Reset continuous rotation for a static frame

        return this.draw(performance.now(), config);
    }

    /**
     * Loads an image from the given source URL and sets it as the current image for drawing.
     * @async
     * @param {string} src - The source URL of the image.
     * @returns {Promise<void>} Resolves when the image is loaded or rejects on error.
     * @throws {Error} If the manager is destroyed or image source is invalid/fails to load.
     */
    async setImage(src) {
        if (this.isDestroyed) return Promise.reject(new Error("Manager destroyed"));
        return new Promise((resolve, reject) => {
            if (!src || typeof src !== 'string') {
                this.image = null; this.lastImageSrc = null;
                return reject(new Error("Invalid image source"));
            }
            // Optimization: if same image and already loaded, resolve immediately
            if (src === this.lastImageSrc && this.image?.complete && this.image?.naturalWidth > 0) {
                return resolve();
            }

            const img = new Image();
            // Handle CORS for external images
            if (src.startsWith('http') && !src.startsWith(window.location.origin)) {
                img.crossOrigin = "anonymous";
            }
            img.onload = () => {
                if (this.isDestroyed) return resolve(); 
                if (img.naturalWidth === 0) { // Check for valid image dimensions
                    this.image = null; this.lastImageSrc = null;
                    reject(new Error(`Loaded image has zero dimensions: ${src.substring(0, 100)}`)); return;
                }
                this.image = img; this.lastImageSrc = src;
                resolve();
            };
            img.onerror = () => {
                if (this.isDestroyed) return reject(new Error("Manager destroyed during image load error"));
                this.image = null; this.lastImageSrc = null;
                reject(new Error(`Failed to load image: ${src.substring(0, 50)}`));
            };
            img.src = src;
        });
    }

    /**
     * Sets the target value for an interpolated parameter (e.g., from MIDI input).
     * The actual visual change will occur smoothly over time via the animation loop.
     * Also updates the internal config to reflect the target.
     * @param {string} param - The parameter key (e.g., 'xaxis', 'yaxis', 'angle').
     * @param {number} targetValue - The new target value for the parameter.
     */
    setTargetValue(param, targetValue) {
        if (this.isDestroyed) return;
        const validatedValue = Number(targetValue);
        if (isNaN(validatedValue)) {
            if (import.meta.env.DEV) console.warn(`[CM L${this.layerId}] Invalid MIDI target value for ${param}: ${targetValue}`);
            return;
        }
        // Update internal config to reflect the MIDI target
        if (Object.prototype.hasOwnProperty.call(this.config, param)) {
            this.config[param] = validatedValue; 
        } else {
            if (import.meta.env.DEV) console.warn(`[CM L${this.layerId}] Unknown MIDI parameter '${param}' for setTargetValue.`);
            return;
        }

        if (param === 'xaxis' && this.xInterpolator) this.xInterpolator.setTarget(validatedValue);
        else if (param === 'yaxis' && this.yInterpolator) this.yInterpolator.setTarget(validatedValue);
        else if (param === 'angle' && this.angleInterpolator) this.angleInterpolator.setTarget(validatedValue);
    }

    /**
     * Sets the audio frequency factor, affecting the layer's size.
     * @param {number} factor - The multiplier for size based on audio frequency.
     */
    setAudioFrequencyFactor(factor) { if (this.isDestroyed) return; this.audioFrequencyFactor = Number(factor) || 1.0; }

    /**
     * Triggers a beat pulse effect, temporarily modifying the layer's size.
     * @param {number} pulseFactor - The size multiplier for the pulse.
     * @param {number} duration - The duration of the pulse in milliseconds.
     */
    triggerBeatPulse(pulseFactor, duration) { if (this.isDestroyed) return; this.beatPulseFactor = Number(pulseFactor) || 1.0; this.beatPulseEndTime = performance.now() + (Number(duration) || 0); }
    
    /** Resets any active audio-driven modifications to their default state. */
    resetAudioModifications() { if (this.isDestroyed) return; this.audioFrequencyFactor = 1.0; this.beatPulseFactor = 1.0; this.beatPulseEndTime = 0; }
    
    /**
     * Returns a deep copy of the current configuration object.
     * @returns {object} The current layer configuration.
     */
    getConfigData() { return JSON.parse(JSON.stringify(this.config)); }

    /**
     * The core drawing method, executed within the animation loop or for static frames.
     * Renders the current image onto the canvas with all transformations (position,
     * size, rotation, drift, opacity, blend mode) applied.
     * Implements a 4-quadrant mirrored drawing effect.
     * @param {number} timestamp - The current timestamp (e.g., from `performance.now()`).
     * @param {object | null} [configToUse=null] - Specific config to use for this draw call, otherwise uses internal `this.config`.
     * @returns {boolean} True if drawing was successful, false otherwise.
     */
    draw(timestamp, configToUse = null) {
        const currentConfig = configToUse || this.config;
        // Pre-conditions for drawing
        if (this.isDestroyed || !currentConfig?.enabled || this.isDrawing ||
            !this.canvas || !this.ctx || !this.image || !this.image.complete ||
            this.image.naturalWidth === 0 || this.lastValidWidth <= 0 || this.lastValidHeight <= 0) {
            this.isDrawing = false; return false;
        }
        this.isDrawing = true;

        try {
            const width = this.lastValidWidth; const height = this.lastValidHeight;
            const halfWidth = Math.floor(width / 2); const halfHeight = Math.floor(height / 2);
            const remainingWidth = width - halfWidth; const remainingHeight = height - halfHeight; // For precise non-even splits

            const imgNaturalWidth = this.image.naturalWidth; const imgNaturalHeight = this.image.naturalHeight;
            const imgAspectRatio = (imgNaturalWidth > 0 && imgNaturalHeight > 0) ? imgNaturalWidth / imgNaturalHeight : 1;

            // Calculate final size based on base size, audio factor, and beat pulse
            let currentBaseSize = currentConfig.size ?? 1.0;
            let finalDrawSize = currentBaseSize * this.audioFrequencyFactor;
            if (this.beatPulseEndTime && timestamp < this.beatPulseEndTime) {
                finalDrawSize *= this.beatPulseFactor;
            } else if (this.beatPulseEndTime && timestamp >= this.beatPulseEndTime) { // Reset beat pulse after duration
                this.beatPulseFactor = 1.0; this.beatPulseEndTime = 0;
            }
            finalDrawSize = Math.max(0.01, finalDrawSize); // Ensure minimum size

            // Calculate image draw dimensions based on aspect ratio and final size
            let imgDrawWidth = halfWidth * finalDrawSize;
            let imgDrawHeight = imgDrawWidth / imgAspectRatio;
            if (imgAspectRatio > 0 && imgDrawHeight > halfHeight * finalDrawSize) { // Constrain by height
                imgDrawHeight = halfHeight * finalDrawSize; imgDrawWidth = imgDrawHeight * imgAspectRatio;
            } else if (isNaN(imgDrawHeight) || imgAspectRatio <= 0) { // Fallback for invalid aspect ratio
                imgDrawWidth = halfWidth * finalDrawSize; imgDrawHeight = halfHeight * finalDrawSize;
            }
            imgDrawWidth = Math.max(1, Math.floor(imgDrawWidth)); 
            imgDrawHeight = Math.max(1, Math.floor(imgDrawHeight));

            // Update drift state
            this.updateDrift(currentConfig, this.smoothedDeltaTime);
            const driftX = currentConfig.driftState?.x ?? 0; 
            const driftY = currentConfig.driftState?.y ?? 0;

            // Get current interpolated or snapped values for position and angle
            const currentX = this.xInterpolator.isCurrentlyInterpolating() ? this.xInterpolator.getCurrentValue() : this.config.xaxis;
            const currentY = this.yInterpolator.isCurrentlyInterpolating() ? this.yInterpolator.getCurrentValue() : this.config.yaxis;
            const baseAngle = this.angleInterpolator.isCurrentlyInterpolating() ? this.angleInterpolator.getCurrentValue() : this.config.angle;
            
            const offsetX = currentX / 10; // Scale down X/Y config for finer control
            const offsetY = currentY / 10;
            const finalAngle = baseAngle + this.continuousRotationAngle; // Add continuous rotation
            const angleRad = (finalAngle % 360) * Math.PI / 180; // Convert to radians

            // Calculate final center for the top-left quadrant's image, clamping to avoid excessive offsets
            const finalCenterX_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfWidth / 2 + offsetX + driftX));
            const finalCenterY_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfHeight / 2 + offsetY + driftY));
            
            try { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); } 
            catch (e) { 
                if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] Error clearing canvas:`, e); 
                this.isDrawing = false; return false; 
            }
            
            this.ctx.globalAlpha = currentConfig.opacity ?? 1.0;
            
            // Helper to draw the image with current rotation, centered for the quadrant
            const drawImageWithRotation = () => {
                 try {
                    this.ctx.save(); 
                    this.ctx.rotate(angleRad);
                    if (this.image?.complete && this.image?.naturalWidth > 0) {
                        this.ctx.drawImage(this.image, 0, 0, imgNaturalWidth, imgNaturalHeight, -imgDrawWidth / 2, -imgDrawHeight / 2, imgDrawWidth, imgDrawHeight);
                    } 
                    this.ctx.restore();
                } catch (e) { if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] drawImage error:`, e); }
            };

            // Draw in 4 quadrants with mirroring
            // Top-Left (Original)
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(0,0,halfWidth,halfHeight); this.ctx.clip();
            this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
            // Top-Right (Flipped Horizontally)
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(halfWidth,0,remainingWidth,halfHeight); this.ctx.clip();
            this.ctx.translate(width,0); this.ctx.scale(-1,1); this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
            // Bottom-Left (Flipped Vertically)
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(0,halfHeight,halfWidth,remainingHeight); this.ctx.clip();
            this.ctx.translate(0,height); this.ctx.scale(1,-1); this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
            // Bottom-Right (Flipped Both)
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(halfWidth,halfHeight,remainingWidth,remainingHeight); this.ctx.clip();
            this.ctx.translate(width,height); this.ctx.scale(-1,-1); this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
            
            this.ctx.globalAlpha = 1.0; // Reset global alpha
            this.isDrawing = false; 
            return true;
        } catch (e) { 
            if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] Unexpected draw error:`, e); 
            this.isDrawing = false; 
            return false; 
        }
    }

    /**
     * Updates the drift state (x, y offsets) based on current config and delta time.
     * @param {object} config - The current layer configuration.
     * @param {number} deltaTime - The time elapsed since the last frame, in seconds.
     */
    updateDrift(config, deltaTime) {
        if (!config?.driftState) return; 
        const {driftState} = config; 
        const driftAmount = config.drift ?? 0; 
        const driftSpeed = config.driftSpeed ?? 0.1; 

        if(driftAmount > 0 && driftState.enabled){ 
            if(typeof driftState.phase !== "number" || isNaN(driftState.phase)) { 
                driftState.phase = Math.random() * Math.PI * 2; // Initialize phase if needed
            } 
            driftState.phase += deltaTime * driftSpeed * 1.0; // Update phase
            // Calculate drift offsets using sine/cosine for smooth, circular/elliptical motion
            const calculatedX = Math.sin(driftState.phase) * driftAmount * 1.5; 
            const calculatedY = Math.cos(driftState.phase * 0.7 + Math.PI / 4) * driftAmount * 1.5; // Different factor/offset for Y for more organic movement
            // Clamp drift offsets to prevent excessive movement
            driftState.x = Math.max(-MAX_TOTAL_OFFSET / 2, Math.min(MAX_TOTAL_OFFSET / 2, calculatedX)); 
            driftState.y = Math.max(-MAX_TOTAL_OFFSET / 2, Math.min(MAX_TOTAL_OFFSET / 2, calculatedY)); 
        } else { // If drift is disabled or amount is zero, reset offsets
            driftState.x = 0; 
            driftState.y = 0; 
        }
    }

    /**
     * The main animation loop, called via `requestAnimationFrame`.
     * Calculates delta time, updates interpolators, updates continuous rotation,
     * and calls the `draw` method.
     * @param {number} timestamp - The current timestamp provided by `requestAnimationFrame`.
     */
    animationLoop(timestamp) {
        if (this.isDestroyed || this.animationFrameId === null) return; 
        this.animationFrameId = requestAnimationFrame(this.animationLoop); 
        
        if (!this.config.enabled) { return; } // Don't draw if not enabled

        if (!this.lastTimestamp) this.lastTimestamp = timestamp; 
        const elapsed = timestamp - this.lastTimestamp; 
        this.lastTimestamp = timestamp; 
        const rawDeltaTime = Math.max(0.001, elapsed / 1000.0); // Delta time in seconds, ensure positive

        // Smooth delta time
        this.deltaTimeBuffer.push(rawDeltaTime); 
        if (this.deltaTimeBuffer.length > DELTA_TIME_BUFFER_SIZE) { this.deltaTimeBuffer.shift(); } 
        this.smoothedDeltaTime = this.deltaTimeBuffer.reduce((a,b) => a+b,0) / this.deltaTimeBuffer.length; 
        
        // Ensure canvas is set up, especially if dimensions were initially zero
        if (this.lastValidWidth <= 0 || this.lastValidHeight <= 0 || !this.canvas || !this.ctx) { 
            this.setupCanvas().then(setupOk => { 
                if (setupOk && this.config.enabled) this.draw(timestamp, this.config); 
            }); 
            return; 
        } 
        
        // Ensure image is loaded and valid before attempting to draw
        if (!this.image?.complete || this.image?.naturalWidth === 0) { return; } 
        
        const now = performance.now(); 
        
        // Update interpolators
        this.xInterpolator?.update(now); 
        this.yInterpolator?.update(now); 
        this.angleInterpolator?.update(now); 
        
        // Update continuous rotation based on speed and direction
        const speed = this.config.speed ?? 0; 
        const direction = this.config.direction ?? 1; 
        const angleDelta = speed * direction * this.smoothedDeltaTime * 600; // Scaled for noticeable rotation
        this.continuousRotationAngle = (this.continuousRotationAngle + angleDelta) % 360; 
        
        this.draw(timestamp, this.config); // Perform the draw operation
    }
    
    /**
     * Forces a single redraw of the canvas with the current or provided configuration.
     * @async
     * @param {object | null} [configToUse=null] - Optional specific config to draw with.
     * @returns {Promise<boolean>} True if drawing was successful.
     */
    async forceRedraw(configToUse = null) { 
        if (this.isDestroyed || this.isDrawing) return false; 
        return this.drawStaticFrame(configToUse || this.config); 
    }

    /** Cleans up resources: stops animation, nullifies references. */
    destroy() { 
        this.isDestroyed = true; 
        this.stopAnimationLoop(); 
        this.image = null; 
        this.ctx = null; 
        this.canvas = null; 
        this.deltaTimeBuffer = []; 
        this.xInterpolator = null; 
        this.yInterpolator = null; 
        this.angleInterpolator = null; 
        this.lastDPR = 0; 
    }
}
export default CanvasManager;