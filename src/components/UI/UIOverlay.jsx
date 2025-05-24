// src/components/UI/UIOverlay.jsx
import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
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

import { useProfileSessionState } from '../../hooks/configSelectors';
import { useToast } from '../../context/ToastContext';
import { ForwardIcon as SequencerIcon } from '@heroicons/react/24/outline';

// Memoized components for performance optimization
const MemoizedTopRightControls = React.memo(TopRightControls);
const MemoizedVerticalToolbar = React.memo(VerticalToolbar);
const MemoizedGlobalMIDIStatus = React.memo(GlobalMIDIStatus);
const MemoizedAudioStatusIcon = React.memo(AudioStatusIcon);
const MemoizedPresetSelectorBar = React.memo(PresetSelectorBar);

const DEFAULT_SEQUENCER_INTERVAL = 10000; // 10 seconds

/**
 * @typedef {import('../../hooks/useUIState').UIState} UIStateHook
 * @typedef {import('../../hooks/useAudioVisualizer').AudioVisualizerAPI} AudioStateHook
 * @typedef {import('../../hooks/configSelectors').ProfileSessionState} ProfileSessionStateHook
 */

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
 * @property {boolean} [isConfigLoading] - Indicates if a configuration preset is currently being loaded.
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
 * @property {(newIntervalMs: number) => void} [onSetSequencerInterval] - Optional callback to set the sequencer interval.
 */

/**
 * @typedef {object} UIOverlayProps
 * @property {UIStateHook} uiState - State and functions for managing UI visibility and panel states.
 * @property {AudioStateHook} audioState - State and functions for managing audio reactivity.
 * @property {ConfigDataPropTypes} configData - Data related to visual configurations, presets, and user permissions.
 * @property {ActionsPropTypes} actions - Callback functions for various application interactions.
 * @property {Array<{name: string}>} [passedSavedConfigList=[]] - List of saved configuration presets.
 */

/**
 * GeneralConnectPill displays a message prompting users to connect their Universal Profile
 * if no visitor UP address is detected.
 * @returns {JSX.Element | null} The pill component or null.
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

/**
 * ActivePanelRenderer conditionally renders the currently active side panel based on `uiState.activePanel`.
 * @param {object} props - Component props.
 * @param {UIStateHook} props.uiState - UI state from `useUIState`.
 * @param {AudioStateHook} props.audioState - Audio state from `useAudioVisualizer`.
 * @param {ConfigDataPropTypes} props.configData - Configuration data.
 * @param {ActionsPropTypes} props.actions - Interaction callbacks.
 * @returns {JSX.Element | null} The rendered active panel or null.
 */
