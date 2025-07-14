// src/utils/performanceHelpers.js

/** @type {ReturnType<typeof setTimeout> | null} */
let dimmingTimerId = null; // Hold the timer ID for the dimming effect

// New performance tracking variables
let backgroundAnimationPaused = false;
let performanceMode = 'auto'; // 'auto', 'performance', 'quality'

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

  // NEW: Always pause background animations during overlay operations
  pauseBackgroundAnimations(true);

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
    
    // NEW: Resume background animations
    pauseBackgroundAnimations(false);
    
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
    
    // NEW: Resume background animations on manual cancel
    pauseBackgroundAnimations(false);
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

// ========== NEW PERFORMANCE OPTIMIZATION FUNCTIONS ==========

/**
 * Detect if we should use performance mode based on device capabilities
 */
const detectPerformanceMode = () => {
  // Check various performance indicators
  const isLowPowerMode = navigator.deviceMemory && navigator.deviceMemory < 4;
  const isSlowConnection = navigator.connection && 
    (navigator.connection.effectiveType === 'slow-2g' || navigator.connection.effectiveType === '2g');
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isLowPowerMode || isSlowConnection) {
    return 'performance';
  } else if (isMobile) {
    return 'auto';
  }
  return 'quality';
};

// Initialize performance mode
if (performanceMode === 'auto') {
  performanceMode = detectPerformanceMode();
}

/**
 * Function to pause/resume background animations to improve overlay performance
 * @param {boolean} pause - Whether to pause (true) or resume (false) animations
 */
const pauseBackgroundAnimations = (pause) => {
  if (pause === backgroundAnimationPaused) return;
  
  backgroundAnimationPaused = pause;
  
  // Dispatch custom event for animation managers to listen to
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('backgroundAnimationControl', {
      detail: { paused: pause, reason: 'overlay-performance' }
    }));
  }
  
  // Use CSS approach for broad compatibility - more aggressive pausing
  const styleId = 'performance-animation-control';
  let styleElement = document.getElementById(styleId);
  
  if (pause) {
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = `
      .performance-pause-animations,
      .performance-pause-animations *,
      .main-view,
      .main-view * {
        animation-play-state: paused !important;
        transition-duration: 0.05s !important;
        will-change: auto !important;
      }
      
      .main-view canvas {
        will-change: auto !important;
        transform: translateZ(0) !important;
      }
      
      /* Reduce GPU usage during overlay operations */
      .main-view {
        transform: translateZ(0);
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }
    `;
    
    // Add class to main view and body
    const mainView = document.querySelector('.main-view');
    const body = document.body;
    if (mainView) {
      mainView.classList.add('performance-pause-animations', 'performance-mode');
    }
    if (body) {
      body.classList.add('performance-pause-animations');
    }
  } else {
    if (styleElement) {
      styleElement.remove();
    }
    
    // Remove class from main view and body
    const mainView = document.querySelector('.main-view');
    const body = document.body;
    if (mainView) {
      mainView.classList.remove('performance-pause-animations', 'performance-mode');
    }
    if (body) {
      body.classList.remove('performance-pause-animations');
    }
  }
};

/**
 * Debounced function factory for performance-critical operations
 * @param {Function} func - The function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export const createPerformanceDebouncer = (func, wait = 16) => {
  let timeout;
  let lastCallTime = 0;
  
  return function executedFunction(...args) {
    const now = Date.now();
    
    // If we're in performance mode, increase debounce time
    const actualWait = performanceMode === 'performance' ? wait * 2 : wait;
    
    const later = () => {
      lastCallTime = now;
      timeout = null;
      func.apply(this, args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    
    // If enough time has passed, execute immediately
    if (now - lastCallTime >= actualWait) {
      later();
    } else {
      timeout = setTimeout(later, actualWait - (now - lastCallTime));
    }
  };
};

/**
 * Throttled function factory for scroll and resize events
 * @param {Function} func - The function to throttle
 * @param {number} limit - Throttle limit in milliseconds
 * @returns {Function} - Throttled function
 */
