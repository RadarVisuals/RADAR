// src/components/Panels/PanelWrapper.jsx
import React from "react";
import PropTypes from "prop-types";
// Correct the import path to point to the PanelStyles subdirectory
import "./PanelStyles/PanelWrapper.css";

/**
 * @typedef {object} PanelWrapperProps
 * @property {string} [className=""] - Optional additional CSS class names to apply to the wrapper div.
 * @property {React.ReactNode} children - The panel content (typically a `Panel` component) to be rendered within this wrapper.
 * @property {React.CSSProperties} [style] - Optional inline styles to apply to the wrapper div.
 */

/**
 * PanelWrapper: A component designed to wrap individual panels (like `EnhancedControlPanel`, `NotificationPanel`).
 * It handles the positioning of the panel on the screen and applies slide-in/slide-out animations
 * using CSS keyframes defined in an accompanying CSS file.
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