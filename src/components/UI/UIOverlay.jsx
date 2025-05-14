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

import { useProfileSessionState } from '../../hooks/configSelectors'; // Local hook

// Memoized components for performance optimization
const MemoizedTopRightControls = React.memo(TopRightControls);
const MemoizedVerticalToolbar = React.memo(VerticalToolbar);
const MemoizedGlobalMIDIStatus = React.memo(GlobalMIDIStatus);
const MemoizedAudioStatusIcon = React.memo(AudioStatusIcon);
const MemoizedPresetSelectorBar = React.memo(PresetSelectorBar);

/**
 * @typedef {object} UIStatePropTypes
 * @property {string|null} activePanel - Identifier of the currently active panel (e.g., 'controls', 'notifications').
 * @property {string|null} animatingPanel - Identifier of the panel currently undergoing an open/close animation (e.g., 'controls', 'closing').
 * @property {string} activeLayerTab - Identifier of the active layer control tab (e.g., 'tab1', 'tab2', 'tab3').
 * @property {boolean} infoOverlayOpen - Whether the informational overlay is currently open.
 * @property {boolean} whitelistPanelOpen - Whether the whitelist management panel is currently open (functionality might be conditional).
 * @property {() => void} closePanel - Function to close the currently active side panel.
 * @property {(tabId: string) => void} setActiveLayerTab - Function to set the active layer control tab.
 * @property {() => void} toggleInfoOverlay - Function to toggle the visibility of the informational overlay.
 * @property {() => void} toggleWhitelistPanel - Function to toggle the visibility of the whitelist panel.
 * @property {(panelName: string) => void} openPanel - Function to open a specific side panel by its identifier.
 * @property {() => void} toggleUiVisibility - Function to toggle the visibility of the main UI elements.
 * @property {boolean} isUiVisible - Whether the main UI elements (toolbars, panels) are currently set to be visible.
 */

/**
 * @typedef {object} AudioStatePropTypes
 * @property {boolean} isAudioActive - Whether audio reactivity is currently active.
 * @property {object} audioSettings - Current settings for audio reactivity (structure depends on `useAudioVisualizer`).
 * @property {object} analyzerData - Data from the audio analyzer (structure depends on `useAudioVisualizer`).
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setIsAudioActive - Function to set the audio reactivity state.
 * @property {React.Dispatch<React.SetStateAction<object>>} setAudioSettings - Function to set audio reactivity settings.
 */

/**
 * @typedef {object} ConfigDataPropTypes
 * @property {object} layerConfigs - Configurations for visual layers (structure depends on `VisualConfigContext`).
 * @property {Array<string>} blendModes - Array of available blend mode strings.
 * @property {Array<object>} notifications - Array of notification objects (structure depends on `useNotifications`).
 * @property {number} unreadCount - Number of unread notifications.
 * @property {object} savedReactions - Saved event reactions (structure depends on `ConfigContext`).
 * @property {boolean} canSave - Whether the current user has permissions to save configurations.
 * @property {boolean} isPreviewMode - Whether the application is currently in preview mode.
 * @property {boolean} isParentAdmin - Whether the current user is the project admin (derived from `isRadarProjectAdmin`).
 * @property {string|null} currentConfigName - Name of the currently loaded visual preset.
 * @property {boolean} isTransitioning - Whether a preset transition (e.g., fade in/out) is currently in progress.
 * @property {boolean} isBaseReady - Whether base components and initial data are considered ready for UI display.
 * @property {string} renderState - Current state of the rendering lifecycle (e.g., 'rendered', 'loading_defaults').
 * @property {boolean} canInteract - Whether the user can interact with UI elements (e.g., not in preview, profile loaded).
 * @property {string|null} currentProfileAddress - The address of the Universal Profile currently being viewed.
 */

/**
 * @typedef {object} ActionsPropTypes
 * @property {() => void} onEnhancedView - Callback function for toggling fullscreen or an enhanced view mode.
 * @property {(layerId: string | number, key: string, value: any) => void} onLayerConfigChange - Callback for when a layer's configuration property changes.
 * @property {(id: string | number) => void} onMarkNotificationRead - Callback to mark a specific notification as read.
 * @property {() => void} onClearAllNotifications - Callback to clear all notifications.
 * @property {(eventType: string, reactionData: object) => void} onSaveReaction - Callback to save an event reaction configuration.
 * @property {(eventType: string) => void} onRemoveReaction - Callback to remove an event reaction configuration.
 * @property {(effectConfig: object) => Promise<string | null>} onPreviewEffect - Callback to preview a visual effect.
 * @property {(tokenId: string | object | null, layerId: string | number) => void} onTokenApplied - Callback invoked when a token is applied to a layer.
 * @property {(presetName: string) => void} onPresetSelect - Callback invoked when a preset is selected from the selector.
 */

