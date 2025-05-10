import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
// Assuming Mainview.css contains .canvas-container, .grid-overlay, .canvas, .click-ping-svg-container etc.
// If not, you might need to import or define them here.
// import './CanvasContainerWrapper.css';

const CanvasContainerWrapper = ({
  containerRef,
  canvasRef1,
  canvasRef2,
  canvasRef3,
  containerClass,
  canvas1Class,
  canvas2Class,
  canvas3Class,
  pingColor,
  pingStrokeWidth,
  noPingSelectors,
}) => {

  const handleCanvasClick = useCallback((event) => {
    if (event.target.closest(noPingSelectors)) return;
    
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
    svg.style.overflow = "visible"; // Important for the animation not to be clipped

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "10");
    circle.setAttribute("cy", "10");
    circle.setAttribute("r", "5");
    circle.setAttribute("stroke", pingColor);
    circle.setAttribute("stroke-width", pingStrokeWidth.toString());
    circle.setAttribute("fill", "none");

    svg.appendChild(circle);
    pingContainer.appendChild(svg);

    try {
      containerElement.appendChild(pingContainer);
      // Trigger animation
      requestAnimationFrame(() => {
        pingContainer.classList.add('ping-svg-animation');
      });
      // Cleanup after animation
      pingContainer.addEventListener('animationend', () => {
        pingContainer.remove();
      }, { once: true });
    } catch (e) {
      console.error("[CanvasClick Ping Error]:", e);
      // Ensure cleanup even if append fails or other error occurs before animationend
      if (pingContainer.parentElement) {
        pingContainer.remove();
      }
    }
  }, [containerRef, noPingSelectors, pingColor, pingStrokeWidth]);

  return (
    <div ref={containerRef} className={containerClass} onClick={handleCanvasClick}>
      <div className="grid-overlay"></div>
      <canvas ref={canvasRef1} className={canvas1Class} />
      <canvas ref={canvasRef2} className={canvas2Class} />
      <canvas ref={canvasRef3} className={canvas3Class} />
    </div>
  );
};

CanvasContainerWrapper.propTypes = {
  containerRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) })
  ]).isRequired,
  canvasRef1: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(HTMLCanvasElement) })
  ]).isRequired,
  canvasRef2: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(HTMLCanvasElement) })
  ]).isRequired,
  canvasRef3: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(HTMLCanvasElement) })
  ]).isRequired,
  containerClass: PropTypes.string.isRequired,
  canvas1Class: PropTypes.string.isRequired,
  canvas2Class: PropTypes.string.isRequired,
  canvas3Class: PropTypes.string.isRequired,
  pingColor: PropTypes.string.isRequired,
  pingStrokeWidth: PropTypes.number.isRequired,
  noPingSelectors: PropTypes.string.isRequired,
};

export default CanvasContainerWrapper;