// src/components/UI/UIOverlay.jsx (Fixed PropTypes Warning)
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
    // isParentAdmin is used in OverlayRenderer, not here directly
    const { layerConfigs, blendModes, notifications, savedReactions, canSave, isPreviewMode } = configData;
    // Removed onRemoveReaction as it's unused in EventsPanel
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
                        // onRemoveReaction removed
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
    const { isParentAdmin } = configData; // isParentAdmin is used here

    return (
        <>
            {infoOverlayOpen && (
                <InfoOverlay isOpen={infoOverlayOpen} onClose={toggleInfoOverlay} />
            )}
            {/* Whitelist panel only renders if the user is the designated admin */}
            {whitelistPanelOpen && isParentAdmin && (
                <WhitelistCollectionsPanel isOpen={whitelistPanelOpen} onClose={toggleWhitelistPanel} />
            )}
        </>
    );
};


/**
 * UIOverlay component: Renders the main user interface elements,
 * including toolbars, panels, and overlays, based on the provided state.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.shouldShowUI - Whether the base conditions for showing UI are met.
 * @param {object} props.uiState - State object from useUIState hook.
 * @param {object} props.audioState - State object from useAudioVisualizer hook.
 * @param {object} props.configData - Object containing configuration and context data.
 * @param {object} props.actions - Object containing action callbacks.
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
  // isProfileOwner, isVisitor are not directly used here, derived logic like canSave is passed in configData
  const {
    isParentAdmin, isPreviewMode, unreadCount,
    savedConfigList, currentConfigName, isTransitioning
    // isLoading (previously isConfigHookLoading) is available here but not directly used by UIOverlay render logic itself
  } = configData;
  const { onEnhancedView, onPresetSelect } = actions;

  const showPresetBar = useMemo(() => shouldShowUI && isUiVisible && !activePanel, [shouldShowUI, isUiVisible, activePanel]);

  return (
    <div className={`ui-container ${shouldShowUI && isUiVisible ? "visible" : "hidden"}`}>
      {shouldShowUI && (
        <>
          <MemoizedTopRightControls
            showWhitelist={isParentAdmin && isUiVisible} // Whitelist button depends on admin status
            showInfo={isUiVisible}
            showToggleUI={true}
            showEnhancedView={true}
            onWhitelistClick={toggleWhitelistPanel}
            onInfoClick={toggleInfoOverlay}
            onToggleUI={toggleUiVisibility}
            onEnhancedView={onEnhancedView}
            isUiVisible={isUiVisible}
          />

          <div className="bottom-right-icons">
            {isUiVisible && <MemoizedAudioStatusIcon isActive={isAudioActive} onClick={() => openPanel('audio')} />}
            {isUiVisible && <MemoizedGlobalMIDIStatus />}
          </div>

          {isUiVisible && isPreviewMode && (
            <div className="preview-mode-indicator">
              <span>👁️</span> Preview Mode
            </div>
          )}

          {isUiVisible && (
            <MemoizedVerticalToolbar
              activePanel={activePanel}
              setActivePanel={openPanel}
              notificationCount={unreadCount}
              // Removed unused props
              // isParentAdmin={isParentAdmin}
              // isProfileOwner={isProfileOwner}
              // isVisitor={isVisitor}
            />
          )}

          {isUiVisible && (
            <ActivePanelRenderer
                uiState={uiState}
                audioState={audioState}
                configData={configData}
                actions={actions}
            />
          )}

          <OverlayRenderer uiState={uiState} configData={configData} />

          {showPresetBar && (
            <MemoizedPresetSelectorBar
              savedConfigList={savedConfigList}
              currentConfigName={currentConfigName}
              onPresetSelect={onPresetSelect}
              isLoading={isTransitioning} // Use isTransitioning to disable buttons during load/preset change
            />
          )}
        </>
      )}
    </div>
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
  isLoading: PropTypes.bool.isRequired, // ****** CHANGED HERE ******
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