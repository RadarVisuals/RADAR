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
  ufoIcon,
} from "../../assets";
import { useNotificationContext } from "../../hooks/useNotificationContext"; 

const VerticalToolbar = ({
  activePanel,
  setActivePanel,
}) => {
  const { unreadCount: notificationCount } = useNotificationContext();

  const handleIconClick = (panelName) => {
    if (typeof setActivePanel === 'function') {
      setActivePanel(panelName);
    }
  };

  const buttonPositions = [
    { top: "20px" },  // Controls
    { top: "65px" },  // Notifications
    { top: "110px" }, // Events
    { top: "155px" }, // Tokens
    { top: "200px" }, // MODULATION MATRIX
    { top: "245px" }, // Sets
    { top: "290px" }, // Save
    { top: "335px" }, // Audio
  ];

  return (
    <>
      <button className={`vertical-toolbar-icon ${activePanel === "controls" ? "active" : ""}`} onClick={() => handleIconClick("controls")} title="Controls" style={buttonPositions[0]}>
        <img src={controlsIcon} alt="Controls" className="icon-image" />
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "notifications" ? "active" : ""}`} onClick={() => handleIconClick("notifications")} title="Notifications" style={buttonPositions[1]}>
        <div className="notification-orb">
          <img src={notifyIcon} alt="Notifications" className={`icon-image ${notificationCount > 0 ? "bell-animation" : ""}`} />
          {notificationCount > 0 && <div className="notification-badge">{notificationCount}</div>}
        </div>
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "events" ? "active" : ""}`} onClick={() => handleIconClick("events")} title="Event Reactions" style={buttonPositions[2]}>
        <img src={listenIcon} alt="Events" className="icon-image" />
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "tokens" ? "active" : ""}`} onClick={() => handleIconClick("tokens")} title="Select Token" style={buttonPositions[3]}>
        <img src={changetokenIcon} alt="Tokens" className="icon-image" />
      </button>

      {/* --- MODULATION BUTTON (UFO) --- */}
      <button 
        className={`vertical-toolbar-icon ${activePanel === "modulation" ? "active" : ""}`} 
        onClick={() => handleIconClick("modulation")} 
        title="Modulation Matrix (FX Wiring)" 
        style={buttonPositions[4]}
      >
        <img src={ufoIcon} className="icon-image ufo-icon-adjust" alt="Modulation" />
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "sets" ? "active" : ""}`} onClick={() => handleIconClick("sets")} title="Setlist" style={buttonPositions[5]}>
        <img src={setsIcon} alt="Sets" className="icon-image" />
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "save" ? "active" : ""}`} onClick={() => handleIconClick("save")} title="Save" style={buttonPositions[6]}>
        <img src={writeIcon} alt="Save" className="icon-image" />
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "audio" ? "active" : ""}`} onClick={() => handleIconClick("audio")} title="Audio" style={buttonPositions[7]}>
        <img src={wavezIcon} alt="Audio" className="icon-image" />
      </button>
    </>
  );
};

VerticalToolbar.propTypes = {
  activePanel: PropTypes.string,
  setActivePanel: PropTypes.func.isRequired,
};

export default VerticalToolbar;