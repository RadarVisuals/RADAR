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
import AudioControlPanel from '../Audio/AudioControlPanel'; // CORRECTED PATH
import TokenSelectorOverlay from '../Panels/TokenSelectorOverlay';
import InfoOverlay from '../Panels/InfoOverlay';
import LibraryPanel from '../Panels/LibraryPanel';
import GlobalMIDIStatus from '../MIDI/GlobalMIDIStatus';
import AudioStatusIcon from '../Audio/AudioStatusIcon';
import PresetSelectorBar from './PresetSelectorBar';

import { useProfileSessionState } from '../../hooks/configSelectors';
import { useToast } from '../../context/ToastContext';
import { ForwardIcon as SequencerIcon } from '@heroicons/react/24/outline';
import { whitelistIcon } from '../../assets';

// Memoized components for performance optimization
const MemoizedTopRightControls = React.memo(TopRightControls);
const MemoizedVerticalToolbar = React.memo(VerticalToolbar);
const MemoizedGlobalMIDIStatus = React.memo(GlobalMIDIStatus);
const MemoizedAudioStatusIcon = React.memo(AudioStatusIcon);
const MemoizedPresetSelectorBar = React.memo(PresetSelectorBar);

const DEFAULT_SEQUENCER_INTERVAL = 10000;

/**
 * @typedef {import('../../hooks/useUIState').UIState} UIStateHook
 * @typedef {import('../../hooks/useAudioVisualizer').AudioVisualizerAPI} AudioStateHook
 * @typedef {import('../../hooks/configSelectors').ProfileSessionState} ProfileSessionStateHook
 */

/**
 * @typedef {object} UIStatePropTypes
 * @property {string|null} activePanel
 * @property {string|null} animatingPanel
 * @property {string} activeLayerTab
 * @property {boolean} infoOverlayOpen
 * @property {boolean} whitelistPanelOpen
 * @property {() => void} closePanel
 * @property {(tabId: string) => void} setActiveLayerTab
 * @property {() => void} toggleInfoOverlay
 * @property {() => void} toggleWhitelistPanel
 * @property {(panelName: string) => void} openPanel
 * @property {() => void} toggleUiVisibility
 * @property {boolean} isUiVisible
 * @property {(panelName: string) => void} toggleSidePanel
 */

/**
 * @typedef {object} AudioStatePropTypes
 * @property {boolean} isAudioActive
 * @property {object} audioSettings
 * @property {object} analyzerData
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setIsAudioActive
 * @property {React.Dispatch<React.SetStateAction<object>>} setAudioSettings
 */

/**
 * @typedef {object} ConfigDataPropTypes
 * @property {object} layerConfigs
 * @property {Array<string>} blendModes
 * @property {Array<object>} notifications
 * @property {number} unreadCount
 * @property {object} savedReactions
 * @property {boolean} canSave
 * @property {boolean} isPreviewMode
 * @property {boolean} isParentAdmin
 * @property {string|null} currentConfigName
 * @property {boolean} isTransitioning
 * @property {boolean} isBaseReady
 * @property {string} renderState
 * @property {boolean} canInteract
 * @property {string|null} currentProfileAddress
 * @property {boolean} [isConfigLoading]
 */

/**
 * @typedef {object} ActionsPropTypes
 * @property {() => void} onEnhancedView
 * @property {(layerId: string | number, key: string, value: any) => void} onLayerConfigChange
 * @property {(id: string | number) => void} onMarkNotificationRead
 * @property {() => void} onClearAllNotifications
 * @property {(eventType: string, reactionData: object) => void} onSaveReaction
 * @property {(eventType: string) => void} onRemoveReaction
 * @property {(effectConfig: object) => Promise<string | null>} onPreviewEffect
 * @property {(tokenId: string | object | null, layerId: string | number) => void} onTokenApplied
 * @property {(presetName: string) => void} onPresetSelect
 * @property {(newIntervalMs: number) => void} [onSetSequencerInterval]
 */

