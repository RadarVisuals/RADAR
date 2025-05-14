// src/utils/performanceHelpers.js

/** @type {ReturnType<typeof setTimeout> | null} */
let dimmingTimerId = null; // Hold the timer ID for the dimming effect

/**
 * Adds/Removes a class to a target element to indicate an overlay is active,
 * typically used to dim or slightly de-emphasize background content.
 * This version is simplified to only manage class toggling and avoid
 * interfering with animation/transition properties of other elements.
 *
 * @param {number} [duration=300] - How long the class should be applied in milliseconds.
 * @param {object} [options={}] - Configuration options.
 * @param {string} [options.className='overlay-animating'] - The class to add/remove.
 * @param {string} [options.selector='.main-view'] - The selector for the target element.
 * @param {boolean} [options.debug=false] - Enable debug logging for this specific utility. General dev logs use `import.meta.env.DEV`.
 * @returns {() => void} - A function that can be called to cancel the dimming effect early and remove the class.
 */
export const manageOverlayDimmingEffect = (duration = 300, options = {}) => {
  const {
    className = 'overlay-animating',
    selector = '.main-view',
    debug = false // Note: This 'debug' flag is specific to this util.
  } = options;

  const target = document.querySelector(selector);

  if (!target) {
    if (debug && import.meta.env.DEV) { // Conditional logging
        console.warn(`[manageOverlayDimmingEffect] Could not find element matching selector "${selector}"`);
    }
    return () => {}; // Return a no-op function if target not found
  }

  // Clear any existing timer for this effect
  if (dimmingTimerId) {
    clearTimeout(dimmingTimerId);
    dimmingTimerId = null;
  }

  // Add class if not already present
  if (!target.classList.contains(className)) {
    if (debug && import.meta.env.DEV) { // Conditional logging
        console.log(`[manageOverlayDimmingEffect] Adding class '${className}' to element matching '${selector}'.`);
    }
    target.classList.add(className);
  }

  // Set timer to remove the class after the specified duration
  dimmingTimerId = setTimeout(() => {
    if (debug && import.meta.env.DEV) { // Conditional logging
        console.log(`[manageOverlayDimmingEffect] Duration elapsed. Removing class '${className}' from element matching '${selector}'.`);
    }
    if(target.classList.contains(className)) { // Check if class still exists before removing
        target.classList.remove(className);
    }
    dimmingTimerId = null; // Clear timer ID after execution
  }, duration);

  // Return a cleanup function to cancel the effect early
  return () => {
    if (debug && import.meta.env.DEV) { // Conditional logging
        console.log(`[manageOverlayDimmingEffect] Manually canceled. Removing class '${className}'.`);
    }
    if (dimmingTimerId) {
      clearTimeout(dimmingTimerId);
      dimmingTimerId = null;
    }
    // Ensure class is removed if the cancel function is called
    if (target.classList.contains(className)) {
        target.classList.remove(className);
    }
  };
};

/**
 * Creates a "rested" `requestAnimationFrame` (RAF) callback that waits for a specified
 * number of animation frames before executing the provided callback function.
 * This can be useful to allow the browser to complete other rendering tasks or "catch up"
 * before performing an animation or update.
 *
 * @param {() => void} callback - The function to execute after the specified frame count.
 * @param {number} [frameCount=2] - Number of animation frames to wait before executing the callback (1-3 recommended for responsiveness).
 * @returns {number | null} - The ID returned by `requestAnimationFrame`, which can be used with `cancelAnimationFrame` to cancel the "rested" RAF. Returns `null` if `requestAnimationFrame` is not supported (should not happen in modern browsers).
 */
export const restfulRAF = (callback, frameCount = 2) => {
  /** @type {number} */
  let currentFrame = 0;
  /** @type {number | null} */
  let rafId = null;

  const rafLoop = () => {
    currentFrame++;
    if (currentFrame >= frameCount) {
      callback();
      // rafId is implicitly null after callback if not re-assigned, or loop ends.
    } else {
      if (typeof requestAnimationFrame === 'function') {
        rafId = requestAnimationFrame(rafLoop);
      } else if (import.meta.env.DEV) {
        // This case should be extremely rare in modern environments.
        console.warn("[restfulRAF] requestAnimationFrame is not supported. Callback will not be executed.");
      }
    }
  };

  if (typeof requestAnimationFrame === 'function') {
    rafId = requestAnimationFrame(rafLoop);
  } else if (import.meta.env.DEV) {
    console.warn("[restfulRAF] requestAnimationFrame is not supported. Callback will not be scheduled.");
  }
  return rafId;
};