import React from "react";
import PropTypes from "prop-types";
import "./ToolbarStyles/TopRightControls.css";
import {
  whitelistIcon,
  enlargeIcon,
  learnIcon,
  eyeIcon,
  eyeopenIcon,
} from "../../assets";

/**
 * TopRightControls component renders a set of control icons positioned at the top-right
 * of the screen. It includes buttons for toggling fullscreen, managing whitelisted collections (admin-only),
 * accessing an information overlay, and toggling the main UI visibility.
 *
 * @param {object} props - The component's props.
 * @param {boolean} [props.showWhitelist=false] - Whether to show the whitelist management button. This is controlled by the parent.
 * @param {boolean} [props.isProjectAdminForWhitelist=false] - Whether the current user is an admin eligible to see/use the whitelist button.
 * @param {boolean} [props.showInfo=true] - Whether to show the information overlay button.
 * @param {boolean} [props.showToggleUI=true] - Whether to show the UI visibility toggle button.
 * @param {boolean} [props.showEnhancedView=true] - Whether to show the fullscreen toggle button.
 * @param {Function} [props.onWhitelistClick] - Callback function when the whitelist button is clicked.
 * @param {Function} [props.onInfoClick] - Callback function when the info button is clicked.
 * @param {Function} [props.onToggleUI] - Callback function when the UI toggle button is clicked.
 * @param {Function} [props.onEnhancedView] - Callback function when the fullscreen toggle button is clicked.
 * @param {boolean} [props.isUiVisible=true] - Current visibility state of the main UI.
 * @returns {JSX.Element} The rendered TopRightControls component.
 */
const TopRightControls = ({
  showWhitelist = false,
  isProjectAdminForWhitelist = false, // New prop to determine if admin can see it
  showInfo = true,
  showToggleUI = true,
  showEnhancedView = true,
  onWhitelistClick,
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
        >
          <img
            src={enlargeIcon}
            alt="Toggle Fullscreen"
            className="enhanced-view-icon icon-image"
          />
        </button>
      )}

      {/* Whitelist button: shown if showWhitelist is true AND user is admin */}
      {showWhitelist && isProjectAdminForWhitelist && isUiVisible && (
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
  showWhitelist: PropTypes.bool,
  isProjectAdminForWhitelist: PropTypes.bool,
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