// src/hooks/useCanvasContainer.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * @typedef {object} CanvasContainerOptions Options for the useCanvasContainer hook.
 * @property {() => void} [onResize] - Optional: Callback function triggered on valid resize events (debounced for zero dimensions). Also triggered on significant visual viewport scale changes.
 * @property {(isVisible: boolean) => void} [onVisibilityChange] - Optional: Callback function triggered when the container's viewport visibility changes based on IntersectionObserver.
 * @property {() => void} [onZeroDimensions] - Optional: Callback function triggered when container dimensions become zero after being valid, following a debounce check.
 */

/**
 * @typedef {object} CanvasContainerHookReturn The state and actions provided by the useCanvasContainer hook.
 * @property {React.RefObject<HTMLDivElement>} containerRef - Ref to be attached to the container element that this hook will observe. Its `.current` property will be `HTMLDivElement | null`.
 * @property {boolean} hasValidDimensions - Indicates if the container currently has valid (non-zero) width and height based on ResizeObserver.
 * @property {boolean} isContainerObservedVisible - Indicates if the container is currently considered visible within the viewport by the IntersectionObserver.
 * @property {boolean} isFullscreenActive - Indicates if the browser is currently in fullscreen mode, typically initiated via this hook.
 * @property {() => void} enterFullscreen - Function to attempt to toggle fullscreen mode. It targets an element with ID 'fullscreen-root' first, falling back to the `containerRef` element.
 */

/**
 * Custom hook to manage observation of a container element for resize, viewport visibility,
 * and fullscreen state. It provides callbacks for these events and stateful flags.
 *
 * @param {CanvasContainerOptions} [options={}] - Configuration options for the hook.
 * @returns {CanvasContainerHookReturn} An object containing the container ref, state flags, and control functions.
 */
