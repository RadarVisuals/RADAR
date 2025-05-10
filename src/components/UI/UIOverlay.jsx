// src/components/UI/UIOverlay.jsx
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

import TopRightControls from '../Toolbars/TopRightControls';
import VerticalToolbar from '../Toolbars/VerticalToolbar';
import PanelWrapper from '../Panels/PanelWrapper';
import EnhancedControlPanel from '../Panels/EnhancedControlPanel';
import NotificationPanel from '../Panels/NotificationPanel';
import EventsPanel from '../Panels/EventsPanel';
import EnhancedSavePanel from '../Panels/EnhancedSavePanel';
import AudioControlPanel from '../Audio/AudioControlPanel';
import TokenSelectorOverlay from '../Panels/TokenSelectorOverlay';
import InfoOverlay from '../Panels/InfoOverlay';
// WhitelistCollectionsPanel import is removed as it's no longer rendered here directly
// import WhitelistCollectionsPanel from '../Panels/WhitelistCollectionsPanel';
import GlobalMIDIStatus from '../MIDI/GlobalMIDIStatus';
import AudioStatusIcon from '../Audio/AudioStatusIcon';
import PresetSelectorBar from './PresetSelectorBar';

// Note: useVisualLayerState is not directly consumed here, as layerConfigs
// is expected to be part of the configData prop passed from MainView.

const MemoizedTopRightControls = React.memo(TopRightControls);
const MemoizedVerticalToolbar = React.memo(VerticalToolbar);
const MemoizedGlobalMIDIStatus = React.memo(GlobalMIDIStatus);
const MemoizedAudioStatusIcon = React.memo(AudioStatusIcon);
const MemoizedPresetSelectorBar = React.memo(PresetSelectorBar);

/**
 * @typedef {object} UIStatePropTypes
 * @property {string|null} activePanel - Identifier of the currently active panel (e.g., 'controls', 'notifications').
 * @property {string|null} animatingPanel - Identifier of the panel currently undergoing an open/close animation.
 * @property {string} activeLayerTab - Identifier of the active layer control tab (e.g., 'tab1', 'tab2', 'tab3').
 * @property {boolean} infoOverlayOpen - Whether the informational overlay is currently open.
 * @property {boolean} whitelistPanelOpen - Whether the whitelist management panel is currently open (though its rendering is commented out).
 * @property {() => void} closePanel - Function to close the currently active side panel.
 * @property {(tabId: string) => void} setActiveLayerTab - Function to set the active layer control tab.
 * @property {() => void} toggleInfoOverlay - Function to toggle the visibility of the informational overlay.
 * @property {() => void} toggleWhitelistPanel - Function to toggle the visibility of the whitelist panel.
 * @property {(panelName: string) => void} openPanel - Function to open a specific side panel by its identifier.
 * @property {() => void} toggleUiVisibility - Function to toggle the visibility of the main UI elements.
 * @property {boolean} isUiVisible - Whether the main UI elements (toolbars, panels) are currently visible.
 */

/**
 * @typedef {object} AudioStatePropTypes
 * @property {boolean} isAudioActive - Whether audio reactivity is active.
 * @property {object} audioSettings - Current settings for audio reactivity (e.g., intensity, smoothing).
 * @property {object} analyzerData - Data from the audio analyzer (e.g., level, frequencyBands).
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setIsAudioActive - Function to set the audio reactivity state.
 * @property {React.Dispatch<React.SetStateAction<object>>} setAudioSettings - Function to set audio reactivity settings.
 */

/**
 * @typedef {object} ConfigDataPropTypes
 * @property {object} layerConfigs - Configurations for visual layers. Sourced from `VisualConfigContext` via `MainView`.
 * @property {Array<string>} blendModes - Array of available blend mode strings.
 * @property {Array<object>} notifications - Array of notification objects.
 * @property {number} unreadCount - Number of unread notifications.
 * @property {object} savedReactions - Saved event reactions configurations for the host profile.
 * @property {boolean} canSave - Whether the current user has permissions to save configurations to the host profile.
 * @property {boolean} isPreviewMode - Whether the application is in a special preview/demo mode.
 * @property {boolean} isParentAdmin - Whether the current visitor is the RADAR project admin.
 * @property {Array<{name: string}>} savedConfigList - List of saved visual presets for the host profile.
 * @property {string|null} currentConfigName - Name of the currently loaded visual preset on the host profile.
 * @property {boolean} isTransitioning - Whether a preset transition is currently in progress.
 */

/**
 * @typedef {object} ActionsPropTypes
 * @property {() => void} onEnhancedView - Callback for toggling fullscreen/enhanced view.
 * @property {(layerId: string | number, key: string, value: any) => void} onLayerConfigChange - Callback for layer configuration changes, originates from `VisualConfigContext`.
 * @property {(id: string | number) => void} onMarkNotificationRead - Callback to mark a notification as read.
 * @property {() => void} onClearAllNotifications - Callback to clear all notifications.
 * @property {(eventType: string, reactionData: object) => void} onSaveReaction - Callback to save an event reaction.
 * @property {(eventType: string) => void} onRemoveReaction - Callback to remove an event reaction (currently unused in EventsPanel).
 * @property {(effectConfig: object) => Promise<string | null>} onPreviewEffect - Callback to preview a visual effect.
 * @property {(tokenId: string | object | null, layerId: string | number) => void} onTokenApplied - Callback when a token is applied to a layer. This will update `VisualConfigContext`.
 * @property {(presetName: string) => void} onPresetSelect - Callback when a preset is selected from the preset bar.
 */

