// src/utils/CanvasManager.js
import { BLEND_MODES } from '../config/global-config';
import ValueInterpolator from './ValueInterpolator';

// Constants for internal use
const SETUP_CANVAS_POLL_INTERVAL = 100;
const SETUP_CANVAS_POLL_TIMEOUT = 3000;
const MAX_TOTAL_OFFSET = 10000; // Max combined offset from position and drift
const DELTA_TIME_BUFFER_SIZE = 5; // For smoothing animation frame time differences
const XY_INTERPOLATION_DURATION = 150; // ms for position interpolation
const ANGLE_INTERPOLATION_DURATION = 100; // ms for angle interpolation

/**
 * Manages a single HTML Canvas element for rendering a visual layer.
 * Handles canvas setup, image loading, configuration application,
 * animation loop management, drawing logic (including a 4-quadrant reflection),
 * value interpolation for smooth transitions, and resource cleanup.
 */
class CanvasManager {
    /** @type {HTMLCanvasElement | null} */
    canvas = null;
    /** @type {CanvasRenderingContext2D | null} */
    ctx = null;
    /** @type {string} */
    layerId;
    /** @type {HTMLImageElement | null} */
    image = null;
    /** @type {object} */
    config;
    /** @type {number | null} */
    animationFrameId = null;
    /** @type {number} */
    lastTimestamp = 0;
    /** @type {boolean} */
    isDrawing = false;
    /** @type {boolean} */
    isDestroyed = false;
    /** @type {string | null} */
    lastImageSrc = null;
    /** @type {number} */
    lastValidWidth = 0;
    /** @type {number} */
    lastValidHeight = 0;
    /** @type {number[]} */
    deltaTimeBuffer = [];
    /** @type {number} */
    smoothedDeltaTime = 1 / 60; // Assume 60fps initially

    /** @type {ValueInterpolator} */
    xInterpolator;
    /** @type {ValueInterpolator} */
    yInterpolator;
    /** @type {ValueInterpolator} */
    angleInterpolator;
    /** @type {number} */
    continuousRotationAngle = 0; // Tracks angle changes from speed

    // --- NEW: Audio Reactivity Properties ---
    /** @type {number} */
    audioFrequencyFactor = 1.0;
    /** @type {number} */
    beatPulseFactor = 1.0;
    /** @type {number} */
    beatPulseEndTime = 0;
    // --- END NEW ---


    /**
     * Creates a CanvasManager instance.
     * @param {HTMLCanvasElement} canvas - The canvas element to manage.
     * @param {string} layerId - An identifier for this layer (e.g., '1', '2', '3').
     * @throws {Error} If canvas is invalid or context cannot be obtained.
     */
    constructor(canvas, layerId) {
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) { throw new Error(`[CM L${layerId}] Invalid canvas element provided.`); }
        this.canvas = canvas;
        try {
            this.ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
            if (!this.ctx) { throw new Error(`Failed to get 2D context for Layer ${layerId} (returned null)`); }
        } catch (e) {
            console.error(`[CM L${layerId}] Error getting context:`, e);
            throw new Error(`Failed to get 2D context for Layer ${layerId}: ${e.message}`);
        }
        this.layerId = layerId;
        this.config = this.getDefaultConfig();
        this.xInterpolator = new ValueInterpolator(this.config.xaxis, XY_INTERPOLATION_DURATION);
        this.yInterpolator = new ValueInterpolator(this.config.yaxis, XY_INTERPOLATION_DURATION);
        this.angleInterpolator = new ValueInterpolator(this.config.angle, ANGLE_INTERPOLATION_DURATION);
        this.animationLoop = this.animationLoop.bind(this);

