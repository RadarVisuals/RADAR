import React from "react";
import PropTypes from "prop-types";

/**
 * Wrapper component that positions and animates panels sliding in from the left.
 */
const PanelWrapper = ({ className, children, style }) => {
  return (
    <div className={`panel-wrapper ${className || ""}`} style={style}>
      {children}

      {/* Using styled-jsx for component-scoped styles and animations */}
      <style jsx>{`
        .panel-wrapper {
          position: fixed;
          top: 5px;
          left: -20px; /* Initial position slightly off-screen for slide-in */
          z-index: 1000;
          max-height: 90vh;
          animation: panel-slide-in 0.3s ease-out forwards;
          overflow: visible; /* Allow shadows/effects outside bounds */
          /* Ensure no borders or outlines that might cause blue lines */
          border: none !important;
          outline: none !important;
        }

        /* Specific class for panels originating from the toolbar */
        .panel-wrapper.panel-from-toolbar {
          /* No need to repeat 'left: -20px;' here */
        }

        @keyframes panel-slide-in {
          from {
            opacity: 0;
            transform: translateX(-150px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* Animation for closing/sliding out */
        .panel-wrapper.animating.closing {
          animation: panel-slide-out 0.3s ease-in forwards;
        }

        @keyframes panel-slide-out {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(-20px); /* Slide slightly back left */
          }
        }
      `}</style>
    </div>
  );
};

PanelWrapper.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
  style: PropTypes.object,
};

export default PanelWrapper;