/**
 * Renders the active panel based on the UI state.
 * This component acts as a router for displaying the correct panel.
 * @param {object} props
 * @param {UIStatePropTypes} props.uiState - Current UI state.
 * @param {AudioStatePropTypes} props.audioState - Current audio state.
 * @param {ConfigDataPropTypes} props.configData - Current configuration data.
 * @param {ActionsPropTypes} props.actions - Action callbacks.
 * @returns {JSX.Element | null} The rendered active panel or null.
 */
const ActivePanelRenderer = ({ uiState, audioState, configData, actions }) => {
    const { activePanel, animatingPanel, activeLayerTab, closePanel, setActiveLayerTab } = uiState;
    const { isAudioActive, audioSettings, analyzerData, setIsAudioActive, setAudioSettings } = audioState;
    // layerConfigs is part of configData, passed down from MainView, ultimately from VisualConfigContext
    const { blendModes, notifications, savedReactions, canSave, isPreviewMode } = configData;
    
    const { onLayerConfigChange, onMarkNotificationRead, onClearAllNotifications, onSaveReaction, onPreviewEffect, onTokenApplied } = actions;

    const handleTokenSelectorClose = useCallback(() => {
        closePanel();
    }, [closePanel]);

    switch (activePanel) {
        case "controls":
            return (
                <PanelWrapper key="controls-panel" className={animatingPanel ? "animating" : ""}>
                    <EnhancedControlPanel
                        onLayerConfigChange={onLayerConfigChange} // Propagated from MainView
                        blendModes={blendModes}
                        onToggleMinimize={closePanel}
                        activeTab={activeLayerTab}
                        onTabChange={setActiveLayerTab}
                        // readOnly is derived inside EnhancedControlPanel
                    />
                </PanelWrapper>
            );
        case "notifications":
            return (
                <PanelWrapper key="notifications-panel" className={animatingPanel ? "animating" : ""}>
                    <NotificationPanel
                        notifications={notifications}
                        onClose={closePanel}
                        onMarkAsRead={onMarkNotificationRead}
                        onClearAll={onClearAllNotifications}
                    />
                </PanelWrapper>
            );
        case "events":
            return !isPreviewMode ? (
                <PanelWrapper key="events-panel" className={animatingPanel ? "animating" : ""}>
                    <EventsPanel
                        onSaveReaction={onSaveReaction}
                        reactions={savedReactions}
                        onClose={closePanel}
                        readOnly={!canSave}
                        onPreviewEffect={onPreviewEffect}
                    />
                </PanelWrapper>
            ) : null;
        case "save":
            return !isPreviewMode ? (
                <PanelWrapper key="save-panel" className={animatingPanel ? "animating" : ""}>
                    <EnhancedSavePanel onClose={closePanel} />
                </PanelWrapper>
            ) : null;
        case "audio":
            return (
                <PanelWrapper key="audio-panel" className={animatingPanel ? "animating" : ""}>
                    <AudioControlPanel
                        onClose={closePanel}
                        isAudioActive={isAudioActive}
                        setIsAudioActive={setIsAudioActive}
                        audioSettings={audioSettings}
                        setAudioSettings={setAudioSettings}
                        analyzerData={analyzerData}
                    />
                </PanelWrapper>
            );
        case "tokens":
            return !isPreviewMode ? (
                <TokenSelectorOverlay
                    key="token-selector-overlay"
                    isOpen={activePanel === "tokens"}
                    onClose={handleTokenSelectorClose}
                    onTokenApplied={onTokenApplied} // Propagated from MainView
                    readOnly={!canSave}
                />
            ) : null;
        default:
            return null;
    }
};
ActivePanelRenderer.propTypes = {
    uiState: PropTypes.object.isRequired, // Should be UIStatePropTypes
    audioState: PropTypes.object.isRequired, // Should be AudioStatePropTypes
    configData: PropTypes.object.isRequired, // Should be ConfigDataPropTypes
    actions: PropTypes.object.isRequired, // Should be ActionsPropTypes
};


/**
 * Renders modal-like overlays (Info). The Whitelist panel rendering is currently commented out.
 * @param {object} props
 * @param {UIStatePropTypes} props.uiState - Current UI state.
 * @param {ConfigDataPropTypes} props.configData - Current configuration data (specifically for isParentAdmin if WhitelistPanel were active).
 * @returns {JSX.Element} The rendered overlays.
 */
