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
import LibraryPanel from '../Panels/LibraryPanel';

import { useAppInteractions } from '../../hooks/useAppInteractions';
import { useProfileSessionState } from '../../hooks/configSelectors';
import { useToast } from '../../context/ToastContext';
import { ForwardIcon as SequencerIcon } from '@heroicons/react/24/outline';
import { whitelistIcon } from '../../assets';

const MemoizedTopRightControls = React.memo(TopRightControls);
const MemoizedVerticalToolbar = React.memo(VerticalToolbar);
const MemoizedGlobalMIDIStatus = React.memo(GlobalMIDIStatus);
const MemoizedAudioStatusIcon = React.memo(AudioStatusIcon);
const MemoizedPresetSelectorBar = React.memo(PresetSelectorBar);

const DEFAULT_SEQUENCER_INTERVAL = 10000;

const GeneralConnectPill = () => {
    return (
        <div className="general-connect-pill">
            Please connect your Universal Profile to begin.
        </div>
    );
};

const ActivePanelRenderer = ({ uiState, audioState, configData, actions, pLockProps }) => {
    const { activePanel, animatingPanel, activeLayerTab, closePanel, setActiveLayerTab } = uiState;
    const { isAudioActive, audioSettings, analyzerData, setIsAudioActive, setAudioSettings } = audioState;
    const { notifications, savedReactions, canSave, isPreviewMode, canInteract, currentProfileAddress, layerConfigs } = configData;
    const { onLayerConfigChange, onMarkNotificationRead, onClearAllNotifications, onSaveReaction, onRemoveReaction, onPreviewEffect, onTokenApplied, onSetSequencerInterval } = actions;

    const handleTokenSelectorClose = useCallback(() => closePanel(), [closePanel]);
    const panelWrapperClassName = useMemo(() => animatingPanel === "closing" ? "animating closing" : animatingPanel ? "animating" : "", [animatingPanel]);

    switch (activePanel) {
        case "controls":
            return (
                <PanelWrapper key="controls-panel" className={panelWrapperClassName}>
                    <EnhancedControlPanel
                        onToggleMinimize={closePanel}
                        activeTab={activeLayerTab}
                        onTabChange={setActiveLayerTab}
                        onSetSequencerInterval={onSetSequencerInterval}
                        pLockProps={pLockProps}
                        onLayerConfigChange={onLayerConfigChange}
                        layerConfigs={layerConfigs}
                    />
                </PanelWrapper>
            );
        case "notifications":
            return ( <PanelWrapper key="notifications-panel" className={panelWrapperClassName}><NotificationPanel notifications={notifications} onClose={closePanel} onMarkAsRead={onMarkNotificationRead} onClearAll={onClearAllNotifications} /></PanelWrapper> );
        case "events":
            return canInteract ? ( <PanelWrapper key="events-panel" className={panelWrapperClassName}><EventsPanel onSaveReaction={onSaveReaction} onRemoveReaction={onRemoveReaction} reactions={savedReactions} onClose={closePanel} readOnly={!canSave} onPreviewEffect={onPreviewEffect} /></PanelWrapper> ) : null;
        case "save":
            return currentProfileAddress && !isPreviewMode ? ( <PanelWrapper key="save-panel" className={panelWrapperClassName}><EnhancedSavePanel onClose={closePanel} /></PanelWrapper> ) : null;
        case "audio":
            return ( <PanelWrapper key="audio-panel" className={panelWrapperClassName}><AudioControlPanel onClose={closePanel} isAudioActive={isAudioActive} setIsAudioActive={setIsAudioActive} audioSettings={audioSettings} setAudioSettings={setAudioSettings} analyzerData={analyzerData} /></PanelWrapper> );
        case "whitelist":
            return ( <PanelWrapper key="whitelist-panel" className={panelWrapperClassName}><LibraryPanel onClose={closePanel} /></PanelWrapper> );
        case "tokens":
            return canInteract ? ( <TokenSelectorOverlay key="token-selector-overlay" isOpen={activePanel === "tokens"} onClose={handleTokenSelectorClose} onTokenApplied={onTokenApplied} readOnly={!canInteract} /> ) : null;
        default:
            return null;
    }
};
ActivePanelRenderer.propTypes = {
    uiState: PropTypes.object.isRequired,
    audioState: PropTypes.object.isRequired,
    configData: PropTypes.object.isRequired,
    actions: PropTypes.object.isRequired,
    pLockProps: PropTypes.object.isRequired,
};
const MemoizedActivePanelRenderer = React.memo(ActivePanelRenderer);

const OverlayRenderer = ({ uiState }) => {
    const { infoOverlayOpen, toggleInfoOverlay } = uiState;
    return infoOverlayOpen ? <InfoOverlay isOpen={infoOverlayOpen} onClose={toggleInfoOverlay} /> : null;
};
OverlayRenderer.propTypes = {
    uiState: PropTypes.object.isRequired,
};
const MemoizedOverlayRenderer = React.memo(OverlayRenderer);

