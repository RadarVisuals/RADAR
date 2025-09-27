// src/components/MainViewParts/CanvasContainerWrapper.jsx (Assuming path based on context)
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

// Assuming styles are imported by a parent or a dedicated CSS file for this component.
// e.g., import './CanvasContainerWrapper.css';
// The original mentioned Mainview.css, so ensure relevant styles are accessible.

/**
 * @typedef {object} CanvasContainerWrapperProps
 * @property {React.RefObject<HTMLDivElement>} containerRef - Ref for the main container div that holds the canvases and grid overlay.
 * @property {Object.<string, React.RefObject<HTMLCanvasElement>>} canvasRefs - An object containing refs for all canvas elements, keyed by an identifier (e.g., '1A', '1B').
 * @property {string} containerClass - CSS class name(s) for the main container div.
 * @property {(layerId: string) => string} baseCanvasClass - A function that returns the base CSS class string for a given layer ID.
 * @property {string} pingColor - CSS color string for the click ping animation stroke.
 * @property {number} pingStrokeWidth - Stroke width for the click ping animation circle.
 * @property {string} noPingSelectors - A CSS selector string. Clicks on elements matching these selectors (or their children) within the container will not trigger the ping animation.
 */

/**
 * CanvasContainerWrapper: A component that sets up the main visual area,
 * containing canvas layers for visual rendering and a grid overlay.
 * It now renders a pair of canvases (A and B) for each visual layer to enable
 * true cross-dissolving between scenes with different blend modes.
 * It also implements a "click ping" animation effect.
 *
 * @param {CanvasContainerWrapperProps} props - The component's props.
 * @returns {JSX.Element} The rendered canvas container with its layers and click ping functionality.
 */
const CanvasContainerWrapper = ({
  containerRef,
  canvasRefs,
  containerClass,
  baseCanvasClass,
  pingColor,
  pingStrokeWidth,
  noPingSelectors,
}) => {

  const handleCanvasClick = useCallback((event) => {
    if (noPingSelectors && typeof noPingSelectors === 'string' && event.target.closest(noPingSelectors)) {
      return;
    }

    const containerElement = containerRef.current;
    if (!containerElement) {
      if (import.meta.env.DEV) {
        console.warn("[CanvasContainerWrapper] Container ref not available for ping effect.");
      }
      return;
    }

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
      if (import.meta.env.DEV) {
        console.error("[CanvasContainerWrapper] Error creating or animating click ping:", e);
      }
      if (pingContainer.parentElement) {
        pingContainer.remove();
      }
    }
  }, [containerRef, noPingSelectors, pingColor, pingStrokeWidth]);

  return (
    <div ref={containerRef} className={containerClass} onClick={handleCanvasClick}>
      <div className="grid-overlay"></div>
      {/* --- START: Render a pair of canvases for each layer --- */}
      <canvas ref={canvasRefs['1A']} className={`${baseCanvasClass('1')} canvas-deck-a`} />
      <canvas ref={canvasRefs['1B']} className={`${baseCanvasClass('1')} canvas-deck-b`} />
      <canvas ref={canvasRefs['2A']} className={`${baseCanvasClass('2')} canvas-deck-a`} />
      <canvas ref={canvasRefs['2B']} className={`${baseCanvasClass('2')} canvas-deck-b`} />
      <canvas ref={canvasRefs['3A']} className={`${baseCanvasClass('3')} canvas-deck-a`} />
      <canvas ref={canvasRefs['3B']} className={`${baseCanvasClass('3')} canvas-deck-b`} />
      {/* --- END: Render a pair of canvases for each layer --- */}
    </div>
  );
};

CanvasContainerWrapper.propTypes = {
  containerRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) })
  ]).isRequired,
  canvasRefs: PropTypes.objectOf(
    PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.shape({ current: PropTypes.instanceOf(HTMLCanvasElement) })
    ])
  ).isRequired,
  containerClass: PropTypes.string.isRequired,
  baseCanvasClass: PropTypes.func.isRequired,
  pingColor: PropTypes.string.isRequired,
  pingStrokeWidth: PropTypes.number.isRequired,
  noPingSelectors: PropTypes.string.isRequired,
};

export default CanvasContainerWrapper;