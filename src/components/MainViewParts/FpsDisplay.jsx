// src/components/MainViewParts/FpsDisplay.jsx
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

import './FpsDisplay.css';

/**
 * @typedef {object} FpsDisplayProps
 * @property {boolean} showFpsCounter - If true, the FPS counter is rendered and active.
 */

const FpsDisplay = ({ showFpsCounter }) => {
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

  // Always render inline. This ensures the counter is part of the element
  // that goes fullscreen (#fullscreen-root), so it remains visible.
  return (
    <div className="fps-counter" aria-live="off">
      FPS: {currentFps}
    </div>
  );
};

FpsDisplay.propTypes = {
  showFpsCounter: PropTypes.bool.isRequired,
};

export default FpsDisplay;