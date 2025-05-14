// src/components/Audio/AudioStatusIcon.jsx
import React from "react";
import PropTypes from "prop-types";

import "./AudioStyles/AudioStatusIcon.css"; // Local styles

/**
 * @typedef {object} AudioStatusIconProps
 * @property {boolean} [isActive=false] - If true, the icon is displayed and indicates that audio visualization is active.
 * @property {() => void} [onClick] - Optional callback function invoked when the icon is clicked. Typically used to open the audio control panel.
 */

/**
 * AudioStatusIcon: A small visual indicator, usually placed in a corner or toolbar,
 * to show that audio visualization/reactivity is currently active.
 * It only renders when `isActive` is true. Clicking the icon can trigger an action,
 * such as opening the audio control panel.
 *
 * @param {AudioStatusIconProps} props - The component's props.
 * @returns {JSX.Element | null} The rendered AudioStatusIcon button, or null if `isActive` is false.
 */
const AudioStatusIcon = ({ isActive = false, onClick }) => {
  // If audio visualization is not active, do not render the icon.
  if (!isActive) {
    return null;
  }

  return (
    <button
      className={`audio-status-icon ${isActive ? "active" : ""}`} // 'active' class can be used for specific styling when active
      onClick={onClick}
      aria-label="Audio Visualizer Active" // Accessibility: Label for screen readers
      title="Audio Visualizer is Active - Click to open settings" // Tooltip for mouse users
    >
      <div className="audio-icon"> {/* Container for the visual wave elements */}
        <div className="wave-container">
          {/* These spans are typically styled with CSS to create the animated wave effect */}
          <span className="audio-wave"></span>
          <span className="audio-wave"></span>
          <span className="audio-wave"></span>
        </div>
      </div>
    </button>
  );
};

AudioStatusIcon.propTypes = {
  /** If true, the icon is displayed and indicates that audio visualization is active. */
  isActive: PropTypes.bool,
  /** Optional callback function invoked when the icon is clicked. */
  onClick: PropTypes.func,
};

AudioStatusIcon.defaultProps = {
  isActive: false,
  onClick: () => {}, // Default to a no-op function to prevent errors if not provided
};

// Default export is standard for React components.
// React.memo can be considered if onClick is stable and isActive changes don't always warrant re-render,
// but for a small component like this, it's often not critical.
export default AudioStatusIcon;