/**
 * @typedef {object} UIOverlayProps
 * @property {UIStateHook} uiState
 * @property {AudioStateHook} audioState
 * @property {ConfigDataPropTypes} configData
 * @property {ActionsPropTypes} actions
 * @property {Array<{name: string}>} [passedSavedConfigList=[]]
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
    const { onLayerConfigChange, onMarkNotificationRead, onClearAllNotifications, onSaveReaction, onRemoveReaction, onPreviewEffect, onTokenApplied, onSetSequencerInterval } = actions;

    const handleTokenSelectorClose = useCallback(() => {
        closePanel();
    }, [closePanel]);

    const panelWrapperClassName = useMemo(() => {
        if (animatingPanel) {
            return animatingPanel === "closing" ? "animating closing" : "animating";
        }
        return "";
    }, [animatingPanel]);

    switch (activePanel) {
        case "controls":
            return (
                <PanelWrapper key="controls-panel" className={panelWrapperClassName}>
                    <EnhancedControlPanel onLayerConfigChange={onLayerConfigChange} blendModes={blendModes} onToggleMinimize={closePanel} activeTab={activeLayerTab} onTabChange={setActiveLayerTab} onSetSequencerInterval={onSetSequencerInterval} />
                </PanelWrapper>
            );
        case "notifications":
            return (
                <PanelWrapper key="notifications-panel" className={panelWrapperClassName}>
                    <NotificationPanel notifications={notifications} onClose={closePanel} onMarkAsRead={onMarkNotificationRead} onClearAll={onClearAllNotifications} />
                </PanelWrapper>
            );
        case "events":
            return canInteract ? (
                <PanelWrapper key="events-panel" className={panelWrapperClassName}>
                    <EventsPanel onSaveReaction={onSaveReaction} onRemoveReaction={onRemoveReaction} reactions={savedReactions} onClose={closePanel} readOnly={!canSave} onPreviewEffect={onPreviewEffect} />
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
                    <AudioControlPanel onClose={closePanel} isAudioActive={isAudioActive} setIsAudioActive={setIsAudioActive} audioSettings={audioSettings} setAudioSettings={setAudioSettings} analyzerData={analyzerData} />
                </PanelWrapper>
            );
        case "tokens":
            return canInteract ? (
                <TokenSelectorOverlay key="token-selector-overlay" isOpen={activePanel === "tokens"} onClose={handleTokenSelectorClose} onTokenApplied={onTokenApplied} readOnly={!canInteract} />
            ) : null;
        case "library":
            return currentProfileAddress ? (
                <PanelWrapper key="library-panel" className={panelWrapperClassName}>
                    <LibraryPanel onClose={closePanel} />
                </PanelWrapper>
            ) : null;
        default:
            return null;
    }
};
ActivePanelRenderer.propTypes = { uiState: PropTypes.object.isRequired, audioState: PropTypes.object.isRequired, configData: PropTypes.object.isRequired, actions: PropTypes.object.isRequired };
const MemoizedActivePanelRenderer = React.memo(ActivePanelRenderer);

const OverlayRenderer = ({ uiState }) => {
    const { infoOverlayOpen, toggleInfoOverlay } = uiState;
    return (
        <>
            {infoOverlayOpen && ( <InfoOverlay isOpen={infoOverlayOpen} onClose={toggleInfoOverlay} /> )}
        </>
    );
};
OverlayRenderer.propTypes = { uiState: PropTypes.object.isRequired };
const MemoizedOverlayRenderer = React.memo(OverlayRenderer);

function UIOverlay(props) {
  const { uiState, audioState, configData: propConfigData, actions, passedSavedConfigList } = props;
  const { addToast } = useToast();
  const { canInteract: sessionCanInteract, currentProfileAddress: sessionCurrentProfileAddress, visitorUPAddress } = useProfileSessionState();

  const configData = useMemo(() => ({ ...propConfigData, canInteract: sessionCanInteract, currentProfileAddress: sessionCurrentProfileAddress }), [propConfigData, sessionCanInteract, sessionCurrentProfileAddress]);

  const { isUiVisible, activePanel, toggleSidePanel, toggleInfoOverlay, toggleUiVisibility } = uiState;
  const { isAudioActive } = audioState;
  const { isParentAdmin, isPreviewMode, unreadCount, isTransitioning, isBaseReady, currentProfileAddress } = configData;
  const { onEnhancedView, onPresetSelect } = actions;

  const [isSequencerActive, setIsSequencerActive] = useState(false);
  const sequencerIntervalRef = useRef(null);
  const nextPresetIndexRef = useRef(0);
  const [sequencerIntervalMs, setSequencerIntervalMs] = useState(DEFAULT_SEQUENCER_INTERVAL);

  const configDataRef = useRef(configData);
  useEffect(() => { configDataRef.current = configData; }, [configData]);

  const savedConfigListRef = useRef(passedSavedConfigList);
  useEffect(() => { savedConfigListRef.current = passedSavedConfigList; }, [passedSavedConfigList]);

  const onPresetSelectRef = useRef(onPresetSelect);
  useEffect(() => { onPresetSelectRef.current = onPresetSelect; }, [onPresetSelect]);

  const actualShouldShowUI = useMemo(() => isBaseReady || configData.renderState === 'prompt_connect', [isBaseReady, configData.renderState]);
  const showPresetBar = useMemo(() => actualShouldShowUI && isUiVisible && !activePanel && !!currentProfileAddress, [actualShouldShowUI, isUiVisible, activePanel, currentProfileAddress]);

  const loadNextPresetInSequence = useCallback((isInitialCall = false) => {
    const { renderState, isConfigLoading, isTransitioning, currentConfigName: currentLoadedConfigNameValue } = configDataRef.current;
    const currentSavedConfigList = savedConfigListRef.current;
    const currentOnPresetSelect = onPresetSelectRef.current;

    if (import.meta.env.DEV) {
        console.log(`[Sequencer LoadNext${isInitialCall ? " (Initial Call)" : " (Interval Tick)"}] Index: ${nextPresetIndexRef.current}, Conditions: isConfigLoading=${isConfigLoading}, renderState=${renderState}, isTransitioning=${isTransitioning}`);
    }

    if (isConfigLoading || renderState !== 'rendered' || isTransitioning) {
      if (import.meta.env.DEV) console.log(`[Sequencer] Load SKIPPED: isConfigLoading=${isConfigLoading}, renderState=${renderState}, isTransitioning=${isTransitioning}`);
      return;
    }

    if (!currentSavedConfigList || currentSavedConfigList.length === 0) return;

    let presetToLoad = currentSavedConfigList[nextPresetIndexRef.current];
    let currentIndexToLoad = nextPresetIndexRef.current;

    if (presetToLoad && presetToLoad.name === currentLoadedConfigNameValue && currentSavedConfigList.length > 1) {
        if (import.meta.env.DEV) console.log(`[Sequencer] Next preset (${presetToLoad.name}) is same as current. Advancing index for this attempt.`);
        currentIndexToLoad = (nextPresetIndexRef.current + 1) % currentSavedConfigList.length;
        presetToLoad = currentSavedConfigList[currentIndexToLoad];
    }

    if (presetToLoad?.name) {
      if (import.meta.env.DEV) console.log(`[Sequencer] >>> Loading preset [${currentIndexToLoad}]: ${presetToLoad.name}`);
      currentOnPresetSelect(presetToLoad.name);
      nextPresetIndexRef.current = (currentIndexToLoad + 1) % currentSavedConfigList.length;
    } else {
        if (import.meta.env.DEV) console.warn(`[Sequencer] Preset at index ${currentIndexToLoad} is invalid. Resetting index to 0.`);
        nextPresetIndexRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (isSequencerActive) {
      const currentSavedConfigList = savedConfigListRef.current;
      if (!currentSavedConfigList || currentSavedConfigList.length === 0) return;
      const { renderState, isConfigLoading, isTransitioning } = configDataRef.current;
      if (!isConfigLoading && renderState === 'rendered' && !isTransitioning) {
        if (import.meta.env.DEV) console.log("[Sequencer] Attempting initial load on activation.");
        loadNextPresetInSequence(true);
      } else if (import.meta.env.DEV) {
        console.log("[Sequencer] Skipping initial load on activation, conditions not met.");
      }
    }
  }, [isSequencerActive, loadNextPresetInSequence]);

  useEffect(() => {
    if (sequencerIntervalRef.current) {
      clearInterval(sequencerIntervalRef.current);
      sequencerIntervalRef.current = null;
    }

    if (isSequencerActive) {
      const currentSavedConfigList = savedConfigListRef.current;
      if (!currentSavedConfigList || currentSavedConfigList.length === 0) {
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
        if (!prev) nextPresetIndexRef.current = 0;
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

  const actionsWithSequencerControl = useMemo(() => ({ ...actions, onSetSequencerInterval: handleSetSequencerInterval }), [actions, handleSetSequencerInterval]);

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
          onWhitelistClick={() => toggleSidePanel('library')}
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
            <div className="vertical-toolbar-container">
              <MemoizedVerticalToolbar
                activePanel={activePanel}
                setActivePanel={toggleSidePanel}
                notificationCount={unreadCount}
              />
              <button
                className={`vertical-toolbar-icon ${activePanel === "library" ? "active" : ""}`}
                onClick={() => toggleSidePanel("library")}
                title="My Library"
                aria-label="Open My Library Panel"
                style={{ top: '290px' }}
              >
                <img src={whitelistIcon} alt="My Library" className="icon-image" />
              </button>
            </div>
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