        // Initialize audio reactivity properties
        this.audioFrequencyFactor = 1.0;
        this.beatPulseFactor = 1.0;
        this.beatPulseEndTime = 0;
    }

    /** Returns the default configuration object for a layer. */
    getDefaultConfig() {
        return {
            enabled: true, blendMode: 'normal', opacity: 1.0, size: 1.0,
            speed: 0.01, drift: 0, driftSpeed: 0.1, angle: 0,
            xaxis: 0, yaxis: 0, direction: 1,
            driftState: { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false },
            audioSource: 'level',
        };
    }

    /**
     * Sets up the canvas dimensions based on its parent element size and device pixel ratio.
     * Includes polling to wait for valid dimensions. Resets interpolators.
     * @returns {Promise<boolean>} True if setup was successful, false otherwise.
     */
    async setupCanvas() {
        const logPrefix = `[CM L${this.layerId}] setupCanvas:`;
        if (!this.canvas || this.isDestroyed) {
            console.warn(`${logPrefix} FAILED (Canvas null or manager destroyed)`);
            this.lastValidWidth = 0; this.lastValidHeight = 0;
            return false;
        }
        const parent = this.canvas.parentElement;
        if (!parent) { console.warn(`${logPrefix} FAILED (No parent)`); this.lastValidWidth = 0; this.lastValidHeight = 0; return false; }

        let logicalWidth = 0, logicalHeight = 0, attempts = 0;
        const maxAttempts = SETUP_CANVAS_POLL_TIMEOUT / SETUP_CANVAS_POLL_INTERVAL;

        while (attempts < maxAttempts) {
            attempts++;
            if (!parent.isConnected) { console.warn(`${logPrefix} Parent disconnected.`); this.lastValidWidth = 0; this.lastValidHeight = 0; return false; }
            const rect = parent.getBoundingClientRect();
            logicalWidth = Math.floor(rect.width); logicalHeight = Math.floor(rect.height);
            if (logicalWidth > 0 && logicalHeight > 0) break;
            await new Promise(resolve => setTimeout(resolve, SETUP_CANVAS_POLL_INTERVAL));
        }

        if (logicalWidth <= 0 || logicalHeight <= 0) {
             console.error(`${logPrefix} FAILED - Zero Dimensions after timeout (${logicalWidth}x${logicalHeight}).`);
             this.lastValidWidth = 0; this.lastValidHeight = 0;
             if (this.canvas && (this.canvas.width > 0 || this.canvas.height > 0)) {
                try { this.canvas.width = 0; this.canvas.height = 0; }
                catch { console.error(`${logPrefix} Error setting canvas dims to 0.`); }
             }
             return false;
        }

        const dpr = window.devicePixelRatio || 1;
        const targetRenderWidth = Math.floor(logicalWidth * dpr);
        const targetRenderHeight = Math.floor(logicalHeight * dpr);

        if (!this.canvas) {
             console.warn(`${logPrefix} FAILED (Canvas became null during setup)`);
             this.lastValidWidth = 0; this.lastValidHeight = 0;
             return false;
        }

        let resized = false;
        if (this.canvas.width !== targetRenderWidth || this.canvas.height !== targetRenderHeight) {
            try { this.canvas.width = targetRenderWidth; this.canvas.height = targetRenderHeight; resized = true; }
            catch(e) { console.error(`${logPrefix} Error setting canvas width/height:`, e); return false; }
        }
        if (this.canvas.style.width !== `${logicalWidth}px` || this.canvas.style.height !== `${logicalHeight}px`) {
             try { this.canvas.style.width = `${logicalWidth}px`; this.canvas.style.height = `${logicalHeight}px`; }
             catch(e) { console.error(`${logPrefix} Error setting canvas style width/height:`, e); }
        }

        if ((resized || this.ctx) && this.ctx) {
            try {
                const currentTransform = this.ctx.getTransform();
                if (!currentTransform || Math.abs(currentTransform.a - dpr) > 1e-6 || Math.abs(currentTransform.d - dpr) > 1e-6) {
                    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }
            } catch (e) { console.error(`${logPrefix} Transform get/set error:`, e); }
        }

        this.lastValidWidth = logicalWidth; this.lastValidHeight = logicalHeight;

        this.xInterpolator?.snap(this.config.xaxis);
        this.yInterpolator?.snap(this.config.yaxis);
        this.angleInterpolator?.snap(this.config.angle);
        return true;
    }

    /**
     * Applies a complete configuration object to the layer, merging with defaults.
     * Validates types and clamps values where necessary. Updates canvas blend mode.
     * Snaps interpolators to the new values.
     * @param {object} newConfig - The configuration object to apply.
     */
    applyFullConfig(newConfig) {
         if (this.isDestroyed) return;
         const logPrefix = `[CM L${this.layerId} applyFullConfig]`;
         const defaultConfig = this.getDefaultConfig();
         const mergedConfig = { ...defaultConfig };

         for (const key in defaultConfig) {
             if (Object.hasOwnProperty.call(defaultConfig, key)) {
                 if (newConfig && Object.hasOwnProperty.call(newConfig, key)) {
                     const newValue = newConfig[key];
                     const defaultValue = defaultConfig[key];
                     const defaultType = typeof defaultValue;

                     if (newValue === null || newValue === undefined) { mergedConfig[key] = defaultValue; continue; }

                     if (defaultType === 'number') {
                         const numValue = Number(newValue);
                         mergedConfig[key] = isNaN(numValue) ? defaultValue : numValue;
                     } else if (defaultType === 'string') {
                         mergedConfig[key] = String(newValue);
                     } else if (defaultType === 'boolean') {
                         mergedConfig[key] = Boolean(newValue);
                     } else if (key === 'driftState' && typeof newValue === 'object') {
                         mergedConfig.driftState = {
                             x: typeof newValue.x === 'number' ? newValue.x : defaultValue.x,
                             y: typeof newValue.y === 'number' ? newValue.y : defaultValue.y,
                             phase: typeof newValue.phase === 'number' ? newValue.phase : defaultValue.phase,
                             enabled: typeof newValue.enabled === 'boolean' ? newValue.enabled : defaultValue.enabled,
                         };
                     } else if (typeof newValue === defaultType) {
                         mergedConfig[key] = newValue;
                     } else {
                         console.warn(`${logPrefix} Type mismatch for key '${key}'. Expected ${defaultType}, got ${typeof newValue}. Using default.`);
                         mergedConfig[key] = defaultValue;
                     }
                 } else {
                     mergedConfig[key] = defaultConfig[key];
                 }
             }
         }

         if (!BLEND_MODES.includes(mergedConfig.blendMode)) { mergedConfig.blendMode = 'normal'; }
         mergedConfig.opacity = Math.max(0, Math.min(1, mergedConfig.opacity));
         mergedConfig.size = Math.max(0.01, mergedConfig.size);
         mergedConfig.direction = mergedConfig.direction === -1 ? -1 : 1;
         mergedConfig.enabled = Boolean(mergedConfig.enabled);

         if (!mergedConfig.driftState || typeof mergedConfig.driftState !== 'object') { mergedConfig.driftState = { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false }; }
         mergedConfig.driftState.enabled = mergedConfig.drift > 0;
         if (!mergedConfig.driftState.enabled) { mergedConfig.driftState.x = 0; mergedConfig.driftState.y = 0; }

         this.config = mergedConfig;

         if (this.canvas?.style) {
             this.canvas.style.mixBlendMode = this.config.blendMode || "normal";
         } else { console.warn(`${logPrefix} Cannot set blend mode, canvas or style is not available.`); }

         this.xInterpolator?.snap(this.config.xaxis);
         this.yInterpolator?.snap(this.config.yaxis);
         this.angleInterpolator?.snap(this.config.angle);
         this.continuousRotationAngle = 0;
    }

    /**
     * Updates a single configuration property with validation.
     * Handles side effects like toggling animation or updating blend mode style.
     * Snaps interpolators if relevant properties (xaxis, yaxis, angle) are updated.
     * @param {string} key - The configuration key to update.
     * @param {any} value - The new value for the property.
     */
     updateConfigProperty(key, value) {
         if (this.isDestroyed) return;
         const logPrefix = `[CM L${this.layerId} updateConfigProperty]`;
         const defaultConfig = this.getDefaultConfig();

         if (!Object.hasOwnProperty.call(defaultConfig, key)) {
             console.warn(`${logPrefix} Attempted update unknown property '${key}'.`);
             return;
         }

         let validatedValue = value;
         const defaultValueType = typeof defaultConfig[key];

         if (defaultValueType === 'number') {
             validatedValue = Number(value);
             if (isNaN(validatedValue)) validatedValue = this.config[key] ?? defaultConfig[key];
             if (key === 'opacity') validatedValue = Math.max(0, Math.min(1, validatedValue));
             if (key === 'size') validatedValue = Math.max(0.01, validatedValue);
         } else if (defaultValueType === 'string') {
             validatedValue = String(value);
             if (key === 'blendMode' && !BLEND_MODES.includes(validatedValue)) {
                 console.warn(`${logPrefix} Invalid blend mode '${validatedValue}'. Reverting.`);
                 validatedValue = this.config[key] ?? defaultConfig[key];
             }
             if (key === 'audioSource') {
                 const validSources = ['level', 'bass', 'mid', 'treble'];
                 if (!validSources.includes(validatedValue)) {
                     console.warn(`${logPrefix} Invalid audio source '${validatedValue}'. Using default.`);
                     validatedValue = defaultConfig[key];
                 }
             }
         } else if (defaultValueType === 'boolean') {
             validatedValue = Boolean(value);
         }

         this.config[key] = validatedValue;

         if (key === 'blendMode') {
             if (this.canvas?.style) this.canvas.style.mixBlendMode = validatedValue || 'normal';
             else console.warn(`${logPrefix} Cannot update blend mode style, canvas or style not available.`);
         } else if (key === 'drift') {
             if (!this.config.driftState) this.config.driftState = { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false };
             this.config.driftState.enabled = validatedValue > 0;
             if (!this.config.driftState.enabled) { this.config.driftState.x = 0; this.config.driftState.y = 0; }
         } else if (key === 'enabled') {
             if (validatedValue && !this.animationFrameId) this.startAnimationLoop();
             else if (!validatedValue && this.animationFrameId) {
                 this.stopAnimationLoop();
                 if (this.ctx && this.canvas?.width > 0 && this.canvas?.height > 0) {
                      try { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
                      catch { /* ignore error */ }
                 }
             }
         } else if (key === 'xaxis') { this.xInterpolator?.snap(validatedValue); }
         else if (key === 'yaxis') { this.yInterpolator?.snap(validatedValue); }
         else if (key === 'angle') { this.angleInterpolator?.snap(validatedValue); this.continuousRotationAngle = 0; }
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

    /** Draws a single static frame, optionally using a provided config. */
    async drawStaticFrame(configToUse = null) {
         const logPrefix = `[CM L${this.layerId}] drawStaticFrame:`;
         console.log(`${logPrefix} Initiated.`);
         try {
             if (!this.canvas || !this.ctx || this.isDestroyed) {
                 console.error(`${logPrefix} Cannot draw static frame (canvas=${!!this.canvas}, ctx=${!!this.ctx}, destroyed=${this.isDestroyed}).`);
                 return false;
             }
             console.log(`${logPrefix} Canvas and context OK. Calling setupCanvas...`);
             const setupSuccess = await this.setupCanvas();
             if (!setupSuccess) {
                 console.error(`${logPrefix} setupCanvas failed.`);
                 return false;
             }
             console.log(`${logPrefix} setupCanvas SUCCESS. Dimensions: ${this.lastValidWidth}x${this.lastValidHeight}. Proceeding to draw...`);
             this.smoothedDeltaTime = 1 / 60;
             const config = configToUse || this.config;
             this.xInterpolator?.snap(config.xaxis);
             this.yInterpolator?.snap(config.yaxis);
             this.angleInterpolator?.snap(config.angle);
             this.continuousRotationAngle = 0;
             const drawSuccess = this.draw(performance.now(), config);
             console.log(`${logPrefix} draw() call returned: ${drawSuccess}`);
             return drawSuccess;
         } catch (e) {
             console.error(`${logPrefix} Error:`, e);
             return false;
         }
     };

    /**
     * Loads an image from the given source URL. Handles CORS for external URLs.
     * Rejects if the source is invalid or loading fails. Resolves on successful load.
     * @param {string} src - The image source URL.
     * @returns {Promise<void>} Promise that resolves on load or rejects on error.
     */
    async setImage(src) {
        if (this.isDestroyed) return Promise.reject("Manager destroyed");
        const logPrefix = `[CM L${this.layerId} setImage]`;
        return new Promise((resolve, reject) => {
            if (!src || typeof src !== 'string') {
                console.warn(`${logPrefix} Invalid source:`, src);
                this.image = null;
                this.lastImageSrc = null;
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
                if (this.isDestroyed) {
                    console.log(`${logPrefix} Load finished but manager destroyed.`);
                    return resolve();
                }
                if (img.naturalWidth === 0) {
                    const eMsg = `${logPrefix} Loaded image has zero dimensions! Source: ${src.substring(0, 100)}...`;
                    console.error(eMsg);
                    this.image = null;
                    this.lastImageSrc = null;
                    reject(new Error(eMsg));
                    return;
                }
                this.image = img;
                this.lastImageSrc = src;
                resolve();
            };
            img.onerror = (error) => {
                if (this.isDestroyed) {
                    return reject(new Error("Manager destroyed during load"));
                }
                console.error(`${logPrefix} FAILED: ${img.src.substring(0, 60)}`, error);
                this.image = null;
                this.lastImageSrc = null;
                reject(new Error(`Failed to load image: ${src.substring(0, 50)}...`));
            };
            img.src = src;
        });
    }

    /**
     * Sets a target value for interpolation (used by MIDI or other smooth inputs).
     * @param {'xaxis' | 'yaxis' | 'angle'} param - The parameter to target.
     * @param {number} targetValue - The target numerical value.
     */
    setTargetValue(param, targetValue) {
        if (this.isDestroyed) return;
        const logPrefix = `[CM L${this.layerId} setTargetValue]`;
        const validatedValue = Number(targetValue);
        if (isNaN(validatedValue)) { console.warn(`${logPrefix} Invalid target value for ${param}:`, targetValue); return; }

        if (Object.hasOwnProperty.call(this.config, param)) {
            this.config[param] = validatedValue;
        } else { console.warn(`${logPrefix} Attempted to set target for unknown param '${param}'.`); return; }

        if (param === 'xaxis' && this.xInterpolator) { this.xInterpolator.setTarget(validatedValue); }
        else if (param === 'yaxis' && this.yInterpolator) { this.yInterpolator.setTarget(validatedValue); }
        else if (param === 'angle' && this.angleInterpolator) { this.angleInterpolator.setTarget(validatedValue); }
    }

    /**
     * Sets the audio frequency-based size modification factor.
     * @param {number} factor - The multiplier (e.g., 1.0 for no change, 1.2 for 20% larger).
     */
    setAudioFrequencyFactor(factor) {
        if (this.isDestroyed) return;
        this.audioFrequencyFactor = Number(factor) || 1.0;
    }

    /**
     * Triggers a temporary beat pulse size modification.
     * @param {number} pulseFactor - The multiplier for the pulse.
     * @param {number} duration - The duration of the pulse in milliseconds.
     */
    triggerBeatPulse(pulseFactor, duration) {
        if (this.isDestroyed) return;
        this.beatPulseFactor = Number(pulseFactor) || 1.0;
        this.beatPulseEndTime = performance.now() + (Number(duration) || 0);
    }

    /** Resets all audio-driven size modifications to their default states. */
    resetAudioModifications() {
        if (this.isDestroyed) return;
        this.audioFrequencyFactor = 1.0;
        this.beatPulseFactor = 1.0;
        this.beatPulseEndTime = 0;
    }


    /** Returns a deep copy of the current configuration object. */
    getConfigData() { return JSON.parse(JSON.stringify(this.config)); }

    /** The core drawing function, performs the 4-quadrant mirrored draw logic. */
    draw(timestamp, configToUse = null) {
        const config = configToUse || this.config;
        const logPrefix = `[CM L${this.layerId} Draw]`;

        if (this.isDestroyed) return false;
        if (!config?.enabled) { console.warn(`${logPrefix} Aborted: Layer disabled.`); return false; }
        if (this.isDrawing) return false;
        if (!this.canvas || !this.ctx) { console.error(`${logPrefix} Aborted: Canvas or Context is NULL.`); return false; }
        if (!this.image) { console.error(`${logPrefix} Aborted: this.image is NULL.`); return false; }
        if (!this.image.complete) { console.warn(`${logPrefix} Aborted: Image not complete. Src: ${this.image.src.substring(0, 100)}...`); return false; }
        if (this.image.naturalWidth === 0) { console.error(`${logPrefix} Aborted: Image naturalWidth is 0. Src: ${this.image.src.substring(0, 100)}...`); return false; }
        if (this.lastValidWidth <= 0 || this.lastValidHeight <= 0) { console.error(`${logPrefix} Aborted: Invalid dimensions (${this.lastValidWidth}x${this.lastValidHeight}).`); return false; }

        this.isDrawing = true;

        try {
            const width = this.lastValidWidth; const height = this.lastValidHeight;
            const halfWidth = Math.floor(width / 2); const halfHeight = Math.floor(height / 2);
            const remainingWidth = width - halfWidth; const remainingHeight = height - halfHeight;

            const imgNaturalWidth = this.image.naturalWidth; const imgNaturalHeight = this.image.naturalHeight;
            const imgAspectRatio = (imgNaturalWidth > 0 && imgNaturalHeight > 0) ? imgNaturalWidth / imgNaturalHeight : 1;

            // --- MODIFIED SIZE CALCULATION ---
            let currentBaseSize = config.size ?? 1.0;
            let finalDrawSize = currentBaseSize;

            finalDrawSize *= this.audioFrequencyFactor;

            const now = timestamp;
            if (this.beatPulseEndTime && now < this.beatPulseEndTime) {
                finalDrawSize *= this.beatPulseFactor;
            } else if (this.beatPulseEndTime && now >= this.beatPulseEndTime) {
                this.beatPulseFactor = 1.0;
                this.beatPulseEndTime = 0;
            }
            finalDrawSize = Math.max(0.01, finalDrawSize);
            // --- END MODIFIED SIZE CALCULATION ---

            let imgDrawWidth = halfWidth * finalDrawSize;
            let imgDrawHeight = imgDrawWidth / imgAspectRatio;
            if (imgAspectRatio > 0 && imgDrawHeight > halfHeight * finalDrawSize) {
                imgDrawHeight = halfHeight * finalDrawSize;
                imgDrawWidth = imgDrawHeight * imgAspectRatio;
            } else if (isNaN(imgDrawHeight) || imgAspectRatio <= 0) {
                imgDrawWidth = halfWidth * finalDrawSize;
                imgDrawHeight = halfHeight * finalDrawSize;
            }
            imgDrawWidth = Math.max(1, Math.floor(imgDrawWidth));
            imgDrawHeight = Math.max(1, Math.floor(imgDrawHeight));

            this.updateDrift(config, this.smoothedDeltaTime);
            const driftX = config.driftState?.x ?? 0; const driftY = config.driftState?.y ?? 0;

            const currentX = this.xInterpolator.getCurrentValue();
            const currentY = this.yInterpolator.getCurrentValue();
            const interpolatedBaseAngle = this.angleInterpolator.getCurrentValue();

            const offsetX = currentX / 10;
            const offsetY = currentY / 10;
            const finalAngle = interpolatedBaseAngle + this.continuousRotationAngle;
            const angleRad = (finalAngle % 360) * Math.PI / 180;

            const rawCenterX_TL = halfWidth / 2 + offsetX + driftX;
            const rawCenterY_TL = halfHeight / 2 + offsetY + driftY;
            const finalCenterX_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, rawCenterX_TL));
            const finalCenterY_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, rawCenterY_TL));

            try { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
            catch(e) { console.error(`${logPrefix} ClearRect error:`, e); this.isDrawing = false; return false;}

            this.ctx.globalAlpha = config.opacity ?? 1.0;

            const drawImageWithRotation = () => {
                 try {
                    this.ctx.save();
                    this.ctx.rotate(angleRad);
                    if (this.image?.complete && this.image?.naturalWidth > 0) {
                        this.ctx.drawImage( this.image, 0, 0, imgNaturalWidth, imgNaturalHeight, -imgDrawWidth / 2, -imgDrawHeight / 2, imgDrawWidth, imgDrawHeight );
                    } else {
                         console.error(`${logPrefix} Image became invalid just before drawImage call!`);
                    }
                    this.ctx.restore();
                } catch (e) {
                  console.error(`${logPrefix} Error during drawImage/transform:`, e);
                  try { this.ctx.restore(); } catch { /* ignore restore error */ }
                }
            };

            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(0, 0, halfWidth, halfHeight); this.ctx.clip();
            this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(halfWidth, 0, remainingWidth, halfHeight); this.ctx.clip();
            this.ctx.translate(width, 0); this.ctx.scale(-1, 1); this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(0, halfHeight, halfWidth, remainingHeight); this.ctx.clip();
            this.ctx.translate(0, height); this.ctx.scale(1, -1); this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();
            this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(halfWidth, halfHeight, remainingWidth, remainingHeight); this.ctx.clip();
            this.ctx.translate(width, height); this.ctx.scale(-1, -1); this.ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); this.ctx.restore();

            this.ctx.globalAlpha = 1.0;
            this.isDrawing = false;
            return true;
        } catch (error) {
            console.error(`${logPrefix} Error during draw cycle execution:`, error);
            this.isDrawing = false;
            return false;
        }
    }

    /** Updates the drift state based on config and delta time. */
    updateDrift(config, deltaTime) {
         if (!config?.driftState) return;
         const { driftState } = config;
         const driftAmount = config.drift ?? 0;
         const driftSpeed = config.driftSpeed ?? 0.1;

         if (driftAmount > 0 && driftState.enabled) {
           if (typeof driftState.phase !== "number" || isNaN(driftState.phase)) { driftState.phase = Math.random() * Math.PI * 2; }
           const speedMultiplier = 1.0;
           driftState.phase += deltaTime * driftSpeed * speedMultiplier;
           const driftMultiplier = 1.5;
           let calculatedX = Math.sin(driftState.phase) * driftAmount * driftMultiplier;
           let calculatedY = Math.cos(driftState.phase * 0.7 + Math.PI / 4) * driftAmount * driftMultiplier;

           const MAX_DRIFT_OFFSET = MAX_TOTAL_OFFSET / 2;
           driftState.x = Math.max(-MAX_DRIFT_OFFSET, Math.min(MAX_DRIFT_OFFSET, calculatedX));
           driftState.y = Math.max(-MAX_DRIFT_OFFSET, Math.min(MAX_DRIFT_OFFSET, calculatedY));
         } else {
             driftState.x = 0; driftState.y = 0;
         }
    }

    /** The main animation loop callback, requested via requestAnimationFrame. */
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
        const sum = this.deltaTimeBuffer.reduce((a, b) => a + b, 0);
        this.smoothedDeltaTime = sum / this.deltaTimeBuffer.length;

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

    /** Forces a redraw of the current frame, optionally applying new config. */
    async forceRedraw(configToUse = null) {
         if (this.isDestroyed) return false;
         const logPrefix = `[CM L${this.layerId}] forceRedraw:`;
         if (this.isDrawing) { console.warn(`${logPrefix} Skipped: Draw in progress.`); return false; }
         const drawSuccess = await this.drawStaticFrame(configToUse || this.config);
         return drawSuccess;
     };

    /** Cleans up resources: stops animation loop, nullifies refs. */
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
    }
}

export default CanvasManager;