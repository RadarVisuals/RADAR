import EffectFactory from "../effects/EffectFactory";

/**
 * Manages the creation, application, and lifecycle of visual effects.
 * It uses an EffectFactory to instantiate specific effect classes and keeps track
 * of active effects, allowing them to be cancelled individually, by layer, or all at once.
 * It also provides a method to create default effects based on event types.
 */
class VisualEffectsProcessor {
  /** @type {Map<string, object>} Stores active effect control objects, keyed by effectId. */
  activeEffects = new Map();

  constructor() {
    this.activeEffects = new Map();
  }

  /**
   * Creates, applies, and tracks a visual effect based on the provided configuration.
   * Automatically cancels any existing effects on the same target layer before applying the new one.
   * Sets a timeout to remove the effect from the active list after its duration (plus a buffer).
   *
   * @param {object} effect - The configuration object for the effect (should include type, layer, config, etc.).
   * @param {Function | null} updateLayerConfig - Function potentially used by the effect to update layer configuration.
   * @returns {Promise<object | null>} A promise resolving to the effect's control object (containing effectId, layer, clear()) or null if creation/application failed.
   */
  processEffect(effect, updateLayerConfig) {
    // console.log(`✅ Processing effect:`, effect); // Keep this potentially useful log for debugging effects

    // Handle potential variations in effect type key
    if (!effect.type && effect.effect) {
      effect.type = effect.effect;
    }
    if (!effect.type) {
      console.warn("No effect type specified, defaulting to color_overlay"); // Keep warning
      effect.type = "color_overlay";
    }

    // Cancel conflicting effects on the same layer
    const activeLayerEffects = Array.from(this.activeEffects.values()).filter(
      (e) => e.layer === effect.layer,
    );
    activeLayerEffects.forEach((activeEffect) => {
      if (activeEffect?.clear) {
        // console.log(`Cancelling existing effect ${activeEffect.effectId} on layer ${effect.layer}`); // Can remove this log
        activeEffect.clear();
        this.activeEffects.delete(activeEffect.effectId);
      }
    });

    // Create and apply the new effect
    try {
        const effectInstance = EffectFactory.createEffect(effect.type, effect);
        const controlObject = effectInstance.apply(updateLayerConfig); // Pass update function

        if (controlObject?.effectId) {
            this.activeEffects.set(controlObject.effectId, controlObject); // Track active effect

            // Auto-cleanup entry from map after duration (+ buffer)
            const duration = effect.config?.duration || 3000;
            setTimeout(() => {
                this.activeEffects.delete(controlObject.effectId);
            }, duration + 1000); // Buffer allows for cleanup animations

            return Promise.resolve(controlObject); // Return the control object
        } else {
             console.warn("Effect instance did not return a valid control object."); // Keep warning
             return Promise.resolve(null);
        }
    } catch (error) {
        console.error(`Error creating/applying effect type ${effect.type}:`, error); // Keep error
        return Promise.resolve(null); // Resolve with null on error
    }
  }

  /**
   * Manually cancels and cleans up a specific active effect by its ID.
   * @param {string} effectId - The unique ID of the effect to cancel.
   */
  cancelEffect(effectId) {
    const effect = this.activeEffects.get(effectId);
    if (effect?.clear) {
      effect.clear();
      this.activeEffects.delete(effectId);
    }
  }

  /**
   * Manually cancels all active effects currently running on a specific layer.
   * @param {string|number} layer - The layer identifier ('global', 1, 2, or 3).
   */
  cancelEffectsForLayer(layer) {
    const layerIdStr = String(layer); // Ensure comparison is consistent
    const effectsToCancel = [];
    for (const [id, effect] of this.activeEffects.entries()) {
      if (effect?.layer?.toString() === layerIdStr) {
        effectsToCancel.push(id);
      }
    }
    effectsToCancel.forEach((id) => this.cancelEffect(id));
  }

  /**
   * Manually cancels and cleans up all currently active effects.
   */
  cancelAllEffects() {
    for (const effectId of this.activeEffects.keys()) {
      this.cancelEffect(effectId);
    }
    this.activeEffects.clear(); // Ensure map is empty
  }

  /**
   * Creates and processes a default visual effect based on a given event type string.
   * Maps common event types to predefined effect configurations (e.g., color overlays).
   * @param {string} eventType - The type of the event (e.g., 'lyx_received', 'token_sent').
   * @param {Function | null} updateLayerConfig - Function potentially used by the effect.
   * @returns {Promise<object | null>} A promise resolving to the effect's control object or null.
   */
  createDefaultEffect(eventType, updateLayerConfig) {
    const eventLower = typeof eventType === "string" ? eventType.toLowerCase() : "";
    let effectConfig;

    // Define default effect configurations based on event type
    if (eventLower.includes("lyx_received") || eventLower.includes("lyxreceived")) {
      effectConfig = { type: "color_overlay", layer: "1", preserveAnimation: true, config: { color: "rgba(255, 165, 0, 0.3)", pulseCount: 3, duration: 3000 } };
    } else if (eventLower.includes("lyx_sent") || eventLower.includes("lyxsent")) {
      effectConfig = { type: "color_overlay", layer: "2", preserveAnimation: true, config: { color: "rgba(0, 140, 255, 0.3)", pulseCount: 3, duration: 3000 } };
    } else if (eventLower.includes("token_received") || eventLower.includes("tokenreceived")) {
      effectConfig = { type: "color_overlay", layer: "1", preserveAnimation: true, config: { color: "rgba(0, 255, 140, 0.3)", pulseCount: 3, duration: 3000 } };
    } else if (eventLower.includes("token_sent") || eventLower.includes("tokensent")) {
      effectConfig = { type: "color_overlay", layer: "2", preserveAnimation: true, config: { color: "rgba(153, 51, 255, 0.3)", pulseCount: 3, duration: 3000 } };
    } else { // Default for unknown/other events
      effectConfig = { type: "color_overlay", layer: "3", preserveAnimation: true, config: { color: "rgba(255, 51, 153, 0.3)", pulseCount: 3, duration: 3000 } };
    }

    return this.processEffect(effectConfig, updateLayerConfig);
  }

  /**
   * Gets the number of currently active effects being tracked.
   * @returns {number} The count of active effects.
   */
  getActiveEffectsCount() {
    return this.activeEffects.size;
  }

  /**
   * Gets an array containing the control objects of all currently active effects.
   * @returns {Array<object>} An array of active effect control objects.
   */
  getActiveEffects() {
    return Array.from(this.activeEffects.values());
  }
}

export default VisualEffectsProcessor;