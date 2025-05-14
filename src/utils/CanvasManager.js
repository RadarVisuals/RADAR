// src/utils/CanvasManager.js
import { BLEND_MODES } from '../config/global-config'; // Local config
import ValueInterpolator from './ValueInterpolator'; // Local utility

const SETUP_CANVAS_POLL_INTERVAL = 100; // ms, for polling parent dimensions if initially zero
const SETUP_CANVAS_POLL_TIMEOUT = 3000; // ms, max time to poll for dimensions
const MAX_TOTAL_OFFSET = 10000; // Max pixel offset for drift/positioning to prevent extreme values
const DELTA_TIME_BUFFER_SIZE = 5; // Number of frames to average for smoothedDeltaTime

const MIDI_XY_INTERPOLATION_DURATION = 80; // ms, duration for X/Y position interpolation
const MIDI_ANGLE_INTERPOLATION_DURATION = 60; // ms, duration for angle interpolation

/**
 * @file Manages an individual HTML5 Canvas for a visual layer.
 * Handles setup, image loading, configuration, animation, and drawing.
 * Renders with a 1:1 pixel ratio to CSS dimensions, letting the browser handle parent page zoom scaling.
 */

/**
 * @class CanvasManager
 * @description Orchestrates rendering and animation for a single canvas layer.
 * It encapsulates the canvas context, current image, configuration,
 * animation loop, and drawing logic for a specific visual layer.
 */
class CanvasManager {
    /** @type {HTMLCanvasElement | null} The HTML canvas element. */
    canvas = null;
    /** @type {CanvasRenderingContext2D | null} The 2D rendering context. */
    ctx = null;
    /** @type {string} Identifier for this layer (e.g., '1', '2', '3'). */
    layerId;
    /** @type {HTMLImageElement | null} The current image object being rendered. */
    image = null;
    /** @type {object} Current layer visual configuration. See `getDefaultConfig` for structure. */
    config;
    /** @type {number | null} ID of the animation frame request, null if not animating. */
    animationFrameId = null;
    /** @type {number} Timestamp of the last animation frame, used for delta time calculation. */
    lastTimestamp = 0;
    /** @type {boolean} Flag to prevent concurrent drawing operations, ensuring draw calls are serialized. */
    isDrawing = false;
    /** @type {boolean} Indicates if the manager instance has been destroyed and should not operate. */
    isDestroyed = false;
    /** @type {string | null} Source URL of the last successfully loaded image. */
    lastImageSrc = null;
    /** @type {number} Last known valid logical width of the canvas (CSS pixels). */
    lastValidWidth = 0;
    /** @type {number} Last known valid logical height of the canvas (CSS pixels). */
    lastValidHeight = 0;
    /** @type {number} Last Device Pixel Ratio used for setup (forced to 1 for 1:1 buffer). */
    lastDPR = 1;
    /** @type {number[]} Buffer for smoothing delta time values across recent frames. */
    deltaTimeBuffer = [];
    /** @type {number} Smoothed delta time in seconds, used for consistent animation speed. */
    smoothedDeltaTime = 1 / 60; // Default to 60 FPS
    /** @type {ValueInterpolator | null} Interpolator for x-axis position. */
    xInterpolator;
    /** @type {ValueInterpolator | null} Interpolator for y-axis position. */
    yInterpolator;
    /** @type {ValueInterpolator | null} Interpolator for angle. */
    angleInterpolator;
    /** @type {number} Continuously accumulating angle for rotation effects (degrees). */
    continuousRotationAngle = 0;
    /** @type {number} Size multiplier derived from audio frequency analysis. */
    audioFrequencyFactor = 1.0;
    /** @type {number} Temporary size multiplier for audio beat pulse effects. */
    beatPulseFactor = 1.0;
    /** @type {number} Timestamp (performance.now()) when the current audio beat pulse effect should end. */
    beatPulseEndTime = 0;

