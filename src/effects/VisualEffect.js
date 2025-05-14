// src/effects/VisualEffect.js

/**
 * @typedef {object} VisualEffectOptions
 * @property {string} [effectId] - Optional unique ID for the effect. If not provided, one will be generated.
 * @property {string|number} layer - The target layer ID for the effect (e.g., 'global', 1, 2, 3).
 * @property {object} [config={}] - Effect-specific configuration options. Structure depends on the concrete effect class.
 * @property {boolean} [preserveAnimation=false] - A hint indicating whether underlying canvas animations on the target layer should be preserved or potentially paused while this effect is active.
 * @property {string} [type] - The type identifier of the effect (e.g., 'color_overlay'). Often added by the factory or processor.
 */

/**
 * @typedef {object} EffectControlAPI
 * @property {string} effectId - The unique ID of this effect instance.
 * @property {string|number} layer - The target layer of this effect.
 * @property {() => void} clear - A function to manually stop and clean up this effect instance.
 * @property {string} [type] - The type of the effect.
 * @property {object} [config] - The configuration used for this effect instance.
 */

/**
 * VisualEffect: Base class for all visual effects within the application.
 * Provides common properties like ID, layer target, configuration, duration,
 * and methods for applying the effect, cleaning up resources (timeouts),
 * and common helper functions (like easing).
 *
 * Subclasses must implement the `apply` method.
 */
class VisualEffect {
  /** @type {string} Unique identifier for this effect instance. */
  effectId;
  /** @type {string|number} The layer this effect targets. */
  layer;
  /** @type {object} Effect-specific configuration. */
  config;
  /** @type {number} Default or configured duration of the effect in milliseconds. */
  duration;
  /** @type {boolean} Hint for animation preservation. */
  preserveAnimation;
  /** @type {string | undefined} The type identifier of the effect. */
  type;
  /** @type {Map<string, ReturnType<typeof setTimeout>>} Stores managed timeouts for automatic cleanup. Keyed by a unique ID. */
  timeouts = new Map();

  /**
   * Creates an instance of VisualEffect.
   * @param {VisualEffectOptions} options - Configuration options for the effect.
   */
  constructor(options) {
    this.effectId =
      options.effectId ||
      `effect_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`; // Increased randomness part
    this.layer = options.layer;
    this.config = options.config || {};
    this.duration = typeof this.config.duration === 'number' ? this.config.duration : 3000; // Default duration if not in config
    this.preserveAnimation = options.preserveAnimation || false;
    this.type = options.type; // Store the type if provided
    this.timeouts = new Map();
  }

  /**
   * Abstract method to apply the visual effect. Must be implemented by subclasses.
   * @param {(layerId: string | number, key: string, value: any) => void} [_updateLayerConfig] - Optional function to potentially update layer config (may not be used by all effects).
   * @returns {EffectControlAPI} A control object, typically including { effectId, layer, type, config, clear() }.
   * @throws {Error} If the method is not implemented by a subclass.
   */
  // eslint-disable-next-line no-unused-vars
  apply(_updateLayerConfig) {
    // This JSDoc comment is for the abstract method, ESLint will still warn if the param is unused in subclasses.
    // Subclasses should decide if they need to use it or can omit it from their signature if truly unused.
    throw new Error("Method 'apply' must be implemented by subclasses of VisualEffect.");
  }

  /**
   * Cleans up any resources used by the effect, primarily clearing all managed timeouts.
   * Subclasses can override this to add specific cleanup logic (e.g., removing DOM elements),
   * but they should call `super.cleanup()` to ensure timeouts are cleared.
   * @returns {void}
   */
  cleanup() {
    for (const timeoutId of this.timeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.timeouts.clear();
    // if (import.meta.env.DEV) {
    //   console.log(`[VisualEffect ${this.effectId}] Cleaned up timeouts.`);
    // }
  }

  // --- Helper methods potentially useful for subclasses ---

  /**
   * Quadratic easing in/out function.
   * f(t) = t < 0.5 ? 2 * t^2 : 1 - (-2 * t + 2)^2 / 2
   * @param {number} t - Progress ratio (0 to 1).
   * @returns {number} Eased value.
   */
  easeInOutQuad(t) {
    // Ensure t is clamped between 0 and 1
    const clampedT = Math.max(0, Math.min(1, t));
    return clampedT < 0.5 ? 2 * clampedT * clampedT : 1 - Math.pow(-2 * clampedT + 2, 2) / 2;
  }

  /**
   * Elastic easing out function.
   * Provides a bouncy, elastic effect at the end of the animation.
   * @param {number} t - Progress ratio (0 to 1).
   * @returns {number} Eased value.
   */
  easeOutElastic(t) {
    // Ensure t is clamped between 0 and 1
    const clampedT = Math.max(0, Math.min(1, t));
    const c4 = (2 * Math.PI) / 3;

    if (clampedT === 0) return 0;
    if (clampedT === 1) return 1;

    return Math.pow(2, -10 * clampedT) * Math.sin((clampedT * 10 - 0.75) * c4) + 1;
  }

  /**
   * Adds a timeout to the internal map for automatic cleanup via `this.cleanup()`.
   * If a timeout with the same `id` already exists, it is cleared before setting the new one.
   * The timeout is removed from the map once its callback is executed.
   *
   * @param {string} id - A unique identifier for the timeout within this effect instance.
   * @param {() => void} callback - The function to execute after the delay.
   * @param {number} delay - The delay in milliseconds.
   * @returns {ReturnType<typeof setTimeout>} The timeout ID (NodeJS.Timeout or number).
   */
  addTimeout(id, callback, delay) {
    // Clear existing timeout with the same ID if present
    if (this.timeouts.has(id)) {
        const existingTimeoutId = this.timeouts.get(id);
        if (existingTimeoutId) clearTimeout(existingTimeoutId);
    }

    const timeoutId = setTimeout(() => {
        this.timeouts.delete(id); // Remove from map once executed or cleared
        try {
            callback();
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error(`[VisualEffect ${this.effectId}] Error in timeout callback for ID '${id}':`, e);
            }
        }
    }, delay);

    this.timeouts.set(id, timeoutId);
    return timeoutId;
  }
}

export default VisualEffect;