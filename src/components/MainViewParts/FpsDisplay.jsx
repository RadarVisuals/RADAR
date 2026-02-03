// src/components/MainViewParts/FpsDisplay.jsx
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import SignalBus from '../../utils/SignalBus'; // ADDED IMPORT

import './FpsDisplay.css';

const FpsDisplay = ({ showFpsCounter }) => {
  const textRef = useRef(null);
  const [currentFps, setCurrentFps] = useState('--');

  useEffect(() => {
    if (!showFpsCounter) return;

    // We only update the display text when a new FPS value is broadcast
    const handleFpsUpdate = (fps) => {
        // PERFORMANCE FIX: Update DOM directly to avoid React re-render overhead
        if (textRef.current) {
            textRef.current.textContent = `FPS: ${fps}`;
            // Optional: for components that need the numerical value
            setCurrentFps(fps); 
        }
    };

    // Subscribe to the engine's actual FPS output
    const unsubscribe = SignalBus.on('engine:actual_fps', handleFpsUpdate);

    return () => {
      // Cleanup the SignalBus listener on unmount
      unsubscribe();
    };
  }, [showFpsCounter]);

  if (!showFpsCounter) {
    return null;
  }

  return (
    <div className="fps-counter" aria-live="off">
      <span ref={textRef}>FPS: {currentFps}</span> 
    </div>
  );
};

FpsDisplay.propTypes = {
  showFpsCounter: PropTypes.bool.isRequired,
};

export default FpsDisplay;