// src/hooks/useCanvasContainer.js
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * @typedef {object} CanvasContainerOptions Options for the useCanvasContainer hook.
 * @property {() => void} onResize - Callback function triggered on valid resize events.
 * @property {(isVisible: boolean) => void} onVisibilityChange - Callback function triggered when viewport visibility changes.
 * @property {() => void} onZeroDimensions - Callback function triggered when dimensions become zero after being valid, following a debounce check.
 */

/**
 * Manages the primary canvas container element. It tracks and reports its dimensions
 * (validating against zero dimensions with a debounce), observed visibility within the
 * viewport using IntersectionObserver, and browser fullscreen state. It provides a ref
 * to attach to the container element and callbacks for resize, visibility changes,
 * zero-dimension detection, and entering fullscreen mode.
 *
 * @param {CanvasContainerOptions} options - Configuration options including callbacks for resize, visibility, and zero dimensions.
 * @returns {{
 *   containerRef: React.RefObject<HTMLDivElement>,
 *   hasValidDimensions: boolean,
 *   isContainerObservedVisible: boolean,
 *   isFullscreenActive: boolean,
 *   enterFullscreen: () => void
 * }} An object containing the container ref, state variables reflecting dimensions/visibility/fullscreen, and a function to request fullscreen.
 */
export function useCanvasContainer(options) {
  const { onResize, onVisibilityChange, onZeroDimensions } = options;

  const containerRef = useRef(null);
  const isMountedRef = useRef(false);
  const intersectionObserverRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const zeroDimCheckTimeoutRef = useRef(null);
  const lastValidDimensionsRef = useRef({ width: 0, height: 0 });

  const [hasValidDimensions, setHasValidDimensions] = useState(false);
  const [isContainerObservedVisible, setIsContainerObservedVisible] = useState(true);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    const containerElement = containerRef.current;

    if (!containerElement) {
      // Keep this warning - indicates a setup issue
      console.warn("[useCanvasContainer] Container element ref not available on mount.");
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
        const currentWidth = Math.floor(width); const currentHeight = Math.floor(height);

        if (zeroDimCheckTimeoutRef.current) {
            clearTimeout(zeroDimCheckTimeoutRef.current);
            zeroDimCheckTimeoutRef.current = null;
        }

        if (currentWidth > 0 && currentHeight > 0) {
            if (!hasValidDimensions) { setHasValidDimensions(true); }
            lastValidDimensionsRef.current = { width: currentWidth, height: currentHeight };
            if (onResize) { onResize(); }
        } else {
            if (hasValidDimensions) {
                zeroDimCheckTimeoutRef.current = setTimeout(() => {
                    const checkElement = containerRef.current;
                    const checkWidth = checkElement ? checkElement.clientWidth : 0;
                    const checkHeight = checkElement ? checkElement.clientHeight : 0;
                    if (checkWidth <= 0 || checkHeight <= 0) {
                        // Keep this error log - critical layout failure
                        console.error(`[useCanvasContainer] Dimensions still zero (${checkWidth}x${checkHeight}) after delay. Triggering onZeroDimensions.`);
                        setHasValidDimensions(false);
                        if (onZeroDimensions) {
                            onZeroDimensions();
                        }
                    } else {
                        if (!hasValidDimensions) {
                            setHasValidDimensions(true);
                            if (onResize) { onResize(); }
                        }
                    }
                    zeroDimCheckTimeoutRef.current = null;
                }, 500);
                setHasValidDimensions(false);
            } else {
                if (hasValidDimensions) {
                    setHasValidDimensions(false);
                }
            }
        }
    };

    resizeObserverRef.current = new ResizeObserver(resizeCallback);
    resizeObserverRef.current.observe(containerElement);

    const initialWidth = containerElement.clientWidth; const initialHeight = containerElement.clientHeight;
    if (initialWidth > 0 && initialHeight > 0) { setHasValidDimensions(true); lastValidDimensionsRef.current = { width: initialWidth, height: initialHeight }; }
    else { setHasValidDimensions(false); lastValidDimensionsRef.current = { width: 0, height: 0 }; }

    return () => {
      isMountedRef.current = false;
      if (intersectionObserverRef.current) { intersectionObserverRef.current.disconnect(); intersectionObserverRef.current = null; }
      if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); resizeObserverRef.current = null; }
      if (zeroDimCheckTimeoutRef.current) { clearTimeout(zeroDimCheckTimeoutRef.current); zeroDimCheckTimeoutRef.current = null; }
    };
  }, [onResize, onVisibilityChange, onZeroDimensions, hasValidDimensions]);

  useEffect(() => {
    const handleFullscreenChange = () => {
        const isCurrentlyFullscreen = !!document.fullscreenElement || !!document.webkitFullscreenElement || !!document.mozFullScreenElement || !!document.msFullscreenElement;
        setIsFullscreenActive(isCurrentlyFullscreen);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange); document.addEventListener('webkitfullscreenchange', handleFullscreenChange); document.addEventListener('mozfullscreenchange', handleFullscreenChange); document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    handleFullscreenChange(); // Call once to set initial state
    return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange); document.removeEventListener('webkitfullscreenchange', handleFullscreenChange); document.removeEventListener('mozfullscreenchange', handleFullscreenChange); document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Helper for error logging during fullscreen operations
  const handleFullscreenError = (err) => {
      console.error(`[useCanvasContainer] Error with fullscreen operation: ${err.message} (${err.name})`);
  };

  const toggleFullscreen = useCallback(() => {
    const elem = document.getElementById('fullscreen-root') || containerRef.current;
    if (!elem) {
      console.warn("[useCanvasContainer] Cannot toggle fullscreen, container ref or #fullscreen-root not available.");
      return;
    }

    const isInFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement || // Corrected: mozFullScreenElement
      document.msFullscreenElement
    );

    if (!isInFullscreen) {
      // Enter fullscreen
      if (elem.requestFullscreen) { elem.requestFullscreen().catch(handleFullscreenError); }
      else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen().catch(handleFullscreenError); }
      else if (elem.mozRequestFullScreen) { elem.mozRequestFullScreen().catch(handleFullscreenError); } // Corrected: mozRequestFullScreen
      else if (elem.msRequestFullscreen) { elem.msRequestFullscreen().catch(handleFullscreenError); }
      else { console.warn("[useCanvasContainer] Fullscreen API not supported for entering."); }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) { document.exitFullscreen().catch(handleFullscreenError); }
      else if (document.webkitExitFullscreen) { document.webkitExitFullscreen().catch(handleFullscreenError); }
      else if (document.mozCancelFullScreen) { document.mozCancelFullScreen().catch(handleFullscreenError); } // Corrected: mozCancelFullScreen
      else if (document.msExitFullscreen) { document.msExitFullscreen().catch(handleFullscreenError); }
      else { console.warn("[useCanvasContainer] Fullscreen API not supported for exiting."); }
    }
  }, [containerRef]); // containerRef is the dependency

  return { containerRef, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen: toggleFullscreen };
}