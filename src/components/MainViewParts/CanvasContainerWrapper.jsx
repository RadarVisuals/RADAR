// src/components/MainViewParts/CanvasContainerWrapper.jsx (Assuming path based on context)
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

// Assuming styles are imported by a parent or a dedicated CSS file for this component.
// e.g., import './CanvasContainerWrapper.css';
// The original mentioned Mainview.css, so ensure relevant styles are accessible.

/**
 * @typedef {object} CanvasContainerWrapperProps
 * @property {React.RefObject<HTMLDivElement>} containerRef - Ref for the main container div that holds the canvases and grid overlay.
 * @property {React.RefObject<HTMLCanvasElement>} canvasRef1 - Ref for the first canvas element (bottom layer).
 * @property {React.RefObject<HTMLCanvasElement>} canvasRef2 - Ref for the second canvas element (middle layer).
 * @property {React.RefObject<HTMLCanvasElement>} canvasRef3 - Ref for the third canvas element (top layer).
 * @property {string} containerClass - CSS class name(s) for the main container div.
 * @property {string} canvas1Class - CSS class name(s) for the first canvas element.
 * @property {string} canvas2Class - CSS class name(s) for the second canvas element.
 * @property {string} canvas3Class - CSS class name(s) for the third canvas element.
 * @property {string} pingColor - CSS color string for the click ping animation stroke.
 * @property {number} pingStrokeWidth - Stroke width for the click ping animation circle.
 * @property {string} noPingSelectors - A CSS selector string. Clicks on elements matching these selectors (or their children) within the container will not trigger the ping animation.
 */

/**
 * CanvasContainerWrapper: A component that sets up the main visual area,
 * containing three canvas layers for visual rendering and a grid overlay.
 * It also implements a "click ping" animation effect that appears at the
 * mouse click location, unless the click target matches `noPingSelectors`.
 *
 * @param {CanvasContainerWrapperProps} props - The component's props.
 * @returns {JSX.Element} The rendered canvas container with its layers and click ping functionality.
 */
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
  noPingSelectors, // e.g., ".toolbar-icon, .panel, button"
}) => {

  /**
   * Handles click events on the canvas container to create a "ping" animation
   * at the click location, unless the click target is within an element matching
   * `noPingSelectors`.
   */
  const handleCanvasClick = useCallback((event) => {
    // Prevent ping if the click target or its ancestor matches any of the noPingSelectors
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

    // Get click coordinates relative to the viewport
    const x = event.clientX;
    const y = event.clientY;

    // Create the SVG container for the ping animation
    const pingContainer = document.createElement('div');
    pingContainer.className = 'click-ping-svg-container'; // For CSS targeting and positioning
    // Position the ping at the click coordinates
    pingContainer.style.left = `${x}px`;
    pingContainer.style.top = `${y}px`;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "click-ping-svg");
    svg.setAttribute("viewBox", "0 0 20 20"); // ViewBox for a 20x20 coordinate system
    svg.style.overflow = "visible"; // Ensure animation (expanding circle) is not clipped by SVG bounds

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "10"); // Center of the 20x20 viewBox
    circle.setAttribute("cy", "10");
    circle.setAttribute("r", "5"); // Initial radius
    circle.setAttribute("stroke", pingColor);
    circle.setAttribute("stroke-width", String(pingStrokeWidth)); // Ensure it's a string
    circle.setAttribute("fill", "none"); // No fill, just a stroke

    svg.appendChild(circle);
    pingContainer.appendChild(svg);

    try {
      containerElement.appendChild(pingContainer);
      // Trigger CSS animation by adding a class.
      // requestAnimationFrame ensures the element is in the DOM before class is added, allowing transition/animation to trigger.
      requestAnimationFrame(() => {
        pingContainer.classList.add('ping-svg-animation'); // Assumes CSS defines this animation
      });

      // Clean up the ping element after its animation completes.
      pingContainer.addEventListener('animationend', () => {
        if (pingContainer.parentElement) { // Check if still in DOM before removing
            pingContainer.remove();
        }
      }, { once: true }); // Listener automatically removed after first trigger

    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("[CanvasContainerWrapper] Error creating or animating click ping:", e);
      }
      // Ensure cleanup even if append fails or other error occurs before animationend
      if (pingContainer.parentElement) {
        pingContainer.remove();
      }
    }
  }, [containerRef, noPingSelectors, pingColor, pingStrokeWidth]); // Dependencies for the click handler

  return (
    <div ref={containerRef} className={containerClass} onClick={handleCanvasClick}>
      <div className="grid-overlay"></div> {/* For visual grid, styled via CSS */}
      <canvas ref={canvasRef1} className={canvas1Class} />
      <canvas ref={canvasRef2} className={canvas2Class} />
      <canvas ref={canvasRef3} className={canvas3Class} />
    </div>
  );
};

CanvasContainerWrapper.propTypes = {
  /** Ref for the main container div. */
  containerRef: PropTypes.oneOfType([
    PropTypes.func, // For callback refs
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }) // For object refs
  ]).isRequired,
  /** Ref for the first canvas element (bottom layer). */
  canvasRef1: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(HTMLCanvasElement) })
  ]).isRequired,
  /** Ref for the second canvas element (middle layer). */
  canvasRef2: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(HTMLCanvasElement) })
  ]).isRequired,
  /** Ref for the third canvas element (top layer). */
  canvasRef3: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(HTMLCanvasElement) })
  ]).isRequired,
  /** CSS class name(s) for the main container div. */
  containerClass: PropTypes.string.isRequired,
  /** CSS class name(s) for the first canvas element. */
  canvas1Class: PropTypes.string.isRequired,
  /** CSS class name(s) for the second canvas element. */
  canvas2Class: PropTypes.string.isRequired,
  /** CSS class name(s) for the third canvas element. */
  canvas3Class: PropTypes.string.isRequired,
  /** CSS color string for the click ping animation stroke. */
  pingColor: PropTypes.string.isRequired,
  /** Stroke width for the click ping animation circle. */
  pingStrokeWidth: PropTypes.number.isRequired,
  /** A CSS selector string to identify elements where clicks should NOT trigger the ping. */
  noPingSelectors: PropTypes.string.isRequired,
};

// Default export is standard for React components.
export default CanvasContainerWrapper;