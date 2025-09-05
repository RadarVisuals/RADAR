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
import Crossfader from './Crossfader';
import { useMIDI } from '../../context/MIDIContext';

import { useProfileSessionState } from '../../hooks/configSelectors';
import { useToast } from '../../context/ToastContext';
import { ForwardIcon as SequencerIcon } from '@heroicons/react/24/outline';
import './UIOverlay.css';

const MemoizedTopRightControls = React.memo(TopRightControls);
const MemoizedVerticalToolbar = React.memo(VerticalToolbar);
const MemoizedGlobalMIDIStatus = React.memo(GlobalMIDIStatus);
const MemoizedAudioStatusIcon = React.memo(AudioStatusIcon);
const MemoizedPresetSelectorBar = React.memo(PresetSelectorBar);

const DEFAULT_SEQUENCER_INTERVAL = 10000;
const MAX_BUTTON_LABEL_LENGTH = 3;

const getPresetDisplayLabel = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return '?';
  const nameParts = fullName.split('.');
  if (nameParts.length > 1) {
    const identifier = nameParts.slice(1).join('.');
    if (/^\d+$/.test(identifier)) {
      const num = parseInt(identifier, 10);
      return num.toString();
    } else {
      return identifier.substring(0, MAX_BUTTON_LABEL_LENGTH).toUpperCase();
    }
  } else {
    return fullName.substring(0, MAX_BUTTON_LABEL_LENGTH).toUpperCase();
  }
};

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
  const { 
    uiState, audioState, configData, actions, passedSavedConfigList,
    pLockProps 
  } = props;
  
  const { addToast } = useToast();
  const { visitorUPAddress } = useProfileSessionState();
  const { isUiVisible, activePanel, toggleSidePanel, toggleInfoOverlay, toggleUiVisibility } = uiState;
  const { isAudioActive } = audioState;
  
  const { isParentAdmin, isPreviewMode, unreadCount, isTransitioning, isBaseReady, currentProfileAddress, crossfader } = configData;

  const { onEnhancedView, onPresetSelect, onCrossfaderChange } = actions;
  const [isSequencerActive, setIsSequencerActive] = useState(false);
  const sequencerIntervalRef = useRef(null);
  const nextPresetIndexRef = useRef(0);
  const [sequencerIntervalMs, setSequencerIntervalMs] = useState(DEFAULT_SEQUENCER_INTERVAL);
  const isMountedRef = useRef(false);
  
  const { pendingCrossfaderUpdate, liveCrossfaderValue, clearPendingActions } = useMIDI();
  
  const [localCrossfaderValue, setLocalCrossfaderValue] = useState(crossfader.value);

  useEffect(() => {
    if (liveCrossfaderValue !== null) {
        setLocalCrossfaderValue(liveCrossfaderValue);
        onCrossfaderChange(liveCrossfaderValue);
    } else {
        setLocalCrossfaderValue(crossfader.value);
    }
  }, [liveCrossfaderValue, crossfader.value, onCrossfaderChange]);

  const handleCrossfaderInput = useCallback((newValue) => {
    setLocalCrossfaderValue(newValue);
    onCrossfaderChange(newValue);
  }, [onCrossfaderChange]);

  const handleCrossfaderChange = useCallback((newValue) => {
    onCrossfaderChange(newValue);
    if (pendingCrossfaderUpdate) {
        clearPendingActions();
    }
  }, [onCrossfaderChange, pendingCrossfaderUpdate, clearPendingActions]);
  
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; } }, []);
  
  // --- START MODIFICATION: Stabilize callbacks and consolidate useEffect ---

  // Use refs to hold the latest callbacks and data without making them dependencies
  const onPresetSelectRef = useRef(onPresetSelect);
  const passedSavedConfigListRef = useRef(passedSavedConfigList);
  useEffect(() => {
    onPresetSelectRef.current = onPresetSelect;
    passedSavedConfigListRef.current = passedSavedConfigList;
  }, [onPresetSelect, passedSavedConfigList]);

  // Make loadNextPresetInSequence a stable function with no dependencies
  const loadNextPresetInSequence = useCallback(() => {
    const currentList = passedSavedConfigListRef.current;
    if (!currentList || currentList.length === 0) return;

    const nextIndex = nextPresetIndexRef.current % currentList.length;
    const nextPreset = currentList[nextIndex];

    if (nextPreset?.name && onPresetSelectRef.current) {
      onPresetSelectRef.current(nextPreset.name);
    }
    nextPresetIndexRef.current = nextIndex + 1;
  }, []);

  // Consolidate all sequencer logic into a single, clean useEffect hook
  useEffect(() => {
    if (sequencerIntervalRef.current) {
      clearInterval(sequencerIntervalRef.current);
    }

    if (isSequencerActive) {
      addToast(`Sequencer started. Interval: ${sequencerIntervalMs / 1000}s`, 'info', 3000);
      
      const tick = () => {
        if (isMountedRef.current) {
          loadNextPresetInSequence();
        }
      };
      
      // Load the first preset immediately upon activation
      tick();
      
      // Then set the interval for subsequent presets
      sequencerIntervalRef.current = setInterval(tick, sequencerIntervalMs);
    } else if (sequencerIntervalRef.current) {
        // This condition is met when isSequencerActive becomes false
        addToast('Sequencer stopped.', 'info', 2000);
    }

    // Cleanup function to clear the interval
    return () => {
      if (sequencerIntervalRef.current) {
        clearInterval(sequencerIntervalRef.current);
      }
    };
  }, [isSequencerActive, sequencerIntervalMs, addToast, loadNextPresetInSequence]); // Dependencies are stable

  const handleToggleSequencer = () => {
    if (configData.isConfigLoading || !configData.currentProfileAddress) return;
    
    setIsSequencerActive(prev => {
      const isActivating = !prev;
      if (isActivating) {
        const currentList = passedSavedConfigList;
        if (currentList && currentList.length > 0) {
          const currentIndex = currentList.findIndex(p => p.name === configData.currentConfigName);
          // Set the ref to the index of the NEXT preset
          nextPresetIndexRef.current = (currentIndex === -1 ? 0 : currentIndex + 1);
        } else {
          nextPresetIndexRef.current = 0;
        }
      }
      return isActivating;
    });
  };
  
  // --- END MODIFICATION ---

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
              <div className="bottom-center-controls">
                <Crossfader
                  value={localCrossfaderValue}
                  onInput={handleCrossfaderInput}
                  onChange={handleCrossfaderChange}
                />
                <MemoizedPresetSelectorBar
                  savedConfigList={passedSavedConfigList} currentConfigName={configData.currentConfigName}
                  onPresetSelect={onPresetSelect} isLoading={isTransitioning || configData.isConfigLoading}
                />
              </div>
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