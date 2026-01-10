// src/components/UI/UIOverlay.jsx
import React, { useCallback, useMemo, useEffect, useState } from 'react';
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
    
    const { 
        handleSceneSelect, 
        isAutoFading, 
        uiControlConfig, 
        updateLayerConfig,
    } = useVisualEngine();
    
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
  
  const { 
      renderedCrossfaderValue, 
      isAutoFading, 
      handleSceneSelect, 
      handleCrossfaderChange, 
      handleCrossfaderCommit, 
      transitionMode, 
      toggleTransitionMode,
      processEffect 
  } = useVisualEngine();

  const { unreadCount } = useNotificationContext();
  const { isRadarProjectAdmin, hostProfileAddress: currentProfileAddress, isHostProfileOwner } = useProfileSessionState();

  const isMappingMode = useUIStore(s => s.isMappingMode);
  const isMappingUiVisible = useUIStore(s => s.isMappingUiVisible);
  const isProjectorMode = useUIStore(s => s.isProjectorMode);
  const mappingConfig = useUIStore(s => s.mappingConfig);
  const toggleMappingMode = useUIStore(s => s.toggleMappingMode);
  const setMappingUiVisibility = useUIStore(s => s.setMappingUiVisibility);
  const toggleSidePanel = useUIStore(s => s.togglePanel);

  const { isUiVisible, activePanel, toggleInfoOverlay, toggleUiVisibility, openPanel, closePanel } = uiState;
  const { isAudioActive } = audioState;
  
  const { onEnhancedView, onToggleParallax, toggleSequencer, isSequencerActive, sequencerIntervalMs, setSequencerInterval } = actions;

  const [showReceiverHint, setShowReceiverHint] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Tab' && (isMappingMode || isProjectorMode)) {
        e.preventDefault(); 
        setMappingUiVisibility(!isMappingUiVisible);
      }
      if (e.key?.toLowerCase() === 'f' && isProjectorMode) {
        const root = document.getElementById('fullscreen-root');
        if (root) root.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMappingMode, isMappingUiVisible, setMappingUiVisibility, isProjectorMode]);

  useEffect(() => {
    if (isProjectorMode) {
        const timer = setTimeout(() => setShowReceiverHint(false), 5000);
        return () => clearTimeout(timer);
    }
  }, [isProjectorMode]);

  const workspaceList = useMemo(() => {
    if (!stagedSetlist?.workspaces) return [];
    return Object.keys(stagedSetlist.workspaces).map(name => ({ name }));
  }, [stagedSetlist]);

  const shouldShowInterface = isUiVisible && (!isMappingMode || isMappingUiVisible);
  const showSceneBar = shouldShowInterface && !activePanel && !!currentProfileAddress;
  const mainUiContainerClass = `ui-elements-container ${shouldShowInterface ? "visible" : "hidden-by-opacity"}`;

  const handleReceiverClick = useCallback(() => {
    const root = document.getElementById('fullscreen-root');
    if (root && !document.fullscreenElement) {
        root.requestFullscreen().catch((err) => console.warn("Manual fullscreen failed:", err));
    }
  }, []);

  const memoizedUI = useMemo(() => {
    if (!isReady) return null;

    if (isProjectorMode) {
        return (
            <>
              <VideoMappingOverlay isVisible={true} config={mappingConfig} />
              {isMappingUiVisible && (
                   <div className="projector-calibration-ui" style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 1001, pointerEvents: 'auto' }}>
                      <PanelWrapper className="animating">
                          <MappingPanel onClose={() => setMappingUiVisibility(false)} />
                      </PanelWrapper>
                   </div>
              )}
              <div className="receiver-interaction-layer" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999, pointerEvents: 'auto', cursor: showReceiverHint ? 'pointer' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'transparent' }} onClick={handleReceiverClick} onDoubleClick={() => window.location.reload()} >
                  {showReceiverHint && (
                      <div style={{ padding: '25px', background: 'rgba(0,0,0,0.85)', border: '1px solid var(--color-primary)', borderRadius: '12px', color: 'var(--color-primary)', textAlign: 'center', pointerEvents: 'none', animation: 'fadeIn 0.5s ease-out', boxShadow: '0 0 20px rgba(0, 243, 255, 0.2)' }}>
                          <h2 style={{fontSize: '18px', marginBottom: '12px', letterSpacing: '1px'}}>RECEIVER MODE ACTIVE</h2>
                          <div style={{fontSize: '12px', opacity: 0.9, display: 'flex', flexDirection: 'column', gap: '6px'}}>
                              <p><strong>Single Click:</strong> Fullscreen</p>
                              <p><strong>Tab Key:</strong> Toggle Calibration UI</p>
                              <p><strong>Double Click:</strong> Exit & Reload</p>
                          </div>
                      </div>
                  )}
              </div>
            </>
        );
    }

    return (
      <>
        {import.meta.env.DEV && <SignalDebugger />}
        <VideoMappingOverlay isVisible={isMappingMode} config={mappingConfig} />
        
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

        {shouldShowInterface && (
          <>
            <ActivePanelRenderer
                uiState={uiState}
                audioState={audioState}
                pLockProps={pLockProps}
                onPreviewEffect={processEffect}
                sequencerIntervalMs={sequencerIntervalMs}
                onSetSequencerInterval={setSequencerInterval}
                crossfadeDurationMs={crossfadeDurationMs}
                onSetCrossfadeDuration={onSetCrossfadeDuration}
            />

            <div className={mainUiContainerClass}>
              <div className="bottom-right-icons">
                <MemoizedGlobalMIDIStatus />
                
                {/* SEQUENCER ICON - Forced White */}
                <button
                  className={`toolbar-icon sequencer-toggle-button ${isSequencerActive ? "active" : ""}`}
                  onClick={toggleSequencer} 
                  title={isSequencerActive ? `Stop Scene Sequencer` : `Start Scene Sequencer`}
                  aria-label={isSequencerActive ? "Stop Scene Sequencer" : "Start Scene Sequencer"} 
                  disabled={isConfigLoading || !currentProfileAddress}
                >
                  <SequencerIcon className="icon-image" style={{ color: '#ffffff' }} />
                </button>
                
                {/* MAPPING ICON - Forced White */}
                {isMappingMode && (
                   <button 
                      className={`toolbar-icon ${activePanel === 'mapping' ? 'active' : ''}`}
                      onClick={() => toggleSidePanel('mapping')}
                      title="Iris Mask Calibration"
                   >
                      <ViewfinderCircleIcon className="icon-image" style={{padding: '4px', color: '#ffffff' }} />
                   </button>
                )}
                <MemoizedAudioStatusIcon isActive={isAudioActive} onClick={() => openPanel('audio')} />
              </div>

              <div className="vertical-toolbar-container">
                <MemoizedVerticalToolbar activePanel={activePanel} setActivePanel={toggleSidePanel} notificationCount={unreadCount} />
              </div>

              {showSceneBar && (
                <div className="bottom-center-controls">
                  <WorkspaceSelectorDots workspaces={workspaceList} activeWorkspaceName={currentWorkspaceName} onSelectWorkspace={loadWorkspace} isLoading={isAutoFading || isConfigLoading} />
                  <Crossfader value={renderedCrossfaderValue} onInput={handleCrossfaderChange} onChange={handleCrossfaderCommit} disabled={isAutoFading} />
                  <MemoizedSceneSelectorBar savedSceneList={savedSceneList} currentSceneName={activeSceneName} onSceneSelect={(sceneName) => handleSceneSelect(sceneName, crossfadeDurationMs)} isLoading={isAutoFading || isConfigLoading} />
                </div>
              )}
            </div>
          </>
        )}
        <OverlayRenderer uiState={uiState} />
        {!currentProfileAddress && ( <GeneralConnectPill /> )}
      </>
    );
  }, [
      isReady, isProjectorMode, isMappingMode, mappingConfig, isMappingUiVisible, showReceiverHint,
      isRadarProjectAdmin, isHostProfileOwner, shouldShowInterface, activePanel,
      savedSceneList, activeSceneName, workspaceList, currentWorkspaceName,
      unreadCount, isAudioActive, isSequencerActive, isConfigLoading, currentProfileAddress,
      transitionMode, configData.isParallaxEnabled, renderedCrossfaderValue,
      handleCrossfaderChange, handleCrossfaderCommit, handleSceneSelect, crossfadeDurationMs,
      setSequencerInterval, sequencerIntervalMs, toggleSequencer, toggleInfoOverlay, 
      toggleUiVisibility, onEnhancedView, onToggleParallax, toggleSidePanel, openPanel, 
      uiState, audioState, pLockProps, processEffect
  ]);

  return memoizedUI;
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