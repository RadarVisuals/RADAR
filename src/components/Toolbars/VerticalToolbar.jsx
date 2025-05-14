// src/components/Toolbars/VerticalToolbar.jsx
import React from "react"; // Removed unused useState import
import PropTypes from "prop-types";

import "./ToolbarStyles/VerticalToolbar.css"; // Local styles
import {
  controlsIcon,
  notifyIcon,
  listenIcon, // For Events/Reactions panel
  changetokenIcon, // For Token Selector
  writeIcon, // For Save panel
  wavezIcon, // For Audio panel
} from "../../assets"; // Assuming assets are correctly pathed

/**
 * @typedef {object} VerticalToolbarProps
 * @property {string | null} activePanel - The identifier of the currently active panel, used to highlight the corresponding toolbar button.
 * @property {(panelName: string) => void} setActivePanel - Callback function to open/toggle a panel. This is typically the `openPanel` or `togglePanel` function from a panel manager hook (e.g., `usePanelManager` or `useUIState`).
 * @property {number} [notificationCount=0] - The number of unread notifications, displayed as a badge on the notifications icon.
 */

/**
 * VerticalToolbar: Renders a fixed vertical toolbar, typically on the left side of the screen.
 * It provides icon buttons to open different control panels (e.g., Controls, Notifications, Events, Save, Audio)
 * and to trigger overlays like the Token Selector. It also displays a badge for unread notifications.
 * The visual "active" state of buttons is determined by the `activePanel` prop.
 *
 * @param {VerticalToolbarProps} props - The component's props.
 * @returns {JSX.Element} The rendered VerticalToolbar component.
 */
const VerticalToolbar = ({
  activePanel,
  setActivePanel,
  notificationCount = 0,
}) => {

  /**
   * Handles a click on a toolbar icon, calling `setActivePanel` with the target panel's name.
   * @param {string} panelName - The identifier of the panel to activate.
   */
  const handleIconClick = (panelName) => {
    if (typeof setActivePanel === 'function') {
      setActivePanel(panelName);
    } else if (import.meta.env.DEV) {
      console.warn("[VerticalToolbar] setActivePanel prop is not a function.");
    }
  };

  // Specific handler for the token selector, as it might be treated as an overlay
  // or a special panel type by the panel manager.
  const openTokenSelector = () => {
    handleIconClick("tokens"); // Standardize to use panel name "tokens"
  };

  // Fixed position values for vertical alignment of buttons.
  // Consider moving to CSS if positions are static and don't need JS logic.
  // Using inline styles here as per original, but CSS classes would be more maintainable for complex layouts.
  const buttonPositions = [
    { top: "20px" }, // Controls
    { top: "65px" }, // Notifications
    { top: "110px" }, // Events
    { top: "155px" }, // Token Selector
    { top: "200px" }, // Save Config
    { top: "245px" }, // Audio Visualizer
  ];

  return (
    // Using React.Fragment <>...</> as the root, assuming the toolbar is positioned absolutely by its CSS.
    <>
      <button
        className={`vertical-toolbar-icon ${activePanel === "controls" ? "active" : ""}`}
        onClick={() => handleIconClick("controls")}
        title="Controls"
        aria-label="Open Controls Panel" // Accessibility
        style={buttonPositions[0]}
      >
        <img src={controlsIcon} alt="Controls Panel" className="icon-image" />
      </button>

      <button
        className={`vertical-toolbar-icon ${activePanel === "notifications" ? "active" : ""}`}
        onClick={() => handleIconClick("notifications")}
        title="Notifications"
        aria-label="Open Notifications Panel"
        style={buttonPositions[1]}
      >
        <div className="notification-orb"> {/* Container for icon and badge */}
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

      <button
        className={`vertical-toolbar-icon ${activePanel === "events" ? "active" : ""}`}
        onClick={() => handleIconClick("events")}
        title="Event Reactions"
        aria-label="Open Event Reactions Panel"
        style={buttonPositions[2]}
      >
        <img src={listenIcon} alt="Event Reactions Panel" className="icon-image" />
      </button>

      <button
        className={`vertical-toolbar-icon ${activePanel === "tokens" ? "active" : ""}`} // Token selector can also have an active state
        onClick={openTokenSelector}
        title="Select Token / Asset"
        aria-label="Open Token Selector"
        style={buttonPositions[3]}
      >
        <img src={changetokenIcon} alt="Select Token" className="icon-image" />
      </button>

      <button
        className={`vertical-toolbar-icon ${activePanel === "save" ? "active" : ""}`}
        onClick={() => handleIconClick("save")}
        title="Save Configuration"
        aria-label="Open Save Configuration Panel"
        style={buttonPositions[4]}
      >
        <img src={writeIcon} alt="Save Configuration" className="icon-image" />
      </button>

      <button
        className={`vertical-toolbar-icon ${activePanel === "audio" ? "active" : ""}`}
        onClick={() => handleIconClick("audio")}
        title="Audio Visualizer Controls"
        aria-label="Open Audio Controls Panel"
        style={buttonPositions[5]}
      >
        <img src={wavezIcon} alt="Audio Controls" className="icon-image" />
      </button>
    </>
  );
};

VerticalToolbar.propTypes = {
  /** Identifier of the currently active panel, to highlight the corresponding button. */
  activePanel: PropTypes.string,
  /** Callback function to open/toggle a panel, invoked with the panel's identifier string. */
  setActivePanel: PropTypes.func.isRequired,
  /** The number of unread notifications, displayed as a badge. */
  notificationCount: PropTypes.number,
};

// Default export is standard for React components.
export default VerticalToolbar;