// src/effects/ColorOverlayEffect.js
import VisualEffect from "./VisualEffect"; // Local base class

/**
 * @typedef {object} ColorOverlayConfig
 * @property {string} [color='rgba(255, 0, 0, 0.3)'] - The color of the overlay (CSS color string).
 * @property {number} [pulseCount=3] - The number of times the overlay will pulse (fade in and out).
 * @property {number} [duration=3000] - The total duration of the effect in milliseconds.
 * @property {number} [fadeOutDuration] - Duration for the final fade out of the overlay. Defaults to 40% of `duration`.
 * @property {string} [easing='cubic-bezier(0.4, 0, 0.2, 1)'] - CSS easing function for the pulse transitions.
 * @property {string} [mixBlendMode='overlay'] - CSS mix-blend-mode for the overlay.
 */

/**
 * Creates a pulsating color overlay effect on a target canvas layer
 * or globally on the main canvas container. The color, pulse count, and duration
 * are configurable via the `config` property inherited from VisualEffect.
 * This effect works by dynamically adding and animating a DOM element overlay.
 *
 * @extends VisualEffect
 */
class ColorOverlayEffect extends VisualEffect {
  /**
   * Applies the color overlay effect by creating and animating a DOM element.
   *
   * @returns {import('../utils/VisualEffectsProcessor').EffectControlAPI} A control object including `effectId`, `layer`, and a `clear` method to stop and remove the effect.
   */
  apply() { // Removed _updateLayerConfig as it's unused in this specific effect
    const { layer } = this;
    /** @type {ColorOverlayConfig} */
    const effectSpecificConfig = this.config || {};

    const {
      color = "rgba(255, 0, 0, 0.3)",
      pulseCount = 3,
      duration = 3000,
      fadeOutDuration = duration * 0.4,
      easing = "cubic-bezier(0.4, 0, 0.2, 1)",
      mixBlendMode = "overlay",
    } = effectSpecificConfig;

    const logPrefix = `[ColorOverlayEffect ${this.effectId}]`;
    /** @type {HTMLElement | null} */
    let targetElement = null;
    let zIndexBase = 1;

    if (layer === 'global') {
        targetElement = document.querySelector('.canvas-container');
        if (targetElement) {
            zIndexBase = 10;
        } else if (import.meta.env.DEV) {
            console.error(`${logPrefix} Failed to find .canvas-container element for global overlay!`);
        }
    } else {
        const layerSelector = `.canvas.layer-${layer}`;
        targetElement = document.querySelector(layerSelector);
        if (targetElement) {
            const targetZIndex = parseInt(targetElement.style.zIndex || '', 10);
            zIndexBase = isNaN(targetZIndex) ? (parseInt(String(layer), 10) + 2) : targetZIndex;
        } else if (import.meta.env.DEV) {
             console.warn(`${logPrefix} Canvas element not found using selector: ${layerSelector}`);
        }
    }

    if (!targetElement) {
      if (import.meta.env.DEV) {
        console.error(`${logPrefix} No target element found to apply overlay.`);
      }
      return {
        effectId: this.effectId,
        layer: layer,
        type: this.type,
        config: this.config,
        clear: () => this.cleanup(),
      };
    }

    const existingOverlay = document.getElementById(`color-overlay-${this.effectId}`);
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const overlayId = `color-overlay-${this.effectId}`;
    const overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.classList.add("color-overlay-effect");
    Object.assign(overlay.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        background: color,
        pointerEvents: "none",
        zIndex: (zIndexBase + 10).toString(),
        opacity: "0",
        transition: `opacity ${duration / (pulseCount * 2)}ms ${easing}`,
        mixBlendMode: mixBlendMode,
    });

    targetElement.appendChild(overlay);

    let currentPulse = 0;
    let isVisible = false;
    let isCleanedUp = false;

    const pulse = () => {
      if (isCleanedUp || !overlay || !overlay.isConnected) return;

      isVisible = !isVisible;
      overlay.style.opacity = isVisible ? "1" : "0";

      if (!isVisible) {
        currentPulse++;
      }

      if (currentPulse >= pulseCount) {
        this.addTimeout(
          "final_fade_out",
          () => {
            if (isCleanedUp || !overlay || !overlay.isConnected) return;
            overlay.style.transition = `opacity ${fadeOutDuration}ms ease-out`;
            overlay.style.opacity = "0";
            this.addTimeout(
              "remove_element",
              () => {
                if (overlay?.parentNode) {
                   overlay.remove();
                }
              },
              fadeOutDuration + 100,
            );
          },
          duration / (pulseCount * 2),
        );
        return;
      }

      this.addTimeout(
        `pulse-${currentPulse}-${isVisible ? "on" : "off"}`,
        pulse,
        duration / (pulseCount * 2),
      );
    };

    this.addTimeout("start_pulse", pulse, 50);

    return {
      effectId: this.effectId,
      layer: layer,
      type: this.type,
      config: this.config,
      clear: () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        this.cleanup();
      },
    };
  }

  /**
   * Overrides the base cleanup method to specifically handle the removal
   * of the DOM element created by this effect.
   */
  cleanup() {
    super.cleanup();

    const overlayId = `color-overlay-${this.effectId}`;
    const overlayElement = document.getElementById(overlayId);

    if (overlayElement) {
      if (overlayElement.style.opacity !== "0") {
        overlayElement.style.transition = "opacity 150ms ease-out";
        overlayElement.style.opacity = "0";
        setTimeout(() => {
          if (overlayElement.parentNode) {
            overlayElement.remove();
          }
        }, 150);
      } else if (overlayElement.parentNode) {
        overlayElement.remove();
      }
    }
  }
}

export default ColorOverlayEffect;