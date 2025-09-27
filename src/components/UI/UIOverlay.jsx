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
import SetsPanel from '../Panels/SetsPanel';
import AudioControlPanel from '../Audio/AudioControlPanel';
import TokenSelectorOverlay from '../Panels/TokenSelectorOverlay';
import InfoOverlay from '../Panels/InfoOverlay';
import GlobalMIDIStatus from '../MIDI/GlobalMIDIStatus';
import AudioStatusIcon from '../Audio/AudioStatusIcon';
import SceneSelectorBar from './SceneSelectorBar';
import LibraryPanel from '../Panels/LibraryPanel';
import Crossfader from './Crossfader';
import WorkspaceSelectorDots from './WorkspaceSelectorDots';
import { useWorkspaceContext } from '../../context/WorkspaceContext';
import { useVisualEngineContext } from '../../context/VisualEngineContext';
import { useNotificationContext } from '../../context/NotificationContext';
import { useUserSession } from '../../context/UserSessionContext';

import { useToast } from '../../context/ToastContext';
import { ForwardIcon as SequencerIcon } from '@heroicons/react/24/outline';
import './UIOverlay.css';

const MemoizedTopRightControls = React.memo(TopRightControls);
const MemoizedVerticalToolbar = React.memo(VerticalToolbar);
const MemoizedGlobalMIDIStatus = React.memo(GlobalMIDIStatus);
const MemoizedAudioStatusIcon = React.memo(AudioStatusIcon);
const MemoizedSceneSelectorBar = React.memo(SceneSelectorBar);

const DEFAULT_SEQUENCER_INTERVAL = 0;

const GeneralConnectPill = () => {
    return (
        <div className="general-connect-pill">
            Please connect your Universal Profile to begin.
        </div>
    );
};

