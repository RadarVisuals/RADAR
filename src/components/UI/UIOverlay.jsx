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
 * Renders the currently active panel based on uiState.activePanel.
 */
const ActivePanelRenderer = ({ uiState, audioState, configData, actions }) => {
    const { activePanel, animatingPanel, activeLayerTab, closePanel, setActiveLayerTab } = uiState;
    const { isAudioActive, audioSettings, analyzerData, setIsAudioActive, setAudioSettings } = audioState;
    const { layerConfigs, blendModes, notifications, savedReactions, canSave, isPreviewMode } = configData;
    const { onLayerConfigChange, onMarkNotificationRead, onClearAllNotifications, onSaveReaction, onPreviewEffect, onTokenApplied } = actions;

    const handleTokenSelectorClose = useCallback(() => {
        closePanel();
    }, [closePanel]);

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
                        readOnly={!canSave}
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

/**
 * Renders overlays like Info and Whitelist.
 */
const OverlayRenderer = ({ uiState, configData }) => {
    const { infoOverlayOpen, whitelistPanelOpen, toggleInfoOverlay, toggleWhitelistPanel } = uiState;
    const { isParentAdmin } = configData;

    return (
        <>
            {infoOverlayOpen && (
                <InfoOverlay isOpen={infoOverlayOpen} onClose={toggleInfoOverlay} />
            )}
            {whitelistPanelOpen && isParentAdmin && (
                <WhitelistCollectionsPanel isOpen={whitelistPanelOpen} onClose={toggleWhitelistPanel} />
            )}
        </>
    );
};

/**
 * UIOverlay component: Renders the main user interface elements,
 * including toolbars, panels, and overlays, based on the provided state.
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
    isParentAdmin, isPreviewMode, unreadCount,
    savedConfigList, currentConfigName, isTransitioning
  } = configData;
  const { onEnhancedView, onPresetSelect } = actions;

  const showPresetBar = useMemo(() => shouldShowUI && isUiVisible && !activePanel, [shouldShowUI, isUiVisible, activePanel]);

  // UPDATED: Class for the main UI container that holds hideable elements
  const mainUiContainerClass = `ui-elements-container ${shouldShowUI && isUiVisible ? "visible" : "hidden-by-opacity"}`;

  return (
    // Use a fragment as the outermost wrapper for UI elements
    <>
      {/* TopRightControls is always rendered IF shouldShowUI is true. Its internal state is managed by isUiVisible prop. */}
      {shouldShowUI && (
        <MemoizedTopRightControls
          showWhitelist={isParentAdmin} // This button will be hidden by TopRightControls if !isUiVisible
          showInfo={true}              // This button will be hidden by TopRightControls if !isUiVisible
          showToggleUI={true}          // This is the toggle button, always conceptually present
          showEnhancedView={true}      // This button will be hidden by TopRightControls if !isUiVisible
          onWhitelistClick={toggleWhitelistPanel}
          onInfoClick={toggleInfoOverlay}
          onToggleUI={toggleUiVisibility}
          onEnhancedView={onEnhancedView}
          isUiVisible={isUiVisible} // Pass isUiVisible for TopRightControls internal logic
        />
      )}

      {/* This container holds elements that will fade in/out based on isUiVisible */}
      <div className={mainUiContainerClass}>
        {/* Only render these children if shouldShowUI is true AND isUiVisible is true */}
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
                configData={configData}
                actions={actions}
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

      {/* Overlays are rendered outside the mainUiContainerClass if their visibility is independent */}
      {shouldShowUI && (
        <OverlayRenderer uiState={uiState} configData={configData} />
      )}
    </>
  );
}

// --- PropType Definitions (remain unchanged) ---
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
  isVisitor: PropTypes.bool.isRequired,
  isPreviewMode: PropTypes.bool.isRequired,
  unreadCount: PropTypes.number.isRequired,
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