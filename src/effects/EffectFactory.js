import ColorOverlayEffect from "./ColorOverlayEffect";

/**
 * EffectFactory: A factory class responsible for creating instances
 * of different visual effect classes based on a given type string.
 */
class EffectFactory {
  /**
   * Creates an instance of a specific VisualEffect subclass.
   * Falls back to ColorOverlayEffect if the type is unknown.
   * @param {string} effectType - The type of effect to create (e.g., 'color_overlay').
   * @param {object} options - Configuration options to pass to the effect constructor.
   * @returns {VisualEffect} An instance of the requested (or fallback) effect class.
   */
  static createEffect(effectType, options) {
    switch (effectType) {
      case "color_overlay":
        return new ColorOverlayEffect(options);
      // Add cases for other effect types here
      // case "particle_burst":
      //   return new ParticleBurstEffect(options);
      default:
        // Keep warning for unknown types
        console.warn(
          `Unknown effect type: ${effectType}, falling back to color_overlay`,
        );
        return new ColorOverlayEffect(options); // Fallback to a default effect
    }
  }
}

export default EffectFactory;