/**
 * Performance Helper Utilities for animations
 * For TokenSelectorOverlay and similar components that need to
 * avoid interrupting background animations.
 */

// Track if we're currently in a high-performance animation situation
let isHighPerfMode = false;

/**
 * Pause expensive background animations temporarily
 * @param {number} duration - How long to pause in ms
 * @param {Object} options - Configuration options
 * @returns {Function} - Call this function to cancel early
 */
export const pauseBackgroundWork = (duration = 1000, options = {}) => {
  const {
    className = 'overlay-animating',
    selector = 'html',
    debug = false
  } = options;
  
  if (isHighPerfMode) {
    if (debug) console.log('Already in high-perf mode, extending');
    return () => {}; // Already activated
  }
  
  isHighPerfMode = true;
  const target = document.querySelector(selector);
  
  if (!target) {
    console.warn(`pauseBackgroundWork: Could not find element matching selector "${selector}"`);
    isHighPerfMode = false;
    return () => {};
  }
  
  if (debug) console.log(`pauseBackgroundWork: Adding ${className} to ${selector}`);
  
  // Store original animation speeds
  const animatedElements = document.querySelectorAll('[class*="animation"], [class*="animate"], canvas');
  animatedElements.forEach(el => {
    const styles = window.getComputedStyle(el);
    const animDuration = styles.getPropertyValue('animation-duration');
    const transDuration = styles.getPropertyValue('transition-duration');
    
    if (animDuration && animDuration !== '0s') {
      el.dataset.originalAnimDuration = animDuration;
      el.style.setProperty('--original-duration', animDuration);
    }
    
    if (transDuration && transDuration !== '0s') {
      el.dataset.originalTransDuration = transDuration;
      el.style.setProperty('--original-duration', transDuration);
    }
  });
  
  // Add class to trigger CSS performance optimizations
  target.classList.add(className);
  
  // Set up timer to remove class
  const timerId = setTimeout(() => {
    if (debug) console.log(`pauseBackgroundWork: Removing ${className} from ${selector}`);
    target.classList.remove(className);
    isHighPerfMode = false;
  }, duration);
  
  // Return cancel function
  return () => {
    if (debug) console.log(`pauseBackgroundWork: Manually canceled, removing ${className}`);
    clearTimeout(timerId);
    target.classList.remove(className);
    isHighPerfMode = false;
  };
};

/**
 * Creates a "rested" RAF callback that waits for a specified
 * number of frames before executing to allow the browser to catch up
 * 
 * @param {Function} callback - The function to execute 
 * @param {number} frameCount - Number of frames to wait (1-3 recommended)
 * @returns {number} - RAF ID that can be canceled
 */
export const restfulRAF = (callback, frameCount = 2) => {
  let currentFrame = 0;
  let rafId = null;
  
  const rafLoop = () => {
    currentFrame++;
    if (currentFrame >= frameCount) {
      callback();
    } else {
      rafId = requestAnimationFrame(rafLoop);
    }
  };
  
  rafId = requestAnimationFrame(rafLoop);
  return rafId;
};

export default {
  pauseBackgroundWork,
  restfulRAF
};