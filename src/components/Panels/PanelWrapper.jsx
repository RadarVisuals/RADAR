// src/components/Panels/PanelWrapper.jsx
import React from "react";
import PropTypes from "prop-types";

/**
 * @typedef {object} PanelWrapperProps
 * @property {string} [className=""] - Optional additional CSS class names to apply to the wrapper div.
 * @property {React.ReactNode} children - The panel content (typically a `Panel` component) to be rendered within this wrapper.
 * @property {React.CSSProperties} [style] - Optional inline styles to apply to the wrapper div.
 */

/**
 * PanelWrapper: A component designed to wrap individual panels (like `EnhancedControlPanel`, `NotificationPanel`).
 * It handles the positioning of the panel on the screen and applies slide-in/slide-out animations
 * using CSS keyframes defined via styled-jsx.
 *
 * The animation durations have been modified as per the original comments.
 *
 * @param {PanelWrapperProps} props - The component's props.
 * @returns {JSX.Element} The rendered PanelWrapper component.
 */
const PanelWrapper = ({ className = "", children, style }) => {
  return (
    <div className={`panel-wrapper ${className}`} style={style}>
      {children}

      <style jsx>{`
        .panel-wrapper {
          position: fixed;
          top: 5px;
          left: -20px; /* Initial position slightly off-screen for slide-in */
          z-index: 1000;
          max-height: 90vh;
          /* MODIFIED: Changed animation duration from 0.3s to 0.5s */
          animation: panel-slide-in 0.5s ease-out forwards;
          overflow: visible; /* Allow shadows/effects outside bounds */
          border: none !important;
          outline: none !important;
        }

        .panel-wrapper.panel-from-toolbar {
          /* Styles for panels originating from toolbar, if any, would go here */
        }

        @keyframes panel-slide-in {
          from {
            opacity: 0;
            transform: translateX(-150px); /* Initial off-screen position */
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .panel-wrapper.animating.closing {
          /* MODIFIED: Changed animation duration from 0.3s to 0.5s */
          animation: panel-slide-out 0.5s ease-in forwards;
        }

        @keyframes panel-slide-out {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(-150px); /* MODIFIED: Match slide-in 'from' transform */
          }
        }
      `}</style>
    </div>
  );
};

PanelWrapper.propTypes = {
  /** Optional additional CSS class names for the wrapper. */
  className: PropTypes.string,
  /** The panel content to be rendered within this wrapper. */
  children: PropTypes.node.isRequired,
  /** Optional inline styles for the wrapper. */
  style: PropTypes.object,
};

export default PanelWrapper;