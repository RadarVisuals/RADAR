import VisualEffect from "./VisualEffect";

/**
 * Creates a pulsating color overlay effect on a target canvas layer
 * or globally on the main canvas container. The color, pulse count, and duration
 * are configurable via the `config` property inherited from VisualEffect.
 * This effect works by dynamically adding and animating a DOM element overlay.
 */
class ColorOverlayEffect extends VisualEffect {
  /**
   * Applies the color overlay effect by creating and animating a DOM element.
   * @param {Function} _updateLayerConfig - Function to update layer config (parameter kept for interface consistency with VisualEffect base class, but not used by this specific effect).
   * @returns {object} A control object including `effectId`, `layer`, and a `clear` method to stop and remove the effect.
   */
  apply(_updateLayerConfig) { // Keep underscore prefix per eslint config
    const { layer } = this;
    const {
      color = "rgba(255, 0, 0, 0.3)",
      pulseCount = 3,
      duration = 3000,
      fadeOutDuration = duration * 0.4,
      easing = "cubic-bezier(0.4, 0, 0.2, 1)",
    } = this.config;

    const logPrefix = `[ColorOverlayEffect ${this.effectId}]`;
    let targetElement = null;
    let zIndexBase = 1;

    if (layer === 'global') {
        targetElement = document.querySelector('.canvas-container');
        if (targetElement) {
            zIndexBase = 10;
        } else {
            console.error(`${logPrefix} Failed to find .canvas-container element!`);
        }
    } else {
        const layerSelector = `.canvas.layer-${layer}`;
        targetElement = document.querySelector(layerSelector);
        if (targetElement) {
            zIndexBase = parseInt(targetElement.style.zIndex || (parseInt(layer, 10) + 2), 10); // Added radix 10
        } else {
             console.warn(`${logPrefix} Canvas element not found using selector: ${layerSelector}`);
        }
    }

    if (!targetElement) {
      console.error(`${logPrefix} No target element found to apply overlay.`);
      return {
        effectId: this.effectId,
        layer: layer,
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
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = color;
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = (zIndexBase + 10).toString();
    overlay.style.opacity = "0";
    overlay.style.transition = `opacity ${duration / (pulseCount * 2)}ms ${easing}`;
    overlay.style.mixBlendMode = "overlay";

    targetElement.appendChild(overlay);

    let currentPulse = 0;
    let isVisible = false;
    let isCleanedUp = false;

    const pulse = () => {
      if (isCleanedUp || !overlay) return;

      isVisible = !isVisible;
      overlay.style.opacity = isVisible ? "1" : "0";

      if (!isVisible) {
        currentPulse++;
      }

      if (currentPulse >= pulseCount) {
        this.addTimeout(
          "cleanup",
          () => {
            if (isCleanedUp || !overlay) return;
            overlay.style.transition = `opacity ${fadeOutDuration}ms ease-out`;
            overlay.style.opacity = "0";
            this.addTimeout(
              "remove",
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

    this.addTimeout("start", pulse, 50);

    return {
      effectId: this.effectId,
      layer: layer,
      clear: () => {
        isCleanedUp = true;
        this.cleanup();
      },
    };
  }

  /** Overrides the base cleanup to specifically remove the DOM element. */
  cleanup() {
    super.cleanup();
    const overlayId = `color-overlay-${this.effectId}`;
    const overlayElement = document.getElementById(overlayId);
    if (overlayElement) {
      overlayElement.style.transition = "opacity 150ms ease-out";
      overlayElement.style.opacity = "0";
      setTimeout(() => {
        if (overlayElement.parentNode) {
          overlayElement.remove();
        }
      }, 150);
    }
  }
}

export default ColorOverlayEffect;