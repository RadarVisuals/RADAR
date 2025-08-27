// src/components/Panels/EnhancedControlPanel.jsx
import React, { useCallback, useMemo } from "react";
import PropTypes from "prop-types";

// Local Component Imports
import Panel from "./Panel";
import PLockController from './PLockController';

// Hook Imports
import { useProfileSessionState } from "../../hooks/configSelectors";
import { useMIDI } from "../../context/MIDIContext";
import { BLEND_MODES } from "../../config/global-config";

// Asset Imports
import {
  toplayerIcon,
  middlelayerIcon,
  bottomlayerIcon,
  rotateIcon,
} from "../../assets";

// Styles
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

export const sliderParams = [
  { prop: "speed", label: "SPEED", icon: "slidersIcon_placeholder", min: 0.001, max: 0.1, step: 0.001, formatDecimals: 3 },
  { prop: "size", label: "SIZE", icon: "enlargeIcon_placeholder", min: 0.1, max: 8.0, step: 0.01, formatDecimals: 1 },
  { prop: "opacity", label: "OPACITY", icon: "eyeIcon_placeholder", min: 0, max: 1, step: 0.001, formatDecimals: 2, defaultValue: 1 },
  { prop: "drift", label: "DRIFT", icon: "wavesIcon_placeholder", min: 0, max: 100, step: 0.001, formatDecimals: 1 },
  { prop: "driftSpeed", label: "DRIFT SPEED", icon: "wavezIcon_placeholder", min: 0, max: 1, step: 0.001, formatDecimals: 1 },
  { prop: "xaxis", label: "X POS", icon: "horizontalviewIcon_placeholder", min: -10000, max: 10000, step: 0.001, formatDecimals: 0 },
  { prop: "yaxis", label: "Y POS", icon: "verticalviewIcon_placeholder", min: -10000, max: 10000, step: 0.001, formatDecimals: 0 },
  { prop: "angle", label: "ANGLE", icon: "rotateIcon_placeholder", min: -360, max: 360, step: 0.001, formatDecimals: 1 },
];

const tabToLayerIdMap = { tab1: 3, tab2: 2, tab3: 1 };

