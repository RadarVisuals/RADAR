// src/utils/VisualEffectsProcessor.js
import EffectFactory from "../effects/EffectFactory";

const MAX_CONCURRENT_EFFECTS = 5;

class VisualEffectsProcessor {
  activeEffects = new Map();

  constructor() {
    this.activeEffects = new Map();
  }

  async processEffect(effectConfig, updateLayerConfig) {
    let type = effectConfig.type || effectConfig.effect || "color_overlay";
    const finalEffectConfig = { ...effectConfig, type };

    // 1. STRENGTHEN: Limit total concurrent effects to prevent visual/DOM exhaustion
    if (this.activeEffects.size >= MAX_CONCURRENT_EFFECTS) {
      const oldestId = this.activeEffects.keys().next().value;
      this.cancelEffect(oldestId);
    }

    // 2. Clear conflicting effects on the same layer
    const activeLayerEffects = Array.from(this.activeEffects.values()).filter(
      (e) => e.layer === finalEffectConfig.layer,
    );
    activeLayerEffects.forEach((activeEffect) => {
      if (activeEffect?.clear) {
        activeEffect.clear();
        this.activeEffects.delete(activeEffect.effectId);
      }
    });

    try {
      const effectInstance = EffectFactory.createEffect(finalEffectConfig.type, finalEffectConfig);
      const controlObject = effectInstance.apply(updateLayerConfig);

      if (controlObject?.effectId) {
        this.activeEffects.set(controlObject.effectId, controlObject);

        const duration = finalEffectConfig.config?.duration || 3000;
        setTimeout(() => {
          if (this.activeEffects.get(controlObject.effectId) === controlObject) {
            this.activeEffects.delete(controlObject.effectId);
          }
        }, duration + 1000);

        return controlObject;
      }
      return null;
    } catch (error) {
      console.error(`[VisualEffectsProcessor] Error:`, error);
      return null;
    }
  }

  cancelEffect(effectId) {
    const effectControl = this.activeEffects.get(effectId);
    if (effectControl?.clear) {
      try {
        effectControl.clear();
      } catch (e) {}
    }
    this.activeEffects.delete(effectId);
  }

  cancelEffectsForLayer(layer) {
    const layerIdStr = String(layer);
    const toCancel = [];
    for (const [id, ctrl] of this.activeEffects.entries()) {
      if (String(ctrl.layer) === layerIdStr) toCancel.push(id);
    }
    toCancel.forEach((id) => this.cancelEffect(id));
  }

  cancelAllEffects() {
    const allIds = Array.from(this.activeEffects.keys());
    allIds.forEach((id) => this.cancelEffect(id));
    this.activeEffects.clear();
  }

  async createDefaultEffect(eventType, updateLayerConfig) {
    const eventLower = typeof eventType === "string" ? eventType.toLowerCase() : "";
    let effectConfig;

    if (eventLower.includes("lyx_received")) {
      effectConfig = { type: "color_overlay", layer: "1", config: { color: "rgba(255, 165, 0, 0.4)", pulseCount: 2, duration: 2500 } };
    } else if (eventLower.includes("token_received") || eventLower.includes("lsp7_received") || eventLower.includes("lsp8_received")) {
      effectConfig = { type: "color_overlay", layer: "2", config: { color: "rgba(0, 243, 255, 0.4)", pulseCount: 2, duration: 2500 } };
    } else {
      effectConfig = { type: "color_overlay", layer: "3", config: { color: "rgba(255, 0, 150, 0.4)", pulseCount: 2, duration: 2500 } };
    }

    return this.processEffect(effectConfig, updateLayerConfig);
  }

  getActiveEffectsCount() { return this.activeEffects.size; }
  getActiveEffects() { return Array.from(this.activeEffects.values()); }
}

export default VisualEffectsProcessor;