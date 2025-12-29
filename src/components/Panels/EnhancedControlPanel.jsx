// src/components/Panels/EnhancedControlPanel.jsx
import React, { useCallback, useMemo, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useShallow } from 'zustand/react/shallow';

import Panel from "./Panel";
import PLockController from './PLockController';
import PerformanceSlider from "../UI/PerformanceSlider"; 

import { useProfileSessionState, useSetManagementState } from "../../hooks/configSelectors";
import { useEngineStore } from "../../store/useEngineStore"; 
import { useProjectStore } from "../../store/useProjectStore"; 
import { useVisualEngine } from "../../hooks/useVisualEngine";
import { useToast } from "../../hooks/useToast";
import { BLEND_MODES } from "../../config/global-config";
import { sliderParams } from "../../config/sliderParams";

import {
  toplayerIcon,
  middlelayerIcon,
  bottomlayerIcon,
  rotateIcon,
} from "../../assets";

import "./PanelStyles/EnhancedControlPanel.css";

const getDefaultLayerConfigTemplate = () => ({
  enabled: true, blendMode: "normal", opacity: 1.0, size: 1.0, speed: 0.01,
  drift: 0, driftSpeed: 0.1, angle: 0, xaxis: 0, yaxis: 0, direction: 1,
  driftState: { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false },
});

const formatValue = (value, decimals = 1) => {
  const numValue = Number(value);
  if (value === undefined || value === null || isNaN(numValue)) return "0".padEnd(decimals > 0 ? decimals + 2 : 1, "0");
  return numValue.toFixed(decimals);
};

const tabToLayerIdMap = { tab1: 3, tab2: 2, tab3: 1 };

