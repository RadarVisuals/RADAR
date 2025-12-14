// src/utils/ModulationEngine.js
import { EFFECT_MANIFEST, getParamDefinition } from '../config/EffectManifest';

export class ModulationEngine {
    constructor() {
        this.baseValues = new Map();
        this.patches = [];
        this.computedValues = {};
        this.resetToDefaults();
    }

    resetToDefaults() {
        Object.values(EFFECT_MANIFEST).forEach(effect => {
            Object.values(effect.params).forEach(param => {
                this.baseValues.set(param.id, param.default);
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

    compute(signals) {
        const finalResults = {};
        
        // 1. Start with Base Values
        for (const [key, value] of this.baseValues.entries()) {
            finalResults[key] = value;
        }

        // 2. Apply Modulations
        for (const patch of this.patches) {
            const signalValue = signals[patch.source] || 0;
            const targetDef = getParamDefinition(patch.target);

            if (targetDef) {
                const currentVal = finalResults[patch.target];
                let modDelta = 0;

                if (targetDef.type === 'float' || targetDef.type === 'int') {
                    const range = targetDef.max - targetDef.min;
                    modDelta = signalValue * patch.amount * range;
                } else if (targetDef.type === 'bool') {
                    modDelta = (signalValue * patch.amount) > 0.5 ? 1 : 0;
                }

                finalResults[patch.target] = currentVal + modDelta;
            }
        }

        // 3. Clamp and Cast
        for (const key in finalResults) {
            const def = getParamDefinition(key);
            if (!def) continue;

            let val = finalResults[key];
            val = Math.max(def.min, Math.min(def.max, val));

            if (def.type === 'int') val = Math.floor(val);
            else if (def.type === 'bool') val = val > 0.5;
            else if (def.type === 'select') {
                val = Math.floor(val);
                if (val >= def.options.length) val = def.options.length - 1;
            }

            this.computedValues[key] = val;
        }

        return this.computedValues;
    }
}