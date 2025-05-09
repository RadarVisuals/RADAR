// src/components/Panels/EnhancedControlPanel.jsx
import React, { useCallback } from "react";
import PropTypes from "prop-types";
import Panel from "./Panel";
import { useConfig } from "../../context/ConfigContext";
import { useMIDI } from "../../context/MIDIContext";
import {
  slidersIcon,
  toplayerIcon,
  middlelayerIcon,
  bottomlayerIcon,
  rotateIcon,
  enlargeIcon,
  eyeIcon,
  wavesIcon,
  wavezIcon,
  verticalviewIcon,
  horizontalviewIcon,
} from "../../assets";
import "./PanelStyles/EnhancedControlPanel.css";

// Helper function to format numeric values for display
const formatValue = (value, decimals = 1) => {
  if (value === undefined || value === null || isNaN(Number(value)))
    return "0".padEnd(decimals > 0 ? decimals + 1 : 1, "0");
  return Number(value).toFixed(decimals);
};

// Configuration for parameters, exported for use in other components (e.g., MainView MIDI handling)
export const sliderParams = [
  { prop: "speed", label: "SPEED", icon: slidersIcon, min: 0.001, max: 0.1, step: 0.001, formatDecimals: 3 },
  { prop: "size", label: "SIZE", icon: enlargeIcon, min: 0.1, max: 8.0, step: 0.01, formatDecimals: 1 },
  { prop: "opacity", label: "OPACITY", icon: eyeIcon, min: 0, max: 1, step: 0.001, formatDecimals: 2, defaultValue: 1 },
  { prop: "drift", label: "DRIFT", icon: wavesIcon, min: 0, max: 100, step: 0.001, formatDecimals: 1 },
  { prop: "driftSpeed", label: "DRIFT SPEED", icon: wavezIcon, min: 0, max: 1, step: 0.001, formatDecimals: 1 },
  { prop: "xaxis", label: "X POS", icon: horizontalviewIcon, min: -10000, max: 10000, step: 0.001, formatDecimals: 0 },
  { prop: "yaxis", label: "Y POS", icon: verticalviewIcon, min: -10000, max: 10000, step: 0.001, formatDecimals: 0 },
  { prop: "angle", label: "ANGLE", icon: rotateIcon, min: -360, max: 360, step: 0.001, formatDecimals: 1 },
];

// Map tab identifiers to layer IDs (Layer 3 is top, Layer 1 is bottom)
const tabToLayerIdMap = { tab1: 3, tab2: 2, tab3: 1 };

/**
 * EnhancedControlPanel: Provides a compact UI for controlling visual layer parameters
 * (speed, size, opacity, position, etc.) via sliders. Includes layer selection tabs
 * and integrates MIDI learn functionality for mapping controls. Displays MIDI monitor
 * and allows MIDI mapping management.
 */
