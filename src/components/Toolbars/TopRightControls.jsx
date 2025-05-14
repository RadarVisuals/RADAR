// src/components/Toolbars/TopRightControls.jsx
import React from "react";
import PropTypes from "prop-types";

import "./ToolbarStyles/TopRightControls.css"; // Local styles
import {
  whitelistIcon,
  enlargeIcon,
  learnIcon, // Info icon
  eyeIcon,   // UI hidden icon
  eyeopenIcon, // UI visible icon
} from "../../assets"; // Assuming assets are correctly pathed

/**
 * @typedef {object} TopRightControlsProps
 * @property {boolean} [showWhitelist=false] - Whether to display the whitelist management button. Visibility is ultimately controlled by this prop combined with `isProjectAdminForWhitelist`.
 * @property {boolean} [isProjectAdminForWhitelist=false] - Indicates if the current user has administrative privileges required to see and use the whitelist button.
 * @property {boolean} [showInfo=true] - Whether to display the information overlay button.
 * @property {boolean} [showToggleUI=true] - Whether to display the UI visibility toggle button.
 * @property {boolean} [showEnhancedView=true] - Whether to display the fullscreen/enhanced view toggle button.
 * @property {(() => void)} [onWhitelistClick] - Callback function invoked when the whitelist button is clicked.
 * @property {(() => void)} [onInfoClick] - Callback function invoked when the info button is clicked.
 * @property {(() => void)} [onToggleUI] - Callback function invoked when the UI toggle button is clicked.
 * @property {(() => void)} [onEnhancedView] - Callback function invoked when the fullscreen/enhanced view toggle button is clicked.
 * @property {boolean} [isUiVisible=true] - Current visibility state of the main UI, used to determine the icon for the UI toggle button and apply conditional styling.
 */

/**
 * TopRightControls component renders a set of control icons positioned at the top-right
 * of the screen. It includes buttons for toggling fullscreen/enhanced view,
 * managing whitelisted collections (conditionally shown to admins), accessing an
 * information overlay, and toggling the main UI visibility.
 *
 * @param {TopRightControlsProps} props - The component's props.
 * @returns {JSX.Element | null} The rendered TopRightControls component, or null if it shouldn't be visible (though current logic always renders the container).
 */
const TopRightControls = ({
  showWhitelist = false,
  isProjectAdminForWhitelist = false,
  showInfo = true,
  showToggleUI = true,
  showEnhancedView = true,
  onWhitelistClick,
  onInfoClick,
  onToggleUI,
  onEnhancedView,
  isUiVisible = true,
}) => {
  // The main container's visibility is handled by its parent or CSS based on `isUiVisible` for its children.
  // The `ui-hidden` class on the container itself might be redundant if children are conditionally rendered
  // or also styled based on `isUiVisible`. For this refactor, keeping existing class logic.
  return (
    <div className={`top-right-controls-container ${!isUiVisible ? "ui-hidden" : ""}`}>
      {/* Enhanced View / Fullscreen Toggle Button */}
      {showEnhancedView && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onEnhancedView}
          title="Toggle Fullscreen"
          aria-label="Toggle Fullscreen" // Accessibility: Provide an accessible name
        >
          <img
            src={enlargeIcon}
            alt="Toggle Fullscreen" // Alt text for accessibility
            className="enhanced-view-icon icon-image"
          />
        </button>
      )}

      {/* Whitelist Management Button: Conditionally rendered */}
      {showWhitelist && isProjectAdminForWhitelist && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onWhitelistClick}
          title="Manage Whitelisted Collections"
          aria-label="Manage Whitelisted Collections"
        >
          <img
            src={whitelistIcon}
            alt="Manage Collections"
            className="icon-image"
          />
        </button>
      )}

      {/* Information Overlay Button */}
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

      {/* UI Visibility Toggle Button */}
      {showToggleUI && (
        <button
          // `fixed-toggle-button` suggests it might always be visible regardless of `isUiVisible` for other elements.
          // `show-ui-btn` class is applied when UI is hidden, potentially making this button more prominent.
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

// Default export is fine for components.
export default TopRightControls;