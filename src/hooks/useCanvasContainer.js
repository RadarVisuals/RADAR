import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * @typedef {object} CanvasContainerOptions Options for the useCanvasContainer hook.
 * @property {() => void} [onResize] - Callback function triggered on valid resize events (debounced for zero dimensions). Also triggered on significant visual viewport scale changes.
 * @property {(isVisible: boolean) => void} [onVisibilityChange] - Callback function triggered when the container's viewport visibility changes based on IntersectionObserver.
 * @property {() => void} [onZeroDimensions] - Callback function triggered when container dimensions become zero after being valid, following a debounce check.
 */

/**
 * @typedef {object} CanvasContainerHookReturn The state and actions provided by the useCanvasContainer hook.
 * @property {React.RefObject<HTMLDivElement | null>} containerRef - Ref to be attached to the container element that this hook will observe.
 * @property {boolean} hasValidDimensions - Indicates if the container currently has valid (non-zero) width and height based on ResizeObserver.
 * @property {boolean} isContainerObservedVisible - Indicates if the container is currently considered visible within the viewport by the IntersectionObserver.
 * @property {boolean} isFullscreenActive - Indicates if the browser is currently in fullscreen mode, typically initiated via this hook.
 * @property {() => void} enterFullscreen - Function to attempt to toggle fullscreen mode. It targets an element with ID 'fullscreen-root' first, falling back to the `containerRef` element.
 */

/**
 * Custom hook to manage a container element's dimensions, visibility, and fullscreen state.
 * It utilizes ResizeObserver for tracking dimension changes, IntersectionObserver for viewport visibility,
 * and listens to VisualViewport API events for zoom changes and Fullscreen API events for fullscreen state.
 * This hook is designed to provide robust state management for elements like a canvas that need to react
 * to these environmental changes.
 *
 * @param {CanvasContainerOptions} options - Configuration options for the hook, including callbacks for resize, visibility change, and zero dimension events.
 * @returns {CanvasContainerHookReturn} An object containing refs, state booleans, and control functions.
 */
