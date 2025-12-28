// src/components/Toolbars/TopRightControls.jsx
import React from "react";
import PropTypes from "prop-types";
import { RocketLaunchIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

import "./ToolbarStyles/TopRightControls.css";
import {
  whitelistIcon,
  enlargeIcon,
  learnIcon,
  eyeIcon,
  eyeopenIcon,
  parallaxIcon,
} from "../../assets";

const TopRightControls = ({
  isHostProfileOwner = false,
  onWhitelistClick,
  showInfo = true,
  showToggleUI = true,
  showEnhancedView = true,
  onInfoClick,
  onToggleUI,
  onEnhancedView,
  isUiVisible = true,
  isParallaxEnabled,
  onToggleParallax,
  transitionMode,
  onToggleTransitionMode
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

      {isHostProfileOwner && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onWhitelistClick}
          title="Manage Collections Library"
          aria-label="Manage Collections Library"
        >
          <img
            src={whitelistIcon}
            alt="Manage Collections"
            className="icon-image"
          />
        </button>
      )}

      {isUiVisible && (
        <button
          className={`toolbar-icon ${isParallaxEnabled ? "active" : ""}`}
          onClick={onToggleParallax}
          title={isParallaxEnabled ? "Disable Parallax Effect" : "Enable Parallax Effect"}
          aria-label={isParallaxEnabled ? "Disable Parallax Effect" : "Enable Parallax Effect"}
        >
          <img
            src={parallaxIcon}
            alt="Toggle Parallax"
            className="icon-image"
          />
        </button>
      )}

      {isUiVisible && onToggleTransitionMode && (
        <button
          className={`toolbar-icon transition-mode-btn ${transitionMode === 'flythrough' ? "active" : ""}`}
          onClick={onToggleTransitionMode}
          title={transitionMode === 'flythrough' ? "Hyperdrift Mode" : "Interpolate Mode"}
          aria-label={transitionMode === 'flythrough' ? "Switch to Interpolate Mode" : "Switch to Hyperdrift Mode"}
        >
          {transitionMode === 'flythrough' ? (
            <RocketLaunchIcon className="icon-image" style={{ padding: '3px' }} />
          ) : (
            <ArrowsRightLeftIcon className="icon-image" style={{ padding: '3px' }} />
          )}
        </button>
      )}

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
  isHostProfileOwner: PropTypes.bool,
  onWhitelistClick: PropTypes.func,
  showInfo: PropTypes.bool,
  showToggleUI: PropTypes.bool,
  showEnhancedView: PropTypes.bool,
  onInfoClick: PropTypes.func,
  onToggleUI: PropTypes.func,
  onEnhancedView: PropTypes.func,
  isUiVisible: PropTypes.bool,
  isParallaxEnabled: PropTypes.bool,
  onToggleParallax: PropTypes.func,
  transitionMode: PropTypes.string,
  onToggleTransitionMode: PropTypes.func,
};

export default TopRightControls;