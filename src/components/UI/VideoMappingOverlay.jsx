// src/components/UI/VideoMappingOverlay.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * VideoMappingOverlay: Optimized hardware-accelerated mask.
 */
const VideoMappingOverlay = ({ config, isVisible }) => {
  if (!isVisible) return null;

  const { radius, feather, x, y } = config;

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 400, 
    pointerEvents: 'none',
    backgroundColor: 'transparent',
    /* 
       M4 OPTIMIZATION: 
       Fast linear transitions on background gradients are handled by the 
       OS compositor on Mac, bypassing the heavy main thread.
    */
    background: `radial-gradient(
      circle at ${x}% ${y}%, 
      transparent 0%, 
      transparent ${radius}%, 
      rgba(0, 0, 0, 1) ${radius + feather}%
    )`,
    transition: 'background 0.1s linear'
  };

  return (
    <div 
      className="video-mapping-mask-overlay" 
      style={overlayStyle} 
      aria-hidden="true"
    />
  );
};

VideoMappingOverlay.propTypes = {
  config: PropTypes.shape({
    radius: PropTypes.number.isRequired,
    feather: PropTypes.number.isRequired,
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }).isRequired,
  isVisible: PropTypes.bool.isRequired,
};

export default React.memo(VideoMappingOverlay);