export function useCanvasContainer(options) {
  const { onResize, onVisibilityChange, onZeroDimensions } = options;

  /** @type {React.RefObject<HTMLDivElement | null>} */
  const containerRef = useRef(null);
  /** @type {React.MutableRefObject<boolean>} Tracks if the component is mounted to prevent state updates after unmount. */
  const isMountedRef = useRef(false);
  /** @type {React.MutableRefObject<IntersectionObserver | null>} Holds the IntersectionObserver instance. */
  const intersectionObserverRef = useRef(null);
  /** @type {React.MutableRefObject<ResizeObserver | null>} Holds the ResizeObserver instance. */
  const resizeObserverRef = useRef(null);
  /** @type {React.MutableRefObject<NodeJS.Timeout | null>} Holds the timeout ID for debouncing zero dimension checks. */
  const zeroDimCheckTimeoutRef = useRef(null);
  /** @type {React.MutableRefObject<{width: number, height: number}>} Stores the last known valid dimensions. */
  const lastValidDimensionsRef = useRef({ width: 0, height: 0 });
  /** @type {React.MutableRefObject<number>} Stores the last known visual viewport scale to detect changes. */
  const lastVisualViewportScaleRef = useRef(window.visualViewport ? window.visualViewport.scale : 1);

  const [hasValidDimensions, setHasValidDimensions] = useState(false);
  const [isContainerObservedVisible, setIsContainerObservedVisible] = useState(true);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);

  // Stable callback reference for onResize
  const stableOnResize = useCallback(() => {
    if (onResize) {
      onResize();
    }
  }, [onResize]);

  useEffect(() => {
    isMountedRef.current = true;
    const containerElement = containerRef.current;

    if (!containerElement) {
      if (import.meta.env.DEV) {
        console.warn("[useCanvasContainer] Container element ref not available on mount.");
      }
      return;
    }

    // --- Intersection Observer Setup ---
    const intersectionCallback = (entries) => {
      if (!isMountedRef.current) return;
      entries.forEach((entry) => {
        const currentlyVisible = entry.isIntersecting;
        setIsContainerObservedVisible(prevVisible => {
            if (prevVisible !== currentlyVisible) {
                if (onVisibilityChange) { onVisibilityChange(currentlyVisible); }
                return currentlyVisible;
            }
            return prevVisible;
        });
      });
    };
    intersectionObserverRef.current = new IntersectionObserver(intersectionCallback, {
      root: null, rootMargin: "0px", threshold: 0.01, // Trigger even if slightly visible
    });
    intersectionObserverRef.current.observe(containerElement);

    // --- Resize Observer Setup ---
    const resizeCallback = (entries) => {
        if (!isMountedRef.current) return;
        const entry = entries[0]; if (!entry) return;
        const { width, height } = entry.contentRect;
        const currentWidth = Math.floor(width); const currentHeight = Math.floor(height);

        // Clear any pending zero-dimension check
        if (zeroDimCheckTimeoutRef.current) {
            clearTimeout(zeroDimCheckTimeoutRef.current);
            zeroDimCheckTimeoutRef.current = null;
        }

        if (currentWidth > 0 && currentHeight > 0) {
            // Dimensions are valid
            if (!hasValidDimensions) { setHasValidDimensions(true); }
            lastValidDimensionsRef.current = { width: currentWidth, height: currentHeight };
            stableOnResize(); // Trigger resize callback
        } else {
            // Dimensions became zero
            if (hasValidDimensions) { // Only trigger if they *were* valid
                setHasValidDimensions(false);
                // Debounce the zero dimension check to avoid flickering during layout shifts
                zeroDimCheckTimeoutRef.current = setTimeout(() => {
                    if (!isMountedRef.current) return; // Check mount status again inside timeout
                    const checkElement = containerRef.current;
                    const checkWidth = checkElement ? checkElement.clientWidth : 0;
                    const checkHeight = checkElement ? checkElement.clientHeight : 0;
                    if (checkWidth <= 0 || checkHeight <= 0) {
                        // Still zero after delay, trigger the callback
                        if (import.meta.env.DEV) {
                            console.error(`[useCanvasContainer] Dimensions still zero (${checkWidth}x${checkHeight}) after delay. Triggering onZeroDimensions.`);
                        }
                        if (onZeroDimensions) { onZeroDimensions(); }
                    } else {
                        // Dimensions became valid again during the debounce period
                        setHasValidDimensions(true);
                        stableOnResize();
                    }
                    zeroDimCheckTimeoutRef.current = null;
                }, 500); // 500ms debounce period
            }
        }
    };
    resizeObserverRef.current = new ResizeObserver(resizeCallback);
    resizeObserverRef.current.observe(containerElement);

    // --- Visual Viewport Setup ---
    let vv = null;
    const handleVisualViewportResize = () => {
        if (!isMountedRef.current || !vv) return;
        const currentScale = vv.scale;
        // Threshold to avoid minor fluctuations triggering resize
        if (Math.abs(currentScale - lastVisualViewportScaleRef.current) > 0.01) {
            if (import.meta.env.DEV) {
                console.log(`[useCanvasContainer] VisualViewport scale changed: ${lastVisualViewportScaleRef.current.toFixed(2)} -> ${currentScale.toFixed(2)}. Triggering resize.`);
            }
            lastVisualViewportScaleRef.current = currentScale;
            // Triggering stableOnResize here allows consumers (like CanvasManager)
            // to re-evaluate dimensions/scaling based on the new viewport scale.
            stableOnResize();
        }
    };

    if (window.visualViewport) {
        vv = window.visualViewport;
        lastVisualViewportScaleRef.current = vv.scale;
        vv.addEventListener('resize', handleVisualViewportResize);
        // Some browsers might also trigger 'scroll' on zoom, listen to be safe
        vv.addEventListener('scroll', handleVisualViewportResize);
    }

    // --- Initial Dimension Check ---
    const initialWidth = containerElement.clientWidth; const initialHeight = containerElement.clientHeight;
    if (initialWidth > 0 && initialHeight > 0) { setHasValidDimensions(true); lastValidDimensionsRef.current = { width: initialWidth, height: initialHeight }; }
    else { setHasValidDimensions(false); lastValidDimensionsRef.current = { width: 0, height: 0 }; }

    // --- Cleanup Function ---
    return () => {
      isMountedRef.current = false;
      if (intersectionObserverRef.current) { intersectionObserverRef.current.disconnect(); intersectionObserverRef.current = null; }
      if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); resizeObserverRef.current = null; }
      if (zeroDimCheckTimeoutRef.current) { clearTimeout(zeroDimCheckTimeoutRef.current); zeroDimCheckTimeoutRef.current = null; }
      if (vv) {
        vv.removeEventListener('resize', handleVisualViewportResize);
        vv.removeEventListener('scroll', handleVisualViewportResize);
      }
    };
  }, [stableOnResize, onVisibilityChange, onZeroDimensions, hasValidDimensions]); // Added hasValidDimensions to re-evaluate if it changes externally

  // --- Fullscreen API Listener ---
  useEffect(() => {
    const handleFullscreenChange = () => {
        const isCurrentlyFullscreen = !!document.fullscreenElement || !!document.webkitFullscreenElement || !!document.mozFullScreenElement || !!document.msFullscreenElement;
        setIsFullscreenActive(isCurrentlyFullscreen);
    };
    // Listen to vendor-prefixed events
    document.addEventListener('fullscreenchange', handleFullscreenChange); document.addEventListener('webkitfullscreenchange', handleFullscreenChange); document.addEventListener('mozfullscreenchange', handleFullscreenChange); document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    handleFullscreenChange(); // Initial check on mount
    return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange); document.removeEventListener('webkitfullscreenchange', handleFullscreenChange); document.removeEventListener('mozfullscreenchange', handleFullscreenChange); document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // --- Fullscreen Error Handler ---
  const handleFullscreenError = (err) => {
      if (import.meta.env.DEV) {
        console.error(`[useCanvasContainer] Error with fullscreen operation: ${err.message} (${err.name})`);
      }
      // Optionally update state or show a toast notification
      setIsFullscreenActive(false); // Assume fullscreen failed if error occurs
  };

  // --- Fullscreen Toggle Function ---
  const toggleFullscreen = useCallback(() => {
    // Prefer a dedicated root element for fullscreen if available
    const elem = document.getElementById('fullscreen-root') || containerRef.current;
    if (!elem) {
      if (import.meta.env.DEV) {
        console.warn("[useCanvasContainer] Cannot toggle fullscreen, container ref or #fullscreen-root not available.");
      }
      return;
    }
    const isInFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

    if (!isInFullscreen) {
      // Enter fullscreen - try standard and vendor-prefixed methods
      const requestPromise =
        elem.requestFullscreen?.() ||
        elem.webkitRequestFullscreen?.() ||
        elem.mozRequestFullScreen?.() ||
        elem.msRequestFullscreen?.();

      if (requestPromise && typeof requestPromise.catch === 'function') {
        requestPromise.catch(handleFullscreenError);
      } else if (!requestPromise) {
         if (import.meta.env.DEV) {
            console.warn("[useCanvasContainer] Fullscreen API not supported by this browser for entering.");
         }
      }
    } else {
      // Exit fullscreen - try standard and vendor-prefixed methods
      const exitPromise =
        document.exitFullscreen?.() ||
        document.webkitExitFullscreen?.() ||
        document.mozCancelFullScreen?.() ||
        document.msExitFullscreen?.();

      if (exitPromise && typeof exitPromise.catch === 'function') {
         exitPromise.catch(handleFullscreenError);
      } else if (!exitPromise) {
         if (import.meta.env.DEV) {
            console.warn("[useCanvasContainer] Fullscreen API not supported by this browser for exiting.");
         }
      }
    }
  }, [containerRef]); // containerRef itself is stable

  return { containerRef, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen: toggleFullscreen };
}