const EnhancedControlPanel = ({
  onToggleMinimize,
  activeTab = "tab1",
  onTabChange,
  pLockProps = {},
  sequencerIntervalMs,
  onSetSequencerInterval,
  crossfadeDurationMs,
  onSetCrossfadeDuration,
}) => {
  const { isProfileOwner } = useProfileSessionState();
  const { addToast } = useToast();
  
  const {
    stagedActiveWorkspace,
    fullSceneList: savedSceneList,
    activeSceneName,
    addNewSceneToStagedWorkspace,
    deleteSceneFromStagedWorkspace,
    setDefaultSceneInStagedWorkspace,
    isSaving,
    setActiveSceneName,
  } = useSetManagementState();

  const {
    handleSceneSelect: onSceneSelect,
    updateLayerConfig: onLayerConfigChange,
    uiControlConfig 
  } = useVisualEngine();

  // --- STABLE SELECTORS FOR MIDI ACTIONS ---
  const isAutoFading = useEngineStore(state => state.isAutoFading);
  const isConnected = useEngineStore(state => state.isConnected);
  const midiLearning = useEngineStore(state => state.midiLearning);
  const learningLayer = useEngineStore(state => state.learningLayer);

  // Get stable action references from store to avoid infinite loops
  const setMidiLearning = useEngineStore(state => state.setMidiLearning);
  const setLearningLayer = useEngineStore(state => state.setLearningLayer);

  const stagedSetlist = useProjectStore(s => s.stagedSetlist);
  const midiMap = stagedSetlist?.globalUserMidiMap || {};
  const layerMappings = midiMap.layerSelects || {};
  // -----------------------------------------

  const [newSceneName, setNewSceneName] = useState("");
  const [localIntervalInput, setLocalIntervalInput] = useState(sequencerIntervalMs / 1000);
  const [localDurationInput, setLocalDurationInput] = useState(crossfadeDurationMs / 1000);
  
  useEffect(() => {
    setLocalIntervalInput(sequencerIntervalMs / 1000);
  }, [sequencerIntervalMs]);

  useEffect(() => {
    setLocalDurationInput(crossfadeDurationMs / 1000);
  }, [crossfadeDurationMs]);

  const handleSetInterval = () => {
    const newIntervalSeconds = parseFloat(localIntervalInput);
    if (isNaN(newIntervalSeconds) || newIntervalSeconds < 0) {
      addToast("Interval must be 0 or greater.", "error");
      setLocalIntervalInput(sequencerIntervalMs / 1000);
      return;
    }
    onSetSequencerInterval(newIntervalSeconds * 1000);
    addToast(`Sequencer interval set to ${newIntervalSeconds}s.`, "success");
  };

  const handleSetDuration = () => {
    const newDurationSeconds = parseFloat(localDurationInput);
    if (isNaN(newDurationSeconds) || newDurationSeconds < 0.1) {
      addToast("Crossfade duration must be at least 0.1 seconds.", "error");
      setLocalDurationInput(crossfadeDurationMs / 1000);
      return;
    }
    onSetCrossfadeDuration(newDurationSeconds * 1000);
    addToast(`Crossfade duration set to ${newDurationSeconds}s.`, "success");
  };

  const activeLayer = useMemo(() => String(tabToLayerIdMap[activeTab] || 3), [activeTab]);
  const activeLayerConfigs = uiControlConfig?.layers;
  const config = useMemo(() => activeLayerConfigs?.[activeLayer] || getDefaultLayerConfigTemplate(), [activeLayerConfigs, activeLayer]);
  
  const handleSliderInput = useCallback((name, value) => {
    onLayerConfigChange(activeLayer, name, value, false, true);
  }, [onLayerConfigChange, activeLayer]);

  const handleSliderCommit = useCallback((name, value) => {
    onLayerConfigChange(activeLayer, name, value, false, false);
  }, [onLayerConfigChange, activeLayer]);

  const handleCreateScene = useCallback(() => {
    const name = newSceneName.trim();
    if (!name) {
      addToast("Scene name cannot be empty.", "warning");
      return;
    }
    
    const liveLayersConfig = JSON.parse(JSON.stringify(uiControlConfig.layers));

    const newSceneData = {
      name,
      ts: Date.now(),
      layers: liveLayersConfig,
      tokenAssignments: JSON.parse(JSON.stringify(uiControlConfig.tokenAssignments)),
    };

    addNewSceneToStagedWorkspace(name, newSceneData);
    setActiveSceneName(name);

    addToast(`Scene "${name}" created and staged.`, "success");
    setNewSceneName("");
    
  }, [newSceneName, uiControlConfig, addNewSceneToStagedWorkspace, addToast, setActiveSceneName]);

  const handleDeleteScene = useCallback((nameToDelete) => {
    if (window.confirm(`Are you sure you want to delete the scene "${nameToDelete}"?`)) {
      deleteSceneFromStagedWorkspace(nameToDelete);
      addToast(`Scene "${nameToDelete}" was deleted.`, "info");
    }
  }, [deleteSceneFromStagedWorkspace, addToast]);

  const handleEnterMIDILearnMode = useCallback((paramName) => {
    if (!isProfileOwner || !isConnected) return;
    setMidiLearning({ type: 'param', param: paramName, layer: activeLayer });
  }, [isProfileOwner, isConnected, setMidiLearning, activeLayer]);

  const handleEnterLayerMIDILearnMode = useCallback((layer) => {
    if (!isProfileOwner || !isConnected) return;
    setLearningLayer(layer);
  }, [isProfileOwner, isConnected, setLearningLayer]);

  const handleEnterGlobalMIDILearnMode = useCallback((controlName) => {
    if (!isProfileOwner || !isConnected) return;
    setMidiLearning({ type: 'global', control: controlName });
  }, [isProfileOwner, isConnected, setMidiLearning]);

  const displayGlobalMidiMapping = useCallback((controlName) => {
    const mapping = midiMap?.global?.[controlName];
    if (!mapping) return "None";
    const ch = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
    if (mapping.type === "cc") return `CC ${mapping.number}${ch}`;
    if (mapping.type === "note") return `Note ${mapping.number}${ch}`;
    if (mapping.type === "pitchbend") return `Pitch${ch}`;
    return "Unknown";
  }, [midiMap]);

  const displayLayerMidiMapping = useCallback((layer) => {
    const mapping = layerMappings[String(layer)];
    if (!mapping?.type) return "-";
    const ch = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
    if (mapping.type === "note") return `Note ${mapping.number}${ch}`;
    return "Unknown";
  }, [layerMappings]);

  const handleBlendModeChange = useCallback((e) => onLayerConfigChange(activeLayer, "blendMode", e.target.value, false), [onLayerConfigChange, activeLayer]);
  const handleDirectionToggle = useCallback(() => onLayerConfigChange(activeLayer, "direction", - (config.direction || 1), false), [onLayerConfigChange, activeLayer, config.direction]);
  const handleEnabledToggle = useCallback((e) => onLayerConfigChange(activeLayer, "enabled", e.target.checked, false), [onLayerConfigChange, activeLayer]);
  
  const stopMIDILearn = useCallback(() => setMidiLearning(null), [setMidiLearning]);
  const stopLayerMIDILearn = useCallback(() => setLearningLayer(null), [setLearningLayer]);

  return (
    <Panel title={`Layer ${activeLayer} Controls`} onClose={onToggleMinimize} className="panel-from-toolbar enhanced-control-panel">
      <div className="compact-panel-header">
        <div className="tab-navigation">
          {[3, 2, 1].map(layerNum => (
            <button key={layerNum} type="button" className={`tab-button ${activeLayer === String(layerNum) ? "active" : ""}`} onClick={() => onTabChange(Object.keys(tabToLayerIdMap).find(key => tabToLayerIdMap[key] === layerNum))} title={`Layer ${layerNum}`}>
              <img src={layerNum === 3 ? toplayerIcon : layerNum === 2 ? middlelayerIcon : bottomlayerIcon} alt={`L${layerNum}`} className="tab-icon" />
            </button>
          ))}
        </div>
      </div>

      <PLockController {...pLockProps} />

      <div className="vertical-layout control-panel-content">
        {sliderParams.map(({ prop, label, min, max, step, formatDecimals, defaultValue = 0 }) => {
            const isLearningThis = midiLearning?.type === 'param' && midiLearning?.param === prop && midiLearning?.layer === activeLayer;
            const isLocked = pLockProps.pLockState === 'playing' && pLockProps.animationDataRef?.current?.[activeLayer]?.[prop];
            return (
              <div key={prop} className="slider-container">
                <div className="slider-header">
                  <span className="slider-label">{isLocked && <span className="plock-indicator" title="Parameter Locked">●</span>}{label}</span>
                  <div className="slider-controls">
                    <span className="slider-value">{formatValue(config[prop] ?? defaultValue, formatDecimals)}</span>
                    {isConnected && isProfileOwner && (<button type="button" className={`midi-btn small-action-button ${isLearningThis ? "learning" : ""}`} onClick={() => handleEnterMIDILearnMode(prop)} disabled={!isConnected || !!learningLayer || (midiLearning !== null && !isLearningThis)} title={`Map MIDI to ${label}`}> {isLearningThis ? "..." : "M"} </button>)}
                  </div>
                </div>
                
                <PerformanceSlider 
                    name={prop}
                    layerId={activeLayer}
                    min={min}
                    max={max}
                    step={step}
                    value={config[prop] ?? defaultValue}
                    onChange={handleSliderInput} 
                    onCommit={handleSliderCommit}
                    disabled={isLearningThis || isLocked}
                    className="horizontal-slider"
                    ariaLabel={label}
                />
              </div>
            );
        })}

        <div className="controls-footer">
          <div className="blendmode-container">
            <label htmlFor={`blendModeVertical-${activeLayer}`}>BLEND MODE</label>
            <select id={`blendModeVertical-${activeLayer}`} className="custom-select blend-mode-select" name="blendMode" value={config.blendMode || "normal"} onChange={handleBlendModeChange} aria-label="Select Blend Mode">
              {BLEND_MODES.map((mode) => (<option key={mode} value={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1).replace("-", " ")}</option>))}
            </select>
          </div>
          <button type="button" className="changerotation-btn icon-button" onClick={handleDirectionToggle} title="Change Rotation Direction" aria-label="Change Rotation Direction"><img src={rotateIcon} className="changerotation-icon" alt="Change Rotation" /></button>
          <div className="enabled-control-vertical">
            <label htmlFor={`enabled-v-${activeLayer}`}>Enabled</label>
            <input type="checkbox" id={`enabled-v-${activeLayer}`} name="enabled" checked={config.enabled ?? true} onChange={handleEnabledToggle} />
          </div>
        </div>
      </div>

      <div className="scene-management-section">
        <h4>Scene Management</h4>
        {isProfileOwner && (
          <div className="scene-create-form">
            <input type="text" value={newSceneName} onChange={(e) => setNewSceneName(e.target.value)} className="form-control" placeholder="New Scene Name" disabled={isSaving} />
            <button className="btn btn-sm" onClick={handleCreateScene} disabled={isSaving || !newSceneName.trim()}>Create</button>
          </div>
        )}
        {savedSceneList.length > 0 ? (
          <ul className="scene-list">
            {savedSceneList.map((scene) => (
              <li key={scene.name} className={scene.name === activeSceneName ? "active" : ""}>
                <div className="scene-main-content">
                  <button className="scene-name" onClick={() => onSceneSelect(scene.name, crossfadeDurationMs)} disabled={isSaving} title={`Load "${scene.name}"`}>
                    {scene.name}
                  </button>
                  {stagedActiveWorkspace?.defaultPresetName === scene.name && (<span className="default-scene-tag">(Default)</span>)}
                </div>
                {isProfileOwner && (
                  <div className="scene-actions">
                    <button className="btn-icon" onClick={() => setDefaultSceneInStagedWorkspace(scene.name)} disabled={isSaving || stagedActiveWorkspace?.defaultPresetName === scene.name} title="Set as Default">★</button>
                    <button 
                      className="btn-icon delete-scene" 
                      onClick={() => handleDeleteScene(scene.name)} 
                      disabled={isSaving || savedSceneList.length <= 1} 
                      title={savedSceneList.length <= 1 ? "Cannot delete the last scene" : `Delete "${scene.name}"`}
                    >×</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="no-scenes-message">No scenes saved in this workspace.</p>}
      </div>

      <div className="sequencer-settings-section">
        <h4 className="midi-section-title">Scene Sequencer Settings</h4>
        <div className="sequencer-interval-form">
            <label htmlFor="crossfade-duration-input">Crossfade Duration:</label>
            <input
                id="crossfade-duration-input"
                type="number"
                className="form-control interval-input"
                value={localDurationInput}
                onChange={(e) => setLocalDurationInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetDuration()}
                min="0.1"
                step="0.1"
                disabled={isAutoFading}
            />
            <span className="interval-unit">s</span>
            <button className="btn btn-sm interval-set-button" onClick={handleSetDuration} disabled={isAutoFading}>Set</button>
        </div>
        <div className="sequencer-interval-form">
            <label htmlFor="sequencer-interval-input">Interval Between Fades:</label>
            <input
                id="sequencer-interval-input"
                type="number"
                className="form-control interval-input"
                value={localIntervalInput}
                onChange={(e) => setLocalIntervalInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetInterval()}
                min="0"
                step="0.1"
                disabled={isAutoFading}
            />
            <span className="interval-unit">s</span>
            <button className="btn btn-sm interval-set-button" onClick={handleSetInterval} disabled={isAutoFading}>Set</button>
        </div>
      </div>

      {isConnected && (
        <div className="midi-mappings-section">
          <h4 className="midi-section-title">Global & Layer MIDI Mappings</h4>
          <div className="global-mapping-grid">
            <div className="global-mapping-item">
              <div className="global-mapping-label">Crossfader</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('crossfader')}>{displayGlobalMidiMapping('crossfader')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${midiLearning?.control === 'crossfader' ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('crossfader')} disabled={!isProfileOwner || !isConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Crossfader">{midiLearning?.control === 'crossfader' ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">P-Lock Toggle</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('pLockToggle')}>{displayGlobalMidiMapping('pLockToggle')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${midiLearning?.control === 'pLockToggle' ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('pLockToggle')} disabled={!isProfileOwner || !isConnected || !!midiLearning || !!learningLayer} title="Map MIDI to P-Lock Toggle">{midiLearning?.control === 'pLockToggle' ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">Previous Scene</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('prevScene')}>{displayGlobalMidiMapping('prevScene')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${midiLearning?.control === 'prevScene' ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('prevScene')} disabled={!isProfileOwner || !isConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Previous Scene">{midiLearning?.control === 'prevScene' ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">Next Scene</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('nextScene')}>{displayGlobalMidiMapping('nextScene')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${midiLearning?.control === 'nextScene' ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('nextScene')} disabled={!isProfileOwner || !isConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Next Scene">{midiLearning?.control === 'nextScene' ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">Previous Workspace</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('prevWorkspace')}>{displayGlobalMidiMapping('prevWorkspace')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${midiLearning?.control === 'prevWorkspace' ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('prevWorkspace')} disabled={!isProfileOwner || !isConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Previous Workspace">{midiLearning?.control === 'prevWorkspace' ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">Next Workspace</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('nextWorkspace')}>{displayGlobalMidiMapping('nextWorkspace')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${midiLearning?.control === 'nextWorkspace' ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('nextWorkspace')} disabled={!isProfileOwner || !isConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Next Workspace">{midiLearning?.control === 'nextWorkspace' ? "..." : "Map"}</button>
              </div>
            </div>
          </div>
          <div className="layer-mapping-grid">
            {[3, 2, 1].map((layerNum) => (
              <div key={`layer_mapping_${layerNum}`} className={`layer-mapping-item ${activeLayer === String(layerNum) ? "active" : ""}`}>
                <div className="layer-mapping-label">Layer {layerNum} Select</div>
                <div className="layer-mapping-controls">
                  <span className="layer-mapping-text" title={displayLayerMidiMapping(String(layerNum))}>{displayLayerMidiMapping(String(layerNum))}</span>
                  {isProfileOwner && (<button type="button" className={`midi-learn-btn small-action-button ${learningLayer === layerNum ? "learning" : ""}`} onClick={() => handleEnterLayerMIDILearnMode(layerNum)} disabled={!isConnected || !!midiLearning || (learningLayer !== null && learningLayer !== layerNum)} title={`Map MIDI to select Layer ${layerNum}`}> {learningLayer === layerNum ? "..." : "Map"} </button>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual learning reset UI */}
      {(midiLearning || learningLayer) && (
          <div className="midi-learning-global-cancel">
              <button className="btn btn-sm btn-block btn-secondary" onClick={() => { stopMIDILearn(); stopLayerMIDILearn(); }}>
                  Cancel MIDI Learning
              </button>
          </div>
      )}
    </Panel>
  );
};

EnhancedControlPanel.propTypes = {
  onToggleMinimize: PropTypes.func.isRequired,
  activeTab: PropTypes.string,
  onTabChange: PropTypes.func,
  pLockProps: PropTypes.object,
  sequencerIntervalMs: PropTypes.number,
  onSetSequencerInterval: PropTypes.func,
  crossfadeDurationMs: PropTypes.number,
  onSetCrossfadeDuration: PropTypes.func,
};

export default React.memo(EnhancedControlPanel);