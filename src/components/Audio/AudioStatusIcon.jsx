// src/components/Audio/AudioStatusIcon.jsx
import React from "react";
import PropTypes from "prop-types";
import "./AudioStyles/AudioStatusIcon.css";

/**
 * Icon to indicate that audio visualization is active.
 * Appears when audio is active but the control panel is closed.
 */
const AudioStatusIcon = ({ isActive, onClick }) => {
  if (!isActive) {
    return null;
  }

  return (
    <button
      className={`audio-status-icon ${isActive ? "active" : ""}`}
      onClick={onClick}
      aria-label="Audio Status Active"
      title="Audio Visualizer Active - Click to open settings"
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

AudioStatusIcon.defaultProps = {
  isActive: false,
  onClick: () => {},
};

export default AudioStatusIcon;