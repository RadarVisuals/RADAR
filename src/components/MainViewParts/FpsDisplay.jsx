// src/components/MainViewParts/FpsDisplay.jsx (Assuming path based on context)
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import './FpsDisplay.css'; // Assuming specific styles for the FPS counter

/**
 * @typedef {object} FpsDisplayProps
 * @property {boolean} showFpsCounter - If true, the FPS counter is rendered and active.
 * @property {boolean} isFullscreenActive - Indicates if the application is currently in fullscreen mode. This is used to determine if the FPS counter should be portalled.
 * @property {Element | null} [portalContainer] - Optional DOM element to which the FPS counter should be portalled when in fullscreen mode. If null or not provided, the counter renders inline.
 */

/**
 * FpsDisplay: A component that calculates and displays the current frames per second (FPS)
 * of the application's rendering loop. It uses `requestAnimationFrame` for accurate FPS calculation.
 * When `isFullscreenActive` is true and a `portalContainer` is provided, it uses a React Portal
 * to render the FPS counter into the specified container, allowing it to overlay fullscreen content.
 *
 * @param {FpsDisplayProps} props - The component's props.
 * @returns {JSX.Element | null} The rendered FPS counter (either inline or portalled), or null if `showFpsCounter` is false.
 */
const FpsDisplay = ({ showFpsCounter, isFullscreenActive, portalContainer }) => {
  const [currentFps, setCurrentFps] = useState(0);
  /** @type {React.RefObject<number>} */
  const fpsFrameCountRef = useRef(0);
  /** @type {React.RefObject<number>} */
  const fpsLastTimeRef = useRef(performance.now());
  /** @type {React.RefObject<number | null>} */
  const fpsRafId = useRef(null);

  useEffect(() => {
    /**
     * Calculates FPS based on frame counts over time.
     * This function is called recursively via `requestAnimationFrame`.
     */
    const updateFps = () => {
      const now = performance.now();
      const delta = now - fpsLastTimeRef.current;
      fpsFrameCountRef.current++;

      if (delta >= 1000) { // Update FPS display approximately every second
        const fps = Math.round((fpsFrameCountRef.current * 1000) / delta);
        setCurrentFps(fps);
        fpsFrameCountRef.current = 0; // Reset frame count for the next second
        fpsLastTimeRef.current = now; // Reset time for the next second
      }
      // Continue the loop
      if (typeof requestAnimationFrame === 'function') {
        fpsRafId.current = requestAnimationFrame(updateFps);
      }
    };

    if (showFpsCounter) {
      // Start FPS calculation if it's not already running
      if (!fpsRafId.current && typeof requestAnimationFrame === 'function') {
        fpsLastTimeRef.current = performance.now(); // Reset timer before starting
        fpsFrameCountRef.current = 0;
        fpsRafId.current = requestAnimationFrame(updateFps);
      }
    } else {
      // Stop FPS calculation if `showFpsCounter` becomes false
      if (fpsRafId.current && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(fpsRafId.current);
        fpsRafId.current = null;
      }
      setCurrentFps(0); // Reset displayed FPS when counter is hidden
    }

    // Cleanup function: stop the animation frame loop when the component unmounts
    // or when `showFpsCounter` changes, to prevent memory leaks.
    return () => {
      if (fpsRafId.current && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(fpsRafId.current);
        fpsRafId.current = null; // Ensure ref is cleared
      }
    };
  }, [showFpsCounter]); // Effect dependencies: only re-run if `showFpsCounter` changes

  // If the FPS counter is not meant to be shown, render nothing.
  if (!showFpsCounter) {
    return null;
  }

  const fpsCounterElement = (
    <div className="fps-counter" aria-live="off"> {/* aria-live="off" as it updates too frequently for assertive/polite */}
      FPS: {currentFps}
    </div>
  );

  // Use React Portal if a portalContainer is provided and fullscreen is active.
  // This allows the FPS counter to be rendered outside its normal DOM hierarchy,
  // useful for overlaying it on fullscreen content.
  if (portalContainer && isFullscreenActive && typeof ReactDOM.createPortal === 'function') {
    return ReactDOM.createPortal(fpsCounterElement, portalContainer);
  }

  // Otherwise, render the FPS counter inline.
  return fpsCounterElement;
};

FpsDisplay.propTypes = {
  /** If true, the FPS counter is rendered and active. */
  showFpsCounter: PropTypes.bool.isRequired,
  /** Indicates if the application is currently in fullscreen mode. */
  isFullscreenActive: PropTypes.bool.isRequired,
  /** Optional DOM element to which the FPS counter should be portalled when in fullscreen mode. */
  portalContainer: PropTypes.instanceOf(Element), // Element is the base type for DOM elements
};

FpsDisplay.defaultProps = {
  // portalContainer defaults to null if not provided, which is fine.
  // No explicit default needed here as the conditional logic handles null.
};

// Default export is standard for React components.
export default FpsDisplay;