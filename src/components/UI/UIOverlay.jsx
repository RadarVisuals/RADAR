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
import { useMIDI } from '../../context/MIDIContext';
import { useSetManagement } from '../../context/SetManagementContext';
import { useUserSession } from '../../context/UserSessionContext';

import { useToast } from '../../context/ToastContext';
import { ForwardIcon as SequencerIcon } from '@heroicons/react/24/outline';
import './UIOverlay.css';

const MemoizedTopRightControls = React.memo(TopRightControls);
const MemoizedVerticalToolbar = React.memo(VerticalToolbar);
const MemoizedGlobalMIDIStatus = React.memo(GlobalMIDIStatus);
const MemoizedAudioStatusIcon = React.memo(AudioStatusIcon);
const MemoizedSceneSelectorBar = React.memo(SceneSelectorBar);

const DEFAULT_SEQUENCER_INTERVAL = 0; // Default pause between fades
const DEFAULT_CROSSFADE_DURATION = 1000; // Default fade time is 1 seconds

const GeneralConnectPill = () => {
    return (
        <div className="general-connect-pill">
            Please connect your Universal Profile to begin.
        </div>
    );
};

const ActivePanelRenderer = ({ uiState, audioState, configData, actions, pLockProps, onSceneSelect, sequencerIntervalMs, onSetSequencerInterval, crossfadeDurationMs, onSetCrossfadeDuration }) => {
    const { activePanel, animatingPanel, activeLayerTab, closePanel, setActiveLayerTab } = uiState;
    const { isAudioActive, audioSettings, analyzerData, setIsAudioActive, setAudioSettings } = audioState;
    const { notifications, savedReactions, canSave, isPreviewMode, canInteract, currentProfileAddress, layerConfigs, tokenAssignments, isAutoFading } = configData;
    const { onLayerConfigChange, onMarkNotificationRead, onClearAllNotifications, onSaveReaction, onRemoveReaction, onPreviewEffect, onTokenApplied } = actions;

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
                        onLayerConfigChange={onLayerConfigChange}
                        layerConfigs={layerConfigs}
                        onSceneSelect={onSceneSelect}
                        sequencerIntervalMs={sequencerIntervalMs}
                        onSetSequencerInterval={onSetSequencerInterval}
                        crossfadeDurationMs={crossfadeDurationMs}
                        onSetCrossfadeDuration={onSetCrossfadeDuration}
                        isAutoFading={isAutoFading}
                    />
                </PanelWrapper>
            );
        case "notifications":
            return ( <PanelWrapper key="notifications-panel" className={panelWrapperClassName}><NotificationPanel notifications={notifications} onClose={closePanel} onMarkAsRead={onMarkNotificationRead} onClearAll={onClearAllNotifications} /></PanelWrapper> );
        case "events":
            return canInteract ? ( <PanelWrapper key="events-panel" className={panelWrapperClassName}><EventsPanel onSaveReaction={onSaveReaction} onRemoveReaction={onRemoveReaction} reactions={savedReactions} onClose={closePanel} readOnly={!canSave} onPreviewEffect={onPreviewEffect} /></PanelWrapper> ) : null;
        case "sets":
            return currentProfileAddress && !isPreviewMode ? ( <PanelWrapper key="sets-panel" className={panelWrapperClassName}><SetsPanel onClose={closePanel} /></PanelWrapper> ) : null;
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
    onSceneSelect: PropTypes.func.isRequired,
    sequencerIntervalMs: PropTypes.number,
    onSetSequencerInterval: PropTypes.func,
    crossfadeDurationMs: PropTypes.number,
    onSetCrossfadeDuration: PropTypes.func,
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
    uiState, audioState, configData, actions, savedSceneList,
    pLockProps, isReady = false
  } = props;
  
  const { addToast } = useToast();
  const { stagedSetlist, loadWorkspace, activeWorkspaceName: currentWorkspaceName } = useSetManagement();
  const { isUiVisible, activePanel, toggleSidePanel, toggleInfoOverlay, toggleUiVisibility } = uiState;
  const { isAudioActive } = audioState;
  
  const { isParentAdmin, isPreviewMode, unreadCount, isTransitioning, currentProfileAddress, crossfader, activeSceneName, isAutoFading, renderState, tokenAssignments, isParallaxEnabled } = configData;

  const { onEnhancedView, onSceneSelect, onCrossfaderChange, onToggleParallax } = actions;
  const [isSequencerActive, setIsSequencerActive] = useState(false);
  const sequencerTimeoutRef = useRef(null);
  const nextSceneIndexRef = useRef(0);
  const [sequencerIntervalMs, setSequencerIntervalMs] = useState(DEFAULT_SEQUENCER_INTERVAL);
  const [crossfadeDurationMs, setCrossfadeDurationMs] = useState(DEFAULT_CROSSFADE_DURATION);
  const isMountedRef = useRef(false);
  
  const {
      pendingNextScene, pendingPrevScene,
      pendingNextWorkspace, pendingPrevWorkspace,
      clearPendingActions
  } = useMIDI();

  const workspaceList = useMemo(() => {
    if (!stagedSetlist?.workspaces) return [];
    return Object.keys(stagedSetlist.workspaces)
      .map(name => ({ name }));
  }, [stagedSetlist]);

  useEffect(() => {
    let actionTaken = false;

    if (pendingNextScene) {
      if (savedSceneList.length > 1) {
        const currentIndex = savedSceneList.findIndex(s => s.name === activeSceneName);
        const nextIndex = (currentIndex + 1) % savedSceneList.length;
        onSceneSelect(savedSceneList[nextIndex].name, crossfadeDurationMs);
      }
      actionTaken = true;
    } else if (pendingPrevScene) {
      if (savedSceneList.length > 1) {
        const currentIndex = savedSceneList.findIndex(s => s.name === activeSceneName);
        const prevIndex = (currentIndex - 1 + savedSceneList.length) % savedSceneList.length;
        onSceneSelect(savedSceneList[prevIndex].name, crossfadeDurationMs);
      }
      actionTaken = true;
    } else if (pendingNextWorkspace) {
      if (workspaceList.length > 1) {
        const currentIndex = workspaceList.findIndex(w => w.name === currentWorkspaceName);
        const nextIndex = (currentIndex + 1) % workspaceList.length;
        loadWorkspace(workspaceList[nextIndex].name);
      }
      actionTaken = true;
    } else if (pendingPrevWorkspace) {
      if (workspaceList.length > 1) {
        const currentIndex = workspaceList.findIndex(w => w.name === currentWorkspaceName);
        const prevIndex = (currentIndex - 1 + workspaceList.length) % workspaceList.length;
        loadWorkspace(workspaceList[prevIndex].name);
      }
      actionTaken = true;
    }

    if (actionTaken) {
      clearPendingActions();
    }
  }, [
    pendingNextScene, pendingPrevScene, pendingNextWorkspace, pendingPrevWorkspace,
    activeSceneName, savedSceneList, onSceneSelect, crossfadeDurationMs,
    currentWorkspaceName, workspaceList, loadWorkspace,
    clearPendingActions
  ]);

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; } }, []);
  
  const onSceneSelectRef = useRef(onSceneSelect);
  const savedSceneListRef = useRef(savedSceneList);
  useEffect(() => {
    onSceneSelectRef.current = onSceneSelect;
    savedSceneListRef.current = savedSceneList;
  }, [onSceneSelect, savedSceneList]);

  const runNextSequenceStep = useCallback(() => {
    const currentList = savedSceneListRef.current;
    if (!currentList || currentList.length === 0) {
        setIsSequencerActive(false);
        return;
    }
    const nextIndex = nextSceneIndexRef.current % currentList.length;
    const nextScene = currentList[nextIndex];
    if (nextScene?.name && onSceneSelectRef.current) {
        onSceneSelectRef.current(nextScene.name, crossfadeDurationMs);
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
    if (configData.isConfigLoading || !configData.currentProfileAddress) return;
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
        runNextSequenceStep();
      } else {
        addToast('Sequencer stopped.', 'info', 2000);
        if (sequencerTimeoutRef.current) clearTimeout(sequencerTimeoutRef.current);
      }
      return isActivating;
    });
  };

  const shouldShowUI = useMemo(() => isReady && renderState === 'rendered', [isReady, renderState]);
  const showSceneBar = useMemo(() => shouldShowUI && isUiVisible && !activePanel && !!currentProfileAddress, [shouldShowUI, isUiVisible, activePanel, currentProfileAddress]);
  const mainUiContainerClass = `ui-elements-container ${shouldShowUI && isUiVisible ? "visible" : "hidden-by-opacity"}`;

  if (!isReady) {
    return null;
  }
  
  return (
    <>
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
        isParallaxEnabled={isParallaxEnabled}
        onToggleParallax={onToggleParallax}
      />
      <div className={mainUiContainerClass}>
        {isUiVisible && (
          <>
            <div className="bottom-right-icons">
              <MemoizedGlobalMIDIStatus />
              <button
                className={`toolbar-icon sequencer-toggle-button ${isSequencerActive ? "active" : ""}`}
                onClick={handleToggleSequencer} title={isSequencerActive ? `Stop Scene Sequencer` : `Start Scene Sequencer`}
                aria-label={isSequencerActive ? "Stop Scene Sequencer" : "Start Scene Sequencer"} disabled={configData.isConfigLoading || !configData.currentProfileAddress}
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
                configData={{ ...configData, tokenAssignments }}
                actions={actions}
                pLockProps={pLockProps}
                onSceneSelect={onSceneSelect}
                sequencerIntervalMs={sequencerIntervalMs}
                onSetSequencerInterval={setSequencerIntervalMs}
                crossfadeDurationMs={crossfadeDurationMs}
                onSetCrossfadeDuration={setCrossfadeDurationMs}
            />
            {showSceneBar && (
              <div className="bottom-center-controls">
                <WorkspaceSelectorDots
                  workspaces={workspaceList}
                  activeWorkspaceName={currentWorkspaceName}
                  onSelectWorkspace={loadWorkspace}
                  isLoading={isTransitioning || configData.isConfigLoading || isAutoFading}
                />
                <Crossfader
                  value={crossfader.value}
                  onInput={onCrossfaderChange}
                  onChange={onCrossfaderChange}
                  disabled={isAutoFading}
                />
                <MemoizedSceneSelectorBar
                  savedSceneList={savedSceneList} currentSceneName={activeSceneName}
                  onSceneSelect={(sceneName) => onSceneSelect(sceneName, crossfadeDurationMs)} isLoading={isTransitioning || configData.isConfigLoading || isAutoFading}
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
  savedSceneList: PropTypes.array,
  isReady: PropTypes.bool,
};

UIOverlay.defaultProps = {
  savedSceneList: [],
  isReady: false,
};

export default React.memo(UIOverlay);