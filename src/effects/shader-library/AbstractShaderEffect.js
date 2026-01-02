// src/effects/shader-library/AbstractShaderEffect.js

/**
 * Base class for all modular shader effects.
 * Enforces a standard interface for initialization, parameter mapping, and updates.
 */
export class AbstractShaderEffect {
    /**
     * @param {string} id - The unique identifier for this effect instance (e.g., 'liquid', 'bloom').
     */
    constructor(id) {
        this.id = id;
        this.active = false;
        this.filter = null; // The PIXI.Filter instance
        
        // Helper to track if we need to release resources on destroy
        this.isDestroyed = false;
    }

    /**
     * Initialize the Pixi Filter.
     * @param {number} resolution - The renderer resolution (usually 1.0 for performance).
     * @returns {import('pixi.js').Filter} The initialized filter instance.
     */
    init(resolution) {
        throw new Error(`[${this.constructor.name}] init() must be implemented.`);
    }

    /**
     * Maps a generic UI/Logic parameter to specific shader uniforms.
     * @param {string} param - The parameter name (e.g., 'intensity', 'speed').
     * @param {number|boolean|object} value - The value to apply.
     */
    setParam(param, value) {
        if (!this.filter) return;

        // Default behavior: specific effects can override this for complex mapping logic
        // e.g. mapping one 'amount' value to x/y vectors.
        if (param in this.filter) {
            this.filter[param] = value;
        } else if (this.filter.uniforms && param in this.filter.uniforms) {
            this.filter.uniforms[param] = value;
        }
    }

    /**
     * Per-frame update loop.
     * @param {number} delta - Time delta factor (1.0 = 60fps).
     * @param {number} now - Current timestamp in ms.
     */
    update(delta, now) {
        // Optional: Override in subclasses if time-based animation is needed
    }

    /**
     * Clean up resources.
     */
    destroy() {
        this.isDestroyed = true;
        if (this.filter) {
            this.filter.destroy();
            this.filter = null;
        }
    }

    /**
     * Defines the UI configuration for this effect.
     * Used to generate the EffectManifest automatically.
     */
    static get manifest() {
        return {
            label: 'Unknown Effect',
            category: 'Uncategorized', // Default Category
            params: {}
        };
    }
}