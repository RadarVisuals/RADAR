// src/components/UI/UIOverlay.jsx
import React, { useCallback, useMemo, useEffect } from 'react';
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
import MappingPanel from '../Panels/MappingPanel'; 
import TokenSelectorOverlay from '../Panels/TokenSelectorOverlay';
import InfoOverlay from '../Panels/InfoOverlay';
import GlobalMIDIStatus from '../MIDI/GlobalMIDIStatus';
import AudioStatusIcon from '../Audio/AudioStatusIcon';
import SceneSelectorBar from './SceneSelectorBar';
import LibraryPanel from '../Panels/LibraryPanel';
import ModulationPanel from '../Panels/ModulationPanel'; 
import Crossfader from './Crossfader';
import WorkspaceSelectorDots from './WorkspaceSelectorDots';
import SignalDebugger from '../Debug/SignalDebugger';
import VideoMappingOverlay from './VideoMappingOverlay'; 

import { useUIStore } from '../../store/useUIStore'; 
import { useSetManagementState, useProfileSessionState } from '../../hooks/configSelectors';
import { useVisualEngine } from '../../hooks/useVisualEngine';
import { useNotificationContext } from '../../hooks/useNotificationContext';

import { ForwardIcon as SequencerIcon, ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import './UIOverlay.css';

const MemoizedTopRightControls = React.memo(TopRightControls);
const MemoizedVerticalToolbar = React.memo(VerticalToolbar);
const MemoizedGlobalMIDIStatus = React.memo(GlobalMIDIStatus);
const MemoizedAudioStatusIcon = React.memo(AudioStatusIcon);
const MemoizedSceneSelectorBar = React.memo(SceneSelectorBar);

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
      sequencerIntervalMs, onSetSequencerInterval, 
      crossfadeDurationMs, onSetCrossfadeDuration, 
    } = props;
    const { activePanel, animatingPanel, activeLayerTab, closePanel, setActiveLayerTab } = uiState;
    const { isAudioActive, audioSettings, analyzerData, setIsAudioActive, setAudioSettings } = audioState;
    
    const { handleSceneSelect, isAutoFading, uiControlConfig, updateLayerConfig } = useVisualEngine();
    
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
        case "modulation":
            return ( <PanelWrapper key="modulation-panel" className={panelWrapperClassName}><ModulationPanel onClose={closePanel} /></PanelWrapper> );
        case "mapping":
            return ( <PanelWrapper key="mapping-panel" className={panelWrapperClassName}><MappingPanel onClose={closePanel} /></PanelWrapper> );
        case "tokens":
            return ( <TokenSelectorOverlay key="token-selector-overlay" isOpen={activePanel === "tokens"} onClose={handleTokenSelectorClose} /> );
        default:
            return null;
    }
};

const OverlayRenderer = ({ uiState }) => {
    const { infoOverlayOpen, toggleInfoOverlay } = uiState;
    return infoOverlayOpen ? <InfoOverlay isOpen={infoOverlayOpen} onClose={toggleInfoOverlay} /> : null;
};

