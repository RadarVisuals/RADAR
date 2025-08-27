// src/components/Toolbars/TopRightControls.jsx
import React from "react";
import PropTypes from "prop-types";

import "./ToolbarStyles/TopRightControls.css";
import {
  whitelistIcon, // <-- BROUGHT BACK THIS ICON
  enlargeIcon,
  learnIcon,
  eyeIcon,
  eyeopenIcon,
} from "../../assets";

const TopRightControls = ({
  isRadarProjectAdmin = false, // <-- ADDED PROP
  onWhitelistClick, // <-- ADDED PROP
  showInfo = true,
  showToggleUI = true,
  showEnhancedView = true,
  onInfoClick,
  onToggleUI,
  onEnhancedView,
  isUiVisible = true,
}) => {
  return (
    <div className={`top-right-controls-container ${!isUiVisible ? "ui-hidden" : ""}`}>
      {showEnhancedView && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onEnhancedView}
          title="Toggle Fullscreen"
          aria-label="Toggle Fullscreen"
        >
          <img
            src={enlargeIcon}
            alt="Toggle Fullscreen"
            className="enhanced-view-icon icon-image"
          />
        </button>
      )}

      {/* --- START MODIFICATION: Admin-only Whitelist Button --- */}
      {isRadarProjectAdmin && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onWhitelistClick}
          title="Manage Official Collection Whitelist"
          aria-label="Manage Whitelist"
        >
          <img
            src={whitelistIcon}
            alt="Manage Whitelist"
            className="icon-image"
          />
        </button>
      )}
      {/* --- END MODIFICATION --- */}

      {showInfo && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onInfoClick}
          title="Information"
          aria-label="Show Information"
        >
          <img src={learnIcon} alt="Information" className="icon-image" />
        </button>
      )}

      {showToggleUI && (
        <button
          className={`toolbar-icon fixed-toggle-button ${!isUiVisible ? "show-ui-btn" : ""}`}
          onClick={onToggleUI}
          title={isUiVisible ? "Hide UI" : "Show UI"}
          aria-label={isUiVisible ? "Hide User Interface" : "Show User Interface"}
        >
          <img
            src={isUiVisible ? eyeopenIcon : eyeIcon}
            alt={isUiVisible ? "Hide UI" : "Show UI"}
            className="icon-image"
          />
        </button>
      )}
    </div>
  );
};

TopRightControls.propTypes = {
  isRadarProjectAdmin: PropTypes.bool,
  onWhitelistClick: PropTypes.func,
  showInfo: PropTypes.bool,
  showToggleUI: PropTypes.bool,
  showEnhancedView: PropTypes.bool,
  onInfoClick: PropTypes.func,
  onToggleUI: PropTypes.func,
  onEnhancedView: PropTypes.func,
  isUiVisible: PropTypes.bool,
};

export default TopRightControls;