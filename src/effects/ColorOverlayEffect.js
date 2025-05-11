import VisualEffect from "./VisualEffect";

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
   * The `_updateLayerConfig` parameter is present to maintain interface consistency
   * with the base `VisualEffect` class, but it is not used by this specific effect.
   *
   * @param {Function} _updateLayerConfig - Function to update layer config (unused in this effect).
   * @returns {object} A control object including `effectId`, `layer`, and a `clear` method to stop and remove the effect.
   */
  apply(_updateLayerConfig) {
    const { layer } = this;
    const {
      color = "rgba(255, 0, 0, 0.3)", // Default pulse color
      pulseCount = 3, // Default number of pulses
      duration = 3000, // Default total duration of the effect in ms
      fadeOutDuration = duration * 0.4, // Duration for the final fade out
      easing = "cubic-bezier(0.4, 0, 0.2, 1)", // Default CSS easing function
    } = this.config;

    const logPrefix = `[ColorOverlayEffect ${this.effectId}]`;
    let targetElement = null;
    let zIndexBase = 1;

    // Determine the target DOM element for the overlay
    if (layer === 'global') {
        targetElement = document.querySelector('.canvas-container');
        if (targetElement) {
            zIndexBase = 10; // Higher z-index for global overlay
        } else {
            console.error(`${logPrefix} Failed to find .canvas-container element!`);
        }
    } else {
        const layerSelector = `.canvas.layer-${layer}`;
        targetElement = document.querySelector(layerSelector);
        if (targetElement) {
            // Base z-index on the target canvas layer's z-index
            zIndexBase = parseInt(targetElement.style.zIndex || (parseInt(layer, 10) + 2), 10);
        } else {
             console.warn(`${logPrefix} Canvas element not found using selector: ${layerSelector}`);
        }
    }

    if (!targetElement) {
      console.error(`${logPrefix} No target element found to apply overlay.`);
      return {
        effectId: this.effectId,
        layer: layer,
        clear: () => this.cleanup(), // Provide a cleanup function even on failure
      };
    }

    // Remove any existing overlay with the same effect ID
    const existingOverlay = document.getElementById(`color-overlay-${this.effectId}`);
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Create and style the new overlay element
    const overlayId = `color-overlay-${this.effectId}`;
    const overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.classList.add("color-overlay-effect"); // For potential CSS targeting
    Object.assign(overlay.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        background: color,
        pointerEvents: "none",
        zIndex: (zIndexBase + 10).toString(), // Ensure overlay is on top
        opacity: "0", // Start transparent
        transition: `opacity ${duration / (pulseCount * 2)}ms ${easing}`,
        mixBlendMode: "overlay", // Example blend mode
    });

    targetElement.appendChild(overlay);

    let currentPulse = 0;
    let isVisible = false;
    let isCleanedUp = false; // Flag to prevent multiple cleanup calls

    // Recursive pulse function
    const pulse = () => {
      if (isCleanedUp || !overlay) return; // Stop if cleaned up or overlay removed

      isVisible = !isVisible; // Toggle visibility state
      overlay.style.opacity = isVisible ? "1" : "0"; // Apply opacity change

      if (!isVisible) { // Increment pulse count when fading out
        currentPulse++;
      }

      if (currentPulse >= pulseCount) { // All pulses completed
        this.addTimeout(
          "cleanup", // Unique ID for this timeout
          () => {
            if (isCleanedUp || !overlay) return;
            overlay.style.transition = `opacity ${fadeOutDuration}ms ease-out`;
            overlay.style.opacity = "0"; // Final fade out
            this.addTimeout(
              "remove",
              () => {
                if (overlay?.parentNode) { // Check if still in DOM
                   overlay.remove();
                }
              },
              fadeOutDuration + 100, // Delay removal after fade out
            );
          },
          duration / (pulseCount * 2), // Time for one phase of the pulse
        );
        return;
      }

      // Schedule next phase of the pulse
      this.addTimeout(
        `pulse-${currentPulse}-${isVisible ? "on" : "off"}`,
        pulse,
        duration / (pulseCount * 2),
      );
    };

    this.addTimeout("start", pulse, 50); // Start the first pulse shortly after creation

    return {
      effectId: this.effectId,
      layer: layer,
      clear: () => {
        isCleanedUp = true; // Set flag to prevent further pulses/cleanup
        this.cleanup(); // Call the main cleanup method
      },
    };
  }

  /**
   * Overrides the base cleanup method to specifically handle the removal
   * of the DOM element created by this effect.
   */
  cleanup() {
    super.cleanup(); // Call base class cleanup (clears timeouts)
    const overlayId = `color-overlay-${this.effectId}`;
    const overlayElement = document.getElementById(overlayId);
    if (overlayElement) {
      // Smoothly fade out before removing, in case it's cleared mid-animation
      overlayElement.style.transition = "opacity 150ms ease-out";
      overlayElement.style.opacity = "0";
      setTimeout(() => {
        if (overlayElement.parentNode) {
          overlayElement.remove();
        }
      }, 150); // Delay removal to allow fade out
    }
  }
}

export default ColorOverlayEffect;