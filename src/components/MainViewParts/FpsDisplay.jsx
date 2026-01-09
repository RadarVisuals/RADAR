// src/components/MainViewParts/FpsDisplay.jsx
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

import './FpsDisplay.css';

const FpsDisplay = ({ showFpsCounter }) => {
  const textRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafId = useRef(null);

  useEffect(() => {
    const updateFps = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      frameCountRef.current++;

      if (delta >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / delta);
        
        // PERFORMANCE FIX: Update DOM directly to avoid React re-render overhead
        if (textRef.current) {
            textRef.current.textContent = `FPS: ${fps}`;
        }
        
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      rafId.current = requestAnimationFrame(updateFps);
    };

    if (showFpsCounter) {
        lastTimeRef.current = performance.now();
        frameCountRef.current = 0;
        rafId.current = requestAnimationFrame(updateFps);
    }

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [showFpsCounter]);

  if (!showFpsCounter) {
    return null;
  }

  return (
    <div className="fps-counter" aria-live="off">
      <span ref={textRef}>FPS: --</span>
    </div>
  );
};

FpsDisplay.propTypes = {
  showFpsCounter: PropTypes.bool.isRequired,
};

export default FpsDisplay;