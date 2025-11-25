// src/components/MainViewParts/PixiCanvasWrapper.jsx
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

const PixiCanvasWrapper = ({
  containerRef,
  canvasRef,
  containerClass,
  pingColor,
  pingStrokeWidth,
  noPingSelectors,
}) => {

  const handleCanvasClick = useCallback((event) => {
    if (noPingSelectors && typeof noPingSelectors === 'string' && event.target.closest(noPingSelectors)) {
      return;
    }

    const containerElement = containerRef.current;
    if (!containerElement) return;

    const x = event.clientX;
    const y = event.clientY;

    const pingContainer = document.createElement('div');
    pingContainer.className = 'click-ping-svg-container';
    pingContainer.style.left = `${x}px`;
    pingContainer.style.top = `${y}px`;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "click-ping-svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.style.overflow = "visible";

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "10");
    circle.setAttribute("cy", "10");
    circle.setAttribute("r", "5");
    circle.setAttribute("stroke", pingColor);
    circle.setAttribute("stroke-width", String(pingStrokeWidth));
    circle.setAttribute("fill", "none");

    svg.appendChild(circle);
    pingContainer.appendChild(svg);

    try {
      containerElement.appendChild(pingContainer);
      requestAnimationFrame(() => {
        pingContainer.classList.add('ping-svg-animation');
      });

      pingContainer.addEventListener('animationend', () => {
        if (pingContainer.parentElement) {
            pingContainer.remove();
        }
      }, { once: true });

    } catch (e) {
      console.error("Error creating click ping:", e);
    }
  }, [containerRef, noPingSelectors, pingColor, pingStrokeWidth]);

  return (
    <div ref={containerRef} className={containerClass} onClick={handleCanvasClick}>
      <div className="grid-overlay"></div>
      <canvas 
        ref={canvasRef} 
        className="pixi-canvas"
        style={{
            display: 'block',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1
        }}
      />
    </div>
  );
};

PixiCanvasWrapper.propTypes = {
  containerRef: PropTypes.object.isRequired,
  canvasRef: PropTypes.object.isRequired,
  containerClass: PropTypes.string.isRequired,
  pingColor: PropTypes.string.isRequired,
  pingStrokeWidth: PropTypes.number.isRequired,
  noPingSelectors: PropTypes.string.isRequired,
};

export default PixiCanvasWrapper;