import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import './FpsDisplay.css'; // Assuming you might want specific styles

const FpsDisplay = ({ showFpsCounter, isFullscreenActive, portalContainer }) => {
  const [currentFps, setCurrentFps] = useState(0);
  const fpsFrameCountRef = useRef(0);
  const fpsLastTimeRef = useRef(performance.now());
  const fpsRafId = useRef(null);

  useEffect(() => {
    const updateFps = () => {
      const now = performance.now();
      const delta = now - fpsLastTimeRef.current;
      fpsFrameCountRef.current++;
      if (delta >= 1000) {
        const fps = Math.round((fpsFrameCountRef.current * 1000) / delta);
        setCurrentFps(fps);
        fpsFrameCountRef.current = 0;
        fpsLastTimeRef.current = now;
      }
      fpsRafId.current = requestAnimationFrame(updateFps);
    };

    if (showFpsCounter) {
      if (!fpsRafId.current) {
        fpsLastTimeRef.current = performance.now();
        fpsFrameCountRef.current = 0;
        fpsRafId.current = requestAnimationFrame(updateFps);
      }
    } else {
      if (fpsRafId.current) {
        cancelAnimationFrame(fpsRafId.current);
        fpsRafId.current = null;
        setCurrentFps(0);
      }
    }

    return () => {
      if (fpsRafId.current) {
        cancelAnimationFrame(fpsRafId.current);
      }
    };
  }, [showFpsCounter]);

  if (!showFpsCounter) return null;

  const fpsCounterElement = <div className="fps-counter">FPS: {currentFps}</div>;

  if (portalContainer && isFullscreenActive) {
    return ReactDOM.createPortal(fpsCounterElement, portalContainer);
  }
  
  return fpsCounterElement;
};

FpsDisplay.propTypes = {
  showFpsCounter: PropTypes.bool.isRequired,
  isFullscreenActive: PropTypes.bool.isRequired,
  portalContainer: PropTypes.instanceOf(Element), // Can be null if not found
};

FpsDisplay.defaultProps = {
  portalContainer: null,
};

export default FpsDisplay;