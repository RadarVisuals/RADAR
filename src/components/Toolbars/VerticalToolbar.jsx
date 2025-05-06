import React from "react"; // Removed useState import
import PropTypes from "prop-types";
// Removed unused useConfig import
// import { useConfig } from "../../context/ConfigContext";
import "./ToolbarStyles/VerticalToolbar.css";
import {
  controlsIcon,
  notifyIcon,
  listenIcon,
  changetokenIcon,
  writeIcon,
  wavezIcon,
} from "../../assets";

/**
 * VerticalToolbar: Renders a fixed vertical toolbar on the left side,
 * providing buttons to open different control panels (Controls, Notifications, Events, Save, Audio)
 * and the Token Selector overlay. Displays a badge for unread notifications.
 */
const VerticalToolbar = ({
  activePanel,
  setActivePanel, // Function to open/toggle panels (likely from usePanelManager)
  notificationCount = 0,
  // Removed unused props: isVisitor, isParentAdmin, isProfileOwner
}) => {
  // Removed unused context value: isParentProfile

  const handleIconClick = (panelName) => {
    setActivePanel(panelName);
  };

  // Specific handler for token selector as it might be an overlay, not a panel
  const openTokenSelector = () => {
    setActivePanel("tokens");
  };

  // Fixed position values for vertical alignment
  const buttonPositions = [
    { top: "20px" }, // Controls
    { top: "65px" }, // Notifications
    { top: "110px" }, // Events
    { top: "155px" }, // Token Selector
    { top: "200px" }, // Save Config
    { top: "245px" }, // Audio Visualizer
  ];

  return (
    <>
      <button
        className={`vertical-toolbar-icon ${activePanel === "controls" ? "active" : ""}`}
        onClick={() => handleIconClick("controls")}
        title="Controls"
        style={buttonPositions[0]}
      >
        <img src={controlsIcon} alt="Controls" className="icon-image" />
      </button>

      <button
        className={`vertical-toolbar-icon ${activePanel === "notifications" ? "active" : ""}`}
        onClick={() => handleIconClick("notifications")}
        title="Notifications"
        style={buttonPositions[1]}
      >
        <div className="notification-orb">
          <img
            src={notifyIcon}
            alt="Notifications"
            className={`icon-image ${notificationCount > 0 ? "bell-animation" : ""}`}
          />
          {notificationCount > 0 && (
            <div className="notification-badge">{notificationCount}</div>
          )}
        </div>
      </button>

      <button
        className={`vertical-toolbar-icon ${activePanel === "events" ? "active" : ""}`}
        onClick={() => handleIconClick("events")}
        title="Event Reactions"
        style={buttonPositions[2]}
      >
        <img src={listenIcon} alt="Events" className="icon-image" />
      </button>

      <button
        className="vertical-toolbar-icon" // No active state needed for overlay trigger
        onClick={openTokenSelector}
        title="Select Token"
        style={buttonPositions[3]}
      >
        <img src={changetokenIcon} alt="Select Token" className="icon-image" />
      </button>

      <button
        className={`vertical-toolbar-icon ${activePanel === "save" ? "active" : ""}`}
        onClick={() => handleIconClick("save")}
        title="Save Configuration"
        style={buttonPositions[4]}
      >
        <img src={writeIcon} alt="Save" className="icon-image" />
      </button>

      <button
        className={`vertical-toolbar-icon ${activePanel === "audio" ? "active" : ""}`}
        onClick={() => handleIconClick("audio")}
        title="Audio Visualizer"
        style={buttonPositions[5]}
      >
        <img src={wavezIcon} alt="Audio Visualizer" className="icon-image" />
      </button>
    </>
  );
};

VerticalToolbar.propTypes = {
  activePanel: PropTypes.string,
  setActivePanel: PropTypes.func.isRequired,
  notificationCount: PropTypes.number,
  // Removed unused props from PropTypes
  // hasPendingChanges: PropTypes.bool,
  // isVisitor: PropTypes.bool,
  // isParentAdmin: PropTypes.bool,
  // isProfileOwner: PropTypes.bool,
};

export default VerticalToolbar;