const OverlayRenderer = ({ uiState, configData }) => {
    const { infoOverlayOpen, whitelistPanelOpen, toggleInfoOverlay, toggleWhitelistPanel } = uiState;
    const { isParentAdmin } = configData; // isParentAdmin from configData is isRadarProjectAdmin

    return (
        <>
            {infoOverlayOpen && (
                <InfoOverlay isOpen={infoOverlayOpen} onClose={toggleInfoOverlay} />
            )}
            {/* Whitelist panel rendering is currently commented out as per instructions.
                When active, it would be:
            {whitelistPanelOpen && isParentAdmin && (
                <WhitelistCollectionsPanel isOpen={whitelistPanelOpen} onClose={toggleWhitelistPanel} />
            )}
            */}
        </>
    );
};
OverlayRenderer.propTypes = {
    uiState: PropTypes.object.isRequired, // Should be UIStatePropTypes
    configData: PropTypes.object.isRequired, // Should be ConfigDataPropTypes
};

/**
 * UIOverlay component orchestrates the display of all UI elements including toolbars,
 * panels, and overlays based on the application state. It acts as a central hub for UI logic.
 *
 * @param {object} props - The component's props.
 * @param {boolean} props.shouldShowUI - Whether the UI should be rendered at all (e.g., after initial load and if not hidden by user).
 * @param {UIStatePropTypes} props.uiState - The current state of the UI (active panels, visibility, etc.).
 * @param {AudioStatePropTypes} props.audioState - The current state of audio processing and reactivity.
 * @param {ConfigDataPropTypes} props.configData - The current configuration data for the host profile (visuals, presets, session info).
 * @param {ActionsPropTypes} props.actions - Action callbacks for UI interactions (e.g., saving, loading, updating configs).
 * @returns {JSX.Element} The rendered UI overlay container with all its child UI elements.
 */
function UIOverlay(props) {
  const {
    shouldShowUI,
    uiState,
    audioState,
    configData,
    actions,
  } = props;

  const {
    isUiVisible, activePanel, openPanel, toggleInfoOverlay,
    toggleWhitelistPanel, toggleUiVisibility
  } = uiState;
  const { isAudioActive } = audioState;
  const {
    isParentAdmin, // This is isRadarProjectAdmin, used for TopRightControls
    isPreviewMode, unreadCount,
    savedConfigList, currentConfigName, isTransitioning
    // layerConfigs is part of configData, passed to ActivePanelRenderer if needed by a panel
  } = configData;
  const { onEnhancedView, onPresetSelect } = actions;

  const showPresetBar = useMemo(() => shouldShowUI && isUiVisible && !activePanel, [shouldShowUI, isUiVisible, activePanel]);
  const mainUiContainerClass = `ui-elements-container ${shouldShowUI && isUiVisible ? "visible" : "hidden-by-opacity"}`;

  return (
    <>
      {shouldShowUI && (
        <MemoizedTopRightControls
          showWhitelist={false} // Whitelist button remains hidden as per current instructions
          isProjectAdminForWhitelist={isParentAdmin} // Pass the admin status for potential future use
          showInfo={true}
          showToggleUI={true}
          showEnhancedView={true}
          onWhitelistClick={toggleWhitelistPanel} // Prop still passed
          onInfoClick={toggleInfoOverlay}
          onToggleUI={toggleUiVisibility}
          onEnhancedView={onEnhancedView}
          isUiVisible={isUiVisible}
        />
      )}
      <div className={mainUiContainerClass}>
        {shouldShowUI && isUiVisible && (
          <>
            <div className="bottom-right-icons">
              <MemoizedAudioStatusIcon isActive={isAudioActive} onClick={() => openPanel('audio')} />
              <MemoizedGlobalMIDIStatus />
            </div>
            {isPreviewMode && (
              <div className="preview-mode-indicator">
                <span>👁️</span> Preview Mode
              </div>
            )}
            <MemoizedVerticalToolbar
              activePanel={activePanel}
              setActivePanel={openPanel}
              notificationCount={unreadCount}
            />
            <ActivePanelRenderer
                uiState={uiState}
                audioState={audioState}
                configData={configData} // configData (including layerConfigs) is passed through
                actions={actions}        // actions (including onLayerConfigChange) is passed through
            />
            {showPresetBar && (
              <MemoizedPresetSelectorBar
                savedConfigList={savedConfigList}
                currentConfigName={currentConfigName}
                onPresetSelect={onPresetSelect}
                isLoading={isTransitioning}
              />
            )}
          </>
        )}
      </div>
      {shouldShowUI && (
        <OverlayRenderer uiState={uiState} configData={configData} />
      )}
    </>
  );
}

UIOverlay.propTypes = {
  shouldShowUI: PropTypes.bool.isRequired,
  uiState: PropTypes.object.isRequired, // Ideally: PropTypes.shape(UIStatePropTypes)
  audioState: PropTypes.object.isRequired, // Ideally: PropTypes.shape(AudioStatePropTypes)
  configData: PropTypes.object.isRequired, // Ideally: PropTypes.shape(ConfigDataPropTypes)
  actions: PropTypes.object.isRequired, // Ideally: PropTypes.shape(ActionsPropTypes)
};

export default UIOverlay;