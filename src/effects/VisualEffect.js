/**
 * VisualEffect: Base class for all visual effects within the application.
 * Provides common properties like ID, layer target, configuration, duration,
 * and methods for applying the effect, cleaning up resources (timeouts),
 * and common helper functions (like easing).
 */
class VisualEffect {
  /**
   * Creates an instance of VisualEffect.
   * @param {object} options - Configuration options for the effect.
   * @param {string} [options.effectId] - Optional unique ID for the effect.
   * @param {string|number} options.layer - The target layer ID ('global' or a number).
   * @param {object} [options.config={}] - Effect-specific configuration.
   * @param {boolean} [options.preserveAnimation=false] - Hint for whether background animations should be preserved.
   */
  constructor(options) {
    this.effectId =
      options.effectId ||
      `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.layer = options.layer;
    this.config = options.config || {};
    this.duration = this.config.duration || 3000; // Default duration if not specified
    this.preserveAnimation = options.preserveAnimation || false;
    this.timeouts = new Map(); // Store managed timeouts for cleanup
  }

  /**
   * Abstract method to apply the visual effect. Must be implemented by subclasses.
   * @param {Function} updateLayerConfig - Function to potentially update layer config (may not be used by all effects).
   * @returns {object} A control object, typically including { effectId, layer, clear() }.
   */
  // eslint-disable-next-line no-unused-vars
  apply(updateLayerConfig) {
    throw new Error("Method 'apply' must be implemented by subclasses");
  }

  /**
   * Cleans up any resources used by the effect, primarily clearing timeouts.
   * Subclasses can override this to add specific cleanup logic, calling super.cleanup().
   */
  cleanup() {
    for (const timeoutId of this.timeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.timeouts.clear();
  }

  // --- Helper methods potentially useful for subclasses ---

  /**
   * Quadratic easing in/out function.
   * @param {number} t - Progress ratio (0 to 1).
   * @returns {number} Eased value.
   */
  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Elastic easing out function.
   * @param {number} t - Progress ratio (0 to 1).
   * @returns {number} Eased value.
   */
  easeOutElastic(t) {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }

  /**
   * Adds a timeout to the internal map for automatic cleanup.
   * @param {string} id - A unique identifier for the timeout within this effect instance.
   * @param {Function} callback - The function to execute.
   * @param {number} delay - The delay in milliseconds.
   * @returns {number} The timeout ID.
   */
  addTimeout(id, callback, delay) {
    // Clear existing timeout with the same ID if present
    if (this.timeouts.has(id)) {
        clearTimeout(this.timeouts.get(id));
    }
    const timeoutId = setTimeout(() => {
        this.timeouts.delete(id); // Remove from map once executed
        callback();
    }, delay);
    this.timeouts.set(id, timeoutId);
    return timeoutId;
  }
}

export default VisualEffect;