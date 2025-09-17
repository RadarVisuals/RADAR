// src/components/Toolbars/VerticalToolbar.jsx
import React from "react";
import PropTypes from "prop-types";

import "./ToolbarStyles/VerticalToolbar.css";
import {
  controlsIcon,
  notifyIcon,
  listenIcon,
  changetokenIcon,
  writeIcon,
  wavezIcon,
  setsIcon,
} from "../../assets";

const VerticalToolbar = ({
  activePanel,
  setActivePanel,
  notificationCount = 0,
}) => {

  const handleIconClick = (panelName) => {
    if (typeof setActivePanel === 'function') {
      setActivePanel(panelName);
    } else if (import.meta.env.DEV) {
      console.warn("[VerticalToolbar] setActivePanel prop is not a function.");
    }
  };

  const buttonPositions = [
    { top: "20px" },  // 1. Controls
    { top: "65px" },  // 2. Notifications
    { top: "110px" }, // 3. Events
    { top: "155px" }, // 4. Token Selector
    { top: "200px" }, // 5. Setlist Management
    { top: "245px" }, // 6. Save Configuration
    { top: "290px" }, // 7. Audio Visualizer
  ];

  return (
    <>
      {/* 1. Controls */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "controls" ? "active" : ""}`}
        onClick={() => handleIconClick("controls")}
        title="Controls"
        aria-label="Open Controls Panel"
        style={buttonPositions[0]}
      >
        <img src={controlsIcon} alt="Controls Panel" className="icon-image" />
      </button>

      {/* 2. Notifications */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "notifications" ? "active" : ""}`}
        onClick={() => handleIconClick("notifications")}
        title="Notifications"
        aria-label="Open Notifications Panel"
        style={buttonPositions[1]}
      >
        <div className="notification-orb">
          <img
            src={notifyIcon}
            alt="Notifications Panel"
            className={`icon-image ${notificationCount > 0 ? "bell-animation" : ""}`}
          />
          {notificationCount > 0 && (
            <div className="notification-badge" aria-label={`${notificationCount} unread notifications`}>
              {notificationCount}
            </div>
          )}
        </div>
      </button>

      {/* 3. Event Reactions */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "events" ? "active" : ""}`}
        onClick={() => handleIconClick("events")}
        title="Event Reactions"
        aria-label="Open Event Reactions Panel"
        style={buttonPositions[2]}
      >
        <img src={listenIcon} alt="Event Reactions Panel" className="icon-image" />
      </button>

      {/* 4. Token Selector */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "tokens" ? "active" : ""}`}
        onClick={() => handleIconClick("tokens")}
        title="Select Token / Asset"
        aria-label="Open Token Selector"
        style={buttonPositions[3]}
      >
        <img src={changetokenIcon} alt="Select Token" className="icon-image" />
      </button>
      
      {/* 5. Setlist Management */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "sets" ? "active" : ""}`}
        onClick={() => handleIconClick("sets")}
        title="Setlist Management"
        aria-label="Open Setlist Management Panel"
        style={buttonPositions[4]}
      >
        <img src={setsIcon} alt="Setlist Management" className="icon-image" />
      </button>

      {/* 6. Save Configuration */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "save" ? "active" : ""}`}
        onClick={() => handleIconClick("save")}
        title="Save Configuration"
        aria-label="Open Save Configuration Panel"
        style={buttonPositions[5]}
      >
        <img src={writeIcon} alt="Save Configuration" className="icon-image" />
      </button>

      {/* 7. Audio Visualizer */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "audio" ? "active" : ""}`}
        onClick={() => handleIconClick("audio")}
        title="Audio Visualizer Controls"
        aria-label="Open Audio Controls Panel"
        style={buttonPositions[6]}
      >
        <img src={wavezIcon} alt="Audio Controls" className="icon-image" />
      </button>
    </>
  );
};

VerticalToolbar.propTypes = {
  activePanel: PropTypes.string,
  setActivePanel: PropTypes.func.isRequired,
  notificationCount: PropTypes.number,
};

export default VerticalToolbar;