const EnhancedControlPanel = ({
  layerConfigs,
  onLayerConfigChange,
  blendModes,
  onToggleMinimize, // Function to close/minimize the panel
  activeTab = "tab1",
  onTabChange, // Function to change the active layer tab
  readOnly = false,
}) => {

  const { isVisitor, isParentProfile } = useConfig();
  const {
    isConnected: midiConnected,
    // disconnectMIDI, // No longer needed here if global icon handles it
    midiLearning,
    learningLayer,
    selectedChannel,
    showMidiMonitor,
    midiMonitorData,
    setShowMidiMonitor,
    startMIDILearn,
    stopMIDILearn,
    startLayerMIDILearn,
    stopLayerMIDILearn,
    clearAllMappings,
    setChannelFilter,
    clearMIDIMonitor,
    midiMap, 
    layerMappings,
  } = useMIDI();

  const activeLayer = tabToLayerIdMap[activeTab] || 1;
  const config = layerConfigs?.[activeLayer] || {};

  const handleEnterMIDILearnMode = useCallback(
    (paramName) => {
      if (readOnly && !isParentProfile) return;
      if (!midiConnected) { alert("Please connect a MIDI device first."); return; }
      const isValidParam = sliderParams.some((p) => p.prop === paramName);
      if (!isValidParam) {
          return;
      }
      startMIDILearn(paramName, activeLayer);
    },
    [midiConnected, startMIDILearn, activeLayer, readOnly, isParentProfile],
  );

  const handleEnterLayerMIDILearnMode = useCallback(
    (layer) => {
      if (readOnly && !isParentProfile) return;
      if (!midiConnected) { alert("Please connect a MIDI device first."); return; }
      startLayerMIDILearn(layer);
    },
    [midiConnected, startLayerMIDILearn, readOnly, isParentProfile],
  );

  const handleMidiChannelChange = (e) => { setChannelFilter(parseInt(e.target.value, 10)); };
  const handleClearMidiMonitor = () => { clearMIDIMonitor(); };
  const handleResetAllMappings = () => { clearAllMappings(); };
  const handleToggleMonitor = () => { setShowMidiMonitor(!showMidiMonitor); };
  const handleCancelMIDILearn = () => { stopMIDILearn?.(); };
  const handleCancelLayerMIDILearn = () => { stopLayerMIDILearn?.(); };

  const displayMidiMapping = useCallback(
    (layer, param) => {
      const mapping = midiMap?.[layer]?.[param];
      if (!mapping) return "None";
      const channel = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
      if (mapping.type === "cc") return `CC ${mapping.number}${channel}`;
      if (mapping.type === "note") return `Note ${mapping.number}${channel}`;
      if (mapping.type === "pitchbend") return `Pitch${channel}`;
      return "Unknown";
    },
    [midiMap],
  );

  const displayLayerMidiMapping = useCallback(
    (layer) => {
      const mapping = layerMappings[layer]?.layerSelect;
      if (!mapping) return "-";
      const channel = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
      if (mapping.type === "note") return `Note ${mapping.number}${channel}`;
      return "Unknown";
    },
    [layerMappings],
  );

  const handleSliderChange = (e) => {
    if (readOnly && !isParentProfile) return;
    const { name, value } = e.target;
    onLayerConfigChange(activeLayer, name, parseFloat(value));
  };

  const handleBlendModeChange = (e) => {
    if (readOnly && !isParentProfile) return;
    const { value } = e.target;
    onLayerConfigChange(activeLayer, "blendMode", value);
  };

  const handleDirectionToggle = () => {
    if (readOnly && !isParentProfile) return;
    const currentDirection = config.direction || 1;
    onLayerConfigChange(activeLayer, "direction", -currentDirection);
  };

  const handleEnabledToggle = (e) => {
    if (readOnly && !isParentProfile) return;
    onLayerConfigChange(activeLayer, "enabled", e.target.checked);
  };

  return (
    <Panel
      title={`Layer ${activeLayer} Controls`}
      onClose={onToggleMinimize}
      className="panel-from-toolbar"
    >
      <div className="compact-panel-header">
        <div className="tab-navigation">
          <button key="tab1" className={`tab-button ${activeTab === "tab1" ? "active" : ""}`} onClick={() => onTabChange("tab1")} title={`Layer 3 (Top)`} > <img src={toplayerIcon} alt="L3" className="tab-icon" /> </button>
          <button key="tab2" className={`tab-button ${activeTab === "tab2" ? "active" : ""}`} onClick={() => onTabChange("tab2")} title={`Layer 2 (Middle)`} > <img src={middlelayerIcon} alt="L2" className="tab-icon" /> </button>
          <button key="tab3" className={`tab-button ${activeTab === "tab3" ? "active" : ""}`} onClick={() => onTabChange("tab3")} title={`Layer 1 (Bottom)`} > <img src={bottomlayerIcon} alt="L1" className="tab-icon" /> </button>
        </div>
      </div>

      {(midiLearning || learningLayer !== null) && (
        <div className={`midi-learning-container ${learningLayer !== null ? "layer-learning" : ""}`} >
          <span className="midi-learning">
            {learningLayer !== null ? `Mapping: LAYER ${learningLayer} SELECTION` : `Mapping: ${midiLearning.param.toUpperCase()} for Layer ${midiLearning.layer}`}
          </span>
          <button className="midi-cancel-btn" onClick={ learningLayer !== null ? handleCancelLayerMIDILearn : handleCancelMIDILearn } >
            Cancel
          </button>
        </div>
      )}

      <div className="vertical-layout">
        {midiConnected && (
          <div className="layer-mappings">
            <div className="layer-mapping-grid">
              {[3, 2, 1].map((layer) => ( 
                <div key={`layer_${layer}`} className={`layer-mapping-item ${activeLayer === layer ? "active" : ""}`} >
                  <div className="layer-mapping-label">Layer {layer}</div>
                  <div className="layer-mapping-controls">
                    <span className="layer-mapping-text" title={displayLayerMidiMapping(layer)} >
                      {displayLayerMidiMapping(layer)}
                    </span>
                    <button className={`midi-learn-btn ${learningLayer === layer ? "learning" : ""}`} onClick={() => handleEnterLayerMIDILearnMode(layer)} disabled={ !midiConnected || (readOnly && !isParentProfile) || learningLayer !== null } >
                      {learningLayer === layer ? "..." : "Map"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sliderParams.map(
          ({ prop, label, min, max, step, formatDecimals, defaultValue = 0, }) => {
            const isLearningThis = midiLearning?.param === prop && midiLearning?.layer === activeLayer;
            const displayValue = prop === "opacity" ? config[prop] !== undefined ? config[prop] : 1 : config[prop] || defaultValue;
            return (
              <div key={prop} className="slider-container">
                <div className="slider-header">
                  <span className="slider-label">{label}</span>
                  <div className="slider-controls">
                    <span className="slider-value"> {formatValue(displayValue, formatDecimals)} </span>
                    {midiConnected && (
                      <button className={`midi-btn ${isLearningThis ? "learning" : ""}`} onClick={() => handleEnterMIDILearnMode(prop)} disabled={ !midiConnected || (readOnly && !isParentProfile) || !!midiLearning } title={`MIDI: ${displayMidiMapping(activeLayer, prop)}`} >
                        {isLearningThis ? "..." : "M"}
                      </button>
                    )}
                  </div>
                </div>
                <input type="range" name={prop} min={min} max={max} step={step} value={displayValue} onChange={handleSliderChange} disabled={(readOnly && !isParentProfile) || isLearningThis} className="horizontal-slider" />
              </div>
            );
          },
        )}

        <div className="controls-footer">
          <div className="blendmode-container">
            <label htmlFor="blendModeVertical">BLEND MODE</label>
            <select id="blendModeVertical" className="custom-select blend-mode-select" name="blendMode" value={config.blendMode || "normal"} onChange={handleBlendModeChange} disabled={readOnly && !isParentProfile} >
              {blendModes.map((mode) => ( <option key={mode} value={mode}> {mode.charAt(0).toUpperCase() + mode.slice(1).replace("-", " ")} </option> ))}
            </select>
          </div>
          <button className="changerotation-btn" onClick={handleDirectionToggle} title="Change Direction" disabled={readOnly && !isParentProfile} >
            <img src={rotateIcon} className="changerotation-icon" alt="Rotate" />
          </button>
          <div className="enabled-control-vertical">
            <label htmlFor={`enabled-v-${activeLayer}`}>Enabled</label>
            <input type="checkbox" id={`enabled-v-${activeLayer}`} name="enabled" checked={config.enabled ?? true} onChange={handleEnabledToggle} disabled={readOnly && !isParentProfile} />
          </div>
        </div>

        <div className="midi-tools">
          {midiConnected ? (
            <>
              <button className="midi-monitor-btn" onClick={handleToggleMonitor}> {showMidiMonitor ? "Hide Monitor" : "Show Monitor"} </button>
              <button className="midi-reset-btn" onClick={handleResetAllMappings} title="Reset all MIDI mappings" > Reset Mappings </button>
              <select className="midi-channel-select" value={selectedChannel} onChange={handleMidiChannelChange} title="Filter MIDI messages by channel" >
                <option value="0">All Channels</option>
                {[...Array(16)].map((_, i) => ( <option key={i + 1} value={i + 1}> Channel {i + 1} </option> ))}
              </select>
              {/* The Disconnect MIDI button can be removed from here if the global icon is the sole disconnect point */}
              {/* <button className="midi-disconnect-btn" onClick={handleDisconnectMIDI} title="Disconnect MIDI device">Disconnect MIDI</button> */}
            </>
          ) : (
            <p className="midi-disconnected-message">MIDI Disconnected. Connect via global status icon.</p>
          )}
        </div>
      </div>

      {midiConnected && showMidiMonitor && (
        <div className="midi-monitor">
          <div className="midi-monitor-header">
            <h4>MIDI Monitor</h4>
            <button className="midi-clear-btn" onClick={handleClearMidiMonitor}> Clear </button>
          </div>
          <div className="midi-monitor-content">
            {midiMonitorData.length === 0 ? ( <div className="midi-monitor-empty"> No MIDI messages received yet. </div> ) : (
              midiMonitorData.map((msg, index) => (
                <div key={index} className="midi-monitor-msg">
                  <span className="midi-monitor-time">{msg.timestamp}</span>
                  <span className="midi-monitor-type">{msg.type}</span>
                  <span className="midi-monitor-channel"> Ch {msg.channel + 1} </span>
                  <span className="midi-monitor-data">{msg.data1}</span>
                  <span className="midi-monitor-data">{msg.data2}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isVisitor && isParentProfile && ( <div className="visitor-message"> As a visitor, you can experiment. Changes won't be saved. </div> )}
      {isVisitor && !isParentProfile && ( <div className="visitor-message warning"> Viewing another profile. Controls are disabled. </div> )}
    </Panel>
  );
};

EnhancedControlPanel.propTypes = {
  layerConfigs: PropTypes.object.isRequired,
  onLayerConfigChange: PropTypes.func.isRequired,
  blendModes: PropTypes.arrayOf(PropTypes.string).isRequired,
  onToggleMinimize: PropTypes.func.isRequired,
  activeTab: PropTypes.string,
  onTabChange: PropTypes.func,
  readOnly: PropTypes.bool,
};
EnhancedControlPanel.defaultProps = { activeTab: "tab1", readOnly: false };

export default EnhancedControlPanel;