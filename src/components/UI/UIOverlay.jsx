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
import GlobalMIDIStatus from '../MIDI/GlobalMIDIStatus';
import AudioStatusIcon from '../Audio/AudioStatusIcon';
import PresetSelectorBar from './PresetSelectorBar';

const MemoizedTopRightControls = React.memo(TopRightControls);
const MemoizedVerticalToolbar = React.memo(VerticalToolbar);
const MemoizedGlobalMIDIStatus = React.memo(GlobalMIDIStatus);
const MemoizedAudioStatusIcon = React.memo(AudioStatusIcon);

/**
 * @typedef {object} UIStatePropTypes
 * @property {string|null} activePanel - Identifier of the currently active panel.
 * @property {string|null} animatingPanel - Identifier of the panel currently animating.
 * @property {string} activeLayerTab - Identifier of the active layer control tab.
 * @property {boolean} infoOverlayOpen - Whether the info overlay is open.
 * @property {boolean} whitelistPanelOpen - Whether the whitelist panel is open.
 * @property {() => void} closePanel - Function to close the active panel.
 * @property {(tabId: string) => void} setActiveLayerTab - Function to set the active layer tab.
 * @property {() => void} toggleInfoOverlay - Function to toggle the info overlay.
 * @property {() => void} toggleWhitelistPanel - Function to toggle the whitelist panel.
 * @property {(panelName: string) => void} openPanel - Function to open a panel.
 * @property {() => void} toggleUiVisibility - Function to toggle overall UI visibility.
 * @property {boolean} isUiVisible - Whether the main UI elements are visible.
 */

/**
 * @typedef {object} AudioStatePropTypes
 * @property {boolean} isAudioActive - Whether audio reactivity is active.
 * @property {object} audioSettings - Current settings for audio reactivity.
 * @property {object} analyzerData - Data from the audio analyzer.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setIsAudioActive - Function to set audio reactivity state.
 * @property {React.Dispatch<React.SetStateAction<object>>} setAudioSettings - Function to set audio settings.
 */

/**
 * @typedef {object} ConfigDataPropTypes
 * @property {object} layerConfigs - Configurations for visual layers.
 * @property {Array<string>} blendModes - Available blend modes.
 * @property {Array<object>} notifications - Array of notification objects.
 * @property {number} unreadCount - Number of unread notifications.
 * @property {object} savedReactions - Saved event reactions.
 * @property {boolean} canSave - Whether the user can save configurations.
 * @property {boolean} isPreviewMode - Whether the app is in preview mode.
 * @property {boolean} isParentAdmin - Whether the current user is the project admin (isRadarProjectAdmin).
 * @property {string|null} currentConfigName - Name of the current visual preset.
 * @property {boolean} isTransitioning - Whether a preset transition is in progress.
 * @property {boolean} isBaseReady - Whether base components are ready.
 * @property {string} renderState - Current rendering lifecycle state.
 */

/**
 * @typedef {object} ActionsPropTypes
 * @property {() => void} onEnhancedView - Callback for toggling fullscreen/enhanced view.
 * @property {(layerId: string | number, key: string, value: any) => void} onLayerConfigChange - Callback for layer configuration changes.
 * @property {(id: string | number) => void} onMarkNotificationRead - Callback to mark a notification as read.
 * @property {() => void} onClearAllNotifications - Callback to clear all notifications.
 * @property {(eventType: string, reactionData: object) => void} onSaveReaction - Callback to save an event reaction.
 * @property {(eventType: string) => void} onRemoveReaction - Callback to remove an event reaction.
 * @property {(effectConfig: object) => Promise<string | null>} onPreviewEffect - Callback to preview a visual effect.
 * @property {(tokenId: string | object | null, layerId: string | number) => void} onTokenApplied - Callback when a token is applied to a layer.
 * @property {(presetName: string) => void} onPresetSelect - Callback when a preset is selected.
 */

/**
 * Renders the currently active panel based on UI state.
 * @param {object} props - Component props.
 * @param {UIStatePropTypes} props.uiState - Current UI state.
 * @param {AudioStatePropTypes} props.audioState - Current audio state.
 * @param {ConfigDataPropTypes} props.configData - Current configuration data.
 * @param {ActionsPropTypes} props.actions - Action callbacks.
 * @returns {JSX.Element|null} The rendered active panel or null.
 */
const ActivePanelRenderer = ({ uiState, audioState, configData, actions }) => {
    const { activePanel, animatingPanel, activeLayerTab, closePanel, setActiveLayerTab } = uiState;
    const { isAudioActive, audioSettings, analyzerData, setIsAudioActive, setAudioSettings } = audioState;
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
                        onLayerConfigChange={onLayerConfigChange}
                        blendModes={blendModes}
                        onToggleMinimize={closePanel}
                        activeTab={activeLayerTab}
                        onTabChange={setActiveLayerTab}
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
                    onTokenApplied={onTokenApplied}
                    readOnly={!canSave}
                />
            ) : null;
        default:
            return null;
    }
};
ActivePanelRenderer.propTypes = {
    uiState: PropTypes.object.isRequired,
    audioState: PropTypes.object.isRequired,
    configData: PropTypes.object.isRequired,
    actions: PropTypes.object.isRequired,
};

