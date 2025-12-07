// src/utils/performanceHelpers.js
import SignalBus from './SignalBus';

/** @type {ReturnType<typeof setTimeout> | null} */
let dimmingTimerId = null; 

let backgroundAnimationPaused = false;
let performanceMode = 'auto'; // 'auto', 'performance', 'quality'

export const manageOverlayDimmingEffect = (duration = 300, options = {}) => {
  const {
    className = 'overlay-animating',
    selector = '.main-view',
    debug = false 
  } = options;

  const target = document.querySelector(selector);

  if (!target) {
    if (debug && import.meta.env.DEV) { 
        console.warn(`[manageOverlayDimmingEffect] Could not find element matching selector "${selector}"`);
    }
    return () => {}; 
  }

  if (dimmingTimerId) {
    clearTimeout(dimmingTimerId);
    dimmingTimerId = null;
  }

  pauseBackgroundAnimations(true);

  if (!target.classList.contains(className)) {
    target.classList.add(className);
  }

  dimmingTimerId = setTimeout(() => {
    if(target.classList.contains(className)) { 
        target.classList.remove(className);
    }
    
    pauseBackgroundAnimations(false);
    dimmingTimerId = null; 
  }, duration);

  return () => {
    if (dimmingTimerId) {
      clearTimeout(dimmingTimerId);
      dimmingTimerId = null;
    }
    if (target.classList.contains(className)) {
        target.classList.remove(className);
    }
    pauseBackgroundAnimations(false);
  };
};

export const restfulRAF = (callback, frameCount = 2) => {
  let currentFrame = 0;
  let rafId = null;

  const rafLoop = () => {
    currentFrame++;
    if (currentFrame >= frameCount) {
      callback();
    } else {
      if (typeof requestAnimationFrame === 'function') {
        rafId = requestAnimationFrame(rafLoop);
      }
    }
  };

  if (typeof requestAnimationFrame === 'function') {
    rafId = requestAnimationFrame(rafLoop);
  }
  return rafId;
};

const detectPerformanceMode = () => {
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

if (performanceMode === 'auto') {
  performanceMode = detectPerformanceMode();
}

const pauseBackgroundAnimations = (pause) => {
  if (pause === backgroundAnimationPaused) return;
  
  backgroundAnimationPaused = pause;
  
  // SIGNAL BUS EMIT
  SignalBus.emit('system:animationControl', { paused: pause, reason: 'overlay-performance' });
  
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
      .main-view canvas { will-change: auto !important; transform: translateZ(0) !important; }
      .main-view { transform: translateZ(0); backface-visibility: hidden; -webkit-backface-visibility: hidden; }
    `;
    
    document.querySelector('.main-view')?.classList.add('performance-pause-animations', 'performance-mode');
    document.body.classList.add('performance-pause-animations');
  } else {
    if (styleElement) styleElement.remove();
    document.querySelector('.main-view')?.classList.remove('performance-pause-animations', 'performance-mode');
    document.body.classList.remove('performance-pause-animations');
  }
};

export const createPerformanceDebouncer = (func, wait = 16) => {
  let timeout;
  let lastCallTime = 0;
  
  return function executedFunction(...args) {
    const now = Date.now();
    const actualWait = performanceMode === 'performance' ? wait * 2 : wait;
    const later = () => {
      lastCallTime = now;
      timeout = null;
      func.apply(this, args);
    };
    if (timeout) clearTimeout(timeout);
    if (now - lastCallTime >= actualWait) later();
    else timeout = setTimeout(later, actualWait - (now - lastCallTime));
  };
};

export const createPerformanceThrottler = (func, limit = 16) => {
  let inThrottle;
  return function throttledFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      const throttleTime = performanceMode === 'performance' ? limit * 2 : limit;
      setTimeout(() => { inThrottle = false; }, throttleTime);
    }
  };
};

export const safeRequestIdleCallback = (callback, options = {}) => {
  if (typeof window !== 'undefined' && window.requestIdleCallback) {
    return window.requestIdleCallback(callback, { timeout: 5000, ...options });
  } else {
    return setTimeout(() => {
      const start = Date.now();
      callback({
        didTimeout: false,
        timeRemaining() { return Math.max(0, 50 - (Date.now() - start)); }
      });
    }, 1);
  }
};

export const safeCancelIdleCallback = (id) => {
  if (typeof window !== 'undefined' && window.cancelIdleCallback) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};

export const scheduleWork = (callback, priority = 'normal') => {
  const priorities = { high: 0, normal: 5, low: 10 };
  const delay = priorities[priority] || 5;
  if (performanceMode === 'performance' && priority === 'low') {
    return requestIdleCallback(callback);
  }
  if (delay === 0) return requestAnimationFrame(callback);
  else return setTimeout(() => { requestAnimationFrame(callback); }, delay);
};

export const performanceMonitor = {
  startTiming: (label) => {
    if (typeof performance !== 'undefined' && performance.mark) performance.mark(`${label}-start`);
    return Date.now();
  },
  endTiming: (label, startTime) => {
    const endTime = Date.now();
    const duration = endTime - (startTime || 0);
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      performance.mark(`${label}-end`);
      try { performance.measure(label, `${label}-start`, `${label}-end`); } catch (e) { }
    }
    if (duration > 16 && import.meta.env.DEV && console.warn) {
      console.warn(`Performance warning: ${label} took ${duration}ms`);
    }
    return duration;
  }
};

export const getPerformanceMode = () => performanceMode;
export const setPerformanceMode = (mode) => { performanceMode = mode; };
export const requestIdleCallback = safeRequestIdleCallback;
export const cancelIdleCallback = safeCancelIdleCallback;

export const cleanup = () => {
  if (dimmingTimerId) { clearTimeout(dimmingTimerId); dimmingTimerId = null; }
  if (backgroundAnimationPaused) { pauseBackgroundAnimations(false); }
};