    /**
     * Creates an instance of CanvasManager.
     * @param {HTMLCanvasElement} canvas - The canvas element to manage.
     * @param {string} layerId - Identifier for this layer.
     * @throws {Error} If an invalid canvas element is provided or context cannot be obtained.
     */
    constructor(canvas, layerId) {
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            throw new Error(`[CM L${layerId}] Invalid canvas element provided.`);
        }
        this.canvas = canvas;
        try {
            this.ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false }); // willReadFrequently false for potential perf gain
            if (!this.ctx) {
                throw new Error(`Failed to get 2D context for Layer ${layerId} (returned null)`);
            }
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error(`[CM L${layerId}] Error getting context:`, e);
            }
            throw new Error(`Failed to get 2D context for Layer ${layerId}: ${e.message}`);
        }
        this.layerId = layerId;
        this.config = this.getDefaultConfig();
        this.lastDPR = 1; // Force DPR 1 for buffer to match CSS pixels

        this.xInterpolator = new ValueInterpolator(this.config.xaxis, MIDI_XY_INTERPOLATION_DURATION);
        this.yInterpolator = new ValueInterpolator(this.config.yaxis, MIDI_XY_INTERPOLATION_DURATION);
        this.angleInterpolator = new ValueInterpolator(this.config.angle, MIDI_ANGLE_INTERPOLATION_DURATION);

        this.animationLoop = this.animationLoop.bind(this); // Bind for requestAnimationFrame
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
            speed: 0.01, // Speed for continuous rotation
            drift: 0, // Magnitude of drift
            driftSpeed: 0.1, // Speed of drift oscillation
            angle: 0, // Base angle (degrees)
            xaxis: 0, // Base X offset
            yaxis: 0, // Base Y offset
            direction: 1, // Direction multiplier for speed (-1 or 1)
            driftState: { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false },
            audioSource: 'level', // Example: 'level', 'frequency', 'beat' (for future audio reactivity)
        };
    }

    /**
     * Sets up canvas dimensions (1:1 with CSS pixels) and context transform.
     * This method is crucial for ensuring the canvas is correctly sized and scaled.
     * It polls briefly if initial dimensions are zero.
     * @async
     * @returns {Promise<boolean>} True if setup was successful or if no changes were needed.
     *                             False if setup failed (e.g., canvas parent not found, zero dimensions after poll).
     */
    async setupCanvas() {
        const logPrefix = `[CM L${this.layerId}] setupCanvas:`;
        if (!this.canvas || this.isDestroyed) {
            if (import.meta.env.DEV) {
                console.warn(`${logPrefix} Aborted - canvas null or destroyed.`);
            }
            this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false;
        }
        const parent = this.canvas.parentElement;
        if (!parent) {
            if (import.meta.env.DEV) {
                console.warn(`${logPrefix} Aborted - no parent element.`);
            }
            this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false;
        }

        const dprForBuffer = 1; // Force DPR 1 for buffer size calculation (1:1 with CSS pixels)

        const parentRectImmediate = parent.getBoundingClientRect();
        const currentLogicalWidth = Math.floor(parentRectImmediate.width);
        const currentLogicalHeight = Math.floor(parentRectImmediate.height);

        if (import.meta.env.DEV && (currentLogicalWidth !== this.lastValidWidth || currentLogicalHeight !== this.lastValidHeight || this.lastDPR !== dprForBuffer)) {
            console.log(`${logPrefix} Initial/Change Check - ParentRect: ${currentLogicalWidth}x${currentLogicalHeight}, DPR for Buffer (FORCED): ${dprForBuffer}`);
        }

        // Check if dimensions and DPR are already correct and valid
        if (
            currentLogicalWidth === this.lastValidWidth &&
            currentLogicalHeight === this.lastValidHeight &&
            this.canvas.width === currentLogicalWidth &&
            this.canvas.height === currentLogicalHeight &&
            currentLogicalWidth > 0 && currentLogicalHeight > 0 &&
            this.lastDPR === dprForBuffer
        ) {
            return true; // No changes needed
        }

        let logicalWidth = currentLogicalWidth;
        let logicalHeight = currentLogicalHeight;

        // Poll if dimensions are initially zero (e.g., due to layout shifts)
        if (logicalWidth <= 0 || logicalHeight <= 0) {
            if (import.meta.env.DEV) {
                console.log(`${logPrefix} Zero/Invalid initial dimensions. Starting poll...`);
            }
            let attempts = 0;
            const maxAttempts = SETUP_CANVAS_POLL_TIMEOUT / SETUP_CANVAS_POLL_INTERVAL;
            while (attempts < maxAttempts) {
                attempts++;
                if (!parent.isConnected) { // Check if parent is still in DOM
                    if (import.meta.env.DEV) {
                        console.warn(`${logPrefix} Parent disconnected during poll.`);
                    }
                    this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false;
                }
                const rect = parent.getBoundingClientRect();
                logicalWidth = Math.floor(rect.width);
                logicalHeight = Math.floor(rect.height);
                if (logicalWidth > 0 && logicalHeight > 0) break; // Valid dimensions found
                await new Promise(resolve => setTimeout(resolve, SETUP_CANVAS_POLL_INTERVAL));
            }
        }

        // Final check after potential polling
        if (logicalWidth <= 0 || logicalHeight <= 0) {
             if (import.meta.env.DEV) {
                 console.error(`${logPrefix} FAILED - Zero Dimensions after timeout/check (${logicalWidth}x${logicalHeight}).`);
             }
             this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0;
             if (this.canvas && (this.canvas.width > 0 || this.canvas.height > 0)) { // Attempt to clear canvas if it had dimensions
                 try { this.canvas.width = 0; this.canvas.height = 0; } catch(e) {
                    if (import.meta.env.DEV) {
                        console.error(`${logPrefix} Error zeroing canvas w/h during failed setup:`, e);
                    }
                 }
             }
             return false;
        }

        const targetRenderWidth = logicalWidth; // Buffer width = logical width (DPR 1)
        const targetRenderHeight = logicalHeight; // Buffer height = logical height (DPR 1)

        if (!this.canvas) { // Should not happen if initial check passed, but defensive
            if (import.meta.env.DEV) {
                console.error(`${logPrefix} Canvas became null unexpectedly during setup.`);
            }
            this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false;
        }

        let resized = false;
        if (this.canvas.width !== targetRenderWidth || this.canvas.height !== targetRenderHeight) {
            try {
                this.canvas.width = targetRenderWidth;
                this.canvas.height = targetRenderHeight;
                resized = true;
                if (import.meta.env.DEV) {
                    console.log(`${logPrefix} Canvas buffer resized to: ${this.canvas.width}x${this.canvas.height}`);
                }
            } catch(e) {
                if (import.meta.env.DEV) {
                    console.error(`${logPrefix} Error setting canvas buffer w/h:`, e);
                }
                return false; // Critical error if buffer cannot be set
            }
        }

        if (this.canvas.style.width !== `${logicalWidth}px` || this.canvas.style.height !== `${logicalHeight}px`) {
             try {
                 this.canvas.style.width = `${logicalWidth}px`;
                 this.canvas.style.height = `${logicalHeight}px`;
                 if (import.meta.env.DEV) {
                     console.log(`${logPrefix} Canvas style set to: ${this.canvas.style.width}x${this.canvas.style.height}`);
                 }
             } catch (e) {
                 if (import.meta.env.DEV) {
                     console.warn(`${logPrefix} Error setting canvas style w/h:`, e);
                 }
             }
        }

        if ((resized || this.ctx) && this.ctx) { // Ensure ctx exists
            try {
                this.ctx.setTransform(dprForBuffer, 0, 0, dprForBuffer, 0, 0); // Apply forced DPR
                if (import.meta.env.DEV) {
                    console.log(`${logPrefix} Context transform set with dprForBuffer (FORCED): ${dprForBuffer}`);
                }
            } catch (e) {
                 if (import.meta.env.DEV) {
                     console.error(`${logPrefix} Context transform error:`, e);
                 }
            }
        }

        this.lastValidWidth = logicalWidth;
        this.lastValidHeight = logicalHeight;
        this.lastDPR = dprForBuffer;

        this.xInterpolator?.snap(this.config.xaxis);
        this.yInterpolator?.snap(this.config.yaxis);
        this.angleInterpolator?.snap(this.config.angle);

        if (import.meta.env.DEV) {
            console.log(`${logPrefix} Setup successful. LastValid: ${this.lastValidWidth}x${this.lastValidHeight}, LastDPR (FORCED): ${this.lastDPR}`);
        }
        return true;
    }

    /**
     * Applies a full new configuration object to the layer, merging with defaults.
     * @param {object} newConfig - The new configuration object to apply. Missing properties will revert to default.
     */
    applyFullConfig(newConfig) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        const mergedConfig = { ...defaultConfig };

        for (const key in defaultConfig) {
            if (Object.prototype.hasOwnProperty.call(defaultConfig, key)) {
                if (newConfig && Object.prototype.hasOwnProperty.call(newConfig, key) && newConfig[key] !== undefined && newConfig[key] !== null) {
                    if (key === 'driftState' && typeof newConfig[key] === 'object' && defaultConfig[key] && typeof defaultConfig[key] === 'object') {
                        mergedConfig.driftState = { ...(defaultConfig.driftState || {}), ...(newConfig[key] || {}), };
                        mergedConfig.driftState.x = typeof mergedConfig.driftState.x === 'number' ? mergedConfig.driftState.x : 0;
                        mergedConfig.driftState.y = typeof mergedConfig.driftState.y === 'number' ? mergedConfig.driftState.y : 0;
                        mergedConfig.driftState.phase = typeof mergedConfig.driftState.phase === 'number' ? mergedConfig.driftState.phase : Math.random() * Math.PI * 2;
                        mergedConfig.driftState.enabled = typeof mergedConfig.driftState.enabled === 'boolean' ? mergedConfig.driftState.enabled : false;
                    } else {
                        mergedConfig[key] = this.validateValue(key, newConfig[key], defaultConfig[key]);
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
        this.continuousRotationAngle = 0;

        this.handleEnabledToggle(this.config.enabled);
    }

    /**
     * Validates a configuration value against its expected type and constraints.
     * @param {string} key - The configuration key.
     * @param {*} value - The value to validate.
     * @param {*} defaultValue - The default value to infer type and use as fallback.
     * @returns {*} The validated value, or the default value if validation fails.
     */
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

    /**
     * Starts or stops the animation loop based on the enabled state.
     * Clears the canvas if disabling.
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
                    if (import.meta.env.DEV) {
                        console.error(`[CM L${this.layerId}] Error clearing canvas on disable:`, e);
                    }
                }
            }
        }
    }

    /**
     * Immediately sets a visual property's value in the config and snaps its interpolator.
     * @param {string} key - The configuration key (e.g., 'xaxis', 'opacity').
     * @param {*} value - The new value to set.
     */
    snapVisualProperty(key, value) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) {
            if (import.meta.env.DEV) {
                console.warn(`[CM L${this.layerId}] snapVisualProperty: Unknown property '${key}'.`);
            }
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
     * For 'xaxis', 'yaxis', 'angle', this behaves like snapVisualProperty.
     * @param {string} key - The configuration key.
     * @param {*} value - The new value.
     */
    updateConfigProperty(key, value) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();

        if (key === 'xaxis' || key === 'yaxis' || key === 'angle') {
            this.snapVisualProperty(key, value);
            return;
        }

        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) {
            return; // Silently ignore unknown properties
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

    /** Starts the animation loop if not already running and the layer is enabled. */
    startAnimationLoop() {
        if (this.isDestroyed || this.animationFrameId !== null || !this.config.enabled) return;
        this.lastTimestamp = performance.now();
        this.deltaTimeBuffer = [];
        this.smoothedDeltaTime = 1 / 60;
        this.animationFrameId = requestAnimationFrame(this.animationLoop);
    }

    /** Stops the animation loop. */
    stopAnimationLoop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isDrawing = false;
    }

    /**
     * Performs a single static draw operation using the current or provided configuration.
     * @async
     * @param {object | null} [configToUse=null] - Optional config object. Defaults to current config.
     * @returns {Promise<boolean>} True if draw was successfully initiated.
     */
    async drawStaticFrame(configToUse = null) {
        if (this.isDestroyed || this.isDrawing) return false;
        const setupSuccess = await this.setupCanvas();
        if (!setupSuccess) return false;

        this.smoothedDeltaTime = 1 / 60;
        const currentConfig = configToUse || this.config;

        this.xInterpolator?.snap(currentConfig.xaxis);
        this.yInterpolator?.snap(currentConfig.yaxis);
        this.angleInterpolator?.snap(currentConfig.angle);
        this.continuousRotationAngle = 0;

        return this.draw(performance.now(), currentConfig);
    }

    /**
     * Loads an image from the given source URL.
     * @async
     * @param {string} src - The source URL of the image.
     * @returns {Promise<void>} Resolves when image is loaded, rejects on error.
     */
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
            img.onerror = (errEvent) => { // errEvent is an Event, not Error directly
                if (this.isDestroyed) return reject(new Error("Manager destroyed during image load error"));
                this.image = null; this.lastImageSrc = null;
                const errorMsg = typeof errEvent === 'string' ? errEvent : (errEvent?.type || 'Unknown image load error');
                reject(new Error(`Failed to load image: ${src.substring(0, 50)}... Error: ${errorMsg}`));
            };
            img.src = src;
        });
    }

    /**
     * Sets the target value for an interpolated parameter (e.g., from MIDI input).
     * @param {string} param - The parameter key ('xaxis', 'yaxis', 'angle').
     * @param {number} targetValue - The new target value.
     */
    setTargetValue(param, targetValue) {
        if (this.isDestroyed) return;
        const validatedValue = Number(targetValue);
        if (isNaN(validatedValue)) {
            if (import.meta.env.DEV) {
                console.warn(`[CM L${this.layerId}] Invalid MIDI target value for ${param}: ${targetValue}`);
            }
            return;
        }
        if (Object.prototype.hasOwnProperty.call(this.config, param)) {
            this.config[param] = validatedValue;
        } else {
            if (import.meta.env.DEV) {
                console.warn(`[CM L${this.layerId}] Unknown MIDI parameter '${param}' for setTargetValue.`);
            }
            return;
        }

        if (param === 'xaxis' && this.xInterpolator) this.xInterpolator.setTarget(validatedValue);
        else if (param === 'yaxis' && this.yInterpolator) this.yInterpolator.setTarget(validatedValue);
        else if (param === 'angle' && this.angleInterpolator) this.angleInterpolator.setTarget(validatedValue);
    }

    /**
     * Sets the audio frequency factor used for size modification.
     * @param {number} factor - The size multiplier based on audio frequency. Defaults to 1.0.
     */
    setAudioFrequencyFactor(factor) { if (this.isDestroyed) return; this.audioFrequencyFactor = Number(factor) || 1.0; }

    /**
     * Triggers a temporary beat pulse effect on the layer's size.
     * @param {number} pulseFactor - The size multiplier during the pulse. Defaults to 1.0.
     * @param {number} duration - The duration of the pulse in milliseconds. Defaults to 0.
     */
    triggerBeatPulse(pulseFactor, duration) { if (this.isDestroyed) return; this.beatPulseFactor = Number(pulseFactor) || 1.0; this.beatPulseEndTime = performance.now() + (Number(duration) || 0); }

    /** Resets any active audio-driven modifications to their defaults. */
    resetAudioModifications() { if (this.isDestroyed) return; this.audioFrequencyFactor = 1.0; this.beatPulseFactor = 1.0; this.beatPulseEndTime = 0; }

    /**
     * Returns a deep copy of the current configuration object.
     * @returns {object} A deep copy of the layer's configuration.
     */
    getConfigData() { return JSON.parse(JSON.stringify(this.config)); }

    /**
     * The core drawing function, called within the animation loop or for static frames.
     * @param {number} timestamp - The current timestamp.
     * @param {object | null} [configToUse=null] - The configuration object to use. Defaults to current config.
     * @returns {boolean} True if drawing was performed.
     */
    draw(timestamp, configToUse = null) {
        const currentConfig = configToUse || this.config;
        const logPrefix = `[CM L${this.layerId}] draw:`;

        if (this.isDestroyed || !currentConfig?.enabled || this.isDrawing ||
            !this.canvas || !this.ctx || !this.image || !this.image.complete ||
            this.image.naturalWidth === 0 || this.lastValidWidth <= 0 || this.lastValidHeight <= 0) {
            this.isDrawing = false;
            return false;
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
            imgDrawWidth = Math.max(1, Math.floor(imgDrawWidth));
            imgDrawHeight = Math.max(1, Math.floor(imgDrawHeight));

            this.updateDrift(currentConfig, this.smoothedDeltaTime);
            const driftX = currentConfig.driftState?.x ?? 0;
            const driftY = currentConfig.driftState?.y ?? 0;

            const currentX = this.xInterpolator?.isCurrentlyInterpolating() ? this.xInterpolator.getCurrentValue() : this.config.xaxis;
            const currentY = this.yInterpolator?.isCurrentlyInterpolating() ? this.yInterpolator.getCurrentValue() : this.config.yaxis;
            const baseAngle = this.angleInterpolator?.isCurrentlyInterpolating() ? this.angleInterpolator.getCurrentValue() : this.config.angle;

            const offsetX = currentX / 10;
            const offsetY = currentY / 10;
            const finalAngle = baseAngle + this.continuousRotationAngle;
            const angleRad = (finalAngle % 360) * Math.PI / 180;

            const finalCenterX_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfWidth / 2 + offsetX + driftX));
            const finalCenterY_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfHeight / 2 + offsetY + driftY));

            if (import.meta.env.DEV && (width < 100 || height < 100 || imgDrawWidth < 10 || imgDrawHeight < 10)) {
                // console.log(`${logPrefix} Draw Params - LogicalWH: ${width}x${height}, ImgDrawWH: ${imgDrawWidth}x${imgDrawHeight}, FinalCenterTL: ${finalCenterX_TL.toFixed(1)}x${finalCenterY_TL.toFixed(1)}, Angle: ${finalAngle.toFixed(1)}, Opacity: ${currentConfig.opacity}, ImageSrc: ${this.image.src.substring(0,50)}...`);
            }

            try { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
            catch (e) {
                if (import.meta.env.DEV) {
                    console.error(`${logPrefix} Error clearing canvas:`, e);
                }
                this.isDrawing = false; return false;
            }

            this.ctx.globalAlpha = currentConfig.opacity ?? 1.0;

            const drawImageWithRotation = () => {
                 try {
                    this.ctx.save();
                    this.ctx.rotate(angleRad);
                    if (this.image?.complete && this.image?.naturalWidth > 0) {
                        this.ctx.drawImage(this.image, 0, 0, imgNaturalWidth, imgNaturalHeight, -imgDrawWidth / 2, -imgDrawHeight / 2, imgDrawWidth, imgDrawHeight);
                    }
                    this.ctx.restore();
                } catch (e) { if (import.meta.env.DEV) console.error(`${logPrefix} drawImage error:`, e); }
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
            if (import.meta.env.DEV) {
                console.error(`${logPrefix} Unexpected draw error:`, e);
            }
            this.isDrawing = false;
            return false;
        }
    }

    /**
     * Updates the drift state (position and phase) based on configuration and delta time.
     * @param {object} config - The current layer configuration containing drift settings.
     * @param {number} deltaTime - The smoothed time elapsed since the last frame in seconds.
     */
    updateDrift(config, deltaTime) {
        if (!config?.driftState) return;
        const {driftState} = config;
        const driftAmount = config.drift ?? 0;
        const driftSpeed = config.driftSpeed ?? 0.1;

        if(driftAmount > 0 && driftState.enabled){
            if(typeof driftState.phase !== "number" || isNaN(driftState.phase)) {
                driftState.phase = Math.random() * Math.PI * 2;
            }
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

    /**
     * The main animation loop callback function.
     * @param {number} timestamp - The timestamp provided by requestAnimationFrame.
     */
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
            this.setupCanvas().then(setupOk => {
                if (setupOk && this.config.enabled) this.draw(timestamp, this.config);
            });
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

    /**
     * Forces a single redraw of the canvas using the current or provided configuration.
     * @async
     * @param {object | null} [configToUse=null] - Optional config object. Defaults to current config.
     * @returns {Promise<boolean>} True if the redraw was successfully initiated.
     */
    async forceRedraw(configToUse = null) {
        if (this.isDestroyed || this.isDrawing) return false;
        return this.drawStaticFrame(configToUse || this.config);
    }

    /**
     * Cleans up resources: stops animation loop, releases references.
     */
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
        this.lastValidWidth = 0;
        this.lastValidHeight = 0;
        if (import.meta.env.DEV) {
            console.log(`[CM L${this.layerId}] Destroyed.`);
        }
    }
}
export default CanvasManager;