function UIOverlay(props) {
  // --- THIS IS THE FIX ---
  // We now accept the single `pLockProps` object passed down from MainView.
  const { 
    uiState, audioState, configData: propConfigData, actions, passedSavedConfigList,
    pLockProps 
  } = props;
  
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
  const isMountedRef = useRef(false);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; } }, []);
  
  const loadNextPresetInSequence = useCallback(() => {
    const currentList = savedConfigListRef.current;
    if (!currentList || currentList.length === 0) return;
    const nextIndex = nextPresetIndexRef.current % currentList.length;
    const nextPreset = currentList[nextIndex];
    if (nextPreset?.name && onPresetSelectRef.current) {
      onPresetSelectRef.current(nextPreset.name);
    }
    nextPresetIndexRef.current = nextIndex + 1;
  }, []);

  useEffect(() => {
    if (isSequencerActive) {
      loadNextPresetInSequence();
    }
  }, [isSequencerActive, loadNextPresetInSequence]);

  useEffect(() => {
    if (sequencerIntervalRef.current) {
      clearInterval(sequencerIntervalRef.current);
      sequencerIntervalRef.current = null;
    }
    if (isSequencerActive) {
      sequencerIntervalRef.current = setInterval(loadNextPresetInSequence, sequencerIntervalMs);
      addToast(`Sequencer started. Interval: ${sequencerIntervalMs / 1000}s`, 'info', 3000);
    }
    return () => {
      if (sequencerIntervalRef.current) {
        clearInterval(sequencerIntervalRef.current);
      }
    };
  }, [isSequencerActive, loadNextPresetInSequence, addToast, sequencerIntervalMs]);

  const handleToggleSequencer = () => {
    if (configData.isConfigLoading || !configData.currentProfileAddress) return;
    setIsSequencerActive(prev => !prev);
  };

  const handleSetSequencerInterval = useCallback((newIntervalMs) => {
    if (typeof newIntervalMs === 'number' && newIntervalMs >= 1000) {
      setSequencerIntervalMs(newIntervalMs);
      addToast(`Sequencer interval set to ${newIntervalMs / 1000} seconds.`, 'success');
    }
  }, [addToast]);

  const actionsWithSequencerControl = useMemo(() => ({ ...actions, onSetSequencerInterval: handleSetSequencerInterval }), [actions, handleSetSequencerInterval]);

  const actualShouldShowUI = useMemo(() => isBaseReady || configData.renderState === 'prompt_connect', [isBaseReady, configData.renderState]);
  const showPresetBar = useMemo(() => actualShouldShowUI && isUiVisible && !activePanel && !!currentProfileAddress, [actualShouldShowUI, isUiVisible, activePanel, currentProfileAddress]);
  const mainUiContainerClass = `ui-elements-container ${actualShouldShowUI && isUiVisible ? "visible" : "hidden-by-opacity"}`;

  return (
    <>
      {actualShouldShowUI && (
        <MemoizedTopRightControls
          isRadarProjectAdmin={isParentAdmin} 
          showInfo={true} 
          showToggleUI={true} 
          showEnhancedView={true}
          onWhitelistClick={() => toggleSidePanel('whitelist')}
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
              <MemoizedGlobalMIDIStatus />
              <button
                className={`toolbar-icon sequencer-toggle-button ${isSequencerActive ? "active" : ""}`}
                onClick={handleToggleSequencer} title={isSequencerActive ? `Stop Preset Sequencer (Interval: ${sequencerIntervalMs / 1000}s)` : `Start Preset Sequencer (Interval: ${sequencerIntervalMs / 1000}s)`}
                aria-label={isSequencerActive ? "Stop Preset Sequencer" : "Start Preset Sequencer"} disabled={configData.isConfigLoading || !configData.currentProfileAddress}
              >
                <SequencerIcon className="icon-image" />
              </button>
              <MemoizedAudioStatusIcon isActive={isAudioActive} onClick={() => uiState.openPanel('audio')} />
            </div>
            {isPreviewMode && (<div className="preview-mode-indicator"><span>👁️</span> Preview Mode</div>)}
            <div className="vertical-toolbar-container">
              <MemoizedVerticalToolbar activePanel={activePanel} setActivePanel={toggleSidePanel} notificationCount={unreadCount} />
            </div>
            <MemoizedActivePanelRenderer
                uiState={uiState}
                audioState={audioState}
                configData={configData}
                actions={actionsWithSequencerControl}
                pLockProps={pLockProps} 
            />
            {showPresetBar && (
              <MemoizedPresetSelectorBar
                savedConfigList={passedSavedConfigList} currentConfigName={configData.currentConfigName}
                onPresetSelect={onPresetSelect} isLoading={isTransitioning || configData.isConfigLoading}
              />
            )}
          </>
        )}
      </div>
      {actualShouldShowUI && ( <MemoizedOverlayRenderer uiState={uiState} /> )}
      {actualShouldShowUI && !visitorUPAddress && ( <GeneralConnectPill /> )}
    </>
  );
}

UIOverlay.propTypes = {
  pLockProps: PropTypes.object.isRequired,
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