const EnhancedControlPanel = ({
  onToggleMinimize,
  onLayerConfigChange,
  layerConfigs,
  activeTab = "tab1",
  onTabChange,
  pLockProps = {},
}) => {
  const { isProfileOwner } = useProfileSessionState();
  const {
    isConnected: midiConnected, midiLearning, learningLayer,
    startMIDILearn, startLayerMIDILearn,
    midiMap, layerMappings,
    startGlobalMIDILearn,
  } = useMIDI();

  const activeLayer = useMemo(() => String(tabToLayerIdMap[activeTab] || 3), [activeTab]);
  const config = useMemo(() => layerConfigs?.[activeLayer] || getDefaultLayerConfigTemplate(), [layerConfigs, activeLayer]);
  
  const handleSliderChange = useCallback((e) => {
    const { name, value } = e.target;
    onLayerConfigChange(activeLayer, name, parseFloat(value), false);
  }, [onLayerConfigChange, activeLayer]);

  const handleEnterMIDILearnMode = useCallback((paramName) => {
    if (!isProfileOwner || !midiConnected) return;
    startMIDILearn(paramName, activeLayer);
  }, [isProfileOwner, midiConnected, startMIDILearn, activeLayer]);

  const handleEnterLayerMIDILearnMode = useCallback((layer) => {
    if (!isProfileOwner || !midiConnected) return;
    startLayerMIDILearn(layer);
  }, [isProfileOwner, midiConnected, startLayerMIDILearn]);

  const handleEnterGlobalMIDILearnMode = useCallback((controlName) => {
    if (!isProfileOwner || !midiConnected) return;
    startGlobalMIDILearn(controlName);
  }, [isProfileOwner, midiConnected, startGlobalMIDILearn]);

  const displayGlobalMidiMapping = useCallback((controlName) => {
    const mapping = midiMap?.global?.[controlName];
    if (!mapping) return "None";
    const ch = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
    if (mapping.type === "cc") return `CC ${mapping.number}${ch}`;
    if (mapping.type === "note") return `Note ${mapping.number}${ch}`;
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
  
  const isPLockMidiLearning = midiLearning?.type === 'global' && midiLearning?.control === 'pLockToggle';

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

      <PLockController
        pLockState={pLockProps.pLockState}
        loopProgress={pLockProps.loopProgress}
        hasLockedParams={pLockProps.hasLockedParams}
        pLockSpeed={pLockProps.pLockSpeed}
        onSetPLockSpeed={pLockProps.onSetPLockSpeed}
        onTogglePLock={pLockProps.onTogglePLock}
        onClearPLocks={pLockProps.onClearPLocks}
        isMidiLearning={isPLockMidiLearning}
        onMapMidi={() => handleEnterGlobalMIDILearnMode('pLockToggle')}
        midiMappingText={displayGlobalMidiMapping('pLockToggle')}
      />

      <div className="vertical-layout control-panel-content">
        {midiConnected && (
          <div className="layer-mappings">
            <div className="layer-mapping-grid">
              {[3, 2, 1].map((layerNum) => (
                <div key={`layer_mapping_${layerNum}`} className={`layer-mapping-item ${activeLayer === String(layerNum) ? "active" : ""}`}>
                  <div className="layer-mapping-label">Layer {layerNum}</div>
                  <div className="layer-mapping-controls">
                    <span className="layer-mapping-text" title={displayLayerMidiMapping(String(layerNum))}>{displayLayerMidiMapping(String(layerNum))}</span>
                    {isProfileOwner && (<button type="button" className={`midi-learn-btn small-action-button ${learningLayer === layerNum ? "learning" : ""}`} onClick={() => handleEnterLayerMIDILearnMode(layerNum)} disabled={!midiConnected || !!midiLearning || (learningLayer !== null && learningLayer !== layerNum)} title={`Map MIDI to select Layer ${layerNum}`}> {learningLayer === layerNum ? "..." : "Map"} </button>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {sliderParams.map(({ prop, label, min, max, step, formatDecimals, defaultValue = 0 }) => {
            const isLearningThis = midiLearning?.type === 'param' && midiLearning?.param === prop && midiLearning?.layer === activeLayer;
            const isLocked = pLockProps.pLockState === 'playing' && pLockProps.animationDataRef?.current?.[activeLayer]?.[prop];
            return (
              <div key={prop} className="slider-container">
                <div className="slider-header">
                  <span className="slider-label">{isLocked && <span className="plock-indicator" title="Parameter Locked">●</span>}{label}</span>
                  <div className="slider-controls">
                    <span className="slider-value">{formatValue(config[prop] ?? defaultValue, formatDecimals)}</span>
                    {midiConnected && isProfileOwner && (<button type="button" className={`midi-btn small-action-button ${isLearningThis ? "learning" : ""}`} onClick={() => handleEnterMIDILearnMode(prop)} disabled={!midiConnected || !!learningLayer || (midiLearning !== null && !isLearningThis)} title={`Map MIDI to ${label}`}> {isLearningThis ? "..." : "M"} </button>)}
                  </div>
                </div>
                <input type="range" name={prop} min={min} max={max} step={step} value={config[prop] ?? defaultValue} onChange={handleSliderChange} disabled={isLearningThis || isLocked} className="horizontal-slider" aria-label={label} />
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
    </Panel>
  );
};

EnhancedControlPanel.propTypes = {
  onToggleMinimize: PropTypes.func.isRequired,
  onLayerConfigChange: PropTypes.func.isRequired,
  layerConfigs: PropTypes.object.isRequired,
  activeTab: PropTypes.string,
  onTabChange: PropTypes.func,
  pLockProps: PropTypes.object,
};

export default React.memo(EnhancedControlPanel);