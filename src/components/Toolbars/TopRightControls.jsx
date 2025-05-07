import React from "react";
import PropTypes from "prop-types";
import "./ToolbarStyles/TopRightControls.css";
import {
  whitelistIcon,
  enlargeIcon, // This will be used by the fullscreen toggle
  learnIcon,
  eyeIcon,      // Assuming this is the "closed eye" for "Show UI"
  eyeopenIcon,  // Assuming this is the "open eye" for "Hide UI"
} from "../../assets";

/**
 * TopRightControls: Renders a set of control icons positioned at the top-right
 * of the screen. Includes buttons for Enhanced View (Fullscreen), Whitelist Management (conditional),
 * Information Overlay, and toggling the main UI visibility.
 */
const TopRightControls = ({
  showWhitelist = false,
  showInfo = false,
  showToggleUI = true,
  showEnhancedView = true, // This prop now controls the fullscreen toggle button
  onWhitelistClick,
  onInfoClick,
  onToggleUI,
  onEnhancedView, // This callback will now handle fullscreen toggling
  isUiVisible = true,
}) => {
  return (
    <div className={`top-right-controls-container ${!isUiVisible ? "ui-hidden" : ""}`}>
      {showEnhancedView && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onEnhancedView} // onEnhancedView now points to toggleFullscreen
          title="Toggle Fullscreen" // Updated title
        >
          <img
            src={enlargeIcon} // Using enlargeIcon for fullscreen
            alt="Toggle Fullscreen" // Updated alt text
            className="enhanced-view-icon icon-image"
          />
        </button>
      )}

      {showWhitelist && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onWhitelistClick}
          title="Manage Collections"
        >
          <img
            src={whitelistIcon}
            alt="Whitelist Collections"
            className="icon-image"
          />
        </button>
      )}

      {showInfo && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onInfoClick}
          title="Information"
        >
          <img src={learnIcon} alt="Info" className="icon-image" />
        </button>
      )}

      {showToggleUI && (
        <button
          className={`toolbar-icon fixed-toggle-button ${!isUiVisible ? "show-ui-btn" : ""}`}
          onClick={onToggleUI}
          title={isUiVisible ? "Hide UI" : "Show UI"}
        >
          <img
            src={isUiVisible ? eyeopenIcon : eyeIcon} // Corrected icon logic: open eye when UI visible, closed when hidden
            alt={isUiVisible ? "Hide UI" : "Show UI"}
            className="icon-image"
          />
        </button>
      )}
    </div>
  );
};

TopRightControls.propTypes = {
  showWhitelist: PropTypes.bool,
  showInfo: PropTypes.bool,
  showToggleUI: PropTypes.bool,
  showEnhancedView: PropTypes.bool,
  onWhitelistClick: PropTypes.func,
  onInfoClick: PropTypes.func,
  onToggleUI: PropTypes.func,
  onEnhancedView: PropTypes.func,
  isUiVisible: PropTypes.bool,
};

export default TopRightControls;