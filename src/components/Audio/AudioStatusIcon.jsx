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
// MODIFIED LINE: Added default parameters directly in the function signature
const AudioStatusIcon = ({ isActive = false, onClick = () => {} }) => {
  // If audio visualization is not active, do not render the icon.
  if (!isActive) {
    return null;
  }

  return (
    <button
      className={`audio-status-icon ${isActive ? "active" : ""}`}
      onClick={onClick}
      aria-label="Audio Visualizer Active"
      title="Audio Visualizer is Active - Click to open settings"
    >
      <div className="audio-icon">
        <div className="wave-container">
          <span className="audio-wave"></span>
          <span className="audio-wave"></span>
          <span className="audio-wave"></span>
        </div>
      </div>
    </button>
  );
};

AudioStatusIcon.propTypes = {
  isActive: PropTypes.bool,
  onClick: PropTypes.func,
};

export default AudioStatusIcon;