const ActivePanelRenderer = (props) => {
    const { 
      uiState, audioState, pLockProps, onPreviewEffect,
      sequencerIntervalMs, onSetSequencerInterval, // <-- Receive from props
      crossfadeDurationMs, onSetCrossfadeDuration, // <-- Receive from props
    } = props;
    const { activePanel, animatingPanel, activeLayerTab, closePanel, setActiveLayerTab } = uiState;
    const { isAudioActive, audioSettings, analyzerData, setIsAudioActive, setAudioSettings } = audioState;
    
    const { handleSceneSelect, updateTokenAssignment, isAutoFading, uiControlConfig, updateLayerConfig } = useVisualEngineContext();
    
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
                        pLockProps={pLockProps}
                        onSceneSelect={(sceneName) => handleSceneSelect(sceneName, crossfadeDurationMs)}
                        sequencerIntervalMs={sequencerIntervalMs}
                        onSetSequencerInterval={onSetSequencerInterval}
                        crossfadeDurationMs={crossfadeDurationMs}
                        onSetCrossfadeDuration={onSetCrossfadeDuration}
                        isAutoFading={isAutoFading}
                        activeLayerConfigs={uiControlConfig?.layers}
                        onLayerConfigChange={updateLayerConfig}
                    />
                </PanelWrapper>
            );
        case "notifications":
            return ( <PanelWrapper key="notifications-panel" className={panelWrapperClassName}><NotificationPanel onClose={closePanel} /></PanelWrapper> );
        case "events":
            return ( <PanelWrapper key="events-panel" className={panelWrapperClassName}><EventsPanel onClose={closePanel} onPreviewEffect={onPreviewEffect} /></PanelWrapper> );
        case "sets":
            return ( <PanelWrapper key="sets-panel" className={panelWrapperClassName}><SetsPanel onClose={closePanel} /></PanelWrapper> );
        case "save":
            return ( <PanelWrapper key="save-panel" className={panelWrapperClassName}><EnhancedSavePanel onClose={closePanel} /></PanelWrapper> );
        case "audio":
            return ( <PanelWrapper key="audio-panel" className={panelWrapperClassName}><AudioControlPanel onClose={closePanel} isAudioActive={isAudioActive} setIsAudioActive={setIsAudioActive} audioSettings={audioSettings} setAudioSettings={setAudioSettings} analyzerData={analyzerData} /></PanelWrapper> );
        case "whitelist":
            return ( <PanelWrapper key="whitelist-panel" className={panelWrapperClassName}><LibraryPanel onClose={closePanel} /></PanelWrapper> );
        case "tokens":
            return ( <TokenSelectorOverlay key="token-selector-overlay" isOpen={activePanel === "tokens"} onClose={handleTokenSelectorClose} onTokenApplied={updateTokenAssignment} /> );
        default:
            return null;
    }
};
ActivePanelRenderer.propTypes = {
    uiState: PropTypes.object.isRequired,
    audioState: PropTypes.object.isRequired,
    pLockProps: PropTypes.object.isRequired,
    onPreviewEffect: PropTypes.func.isRequired,
    sequencerIntervalMs: PropTypes.number.isRequired,
    onSetSequencerInterval: PropTypes.func.isRequired,
    crossfadeDurationMs: PropTypes.number.isRequired,
    onSetCrossfadeDuration: PropTypes.func.isRequired,
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

function UIOverlay({
  uiState,
  audioState,
  pLockProps,
  isReady = false, // Default value here replaces defaultProps
  actions,
  configData,
  crossfadeDurationMs,
  onSetCrossfadeDuration,
}) {
  const { addToast } = useToast();
  const { stagedSetlist, loadWorkspace, activeWorkspaceName: currentWorkspaceName, isLoading: isConfigLoading, activeSceneName, fullSceneList: savedSceneList } = useWorkspaceContext();
  const { renderedCrossfaderValue, isAutoFading, handleSceneSelect, handleCrossfaderChange } = useVisualEngineContext();
  const { unreadCount } = useNotificationContext();
  const { isRadarProjectAdmin, hostProfileAddress: currentProfileAddress } = useUserSession();
  const { isUiVisible, activePanel, toggleSidePanel, toggleInfoOverlay, toggleUiVisibility } = uiState;
  const { isAudioActive } = audioState;
  
  const { onEnhancedView, onToggleParallax, onPreviewEffect } = actions;
  const [isSequencerActive, setIsSequencerActive] = useState(false);
  const sequencerTimeoutRef = useRef(null);
  const nextSceneIndexRef = useRef(0);
  const isMountedRef = useRef(false);

  // --- THIS IS THE FIX: State is now held in the correct parent component ---
  const [sequencerIntervalMs, setSequencerIntervalMs] = useState(DEFAULT_SEQUENCER_INTERVAL);
  // --- END FIX ---

  const workspaceList = useMemo(() => {
    if (!stagedSetlist?.workspaces) return [];
    return Object.keys(stagedSetlist.workspaces)
      .map(name => ({ name }));
  }, [stagedSetlist]);

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; } }, []);
  
  const handleSceneSelectRef = useRef(handleSceneSelect);
  const savedSceneListRef = useRef(savedSceneList);
  useEffect(() => {
    handleSceneSelectRef.current = handleSceneSelect;
    savedSceneListRef.current = savedSceneList;
  }, [handleSceneSelect, savedSceneList]);

  const runNextSequenceStep = useCallback(() => {
    const currentList = savedSceneListRef.current;
    if (!currentList || currentList.length === 0) {
        setIsSequencerActive(false);
        return;
    }
    const nextIndex = nextSceneIndexRef.current % currentList.length;
    const nextScene = currentList[nextIndex];
    if (nextScene?.name && handleSceneSelectRef.current) {
        handleSceneSelectRef.current(nextScene.name, crossfadeDurationMs);
    }
    nextSceneIndexRef.current = nextIndex + 1;
  }, [crossfadeDurationMs]);

  useEffect(() => {
    if (sequencerTimeoutRef.current) clearTimeout(sequencerTimeoutRef.current);
    if (isSequencerActive && !isAutoFading) {
        sequencerTimeoutRef.current = setTimeout(runNextSequenceStep, sequencerIntervalMs);
    }
    return () => { if (sequencerTimeoutRef.current) clearTimeout(sequencerTimeoutRef.current); };
  }, [isSequencerActive, isAutoFading, sequencerIntervalMs, runNextSequenceStep]);

  const handleToggleSequencer = () => {
    if (isConfigLoading || !currentProfileAddress) return;
    setIsSequencerActive(prev => {
      const isActivating = !prev;
      if (isActivating) {
        addToast(`Sequencer started.`, 'info', 3000);
        const currentList = savedSceneList;
        if (currentList && currentList.length > 0) {
          const currentIndex = currentList.findIndex(p => p.name === activeSceneName);
          nextSceneIndexRef.current = (currentIndex === -1 ? 0 : currentIndex + 1);
        } else {
          nextSceneIndexRef.current = 0;
        }
        // --- THIS IS THE FIX: Removed the immediate imperative call ---
        // runNextSequenceStep(); // <--- REMOVED
        // The useEffect hook will now handle the first step after the initial interval.
      } else {
        addToast('Sequencer stopped.', 'info', 2000);
        if (sequencerTimeoutRef.current) clearTimeout(sequencerTimeoutRef.current);
      }
      return isActivating;
    });
  };

  // --- FIX: Logic simplified and corrected ---
  const shouldShowUI = useMemo(() => isReady, [isReady]);
  const showSceneBar = useMemo(() => shouldShowUI && isUiVisible && !activePanel && !!currentProfileAddress, [shouldShowUI, isUiVisible, activePanel, currentProfileAddress]);
  const mainUiContainerClass = `ui-elements-container ${shouldShowUI && isUiVisible ? "visible" : "hidden-by-opacity"}`;
  // --- END FIX ---

  if (!isReady) {
    return null;
  }
  
  return (
    <>
      {isReady && <MemoizedTopRightControls
        isRadarProjectAdmin={isRadarProjectAdmin} 
        showInfo={true} 
        showToggleUI={true} 
        showEnhancedView={true}
        onWhitelistClick={() => toggleSidePanel('whitelist')}
        onInfoClick={toggleInfoOverlay} 
        onToggleUI={toggleUiVisibility} 
        onEnhancedView={onEnhancedView} 
        isUiVisible={isUiVisible}
        isParallaxEnabled={configData.isParallaxEnabled}
        onToggleParallax={onToggleParallax}
      />}
      <div className={mainUiContainerClass}>
        {isUiVisible && (
          <>
            <div className="bottom-right-icons">
              <MemoizedGlobalMIDIStatus />
              <button
                className={`toolbar-icon sequencer-toggle-button ${isSequencerActive ? "active" : ""}`}
                onClick={handleToggleSequencer} title={isSequencerActive ? `Stop Scene Sequencer` : `Start Scene Sequencer`}
                aria-label={isSequencerActive ? "Stop Scene Sequencer" : "Start Scene Sequencer"} disabled={isConfigLoading || !currentProfileAddress}
              >
                <SequencerIcon className="icon-image" />
              </button>
              <MemoizedAudioStatusIcon isActive={isAudioActive} onClick={() => uiState.openPanel('audio')} />
            </div>
            {isReady && <div className="vertical-toolbar-container">
              <MemoizedVerticalToolbar activePanel={activePanel} setActivePanel={toggleSidePanel} notificationCount={unreadCount} />
            </div>}
            <MemoizedActivePanelRenderer
                uiState={uiState}
                audioState={audioState}
                pLockProps={pLockProps}
                onPreviewEffect={onPreviewEffect}
                sequencerIntervalMs={sequencerIntervalMs}
                onSetSequencerInterval={setSequencerIntervalMs}
                crossfadeDurationMs={crossfadeDurationMs}
                onSetCrossfadeDuration={onSetCrossfadeDuration}
            />
            {showSceneBar && (
              <div className="bottom-center-controls">
                <WorkspaceSelectorDots
                  workspaces={workspaceList}
                  activeWorkspaceName={currentWorkspaceName}
                  onSelectWorkspace={loadWorkspace}
                  isLoading={isAutoFading || isConfigLoading}
                />
                <Crossfader
                  value={renderedCrossfaderValue}
                  onInput={handleCrossfaderChange}
                  onChange={handleCrossfaderChange}
                  disabled={isAutoFading}
                />
                <MemoizedSceneSelectorBar
                  savedSceneList={savedSceneList} currentSceneName={activeSceneName}
                  onSceneSelect={(sceneName) => handleSceneSelect(sceneName, crossfadeDurationMs)} isLoading={isAutoFading || isConfigLoading}
                />
              </div>
            )}
          </>
        )}
      </div>
      <MemoizedOverlayRenderer uiState={uiState} />
      {!currentProfileAddress && ( <GeneralConnectPill /> )}
    </>
  );
}

UIOverlay.propTypes = {
  pLockProps: PropTypes.object.isRequired,
  uiState: PropTypes.object.isRequired,
  audioState: PropTypes.object.isRequired,
  configData: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
  isReady: PropTypes.bool,
  crossfadeDurationMs: PropTypes.number.isRequired,
  onSetCrossfadeDuration: PropTypes.func.isRequired,
};

export default React.memo(UIOverlay);