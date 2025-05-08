import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

// Import Child Components
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
import WhitelistCollectionsPanel from '../Panels/WhitelistCollectionsPanel';
import GlobalMIDIStatus from '../MIDI/GlobalMIDIStatus';
import AudioStatusIcon from '../Audio/AudioStatusIcon';
import PresetSelectorBar from './PresetSelectorBar';

// Memoized components for performance optimization
const MemoizedTopRightControls = React.memo(TopRightControls);
const MemoizedVerticalToolbar = React.memo(VerticalToolbar);
const MemoizedGlobalMIDIStatus = React.memo(GlobalMIDIStatus);
const MemoizedAudioStatusIcon = React.memo(AudioStatusIcon);
const MemoizedPresetSelectorBar = React.memo(PresetSelectorBar);

/**
 * Renders the currently active side panel based on uiState.activePanel.
 * @param {object} props - Component props.
 * @param {object} props.uiState - State object from useUIState hook.
 * @param {object} props.audioState - State object from useAudioVisualizer hook.
 * @param {object} props.configData - Relevant configuration data.
 * @param {object} props.actions - Callback functions for interactions.
 * @returns {React.ReactElement | null} The rendered panel or null.
 */
const ActivePanelRenderer = ({ uiState, audioState, configData, actions }) => {
    const { activePanel, animatingPanel, activeLayerTab, closePanel, setActiveLayerTab } = uiState;
    const { isAudioActive, audioSettings, analyzerData, setIsAudioActive, setAudioSettings } = audioState;
    // Destructure only necessary props from configData for this component
    // Removed 'isVisitor' as it was unused here. 'canSave' implicitly handles visitor state for readOnly.
    const { layerConfigs, blendModes, notifications, savedReactions, canSave, isPreviewMode } = configData;
    const { onLayerConfigChange, onMarkNotificationRead, onClearAllNotifications, onSaveReaction, onPreviewEffect, onTokenApplied } = actions;

    // Callback to handle closing the Token Selector overlay
    const handleTokenSelectorClose = useCallback(() => {
        closePanel();
    }, [closePanel]);

    // Render the appropriate panel based on the activePanel state
    switch (activePanel) {
        case "controls":
            return (
                <PanelWrapper key="controls-panel" className={animatingPanel ? "animating" : ""}>
                    <EnhancedControlPanel
                        layerConfigs={layerConfigs}
                        onLayerConfigChange={onLayerConfigChange}
                        blendModes={blendModes}
                        onToggleMinimize={closePanel}
                        activeTab={activeLayerTab}
                        onTabChange={setActiveLayerTab}
                        readOnly={!canSave} // Panels are read-only if user cannot save
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
            return !isPreviewMode ? ( // Don't show events panel in preview mode
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
            return !isPreviewMode ? ( // Don't show save panel in preview mode
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
            return !isPreviewMode ? ( // Don't show token selector in preview mode
                <TokenSelectorOverlay
                    key="token-selector-overlay"
                    isOpen={activePanel === "tokens"}
                    onClose={handleTokenSelectorClose}
                    onTokenApplied={onTokenApplied}
                    readOnly={!canSave} // Token selector is read-only if user cannot save
                />
            ) : null;
        default:
            return null; // No panel active
    }
};

/**
 * Renders modal-like overlays (Info, Whitelist).
 * @param {object} props - Component props.
 * @param {object} props.uiState - State object from useUIState hook.
 * @param {object} props.configData - Relevant configuration data.
 * @returns {React.ReactElement} Rendered overlays.
 */
const OverlayRenderer = ({ uiState, configData }) => {
    const { infoOverlayOpen, whitelistPanelOpen, toggleInfoOverlay, toggleWhitelistPanel } = uiState;
    const { isParentAdmin } = configData; // Check if user is admin for whitelist

    return (
        <>
            {infoOverlayOpen && (
                <InfoOverlay isOpen={infoOverlayOpen} onClose={toggleInfoOverlay} />
            )}
            {/* Only render Whitelist Panel if the user is admin */}
            {whitelistPanelOpen && isParentAdmin && (
                <WhitelistCollectionsPanel isOpen={whitelistPanelOpen} onClose={toggleWhitelistPanel} />
            )}
        </>
    );
};

/**
 * UIOverlay component: The main container for all user interface elements,
 * coordinating the display of toolbars, panels, and overlays.
 * @param {object} props - Component props.
 * @param {boolean} props.shouldShowUI - Whether the base conditions for showing UI are met.
 * @param {object} props.uiState - State object from useUIState hook.
 * @param {object} props.audioState - State object from useAudioVisualizer hook.
 * @param {object} props.configData - Relevant configuration data.
 * @param {object} props.actions - Callback functions for interactions.
 * @returns {React.ReactElement} The rendered UI overlay structure.
 */
function UIOverlay(props) {
  const {
    shouldShowUI,
    uiState,
    audioState,
    configData,
    actions,
  } = props;

  // Destructure states and actions for clarity
  const {
    isUiVisible, activePanel, openPanel, toggleInfoOverlay,
    toggleWhitelistPanel, toggleUiVisibility
  } = uiState;
  const { isAudioActive } = audioState;
  const {
    isParentAdmin, isPreviewMode, unreadCount,
    savedConfigList, currentConfigName, isTransitioning
  } = configData;
  const { onEnhancedView, onPresetSelect } = actions;

  // Determine if the preset selector bar should be visible
  const showPresetBar = useMemo(() => shouldShowUI && isUiVisible && !activePanel, [shouldShowUI, isUiVisible, activePanel]);

  // Dynamic class for the container holding hideable UI elements
  const mainUiContainerClass = `ui-elements-container ${shouldShowUI && isUiVisible ? "visible" : "hidden-by-opacity"}`;

  return (
    <>
      {/* Top Right Controls: Always rendered if base condition met, visibility managed internally */}
      {shouldShowUI && (
        <MemoizedTopRightControls
          showWhitelist={isParentAdmin}
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

      {/* Container for UI elements that fade in/out */}
      <div className={mainUiContainerClass}>
        {shouldShowUI && isUiVisible && (
          <>
            {/* Bottom Right Icons */}
            <div className="bottom-right-icons">
              <MemoizedAudioStatusIcon isActive={isAudioActive} onClick={() => openPanel('audio')} />
              <MemoizedGlobalMIDIStatus />
            </div>

            {/* Preview Mode Indicator */}
            {isPreviewMode && (
              <div className="preview-mode-indicator">
                <span>👁️</span> Preview Mode
              </div>
            )}

            {/* Left Vertical Toolbar */}
            <MemoizedVerticalToolbar
              activePanel={activePanel}
              setActivePanel={openPanel}
              notificationCount={unreadCount}
            />

            {/* Renders the currently selected side panel */}
            <ActivePanelRenderer
                uiState={uiState}
                audioState={audioState}
                configData={configData}
                actions={actions}
            />

            {/* Preset Selector Bar */}
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

      {/* Overlays (Info, Whitelist) */}
      {shouldShowUI && (
        <OverlayRenderer uiState={uiState} configData={configData} />
      )}
    </>
  );
}

// --- PropType Definitions ---
const UIStatePropTypes = PropTypes.shape({
  isUiVisible: PropTypes.bool.isRequired,
  infoOverlayOpen: PropTypes.bool.isRequired,
  whitelistPanelOpen: PropTypes.bool.isRequired,
  activePanel: PropTypes.string,
  animatingPanel: PropTypes.string,
  activeLayerTab: PropTypes.string.isRequired,
  toggleUiVisibility: PropTypes.func.isRequired,
  toggleInfoOverlay: PropTypes.func.isRequired,
  toggleWhitelistPanel: PropTypes.func.isRequired,
  openPanel: PropTypes.func.isRequired,
  closePanel: PropTypes.func.isRequired,
  setActiveLayerTab: PropTypes.func.isRequired,
});

const AudioStatePropTypes = PropTypes.shape({
  isAudioActive: PropTypes.bool.isRequired,
  audioSettings: PropTypes.object.isRequired,
  analyzerData: PropTypes.object.isRequired,
  setIsAudioActive: PropTypes.func.isRequired,
  setAudioSettings: PropTypes.func.isRequired,
  handleAudioDataUpdate: PropTypes.func.isRequired,
});

const ConfigDataPropTypes = PropTypes.shape({
  layerConfigs: PropTypes.object.isRequired,
  blendModes: PropTypes.array.isRequired,
  notifications: PropTypes.array.isRequired,
  savedReactions: PropTypes.object.isRequired,
  savedConfigList: PropTypes.array.isRequired,
  currentConfigName: PropTypes.string,
  isTransitioning: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool.isRequired,
  canSave: PropTypes.bool.isRequired,
  isParentAdmin: PropTypes.bool.isRequired,
  isProfileOwner: PropTypes.bool.isRequired,
  isVisitor: PropTypes.bool.isRequired, // Keep this prop definition even if unused locally
  isPreviewMode: PropTypes.bool.isRequired,
  unreadCount: PropTypes.number.isRequired,
  currentProfileAddress: PropTypes.string, // Added this prop
});

const ActionsPropTypes = PropTypes.shape({
  onEnhancedView: PropTypes.func.isRequired,
  onLayerConfigChange: PropTypes.func.isRequired,
  onMarkNotificationRead: PropTypes.func.isRequired,
  onClearAllNotifications: PropTypes.func.isRequired,
  onSaveReaction: PropTypes.func.isRequired,
  onRemoveReaction: PropTypes.func.isRequired,
  onPreviewEffect: PropTypes.func.isRequired,
  onTokenApplied: PropTypes.func.isRequired,
  onPresetSelect: PropTypes.func.isRequired,
});

UIOverlay.propTypes = {
  shouldShowUI: PropTypes.bool.isRequired,
  uiState: UIStatePropTypes.isRequired,
  audioState: AudioStatePropTypes.isRequired,
  configData: ConfigDataPropTypes.isRequired,
  actions: ActionsPropTypes.isRequired,
};

export default UIOverlay;