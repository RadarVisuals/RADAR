// src/effects/EffectFactory.js
import ColorOverlayEffect from "./ColorOverlayEffect"; // Local effect class
// import ParticleBurstEffect from "./ParticleBurstEffect"; // Example for future expansion
// import VisualEffect from "./VisualEffect"; // Base class, for type hinting if needed

/**
 * @typedef {import('./VisualEffect').default} VisualEffect - Base class for all visual effects.
 * @typedef {import('../utils/VisualEffectsProcessor').EffectConfigInput} EffectConfigInput - Input config for effects.
 */

/**
 * EffectFactory: A factory class responsible for creating instances
 * of different visual effect classes based on a given type string.
 * This allows for easy extension with new effect types without modifying
 * the core effect processing logic.
 */
class EffectFactory {
  /**
   * Creates an instance of a specific VisualEffect subclass based on the `effectType`.
   * If the `effectType` is unknown or not explicitly handled, it falls back to
   * creating a `ColorOverlayEffect` as a default.
   *
   * @param {string} effectType - The type of effect to create (e.g., 'color_overlay').
   * @param {EffectConfigInput} options - Configuration options to pass to the effect constructor.
   *                                      These options typically include `layer`, `config`, `effectId`, etc.
   * @returns {VisualEffect} An instance of the requested (or fallback) effect class,
   *                         which should extend `VisualEffect`.
   */
  static createEffect(effectType, options) {
    switch (effectType) {
      case "color_overlay":
        return new ColorOverlayEffect(options);
      // Example for future expansion:
      // case "particle_burst":
      //   return new ParticleBurstEffect(options);
      default:
        if (import.meta.env.DEV) {
          // Keep warning for unknown types, as it indicates a potential configuration issue or missing effect class.
          console.warn(
            `[EffectFactory] Unknown effect type: '${effectType}'. Falling back to 'color_overlay'.`,
          );
        }
        // Fallback to a default effect (ColorOverlayEffect in this case)
        // Ensure the options passed are still compatible or handled gracefully by the fallback.
        return new ColorOverlayEffect({ ...options, type: 'color_overlay' });
    }
  }
}

export default EffectFactory;