export function useCanvasContainer(options = {}) {
  const { onResize, onVisibilityChange, onZeroDimensions } = options;

  /** @type {React.RefObject<HTMLDivElement | null>} */
  const containerRef = useRef(null);
  /** @type {React.RefObject<boolean>} */
  const isMountedRef = useRef(false);
  /** @type {React.RefObject<IntersectionObserver | null>} */
  const intersectionObserverRef = useRef(null);
  /** @type {React.RefObject<ResizeObserver | null>} */
  const resizeObserverRef = useRef(null);
  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const zeroDimCheckTimeoutRef = useRef(null);
  /** @type {React.RefObject<{width: number, height: number}>} */
  const lastValidDimensionsRef = useRef({ width: 0, height: 0 });
  /** @type {React.RefObject<number>} */
  const lastVisualViewportScaleRef = useRef(
    typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.scale : 1
  );

  const [hasValidDimensions, setHasValidDimensions] = useState(false);
  const [isContainerObservedVisible, setIsContainerObservedVisible] = useState(true);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);

  const stableOnResize = useCallback(() => {
    if (onResize) {
      onResize();
    }
  }, [onResize]);

  const handleFullscreenError = useCallback((err) => {
      if (import.meta.env.DEV) {
        console.error(`[useCanvasContainer] Error with fullscreen operation: ${err.message} (${err.name})`);
      }
      // Update fullscreen state based on the actual document state after an error.
      setIsFullscreenActive(!!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement));
  }, [setIsFullscreenActive]); // setIsFullscreenActive is stable

  const enterFullscreen = useCallback(() => {
    const elem = document.getElementById('fullscreen-root') || containerRef.current;
    if (!elem) {
      if (import.meta.env.DEV) {
        console.warn("[useCanvasContainer] Fullscreen target element not found for enterFullscreen.");
      }
      return;
    }

    const isInFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

    if (!isInFullscreen) {
      const requestPromise = elem.requestFullscreen?.() || elem.webkitRequestFullscreen?.() || elem.mozRequestFullScreen?.() || elem.msRequestFullscreen?.();
      if (requestPromise && typeof requestPromise.catch === 'function') {
        requestPromise.catch(handleFullscreenError);
      } else if (!requestPromise) {
        if (import.meta.env.DEV) {
          console.warn("[useCanvasContainer] Fullscreen request API not supported or call failed synchronously.");
        }
        handleFullscreenError(new Error("Fullscreen request failed or not supported."));
      }
    } else {
      const exitPromise = document.exitFullscreen?.() || document.webkitExitFullscreen?.() || document.mozCancelFullScreen?.() || document.msExitFullscreen?.();
      if (exitPromise && typeof exitPromise.catch === 'function') {
        exitPromise.catch(handleFullscreenError);
      } else if (!exitPromise) {
        if (import.meta.env.DEV) {
          console.warn("[useCanvasContainer] Fullscreen exit API not supported or call failed synchronously.");
        }
        handleFullscreenError(new Error("Fullscreen exit failed or not supported."));
      }
    }
  }, [containerRef, handleFullscreenError]);

  useEffect(() => {
    isMountedRef.current = true;
    const containerElement = containerRef.current;

    if (!containerElement) {
      return;
    }

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
      root: null, rootMargin: "0px", threshold: 0.01,
    });
    intersectionObserverRef.current.observe(containerElement);

    const resizeCallback = (entries) => {
        if (!isMountedRef.current) return;
        const entry = entries[0]; if (!entry) return;
        const { width, height } = entry.contentRect;
        const currentWidth = Math.floor(width);
        const currentHeight = Math.floor(height);

        if (zeroDimCheckTimeoutRef.current) {
            clearTimeout(zeroDimCheckTimeoutRef.current);
            zeroDimCheckTimeoutRef.current = null;
        }

        if (currentWidth > 0 && currentHeight > 0) {
            if (!hasValidDimensions) {
                setHasValidDimensions(true);
            }
            lastValidDimensionsRef.current = { width: currentWidth, height: currentHeight };
            stableOnResize();
        } else {
            if (hasValidDimensions) {
                setHasValidDimensions(false);
                zeroDimCheckTimeoutRef.current = setTimeout(() => {
                    if (!isMountedRef.current) return;
                    const checkElement = containerRef.current;
                    const checkWidth = checkElement ? checkElement.clientWidth : 0;
                    const checkHeight = checkElement ? checkElement.clientHeight : 0;
                    if (checkWidth <= 0 || checkHeight <= 0) {
                        if (onZeroDimensions) { onZeroDimensions(); }
                    } else {
                        setHasValidDimensions(true);
                        lastValidDimensionsRef.current = { width: checkWidth, height: checkHeight };
                        stableOnResize();
                    }
                    zeroDimCheckTimeoutRef.current = null;
                }, 500);
            }
        }
    };
    resizeObserverRef.current = new ResizeObserver(resizeCallback);
    resizeObserverRef.current.observe(containerElement);

    let vv = null;
    const handleVisualViewportResize = () => {
        if (!isMountedRef.current || !vv) return;
        const currentScale = vv.scale;
        if (Math.abs(currentScale - lastVisualViewportScaleRef.current) > 0.01) {
            lastVisualViewportScaleRef.current = currentScale;
            stableOnResize();
        }
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
        vv = window.visualViewport;
        lastVisualViewportScaleRef.current = vv.scale;
        vv.addEventListener('resize', handleVisualViewportResize);
        vv.addEventListener('scroll', handleVisualViewportResize);
    }

    const initialWidth = containerElement.clientWidth;
    const initialHeight = containerElement.clientHeight;
    if (initialWidth > 0 && initialHeight > 0) {
        if (!hasValidDimensions) setHasValidDimensions(true);
        lastValidDimensionsRef.current = { width: initialWidth, height: initialHeight };
    } else {
        if (hasValidDimensions) setHasValidDimensions(false);
        lastValidDimensionsRef.current = { width: 0, height: 0 };
    }

    return () => {
      isMountedRef.current = false;
      if (intersectionObserverRef.current) { intersectionObserverRef.current.disconnect(); }
      if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); }
      if (zeroDimCheckTimeoutRef.current) { clearTimeout(zeroDimCheckTimeoutRef.current); }
      if (vv) {
        vv.removeEventListener('resize', handleVisualViewportResize);
        vv.removeEventListener('scroll', handleVisualViewportResize);
      }
    };
  }, [stableOnResize, onVisibilityChange, onZeroDimensions, hasValidDimensions]);

  useEffect(() => {
    const handleFullscreenChange = () => {
        const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        setIsFullscreenActive(isCurrentlyFullscreen);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    handleFullscreenChange(); // Initial check
    return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
        document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [setIsFullscreenActive]); // setIsFullscreenActive is stable

  return useMemo(() => ({
    containerRef,
    hasValidDimensions,
    isContainerObservedVisible,
    isFullscreenActive,
    enterFullscreen,
  }), [containerRef, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen]);
}