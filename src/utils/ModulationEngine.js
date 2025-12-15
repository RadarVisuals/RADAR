// src/utils/ModulationEngine.js
import { EFFECT_MANIFEST, getParamDefinition } from '../config/EffectManifest';

export class ModulationEngine {
    constructor() {
        this.baseValues = new Map();
        this.patches = [];
        
        // This is our persistent state object. 
        // We initialize it once and update properties in-place.
        this.computedValues = {}; 
        
        this.resetToDefaults();
    }

    resetToDefaults() {
        Object.values(EFFECT_MANIFEST).forEach(effect => {
            Object.values(effect.params).forEach(param => {
                this.baseValues.set(param.id, param.default);
                // Initialize computedValues keys to ensure hidden class stability in V8
                this.computedValues[param.id] = param.default;
            });
        });
    }

    setBaseValue(paramId, value) {
        if (this.baseValues.has(paramId)) {
            this.baseValues.set(paramId, value);
        }
    }

    // Fixed: Updates in place if exists
    addPatch(sourceId, targetId, amount = 1.0) {
        const patchId = `${sourceId}->${targetId}`;
        const existing = this.patches.find(p => p.id === patchId);
        
        if (existing) {
            existing.amount = amount;
        } else {
            this.patches.push({ id: patchId, source: sourceId, target: targetId, amount: amount });
        }
    }

    removePatch(patchId) {
        this.patches = this.patches.filter(p => p.id !== patchId);
    }

    clearAllPatches() {
        this.patches = [];
    }

    /**
     * Calculates final parameter values based on Base Values + Modulation Signals.
     * optimized for Zero-Allocation (GC Friendly).
     * 
     * @param {Object} signals - The current frame's signal values (Audio/LFO/Events)
     * @returns {Object} The persistent computedValues object
     */
    compute(signals) {
        // 1. Reset: Copy Base Values directly to computedValues
        // Using iterator is faster than recreating object
        for (const [key, value] of this.baseValues.entries()) {
            this.computedValues[key] = value;
        }

        // 2. Apply Modulations (Additive)
        // We use a standard for loop for performance over .forEach in hot paths
        for (let i = 0; i < this.patches.length; i++) {
            const patch = this.patches[i];
            const signalValue = signals[patch.source] || 0;
            
            // Optimization: Skip calculation if signal or amount is negligible
            if (Math.abs(signalValue) < 0.001 || Math.abs(patch.amount) < 0.001) continue;

            const targetDef = getParamDefinition(patch.target);

            if (targetDef) {
                // Read current value from the persistent object
                const currentVal = this.computedValues[patch.target];
                let modDelta = 0;

                if (targetDef.type === 'float' || targetDef.type === 'int') {
                    const range = targetDef.max - targetDef.min;
                    modDelta = signalValue * patch.amount * range;
                } else if (targetDef.type === 'bool') {
                    // For bools, we treat it as a threshold trigger
                    modDelta = (signalValue * patch.amount) > 0.5 ? 1 : 0;
                }

                // Write update back to persistent object
                this.computedValues[patch.target] = currentVal + modDelta;
            }
        }

        // 3. Clamp and Cast
        // We iterate the computedValues keys. Since this object structure doesn't change, 
        // JS engines optimize this iteration.
        for (const key in this.computedValues) {
            const def = getParamDefinition(key);
            if (!def) continue;

            let val = this.computedValues[key];
            
            // Clamp
            if (val < def.min) val = def.min;
            else if (val > def.max) val = def.max;

            // Type Cast
            if (def.type === 'int') {
                val = Math.floor(val);
            } else if (def.type === 'bool') {
                val = val > 0.5; // Boolean logic: > 0.5 is true
            } else if (def.type === 'select') {
                val = Math.floor(val);
                if (val >= def.options.length) val = def.options.length - 1;
                if (val < 0) val = 0;
            }

            this.computedValues[key] = val;
        }

        return this.computedValues;
    }
}