function UIOverlay({
  uiState,
  audioState,
  pLockProps,
  isReady = false,
  actions,
  configData,
  crossfadeDurationMs,
  onSetCrossfadeDuration,
}) {
  const { 
    stagedSetlist, 
    loadWorkspace, 
    activeWorkspaceName: currentWorkspaceName, 
    isLoading: isConfigLoading, 
    activeSceneName, 
    fullSceneList: savedSceneList 
  } = useSetManagementState();
  
  const { renderedCrossfaderValue, isAutoFading, handleSceneSelect, handleCrossfaderChange, handleCrossfaderCommit, transitionMode, toggleTransitionMode } = useVisualEngine();
  const { unreadCount } = useNotificationContext();
  const { isRadarProjectAdmin, hostProfileAddress: currentProfileAddress, isHostProfileOwner } = useProfileSessionState();

  // --- VIDEO MAPPING STORE CONNECTIONS ---
  const isMappingMode = useUIStore(s => s.isMappingMode);
  const isMappingUiVisible = useUIStore(s => s.isMappingUiVisible);
  const mappingConfig = useUIStore(s => s.mappingConfig);
  const toggleMappingMode = useUIStore(s => s.toggleMappingMode);
  const setMappingUiVisibility = useUIStore(s => s.setMappingUiVisibility);
  const toggleSidePanel = useUIStore(s => s.togglePanel);

  const { isUiVisible, activePanel, toggleInfoOverlay, toggleUiVisibility, openPanel, closePanel } = uiState;
  const { isAudioActive } = audioState;
  
  const { onEnhancedView, onToggleParallax, onPreviewEffect, toggleSequencer, isSequencerActive, sequencerIntervalMs, setSequencerInterval } = actions;

  // --- KEYBOARD EVENT LISTENER (TAB KEY) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Intercept TAB when in mapping mode to hide/show the interface
      if (e.key === 'Tab' && isMappingMode) {
        e.preventDefault(); 
        setMappingUiVisibility(!isMappingUiVisible);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMappingMode, isMappingUiVisible, setMappingUiVisibility]);

  const workspaceList = useMemo(() => {
    if (!stagedSetlist?.workspaces) return [];
    return Object.keys(stagedSetlist.workspaces).map(name => ({ name }));
  }, [stagedSetlist]);

  // Main UI Visibility Logic: Show interface if UI is ON AND (we aren't mapping OR mapping UI is toggled ON)
  const shouldShowInterface = isUiVisible && (!isMappingMode || isMappingUiVisible);
  const showSceneBar = shouldShowInterface && !activePanel && !!currentProfileAddress;
  const mainUiContainerClass = `ui-elements-container ${shouldShowInterface ? "visible" : "hidden-by-opacity"}`;

  if (!isReady) return null;
  
  return (
    <>
      {import.meta.env.DEV && <SignalDebugger />}

      {/* 1. THE MASK: Always renders if mode is ON, ignoring interface visibility */}
      <VideoMappingOverlay isVisible={isMappingMode} config={mappingConfig} />

      {/* 2. SAFETY CONTROLS: TopRight always rendered so user can escape or fix UI toggle */}
      {isReady && (
        <MemoizedTopRightControls
          isRadarProjectAdmin={isRadarProjectAdmin}
          isHostProfileOwner={isHostProfileOwner}
          onWhitelistClick={() => toggleSidePanel('whitelist')}
          onInfoClick={toggleInfoOverlay} 
          onToggleUI={toggleUiVisibility} 
          onEnhancedView={onEnhancedView} 
          isUiVisible={shouldShowInterface} 
          isParallaxEnabled={configData.isParallaxEnabled}
          onToggleParallax={onToggleParallax}
          transitionMode={transitionMode}
          onToggleTransitionMode={toggleTransitionMode}
          isMappingMode={isMappingMode}
          onToggleMapping={toggleMappingMode}
        />
      )}

      {/* 3. THE INTERACTIVE INTERFACE: This is what TAB toggles */}
      {shouldShowInterface && (
        <>
          <ActivePanelRenderer
              uiState={uiState}
              audioState={audioState}
              pLockProps={pLockProps}
              onPreviewEffect={onPreviewEffect}
              sequencerIntervalMs={sequencerIntervalMs}
              onSetSequencerInterval={setSequencerInterval}
              crossfadeDurationMs={crossfadeDurationMs}
              onSetCrossfadeDuration={onSetCrossfadeDuration}
          />

          <div className={mainUiContainerClass}>
            <div className="bottom-right-icons">
              <MemoizedGlobalMIDIStatus />
              <button
                className={`toolbar-icon sequencer-toggle-button ${isSequencerActive ? "active" : ""}`}
                onClick={toggleSequencer} 
                title={isSequencerActive ? `Stop Scene Sequencer` : `Start Scene Sequencer`}
                aria-label={isSequencerActive ? "Stop Scene Sequencer" : "Start Scene Sequencer"} 
                disabled={isConfigLoading || !currentProfileAddress}
              >
                <SequencerIcon className="icon-image" />
              </button>
              
              {/* Dedicated toggle for the Calibration Panel while Mapping */}
              {isMappingMode && (
                 <button 
                    className={`toolbar-icon ${activePanel === 'mapping' ? 'active' : ''}`}
                    onClick={() => toggleSidePanel('mapping')}
                    title="Iris Mask Calibration"
                 >
                    <ViewfinderCircleIcon className="icon-image" style={{padding: '4px'}} />
                 </button>
              )}

              <MemoizedAudioStatusIcon isActive={isAudioActive} onClick={() => openPanel('audio')} />
            </div>

            <div className="vertical-toolbar-container">
              <MemoizedVerticalToolbar activePanel={activePanel} setActivePanel={toggleSidePanel} notificationCount={unreadCount} />
            </div>

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
                  onChange={handleCrossfaderCommit}
                  disabled={isAutoFading}
                />

                <MemoizedSceneSelectorBar
                  savedSceneList={savedSceneList} 
                  currentSceneName={activeSceneName}
                  onSceneSelect={(sceneName) => handleSceneSelect(sceneName, crossfadeDurationMs)} 
                  isLoading={isAutoFading || isConfigLoading}
                />
              </div>
            )}
          </div>
        </>
      )}

      <OverlayRenderer uiState={uiState} />
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