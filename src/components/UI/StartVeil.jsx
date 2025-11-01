// src/components/UI/StartVeil.jsx
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import R_WEBP_ASSET from "../../assets/R.webp";
import './Startveil.css';

const StartVeil = ({ onStart }) => {
  const logoRef = useRef(null);
  const mousePosition = useRef({ x: 0, y: 0 });
  const animationFrameId = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      mousePosition.current = {
        x: (e.clientX / innerWidth - 0.5) * 2, // -1 to 1
        y: (e.clientY / innerHeight - 0.5) * 2, // -1 to 1
      };
    };

    const animate = () => {
      if (logoRef.current) {
        const { x, y } = mousePosition.current;
        const tiltIntensity = 8;
        const shiftIntensity = 6;
        
        logoRef.current.style.transform = `
          rotateY(${x * tiltIntensity}deg) 
          rotateX(${-y * tiltIntensity}deg) 
          translate(${x * shiftIntensity}px, ${y * shiftIntensity}px)
        `;
      }
      animationFrameId.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  return (
    <div className="start-veil">
      <div className="start-content">
        <div className="start-logo-container">
          <div className="start-logo-animated" ref={logoRef}>
            <img src={R_WEBP_ASSET} alt="RADAR Logo Background" className="logo-bottom" />
            <img src={R_WEBP_ASSET} alt="RADAR Logo Foreground" className="logo-top" />
          </div>
        </div>
        <div className="enter-prompt" onClick={onStart}>
          Click to Enter
        </div>
      </div>
    </div>
  );
};

StartVeil.propTypes = {
  onStart: PropTypes.func.isRequired,
};

export default StartVeil;