export const createPerformanceThrottler = (func, limit = 16) => {
  let inThrottle;
  
  return function throttledFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      
      const throttleTime = performanceMode === 'performance' ? limit * 2 : limit;
      
      setTimeout(() => {
        inThrottle = false;
      }, throttleTime);
    }
  };
};

/**
 * Request idle callback with fallback for older browsers
 * @param {Function} callback - Callback function to execute
 * @param {object} options - Options object
 * @returns {number} - ID that can be used to cancel the callback
 */
export const safeRequestIdleCallback = (callback, options = {}) => {
  if (typeof window !== 'undefined' && window.requestIdleCallback) {
    return window.requestIdleCallback(callback, {
      timeout: 5000,
      ...options
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    return setTimeout(() => {
      const start = Date.now();
      callback({
        didTimeout: false,
        timeRemaining() {
          return Math.max(0, 50 - (Date.now() - start));
        }
      });
    }, 1);
  }
};

/**
 * Cancel idle callback with fallback
 * @param {number} id - ID returned by safeRequestIdleCallback
 */
export const safeCancelIdleCallback = (id) => {
  if (typeof window !== 'undefined' && window.cancelIdleCallback) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};

/**
 * Optimized animation frame scheduler
 * @param {Function} callback - Callback to execute
 * @param {string} priority - Priority level: 'high', 'normal', 'low'
 * @returns {number} - ID that can be used to cancel
 */
export const scheduleWork = (callback, priority = 'normal') => {
  const priorities = {
    high: 0,
    normal: 5,
    low: 10
  };
  
  const delay = priorities[priority] || 5;
  
  if (performanceMode === 'performance') {
    // In performance mode, defer non-critical work
    if (priority === 'low') {
      return requestIdleCallback(callback);
    }
  }
  
  if (delay === 0) {
    return requestAnimationFrame(callback);
  } else {
    return setTimeout(() => {
      requestAnimationFrame(callback);
    }, delay);
  }
};

/**
 * Performance monitoring utilities
 */
export const performanceMonitor = {
  startTiming: (label) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${label}-start`);
    }
    return Date.now();
  },
  
  endTiming: (label, startTime) => {
    const endTime = Date.now();
    const duration = endTime - (startTime || 0);
    
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      performance.mark(`${label}-end`);
      try {
        performance.measure(label, `${label}-start`, `${label}-end`);
      } catch (e) {
        // Ignore measurement errors
      }
    }
    
    if (duration > 16 && import.meta.env.DEV && console.warn) {
      console.warn(`Performance warning: ${label} took ${duration}ms`);
    }
    
    return duration;
  }
};

/**
 * Get current performance mode
 * @returns {string} Current performance mode
 */
export const getPerformanceMode = () => performanceMode;

/**
 * Set performance mode
 * @param {string} mode - Performance mode to set
 */
export const setPerformanceMode = (mode) => {
  performanceMode = mode;
};

/**
 * Request idle callback with fallback for older browsers
 * @param {Function} callback - Callback function to execute
 * @param {object} options - Options object
 * @returns {number} - ID that can be used to cancel the callback
 */
export const requestIdleCallback = (callback, options = {}) => {
  if (typeof window !== 'undefined' && window.requestIdleCallback) {
    return window.requestIdleCallback(callback, {
      timeout: 5000,
      ...options
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    return setTimeout(() => {
      const start = Date.now();
      callback({
        didTimeout: false,
        timeRemaining() {
          return Math.max(0, 50 - (Date.now() - start));
        }
      });
    }, 1);
  }
};

/**
 * Cancel idle callback with fallback
 * @param {number} id - ID returned by requestIdleCallback
 */
export const cancelIdleCallback = (id) => {
  if (typeof window !== 'undefined' && window.cancelIdleCallback) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};

/**
 * Cleanup function for the module
 */
export const cleanup = () => {
  if (dimmingTimerId) {
    clearTimeout(dimmingTimerId);
    dimmingTimerId = null;
  }
  
  if (backgroundAnimationPaused) {
    pauseBackgroundAnimations(false);
  }
};