// --- General Connect Pill Component ---
/**
 * A simple component that displays a message prompting the user to connect
 * their Universal Profile if they haven't already.
 * @returns {JSX.Element | null} The connect pill component or null if visitor is connected.
 */
const GeneralConnectPill = () => {
  const { visitorUPAddress } = useProfileSessionState();
  // Only show if the visitor is not connected (i.e., no visitorUPAddress)
  if (visitorUPAddress) return null;

  return (
    <div className="general-connect-pill">
      Create or connect a Universal Profile to save configurations, use your own tokens, and access all features.
    </div>
  );
};
// --- End General Connect Pill Component ---


/**
 * Renders the currently active panel based on `uiState.activePanel`.
 * This component acts as a switch for displaying different panel contents.
 * @param {object} props - Component props.
 * @param {UIStatePropTypes} props.uiState - Current UI state.
 * @param {AudioStatePropTypes} props.audioState - Current audio state.
 * @param {ConfigDataPropTypes} props.configData - Current configuration data.
 * @param {ActionsPropTypes} props.actions - Action callbacks.
 * @returns {JSX.Element | null} The rendered active panel or null.
 */
const ActivePanelRenderer = ({ uiState, audioState, configData, actions }) => {
    const { activePanel, animatingPanel, activeLayerTab, closePanel, setActiveLayerTab } = uiState;
    const { isAudioActive, audioSettings, analyzerData, setIsAudioActive, setAudioSettings } = audioState;
    const { blendModes, notifications, savedReactions, canSave, isPreviewMode, canInteract, currentProfileAddress } = configData;
    const { onLayerConfigChange, onMarkNotificationRead, onClearAllNotifications, onSaveReaction, onRemoveReaction, onPreviewEffect, onTokenApplied } = actions;

    const handleTokenSelectorClose = useCallback(() => {
        closePanel(); // From uiState
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
            return canInteract ? ( // Only render if user can interact
                <PanelWrapper key="events-panel" className={animatingPanel ? "animating" : ""}>
                    <EventsPanel
                        onSaveReaction={onSaveReaction}
                        onRemoveReaction={onRemoveReaction} // Added missing prop
                        reactions={savedReactions}
                        onClose={closePanel}
                        readOnly={!canSave} // Based on ability to save to host profile
                        onPreviewEffect={onPreviewEffect}
                    />
                </PanelWrapper>
            ) : null;
        case "save":
            // Show save panel only if there's a profile and not in preview mode
            return currentProfileAddress && !isPreviewMode ? (
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
            return canInteract ? ( // Only render if user can interact
                <TokenSelectorOverlay
                    key="token-selector-overlay"
                    isOpen={activePanel === "tokens"} // Controlled by activePanel state
                    onClose={handleTokenSelectorClose}
                    onTokenApplied={onTokenApplied}
                    readOnly={!canInteract} // UI interaction capability
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
const MemoizedActivePanelRenderer = React.memo(ActivePanelRenderer);


/**
 * Renders overlays like the InfoOverlay.
 * @param {object} props - Component props.
 * @param {UIStatePropTypes} props.uiState - Current UI state.
 * @returns {JSX.Element} The rendered overlays.
 */
const OverlayRenderer = ({ uiState }) => {
    const { infoOverlayOpen, toggleInfoOverlay /*, whitelistPanelOpen, toggleWhitelistPanel */ } = uiState;
    // Whitelist panel logic can be added here if it's a similar full-screen overlay
    return (
        <>
            {infoOverlayOpen && (
                <InfoOverlay isOpen={infoOverlayOpen} onClose={toggleInfoOverlay} />
            )}
            {/* Example for WhitelistOverlay if it were similar:
            {whitelistPanelOpen && (
                <WhitelistOverlay isOpen={whitelistPanelOpen} onClose={toggleWhitelistPanel} />
            )}
            */}
        </>
    );
};
OverlayRenderer.propTypes = {
    uiState: PropTypes.object.isRequired,
};
const MemoizedOverlayRenderer = React.memo(OverlayRenderer);


/**
 * UIOverlay: The main component responsible for rendering all primary UI elements,
 * including toolbars, panels, status indicators, and overlays. It orchestrates
 * the visibility and interaction of these elements based on the application state.
 *
 * @param {object} props - Component props.
 * @param {UIStatePropTypes} props.uiState - Current state of various UI elements.
 * @param {AudioStatePropTypes} props.audioState - Current state related to audio processing.
 * @param {ConfigDataPropTypes} props.configData - General configuration data and application status.
 * @param {ActionsPropTypes} props.actions - Collection of callback functions for UI interactions.
 * @param {Array<object>} [props.passedSavedConfigList=[]] - List of saved presets, passed down to `PresetSelectorBar`.
 * @returns {JSX.Element} The rendered UI overlay.
 */
function UIOverlay(props) {
  const {
    uiState,
    audioState,
    configData: propConfigData, // Renamed to avoid conflict with internal configData
    actions,
    passedSavedConfigList,
  } = props;

  // Integrate session-specific interaction capabilities
  const { canInteract: sessionCanInteract, currentProfileAddress: sessionCurrentProfileAddress, visitorUPAddress } = useProfileSessionState();

  // Memoize the configData prop enhanced with session interaction state
  const configData = useMemo(() => ({
    ...propConfigData,
    canInteract: sessionCanInteract, // Override/set canInteract from session
    currentProfileAddress: sessionCurrentProfileAddress, // Override/set currentProfileAddress from session
  }), [propConfigData, sessionCanInteract, sessionCurrentProfileAddress]);


  const {
    isUiVisible,
    activePanel,
    openPanel, // From uiState, used by child components
    toggleInfoOverlay,
    toggleWhitelistPanel,
    toggleUiVisibility
  } = uiState;

  const { isAudioActive } = audioState;
  const {
    isParentAdmin,
    isPreviewMode,
    unreadCount,
    currentConfigName,
    isTransitioning,
    isBaseReady,
    renderState,
    // canInteract and currentProfileAddress are now sourced from the memoized configData above
  } = configData;
  const { onEnhancedView, onPresetSelect } = actions;

  // Determine if the core UI should be shown (e.g., after initial loading/connection)
  const actualShouldShowUI = useMemo(() => {
    // Example condition: UI is ready when base components are ready OR in a state prompting connection.
    // Adjust this logic based on your application's specific readiness criteria.
    return isBaseReady || renderState === 'prompt_connect';
  } , [isBaseReady, renderState]);

  const showPresetBar = useMemo(() => {
    // Show preset bar if UI is generally ready, visible, no panel is open, and a profile is being viewed.
    return actualShouldShowUI && isUiVisible && !activePanel && !!configData.currentProfileAddress;
  }, [actualShouldShowUI, isUiVisible, activePanel, configData.currentProfileAddress]);

  // Dynamically set class for main UI container based on visibility
  const mainUiContainerClass = `ui-elements-container ${actualShouldShowUI && isUiVisible ? "visible" : "hidden-by-opacity"}`;

  return (
    <>
      {actualShouldShowUI && (
        <MemoizedTopRightControls
          showWhitelist={false} // Whitelist feature can be conditionally shown based on other state if needed
          isProjectAdminForWhitelist={isParentAdmin}
          showInfo={true}
          showToggleUI={true}
          showEnhancedView={true}
          onWhitelistClick={toggleWhitelistPanel}
          onInfoClick={toggleInfoOverlay}
          onToggleUI={toggleUiVisibility}
          onEnhancedView={onEnhancedView}
          isUiVisible={isUiVisible} // Pass current UI visibility state
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
              setActivePanel={openPanel} // Pass openPanel to handle panel activation
              notificationCount={unreadCount}
            />
            <MemoizedActivePanelRenderer
                uiState={uiState}
                audioState={audioState}
                configData={configData} // Pass the enhanced configData
                actions={actions}
            />
            {showPresetBar && (
              <MemoizedPresetSelectorBar
                savedConfigList={passedSavedConfigList}
                currentConfigName={currentConfigName}
                onPresetSelect={onPresetSelect}
                isLoading={isTransitioning} // Reflects preset loading/transition state
              />
            )}
          </>
        )}
      </div>
      {actualShouldShowUI && ( // Only render overlays if base UI is ready
        <MemoizedOverlayRenderer uiState={uiState} />
      )}
      {actualShouldShowUI && !visitorUPAddress && ( // Show connect pill if UI is ready but visitor not connected
         <GeneralConnectPill />
      )}
    </>
  );
}

UIOverlay.propTypes = {
  uiState: PropTypes.object.isRequired, // Should match UIStatePropTypes
  audioState: PropTypes.object.isRequired, // Should match AudioStatePropTypes
  configData: PropTypes.object.isRequired, // Should match ConfigDataPropTypes
  actions: PropTypes.object.isRequired, // Should match ActionsPropTypes
  passedSavedConfigList: PropTypes.array,
};

UIOverlay.defaultProps = {
  passedSavedConfigList: [],
};

export default React.memo(UIOverlay); // Memoize the main UIOverlay component