/**
 * Renders overlays like the InfoOverlay.
 * @param {object} props - Component props.
 * @param {UIStatePropTypes} props.uiState - Current UI state.
 * @returns {JSX.Element} The rendered overlays.
 */
const OverlayRenderer = ({ uiState }) => {
    const { infoOverlayOpen, toggleInfoOverlay } = uiState;
    return (
        <>
            {infoOverlayOpen && (
                <InfoOverlay isOpen={infoOverlayOpen} onClose={toggleInfoOverlay} />
            )}
        </>
    );
};
OverlayRenderer.propTypes = {
    uiState: PropTypes.object.isRequired,
};

/**
 * UIOverlay is a top-level component responsible for rendering the entire user interface
 * layer of the application. It orchestrates the display of various UI elements including
 * toolbars (TopRightControls, VerticalToolbar), side panels (EnhancedControlPanel,
 * NotificationPanel, etc.), modal-like overlays (TokenSelectorOverlay, InfoOverlay),
 * and status indicators (GlobalMIDIStatus, AudioStatusIcon, PresetSelectorBar).
 *
 * The visibility and content of these elements are determined by the `uiState`,
 * `audioState`, and `configData` props, which are typically derived from context
 * providers higher up in the component tree. Action callbacks are passed via the
 * `actions` prop to handle user interactions.
 *
 * @param {object} props - Component props.
 * @param {UIStatePropTypes} props.uiState - Current UI state, managing panel visibility, active tabs, etc.
 * @param {AudioStatePropTypes} props.audioState - Current audio state, managing audio reactivity.
 * @param {ConfigDataPropTypes} props.configData - Current configuration data, including layer settings, notifications, user permissions.
 * @param {ActionsPropTypes} props.actions - Collection of callback functions for user interactions.
 * @param {Array} props.passedSavedConfigList - List of saved configurations to be displayed in the PresetSelectorBar.
 * @returns {JSX.Element} The rendered UI overlay structure.
 */
function UIOverlay(props) {
  const {
    uiState,
    audioState,
    configData,
    actions,
    passedSavedConfigList,
  } = props;

  const {
    isUiVisible, activePanel, openPanel, toggleInfoOverlay,
    toggleWhitelistPanel, toggleUiVisibility
  } = uiState;
  const { isAudioActive } = audioState;
  const {
    isParentAdmin,
    isPreviewMode, unreadCount,
    currentConfigName,
    isTransitioning,
    isBaseReady,
    renderState,
  } = configData;
  const { onEnhancedView, onPresetSelect } = actions;

  const actualShouldShowUI = useMemo(() => {
    return isBaseReady || renderState === 'prompt_connect';
  } , [isBaseReady, renderState]);

  const showPresetBar = useMemo(() => {
    return actualShouldShowUI && isUiVisible && !activePanel;
  }, [actualShouldShowUI, isUiVisible, activePanel]);

  const mainUiContainerClass = `ui-elements-container ${actualShouldShowUI && isUiVisible ? "visible" : "hidden-by-opacity"}`;

  return (
    <>
      {actualShouldShowUI && (
        <MemoizedTopRightControls
          showWhitelist={false}
          isProjectAdminForWhitelist={isParentAdmin}
          showInfo={true}
          showToggleUI={true}
          showEnhancedView={true}
          onWhitelistClick={toggleWhitelistPanel}
          onInfoClick={toggleInfoOverlay}
          onToggleUI={toggleUiVisibility}
          onEnhancedView={onEnhancedView}
          isUiVisible={isUiVisible}
        />
      )}
      <div className={mainUiContainerClass}>
        {actualShouldShowUI && isUiVisible && (
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
                configData={configData}
                actions={actions}
            />
            {showPresetBar && (
              <PresetSelectorBar
                savedConfigList={passedSavedConfigList}
                currentConfigName={currentConfigName}
                onPresetSelect={onPresetSelect}
                isLoading={isTransitioning}
              />
            )}
          </>
        )}
      </div>
      {actualShouldShowUI && (
        <OverlayRenderer uiState={uiState} />
      )}
    </>
  );
}

UIOverlay.propTypes = {
  uiState: PropTypes.object.isRequired,
  audioState: PropTypes.object.isRequired,
  configData: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
  passedSavedConfigList: PropTypes.array,
};

UIOverlay.defaultProps = {
  passedSavedConfigList: [],
};

export default UIOverlay;