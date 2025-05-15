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
 * @property {string|null} animatingPanel - Identifier of the panel currently undergoing an open/close animation (e.g., the panel name when opening, or "closing" when closing).
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
 * @property {(panelName: string) => void} toggleSidePanel - Function to toggle a specific side panel's visibility.
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

const GeneralConnectPill = () => {
  const { visitorUPAddress } = useProfileSessionState();
  if (visitorUPAddress) return null;

  return (
    <div className="general-connect-pill">
      Create or connect a Universal Profile to save configurations, use your own tokens, and access all features.
    </div>
  );
};

const ActivePanelRenderer = ({ uiState, audioState, configData, actions }) => {
    const { activePanel, animatingPanel, activeLayerTab, closePanel, setActiveLayerTab } = uiState;
    const { isAudioActive, audioSettings, analyzerData, setIsAudioActive, setAudioSettings } = audioState;
    const { blendModes, notifications, savedReactions, canSave, isPreviewMode, canInteract, currentProfileAddress } = configData;
    const { onLayerConfigChange, onMarkNotificationRead, onClearAllNotifications, onSaveReaction, onRemoveReaction, onPreviewEffect, onTokenApplied } = actions;

    const handleTokenSelectorClose = useCallback(() => {
        closePanel(); 
    }, [closePanel]);

    // Construct className for PanelWrapper based on animatingPanel state
    const panelWrapperClassName = useMemo(() => {
        if (animatingPanel) {
            if (animatingPanel === "closing") {
                return "animating closing"; // For slide-out
            }
            return "animating"; // For slide-in (or generic animating state)
        }
        return ""; // No animation class
    }, [animatingPanel]);

    switch (activePanel) {
        case "controls":
            return (
                <PanelWrapper key="controls-panel" className={panelWrapperClassName}>
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
                <PanelWrapper key="notifications-panel" className={panelWrapperClassName}>
                    <NotificationPanel
                        notifications={notifications}
                        onClose={closePanel}
                        onMarkAsRead={onMarkNotificationRead}
                        onClearAll={onClearAllNotifications}
                    />
                </PanelWrapper>
            );
        case "events":
            return canInteract ? ( 
                <PanelWrapper key="events-panel" className={panelWrapperClassName}>
                    <EventsPanel
                        onSaveReaction={onSaveReaction}
                        onRemoveReaction={onRemoveReaction} 
                        reactions={savedReactions}
                        onClose={closePanel}
                        readOnly={!canSave} 
                        onPreviewEffect={onPreviewEffect}
                    />
                </PanelWrapper>
            ) : null;
        case "save":
            return currentProfileAddress && !isPreviewMode ? (
                <PanelWrapper key="save-panel" className={panelWrapperClassName}>
                    <EnhancedSavePanel onClose={closePanel} />
                </PanelWrapper>
            ) : null;
        case "audio":
            return (
                <PanelWrapper key="audio-panel" className={panelWrapperClassName}>
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
            return canInteract ? ( 
                <TokenSelectorOverlay
                    key="token-selector-overlay"
                    isOpen={activePanel === "tokens"} 
                    onClose={handleTokenSelectorClose}
                    onTokenApplied={onTokenApplied}
                    readOnly={!canInteract} 
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
const MemoizedOverlayRenderer = React.memo(OverlayRenderer);

function UIOverlay(props) {
  const {
    uiState,
    audioState,
    configData: propConfigData, 
    actions,
    passedSavedConfigList,
  } = props;

  const { canInteract: sessionCanInteract, currentProfileAddress: sessionCurrentProfileAddress, visitorUPAddress } = useProfileSessionState();

  const configData = useMemo(() => ({
    ...propConfigData,
    canInteract: sessionCanInteract, 
    currentProfileAddress: sessionCurrentProfileAddress, 
  }), [propConfigData, sessionCanInteract, sessionCurrentProfileAddress]);


  const {
    isUiVisible,
    activePanel,
    toggleSidePanel, 
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
  } = configData;
  const { onEnhancedView, onPresetSelect } = actions;

  const actualShouldShowUI = useMemo(() => {
    return isBaseReady || renderState === 'prompt_connect';
  } , [isBaseReady, renderState]);

  const showPresetBar = useMemo(() => {
    return actualShouldShowUI && isUiVisible && !activePanel && !!configData.currentProfileAddress;
  }, [actualShouldShowUI, isUiVisible, activePanel, configData.currentProfileAddress]);

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
              <MemoizedAudioStatusIcon isActive={isAudioActive} onClick={() => uiState.openPanel('audio')} />
              <MemoizedGlobalMIDIStatus />
            </div>
            {isPreviewMode && (
              <div className="preview-mode-indicator">
                <span>👁️</span> Preview Mode
              </div>
            )}
            <MemoizedVerticalToolbar
              activePanel={activePanel}
              setActivePanel={toggleSidePanel} 
              notificationCount={unreadCount}
            />
            <MemoizedActivePanelRenderer
                uiState={uiState}
                audioState={audioState}
                configData={configData} 
                actions={actions}
            />
            {showPresetBar && (
              <MemoizedPresetSelectorBar
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
        <MemoizedOverlayRenderer uiState={uiState} />
      )}
      {actualShouldShowUI && !visitorUPAddress && ( 
         <GeneralConnectPill />
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

export default React.memo(UIOverlay);