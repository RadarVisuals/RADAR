// src/utils/CanvasManager.js
import { BLEND_MODES } from '../config/global-config';
import ValueInterpolator from './ValueInterpolator';

const SETUP_CANVAS_POLL_INTERVAL = 100;
const SETUP_CANVAS_POLL_TIMEOUT = 3000;
const MAX_TOTAL_OFFSET = 10000;
const DELTA_TIME_BUFFER_SIZE = 5;

const MIDI_XY_INTERPOLATION_DURATION = 80;
const MIDI_ANGLE_INTERPOLATION_DURATION = 60;

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
    /** @type {string} Identifier for this layer. */
    layerId;
    /** @type {HTMLImageElement | null} The current image object. */
    image = null;
    /** @type {object} Current layer visual configuration. */
    config;
    /** @type {number | null} ID of the animation frame request. */
    animationFrameId = null;
    /** @type {number} Timestamp of the last animation frame. */
    lastTimestamp = 0;
    /** @type {boolean} Prevents concurrent drawing operations. */
    isDrawing = false;
    /** @type {boolean} Indicates if the manager has been destroyed. */
    isDestroyed = false;
    /** @type {string | null} Source URL of the last loaded image. */
    lastImageSrc = null;
    /** @type {number} Last known valid logical width (CSS pixels). */
    lastValidWidth = 0;
    /** @type {number} Last known valid logical height (CSS pixels). */
    lastValidHeight = 0;
    /** @type {number} Last DPR used for setup (forced to 1). */
    lastDPR = 1;
    /** @type {number[]} Buffer for smoothing delta time. */
    deltaTimeBuffer = [];
    /** @type {number} Smoothed delta time (seconds) for animations. */
    smoothedDeltaTime = 1 / 60;
    /** @type {ValueInterpolator} Interpolator for x-axis position. */
    xInterpolator;
    /** @type {ValueInterpolator} Interpolator for y-axis position. */
    yInterpolator;
    /** @type {ValueInterpolator} Interpolator for angle. */
    angleInterpolator;
    /** @type {number} Continuously accumulating angle for rotation. */
    continuousRotationAngle = 0;
    /** @type {number} Size multiplier from audio frequency. */
    audioFrequencyFactor = 1.0;
    /** @type {number} Size multiplier for audio beat pulse. */
    beatPulseFactor = 1.0;
    /** @type {number} End time for current audio beat pulse. */
    beatPulseEndTime = 0;

    /**
     * Creates an instance of CanvasManager.
     * @param {HTMLCanvasElement} canvas - The canvas element to manage.
     * @param {string} layerId - Identifier for this layer.
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
            if (import.meta.env.DEV) {
                console.error(`[CM L${layerId}] Error getting context:`, e);
            }
            throw new Error(`Failed to get 2D context for Layer ${layerId}: ${e.message}`);
        }
        this.layerId = layerId;
        this.config = this.getDefaultConfig();
        this.lastDPR = 1; // Force DPR 1 for buffer

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
            audioSource: 'level', // Example: 'level', 'frequency', 'beat'
        };
    }

    /**
     * Sets up canvas dimensions (1:1 with CSS pixels) and context transform.
     * This method is crucial for ensuring the canvas is correctly sized and scaled,
     * especially when dealing with browser zoom or dynamic layout changes.
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

        const dprForBuffer = 1; // Force DPR 1 for buffer size calculation

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
            this.canvas.width === currentLogicalWidth && // Buffer size matches logical size (DPR=1)
            this.canvas.height === currentLogicalHeight &&
            currentLogicalWidth > 0 && currentLogicalHeight > 0 &&
            this.lastDPR === dprForBuffer // DPR hasn't changed (always 1 here)
        ) {
            return true; // No changes needed
        }

        let logicalWidth = currentLogicalWidth;
        let logicalHeight = currentLogicalHeight;

        // Poll if dimensions are initially zero
        if (logicalWidth <= 0 || logicalHeight <= 0) {
            if (import.meta.env.DEV) {
                console.log(`${logPrefix} Zero/Invalid initial dimensions. Starting poll...`);
            }
            let attempts = 0;
            const maxAttempts = SETUP_CANVAS_POLL_TIMEOUT / SETUP_CANVAS_POLL_INTERVAL;
            while (attempts < maxAttempts) {
                attempts++;
                if (!parent.isConnected) {
                    if (import.meta.env.DEV) {
                        console.warn(`${logPrefix} Parent disconnected during poll.`);
                    }
                    this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false;
                }
                const rect = parent.getBoundingClientRect();
                logicalWidth = Math.floor(rect.width);
                logicalHeight = Math.floor(rect.height);
                if (logicalWidth > 0 && logicalHeight > 0) break;
                await new Promise(resolve => setTimeout(resolve, SETUP_CANVAS_POLL_INTERVAL));
            }
        }

        // Final check after potential polling
        if (logicalWidth <= 0 || logicalHeight <= 0) {
             if (import.meta.env.DEV) {
                 console.error(`${logPrefix} FAILED - Zero Dimensions after timeout/check (${logicalWidth}x${logicalHeight}).`);
             }
             this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0;
             if (this.canvas && (this.canvas.width > 0 || this.canvas.height > 0)) {
                 try { this.canvas.width = 0; this.canvas.height = 0; } catch(e) {
                    if (import.meta.env.DEV) {
                        console.error(`${logPrefix} Error zeroing canvas w/h during failed setup:`, e);
                    }
                 }
             }
             return false;
        }

        // Calculate target buffer size (always logical size because DPR=1)
        const targetRenderWidth = logicalWidth;
        const targetRenderHeight = logicalHeight;

        if (!this.canvas) { // Should not happen, but check defensively
            if (import.meta.env.DEV) {
                console.error(`${logPrefix} Canvas became null unexpectedly.`);
            }
            this.lastValidWidth = 0; this.lastValidHeight = 0; this.lastDPR = 0; return false;
        }

        let resized = false;
        // Resize the canvas buffer if needed
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
                return false; // Critical error
            }
        }

        // Set the CSS style size to match the logical dimensions
        if (this.canvas.style.width !== `${logicalWidth}px` || this.canvas.style.height !== `${logicalHeight}px`) {
             try {
                 this.canvas.style.width = `${logicalWidth}px`;
                 this.canvas.style.height = `${logicalHeight}px`;
                 if (import.meta.env.DEV) {
                     console.log(`${logPrefix} Canvas style set to: ${this.canvas.style.width}x${this.canvas.style.height}`);
                 }
             } catch (e) {
                 // Non-critical, might happen in weird edge cases
                 if (import.meta.env.DEV) {
                     console.warn(`${logPrefix} Error setting canvas style w/h:`, e);
                 }
             }
        }

        // Apply context transform if resized or context exists
        if ((resized || this.ctx) && this.ctx) { // Ensure ctx exists before transforming
            try {
                // Reset transform and apply scaling based on forced DPR (which is 1)
                this.ctx.setTransform(dprForBuffer, 0, 0, dprForBuffer, 0, 0);
                if (import.meta.env.DEV) {
                    console.log(`${logPrefix} Context transform set with dprForBuffer (FORCED): ${dprForBuffer}`);
                }
            } catch (e) {
                 // Log error but continue if possible
                 if (import.meta.env.DEV) {
                     console.error(`${logPrefix} Context transform error:`, e);
                 }
            }
        }

        // Update last known valid dimensions and DPR
        this.lastValidWidth = logicalWidth;
        this.lastValidHeight = logicalHeight;
        this.lastDPR = dprForBuffer; // Store the forced DPR used

        // Snap interpolators to current config values after resize
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

        // Merge provided config with defaults, validating types
        for (const key in defaultConfig) {
            if (Object.prototype.hasOwnProperty.call(defaultConfig, key)) {
                if (newConfig && Object.prototype.hasOwnProperty.call(newConfig, key) && newConfig[key] !== undefined && newConfig[key] !== null) {
                    // Special handling for nested driftState
                    if (key === 'driftState' && typeof newConfig[key] === 'object' && defaultConfig[key] && typeof defaultConfig[key] === 'object') {
                        mergedConfig.driftState = { ...(defaultConfig.driftState || {}), ...(newConfig[key] || {}), };
                        // Ensure driftState properties have correct types
                        mergedConfig.driftState.x = typeof mergedConfig.driftState.x === 'number' ? mergedConfig.driftState.x : 0;
                        mergedConfig.driftState.y = typeof mergedConfig.driftState.y === 'number' ? mergedConfig.driftState.y : 0;
                        mergedConfig.driftState.phase = typeof mergedConfig.driftState.phase === 'number' ? mergedConfig.driftState.phase : Math.random() * Math.PI * 2;
                        mergedConfig.driftState.enabled = typeof mergedConfig.driftState.enabled === 'boolean' ? mergedConfig.driftState.enabled : false;
                    } else {
                        mergedConfig[key] = this.validateValue(key, newConfig[key], defaultConfig[key]);
                    }
                } else {
                    // Use default if not provided in newConfig
                    mergedConfig[key] = defaultConfig[key];
                }
            }
        }
        // Ensure blend mode is valid
        if (!BLEND_MODES.includes(mergedConfig.blendMode)) { mergedConfig.blendMode = 'normal'; }

        // Ensure driftState exists and is properly configured based on drift value
        if (!mergedConfig.driftState || typeof mergedConfig.driftState !== 'object') {
            mergedConfig.driftState = { x:0,y:0,phase:Math.random()*Math.PI*2,enabled:false };
        }
        mergedConfig.driftState.enabled = (mergedConfig.drift || 0) > 0;
        if (!mergedConfig.driftState.enabled) {
            mergedConfig.driftState.x = 0;
            mergedConfig.driftState.y = 0;
        }

        this.config = mergedConfig;

        // Apply blend mode to canvas style
        if (this.canvas?.style) {
            this.canvas.style.mixBlendMode = this.config.blendMode || "normal";
        }

        // Snap interpolators to the new values
        this.xInterpolator?.snap(this.config.xaxis);
        this.yInterpolator?.snap(this.config.yaxis);
        this.angleInterpolator?.snap(this.config.angle);
        this.continuousRotationAngle = 0; // Reset continuous rotation on full config apply

        // Start/stop animation loop based on enabled state
        this.handleEnabledToggle(this.config.enabled);
    }

    /**
     * Validates a configuration value against its expected type and constraints.
     * @param {string} key - The configuration key (e.g., 'opacity', 'size').
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
            // Apply constraints
            if (key === 'opacity') validated = Math.max(0, Math.min(1, validated));
            if (key === 'size') validated = Math.max(0.01, validated); // Ensure size is positive
        } else if (defaultValueType === 'string') {
            validated = String(value);
            // Validate blend mode
            if (key === 'blendMode' && !BLEND_MODES.includes(validated)) {
                validated = defaultValue;
            }
        } else if (defaultValueType === 'boolean') {
            validated = Boolean(value);
        }
        // Note: Does not validate object types like driftState here, handled in applyFullConfig
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
            // Clear canvas when disabling
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
     * Immediately sets a visual property's value in the config and snaps its interpolator (if applicable).
     * Use this for immediate changes that shouldn't be interpolated (e.g., direct user input).
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

        // Snap corresponding interpolator or apply direct style
        if (key === 'xaxis' && this.xInterpolator) this.xInterpolator.snap(validatedValue);
        else if (key === 'yaxis' && this.yInterpolator) this.yInterpolator.snap(validatedValue);
        else if (key === 'angle' && this.angleInterpolator) this.angleInterpolator.snap(validatedValue);
        else if (key === 'blendMode' && this.canvas?.style) this.canvas.style.mixBlendMode = validatedValue || 'normal';
        else if (key === 'drift') {
            // Update drift state based on new drift value
            if (!this.config.driftState) this.config.driftState = { x:0,y:0,phase:Math.random()*Math.PI*2,enabled:false };
            this.config.driftState.enabled = validatedValue > 0;
            if (!this.config.driftState.enabled) { this.config.driftState.x = 0; this.config.driftState.y = 0; }
        } else if (key === 'enabled') this.handleEnabledToggle(validatedValue);
        // Other properties like opacity, size, speed, direction are used directly in the draw/animation loop
    }

    /**
     * Updates a non-interpolated configuration property directly.
     * For properties like 'opacity', 'speed', 'blendMode', 'enabled', etc.
     * For 'xaxis', 'yaxis', 'angle', this behaves like snapVisualProperty.
     * @param {string} key - The configuration key.
     * @param {*} value - The new value.
     */
    updateConfigProperty(key, value) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();

        // Use snap for interpolated properties even when called via updateConfigProperty
        if (key === 'xaxis' || key === 'yaxis' || key === 'angle') {
            this.snapVisualProperty(key, value);
            return;
        }

        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) {
            // Silently ignore unknown properties
            return;
        }
        const validatedValue = this.validateValue(key, value, defaultConfig[key]);
        this.config[key] = validatedValue;

        // Apply direct effects for specific properties
        if (key === 'blendMode' && this.canvas?.style) this.canvas.style.mixBlendMode = validatedValue || 'normal';
        else if (key === 'drift') {
             if (!this.config.driftState) this.config.driftState = { x:0,y:0,phase:Math.random()*Math.PI*2,enabled:false };
             this.config.driftState.enabled = validatedValue > 0;
             if (!this.config.driftState.enabled) { this.config.driftState.x = 0; this.config.driftState.y = 0; }
        } else if (key === 'enabled') this.handleEnabledToggle(validatedValue);
    }

    /**
     * Starts the animation loop if not already running and the layer is enabled.
     */
    startAnimationLoop() {
        if (this.isDestroyed || this.animationFrameId !== null || !this.config.enabled) return;
        this.lastTimestamp = performance.now();
        this.deltaTimeBuffer = []; // Reset buffer on start
        this.smoothedDeltaTime = 1 / 60; // Reset smoothed delta time
        this.animationFrameId = requestAnimationFrame(this.animationLoop);
    }

    /**
     * Stops the animation loop.
     */
    stopAnimationLoop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isDrawing = false; // Ensure drawing flag is reset
    }

    /**
     * Performs a single static draw operation using the current or provided configuration.
     * Ensures canvas is set up before drawing. Snaps interpolators for the static frame.
     * @async
     * @param {object | null} [configToUse=null] - Optional config object to use for this draw call. Defaults to the current config.
     * @returns {Promise<boolean>} True if the draw was successfully initiated, false otherwise.
     */
    async drawStaticFrame(configToUse = null) {
        if (this.isDestroyed || this.isDrawing) return false;
        const setupSuccess = await this.setupCanvas();
        if (!setupSuccess) return false;

        this.smoothedDeltaTime = 1 / 60; // Use a default delta time for static draw calculations if needed
        const config = configToUse || this.config;

        // Snap interpolators to the target values for this static frame
        this.xInterpolator?.snap(config.xaxis);
        this.yInterpolator?.snap(config.yaxis);
        this.angleInterpolator?.snap(config.angle);
        this.continuousRotationAngle = 0; // Reset continuous rotation for static frame

        return this.draw(performance.now(), config); // Pass current time and config
    }

    /**
     * Loads an image from the given source URL. Handles CORS for external URLs.
     * Rejects if the source is invalid or the image fails to load or has zero dimensions.
     * @async
     * @param {string} src - The source URL of the image.
     * @returns {Promise<void>} Resolves when the image is loaded and valid, rejects on error.
     */
    async setImage(src) {
        if (this.isDestroyed) return Promise.reject(new Error("Manager destroyed"));
        return new Promise((resolve, reject) => {
            if (!src || typeof src !== 'string') {
                this.image = null; this.lastImageSrc = null;
                return reject(new Error("Invalid image source"));
            }
            // Avoid reloading if the source is the same and the image is already loaded and valid
            if (src === this.lastImageSrc && this.image?.complete && this.image?.naturalWidth > 0) {
                return resolve();
            }

            const img = new Image();
            // Handle potential CORS issues for external images
            if (src.startsWith('http') && !src.startsWith(window.location.origin)) {
                img.crossOrigin = "anonymous";
            }
            img.onload = () => {
                if (this.isDestroyed) return resolve(); // Resolve silently if destroyed during load
                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                    this.image = null; this.lastImageSrc = null;
                    reject(new Error(`Loaded image has zero dimensions: ${src.substring(0, 100)}`)); return;
                }
                this.image = img; this.lastImageSrc = src;
                resolve();
            };
            img.onerror = (err) => {
                if (this.isDestroyed) return reject(new Error("Manager destroyed during image load error"));
                this.image = null; this.lastImageSrc = null;
                reject(new Error(`Failed to load image: ${src.substring(0, 50)}... Error: ${err}`));
            };
            img.src = src;
        });
    }

    /**
     * Sets the target value for an interpolated parameter (e.g., from MIDI input).
     * The value will be smoothly interpolated towards by the corresponding ValueInterpolator.
     * Also updates the config value immediately.
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
        // Update the config value directly as well
        if (Object.prototype.hasOwnProperty.call(this.config, param)) {
            this.config[param] = validatedValue;
        } else {
            if (import.meta.env.DEV) {
                console.warn(`[CM L${this.layerId}] Unknown MIDI parameter '${param}' for setTargetValue.`);
            }
            return; // Don't try to set target on unknown param
        }

        // Set the target for the appropriate interpolator
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

    /**
     * Resets any active audio-driven modifications (frequency factor, beat pulse) to their defaults.
     */
    resetAudioModifications() { if (this.isDestroyed) return; this.audioFrequencyFactor = 1.0; this.beatPulseFactor = 1.0; this.beatPulseEndTime = 0; }

    /**
     * Returns a deep copy of the current configuration object.
     * @returns {object} A deep copy of the layer's configuration.
     */
    getConfigData() { return JSON.parse(JSON.stringify(this.config)); }

    /**
     * The core drawing function, called within the animation loop or for static frames.
     * Calculates positions, sizes, angles based on config, interpolators, and audio mods,
     * then draws the image tiled/reflected across four quadrants.
     * @param {number} timestamp - The current timestamp (e.g., from performance.now() or requestAnimationFrame).
     * @param {object | null} [configToUse=null] - The configuration object to use for this draw call. Defaults to the current config.
     * @returns {boolean} True if drawing was performed, false if skipped due to conditions (disabled, no image, etc.).
     */
    draw(timestamp, configToUse = null) {
        const currentConfig = configToUse || this.config;
        const logPrefix = `[CM L${this.layerId}] draw:`;

        // Pre-conditions check
        if (this.isDestroyed || !currentConfig?.enabled || this.isDrawing ||
            !this.canvas || !this.ctx || !this.image || !this.image.complete ||
            this.image.naturalWidth === 0 || this.lastValidWidth <= 0 || this.lastValidHeight <= 0) {
            this.isDrawing = false; // Ensure flag is reset if we exit early
            return false;
        }
        this.isDrawing = true;

        try {
            const width = this.lastValidWidth; const height = this.lastValidHeight;
            const halfWidth = Math.floor(width / 2); const halfHeight = Math.floor(height / 2);
            const remainingWidth = width - halfWidth; const remainingHeight = height - halfHeight; // Handle odd dimensions

            const imgNaturalWidth = this.image.naturalWidth; const imgNaturalHeight = this.image.naturalHeight;
            const imgAspectRatio = (imgNaturalWidth > 0 && imgNaturalHeight > 0) ? imgNaturalWidth / imgNaturalHeight : 1;

            // Calculate base size incorporating audio factors
            let currentBaseSize = currentConfig.size ?? 1.0;
            let finalDrawSize = currentBaseSize * this.audioFrequencyFactor;
            // Apply beat pulse if active
            if (this.beatPulseEndTime && timestamp < this.beatPulseEndTime) {
                finalDrawSize *= this.beatPulseFactor;
            } else if (this.beatPulseEndTime && timestamp >= this.beatPulseEndTime) {
                // Reset beat pulse state after it ends
                this.beatPulseFactor = 1.0; this.beatPulseEndTime = 0;
            }
            finalDrawSize = Math.max(0.01, finalDrawSize); // Ensure minimum size

            // Calculate image draw dimensions based on aspect ratio and final size
            // Fit within half the canvas dimensions multiplied by the size factor
            let imgDrawWidth = halfWidth * finalDrawSize;
            let imgDrawHeight = imgDrawWidth / imgAspectRatio;
            // Adjust if height exceeds bounds based on aspect ratio
            if (imgAspectRatio > 0 && imgDrawHeight > halfHeight * finalDrawSize) {
                imgDrawHeight = halfHeight * finalDrawSize; imgDrawWidth = imgDrawHeight * imgAspectRatio;
            } else if (isNaN(imgDrawHeight) || imgAspectRatio <= 0) { // Fallback for invalid aspect ratio
                imgDrawWidth = halfWidth * finalDrawSize; imgDrawHeight = halfHeight * finalDrawSize;
            }
            imgDrawWidth = Math.max(1, Math.floor(imgDrawWidth)); // Ensure minimum pixel dimensions
            imgDrawHeight = Math.max(1, Math.floor(imgDrawHeight));

            // Update drift position
            this.updateDrift(currentConfig, this.smoothedDeltaTime);
            const driftX = currentConfig.driftState?.x ?? 0;
            const driftY = currentConfig.driftState?.y ?? 0;

            // Get current interpolated values or config values if not interpolating
            const currentX = this.xInterpolator?.isCurrentlyInterpolating() ? this.xInterpolator.getCurrentValue() : this.config.xaxis;
            const currentY = this.yInterpolator?.isCurrentlyInterpolating() ? this.yInterpolator.getCurrentValue() : this.config.yaxis;
            const baseAngle = this.angleInterpolator?.isCurrentlyInterpolating() ? this.angleInterpolator.getCurrentValue() : this.config.angle;

            // Calculate final offsets and angle
            const offsetX = currentX / 10; // Scale MIDI/config value to pixel offset
            const offsetY = currentY / 10;
            const finalAngle = baseAngle + this.continuousRotationAngle; // Combine interpolated/config angle with continuous rotation
            const angleRad = (finalAngle % 360) * Math.PI / 180; // Convert degrees to radians

            // Calculate the center point for the top-left quadrant's drawing, clamping to avoid excessive offsets
            const finalCenterX_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfWidth / 2 + offsetX + driftX));
            const finalCenterY_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfHeight / 2 + offsetY + driftY));

            // Debug log for small dimensions or draw sizes
            if (import.meta.env.DEV && (width < 100 || height < 100 || imgDrawWidth < 10 || imgDrawHeight < 10)) {
                console.log(`${logPrefix} Draw Params - LogicalWH: ${width}x${height}, ImgDrawWH: ${imgDrawWidth}x${imgDrawHeight}, FinalCenterTL: ${finalCenterX_TL.toFixed(1)}x${finalCenterY_TL.toFixed(1)}, Angle: ${finalAngle.toFixed(1)}, Opacity: ${currentConfig.opacity}, ImageSrc: ${this.image.src.substring(0,50)}...`);
            }

            // Clear the entire canvas (using buffer dimensions)
            try { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
            catch (e) {
                if (import.meta.env.DEV) {
                    console.error(`${logPrefix} Error clearing canvas:`, e);
                }
                this.isDrawing = false; return false; // Cannot proceed if clear fails
            }

            // Set global alpha for the layer
            this.ctx.globalAlpha = currentConfig.opacity ?? 1.0;

            // Helper function to draw the image centered and rotated
            const drawImageWithRotation = () => {
                 try {
                    this.ctx.save(); // Save context state before rotation
                    this.ctx.rotate(angleRad); // Apply rotation
                    if (this.image?.complete && this.image?.naturalWidth > 0) {
                        // Draw image centered at the translated origin (0,0)
                        this.ctx.drawImage(this.image, 0, 0, imgNaturalWidth, imgNaturalHeight, -imgDrawWidth / 2, -imgDrawHeight / 2, imgDrawWidth, imgDrawHeight);
                    }
                    this.ctx.restore(); // Restore context state
                } catch (e) { if (import.meta.env.DEV) console.error(`${logPrefix} drawImage error:`, e); }
            };

            // Draw four quadrants with appropriate clipping, translation, and scaling for reflection
            // Top-Left (Normal)
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(0,0,halfWidth,halfHeight); this.ctx.clip();
            this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();

            // Top-Right (Horizontal Reflection)
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(halfWidth,0,remainingWidth,halfHeight); this.ctx.clip();
            this.ctx.translate(width,0); this.ctx.scale(-1,1); // Reflect horizontally
            this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();

            // Bottom-Left (Vertical Reflection)
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(0,halfHeight,halfWidth,remainingHeight); this.ctx.clip();
            this.ctx.translate(0,height); this.ctx.scale(1,-1); // Reflect vertically
            this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();

            // Bottom-Right (Horizontal & Vertical Reflection)
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(halfWidth,halfHeight,remainingWidth,remainingHeight); this.ctx.clip();
            this.ctx.translate(width,height); this.ctx.scale(-1,-1); // Reflect both
            this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();

            // Reset global alpha
            this.ctx.globalAlpha = 1.0;
            this.isDrawing = false; // Release drawing flag
            return true;
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error(`${logPrefix} Unexpected draw error:`, e);
            }
            this.isDrawing = false; // Ensure flag is released on error
            return false;
        }
    }

    /**
     * Updates the drift state (position and phase) based on configuration and delta time.
     * @param {object} config - The current layer configuration containing drift settings.
     * @param {number} deltaTime - The smoothed time elapsed since the last frame in seconds.
     */
    updateDrift(config, deltaTime) {
        if (!config?.driftState) return; // No drift state configured
        const {driftState} = config;
        const driftAmount = config.drift ?? 0;
        const driftSpeed = config.driftSpeed ?? 0.1;

        if(driftAmount > 0 && driftState.enabled){
            // Initialize phase if invalid
            if(typeof driftState.phase !== "number" || isNaN(driftState.phase)) {
                driftState.phase = Math.random() * Math.PI * 2;
            }
            // Update phase based on time and speed
            driftState.phase += deltaTime * driftSpeed * 1.0; // Multiplier can adjust drift pattern speed
            // Calculate X/Y drift using sine/cosine for smooth oscillation
            const calculatedX = Math.sin(driftState.phase) * driftAmount * 1.5; // Multiplier adjusts drift range
            const calculatedY = Math.cos(driftState.phase * 0.7 + Math.PI / 4) * driftAmount * 1.5; // Different phase/multiplier for Y
            // Clamp drift values to prevent excessive offsets
            driftState.x = Math.max(-MAX_TOTAL_OFFSET / 2, Math.min(MAX_TOTAL_OFFSET / 2, calculatedX));
            driftState.y = Math.max(-MAX_TOTAL_OFFSET / 2, Math.min(MAX_TOTAL_OFFSET / 2, calculatedY));
        } else {
            // Reset drift position if disabled or amount is zero
            driftState.x = 0;
            driftState.y = 0;
        }
    }

    /**
     * The main animation loop callback function.
     * Calculates delta time, updates interpolators, updates continuous rotation,
     * handles canvas setup checks, and triggers the draw function.
     * @param {number} timestamp - The timestamp provided by requestAnimationFrame.
     */
    animationLoop(timestamp) {
        if (this.isDestroyed || this.animationFrameId === null) return; // Exit if destroyed or loop stopped
        this.animationFrameId = requestAnimationFrame(this.animationLoop); // Request next frame

        if (!this.config.enabled) { return; } // Skip updates and drawing if disabled

        // Calculate smoothed delta time
        if (!this.lastTimestamp) this.lastTimestamp = timestamp; // Initialize timestamp on first frame
        const elapsed = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;
        const rawDeltaTime = Math.max(0.001, elapsed / 1000.0); // Clamp minimum delta time

        this.deltaTimeBuffer.push(rawDeltaTime);
        if (this.deltaTimeBuffer.length > DELTA_TIME_BUFFER_SIZE) { this.deltaTimeBuffer.shift(); }
        this.smoothedDeltaTime = this.deltaTimeBuffer.reduce((a,b) => a+b,0) / this.deltaTimeBuffer.length;

        // Check if canvas setup is needed (e.g., initial load, resize)
        if (this.lastValidWidth <= 0 || this.lastValidHeight <= 0 || !this.canvas || !this.ctx) {
            // Attempt setup, then draw if successful and still enabled
            this.setupCanvas().then(setupOk => {
                if (setupOk && this.config.enabled) this.draw(timestamp, this.config);
            });
            return; // Don't proceed with drawing this frame if setup was needed
        }

        // Don't draw if image isn't ready
        if (!this.image?.complete || this.image?.naturalWidth === 0) { return; }

        const now = performance.now(); // Use consistent time for updates

        // Update interpolators
        this.xInterpolator?.update(now);
        this.yInterpolator?.update(now);
        this.angleInterpolator?.update(now);

        // Update continuous rotation based on speed and delta time
        const speed = this.config.speed ?? 0;
        const direction = this.config.direction ?? 1;
        const angleDelta = speed * direction * this.smoothedDeltaTime * 600; // Scale speed factor
        this.continuousRotationAngle = (this.continuousRotationAngle + angleDelta) % 360; // Keep angle within 0-360

        // Perform the draw operation for this frame
        this.draw(timestamp, this.config);
    }

    /**
     * Forces a single redraw of the canvas using the current or provided configuration.
     * Useful for updating the view after non-animated changes.
     * @async
     * @param {object | null} [configToUse=null] - Optional config object to use for this redraw. Defaults to the current config.
     * @returns {Promise<boolean>} True if the redraw was successfully initiated.
     */
    async forceRedraw(configToUse = null) {
        if (this.isDestroyed || this.isDrawing) return false; // Don't redraw if destroyed or already drawing
        return this.drawStaticFrame(configToUse || this.config);
    }

    /**
     * Cleans up resources: stops the animation loop, releases references to canvas, context, and image.
     */
    destroy() {
        this.isDestroyed = true;
        this.stopAnimationLoop();
        this.image = null;
        this.ctx = null;
        this.canvas = null; // Release reference
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