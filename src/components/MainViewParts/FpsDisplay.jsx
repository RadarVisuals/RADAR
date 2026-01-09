// src/components/MainViewParts/FpsDisplay.jsx
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './FpsDisplay.css';

const FpsDisplay = ({ showFpsCounter }) => {
  const textRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafIdRef = useRef(null);

  useEffect(() => {
    if (!showFpsCounter) {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        return;
    }

    const updateLoop = () => {
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        
        // PERFORMANCE FIX: Update DOM directly to avoid React Re-render
        if (textRef.current) {
            textRef.current.textContent = `FPS: ${fps}`;
        }
        
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      rafIdRef.current = requestAnimationFrame(updateLoop);
    };

    rafIdRef.current = requestAnimationFrame(updateLoop);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [showFpsCounter]);

  if (!showFpsCounter) return null;

  return (
    <div className="fps-counter" style={{ willChange: 'contents' }}>
      <span ref={textRef}>FPS: --</span>
    </div>
  );
};

FpsDisplay.propTypes = {
  showFpsCounter: PropTypes.bool.isRequired,
};

export default FpsDisplay;