const ActivePanelRenderer = ({ uiState, audioState, configData, actions }) => {
    const { activePanel, animatingPanel, activeLayerTab, closePanel, setActiveLayerTab } = uiState;
    const { isAudioActive, audioSettings, analyzerData, setIsAudioActive, setAudioSettings } = audioState;
    const { blendModes, notifications, savedReactions, canSave, isPreviewMode, canInteract, currentProfileAddress } = configData;
    const { onLayerConfigChange, onMarkNotificationRead, onClearAllNotifications, onSaveReaction, onRemoveReaction, onPreviewEffect, onTokenApplied, onSetSequencerInterval } = actions;

    const handleTokenSelectorClose = useCallback(() => {
        closePanel();
    }, [closePanel]);

    const panelWrapperClassName = useMemo(() => {
        if (animatingPanel) {
            if (animatingPanel === "closing") {
                return "animating closing";
            }
            return "animating";
        }
        return "";
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
                        onSetSequencerInterval={onSetSequencerInterval} // Pass down the new prop
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

/**
 * OverlayRenderer conditionally renders modal-like overlays (e.g., InfoOverlay).
 * @param {object} props - Component props.
 * @param {UIStateHook} props.uiState - UI state from `useUIState`.
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
const MemoizedOverlayRenderer = React.memo(OverlayRenderer);

/**
 * UIOverlay is the main component responsible for rendering all user interface elements
 * that overlay the core visual canvas. This includes toolbars, panels, and modal overlays.
 * It orchestrates the visibility and interaction of these elements based on application state.
 * It now includes a preset sequencer feature with a customizable interval.
 *
 * @param {UIOverlayProps} props - The component's props.
 * @returns {JSX.Element} The rendered UIOverlay component.
 */
function UIOverlay(props) {
  const {
    uiState,
    audioState,
    configData: propConfigData,
    actions,
    passedSavedConfigList,
  } = props;

  const { addToast } = useToast();
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
    isTransitioning,
    isBaseReady,
    currentProfileAddress,
  } = configData;
  const { onEnhancedView, onPresetSelect } = actions;

  const [isSequencerActive, setIsSequencerActive] = useState(false);
  const sequencerIntervalRef = useRef(null);
  const nextPresetIndexRef = useRef(0);
  const [sequencerIntervalMs, setSequencerIntervalMs] = useState(DEFAULT_SEQUENCER_INTERVAL);


  const configDataRef = useRef(configData);
  useEffect(() => {
    configDataRef.current = configData;
  }, [configData]);

  const passedSavedConfigListRef = useRef(passedSavedConfigList);
  useEffect(() => {
    passedSavedConfigListRef.current = passedSavedConfigList;
  }, [passedSavedConfigList]);

  const onPresetSelectRef = useRef(onPresetSelect);
  useEffect(() => {
    onPresetSelectRef.current = onPresetSelect;
  }, [onPresetSelect]);


  const actualShouldShowUI = useMemo(() => {
    return isBaseReady || configData.renderState === 'prompt_connect';
  } , [isBaseReady, configData.renderState]);

  const showPresetBar = useMemo(() => {
    return actualShouldShowUI && isUiVisible && !activePanel && !!currentProfileAddress;
  }, [actualShouldShowUI, isUiVisible, activePanel, currentProfileAddress]);


  const loadNextPresetInSequence = useCallback((isInitialCall = false) => {
    const { renderState, isConfigLoading, isTransitioning, currentConfigName: currentLoadedConfigNameValue } = configDataRef.current;
    const currentPassedSavedConfigList = passedSavedConfigListRef.current;
    const currentOnPresetSelect = onPresetSelectRef.current;

    if (import.meta.env.DEV) {
        console.log(`[Sequencer LoadNext${isInitialCall ? " (Initial Call)" : " (Interval Tick)"}] Index: ${nextPresetIndexRef.current}, Conditions: isConfigLoading=${isConfigLoading}, renderState=${renderState}, isTransitioning=${isTransitioning}`);
    }

    if (isConfigLoading || renderState !== 'rendered' || isTransitioning) {
      if (import.meta.env.DEV) {
        console.log(`[Sequencer] Load SKIPPED: isConfigLoading=${isConfigLoading}, renderState=${renderState}, isTransitioning=${isTransitioning}`);
      }
      return;
    }

    if (!currentPassedSavedConfigList || currentPassedSavedConfigList.length === 0) {
        return;
    }

    let presetToLoad = currentPassedSavedConfigList[nextPresetIndexRef.current];
    let currentIndexToLoad = nextPresetIndexRef.current;

    if (presetToLoad && presetToLoad.name === currentLoadedConfigNameValue && currentPassedSavedConfigList.length > 1) {
        if (import.meta.env.DEV) {
            console.log(`[Sequencer] Next preset (${presetToLoad.name}) is same as current. Advancing index for this attempt.`);
        }
        currentIndexToLoad = (nextPresetIndexRef.current + 1) % currentPassedSavedConfigList.length;
        presetToLoad = currentPassedSavedConfigList[currentIndexToLoad];
    }

    if (presetToLoad && presetToLoad.name) {
      if (import.meta.env.DEV) {
        console.log(`[Sequencer] >>> Loading preset [${currentIndexToLoad}]: ${presetToLoad.name}`);
      }
      currentOnPresetSelect(presetToLoad.name);
      nextPresetIndexRef.current = (currentIndexToLoad + 1) % currentPassedSavedConfigList.length;
    } else {
        if (import.meta.env.DEV) {
            console.warn(`[Sequencer] Preset at index ${currentIndexToLoad} is invalid. Resetting index to 0.`);
        }
        nextPresetIndexRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (isSequencerActive) {
      const currentPassedSavedConfigList = passedSavedConfigListRef.current;
      if (!currentPassedSavedConfigList || currentPassedSavedConfigList.length === 0) {
        return;
      }
      const { renderState, isConfigLoading, isTransitioning } = configDataRef.current;
      if (!isConfigLoading && renderState === 'rendered' && !isTransitioning) {
        if (import.meta.env.DEV) console.log("[Sequencer] Attempting initial load on activation.");
        loadNextPresetInSequence(true);
      } else {
        if (import.meta.env.DEV) console.log("[Sequencer] Skipping initial load on activation, conditions not met.");
      }
    }
  }, [isSequencerActive, loadNextPresetInSequence]);

  useEffect(() => {
    if (sequencerIntervalRef.current) {
      clearInterval(sequencerIntervalRef.current);
      sequencerIntervalRef.current = null;
    }

    if (isSequencerActive) {
      const currentPassedSavedConfigList = passedSavedConfigListRef.current;
      if (!currentPassedSavedConfigList || currentPassedSavedConfigList.length === 0) {
        addToast("No saved presets available to sequence.", "warning");
        setIsSequencerActive(false);
        return;
      }
      sequencerIntervalRef.current = setInterval(() => loadNextPresetInSequence(false), sequencerIntervalMs);
    } else {
      nextPresetIndexRef.current = 0;
    }

    return () => {
      if (sequencerIntervalRef.current) {
        clearInterval(sequencerIntervalRef.current);
        sequencerIntervalRef.current = null;
      }
    };
  }, [isSequencerActive, loadNextPresetInSequence, addToast, sequencerIntervalMs]);


  const handleToggleSequencer = () => {
    if (configData.isConfigLoading) {
        addToast("Cannot toggle sequencer while a preset is loading.", "warning");
        return;
    }
    if (!configData.currentProfileAddress) {
        addToast("Connect a profile to use the preset sequencer.", "warning");
        return;
    }
    setIsSequencerActive(prev => {
        if (!prev) {
            nextPresetIndexRef.current = 0;
        }
        return !prev;
    });
  };

  const handleSetSequencerInterval = useCallback((newIntervalMs) => {
    const newInterval = Number(newIntervalMs);
    if (!isNaN(newInterval) && newInterval >= 1000) {
        setSequencerIntervalMs(newInterval);
        addToast(`Sequencer interval set to ${newInterval / 1000}s.`, "info");
    } else {
        addToast("Invalid interval. Must be at least 1000ms.", "warning");
    }
  }, [addToast]);

  const actionsWithSequencerControl = useMemo(() => ({
    ...actions,
    onSetSequencerInterval: handleSetSequencerInterval,
  }), [actions, handleSetSequencerInterval]);

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
              <button
                className={`toolbar-icon sequencer-toggle-button ${isSequencerActive ? "active" : ""}`}
                onClick={handleToggleSequencer}
                title={isSequencerActive ? `Stop Preset Sequencer (Interval: ${sequencerIntervalMs / 1000}s)` : `Start Preset Sequencer (Interval: ${sequencerIntervalMs / 1000}s)`}
                aria-label={isSequencerActive ? "Stop Preset Sequencer" : "Start Preset Sequencer"}
                disabled={configData.isConfigLoading || !configData.currentProfileAddress}
              >
                <SequencerIcon className="icon-image" />
              </button>
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
                actions={actionsWithSequencerControl}
            />
            {showPresetBar && (
              <MemoizedPresetSelectorBar
                savedConfigList={passedSavedConfigList}
                currentConfigName={configData.currentConfigName}
                onPresetSelect={onPresetSelect}
                isLoading={isTransitioning || configData.isConfigLoading}
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
  /** State and functions for managing UI visibility and panel states. */
  uiState: PropTypes.object.isRequired,
  /** State and functions for managing audio reactivity. */
  audioState: PropTypes.object.isRequired,
  /** Data related to visual configurations, presets, and user permissions. */
  configData: PropTypes.object.isRequired,
  /** Callback functions for various application interactions. */
  actions: PropTypes.object.isRequired,
  /** List of saved configuration presets. */
  passedSavedConfigList: PropTypes.array,
};

UIOverlay.defaultProps = {
  passedSavedConfigList: [],
};


export default React.memo(UIOverlay);