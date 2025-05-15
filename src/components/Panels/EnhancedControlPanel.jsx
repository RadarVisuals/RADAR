// src/components/Panels/EnhancedControlPanel.jsx
import React, { useCallback, useMemo, useEffect, useRef } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import { useProfileSessionState, useVisualLayerState } from "../../hooks/configSelectors";
import { useMIDI } from "../../context/MIDIContext";

import {
  toplayerIcon,
  middlelayerIcon,
  bottomlayerIcon,
  rotateIcon,
} from "../../assets";

import "./PanelStyles/EnhancedControlPanel.css";

const getDefaultLayerConfigTemplate = () => ({
  enabled: true,
  blendMode: "normal",
  opacity: 1.0,
  size: 1.0,
  speed: 0.01,
  drift: 0,
  driftSpeed: 0.1,
  angle: 0,
  xaxis: 0,
  yaxis: 0,
  direction: 1,
  driftState: {
    x: 0,
    y: 0,
    phase: Math.random() * Math.PI * 2,
    enabled: false,
  },
});


const formatValue = (value, decimals = 1) => {
  const numValue = Number(value);
  if (value === undefined || value === null || isNaN(numValue)) {
    return "0".padEnd(decimals > 0 ? decimals + 2 : 1, "0");
  }
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
  onLayerConfigChange,
  blendModes,
  onToggleMinimize,
  activeTab = "tab1",
  onTabChange,
}) => {
  const { 
    isVisitor, 
    isParentAdmin, 
    isPreviewMode,      // Still available for context
    canSave,            // For "Reset Mappings" button logic
    isProfileOwner,     // To show/hide MIDI Learn buttons
    // hostCanInteract, // We will use hostProfileAddress directly for enabling most controls
    currentProfileAddress: hostProfileAddress 
  } = useProfileSessionState();
  const { layerConfigs } = useVisualLayerState();

  // Layer parameter controls are disabled if no hostProfileAddress is loaded
  const disableHostLayerControls = useMemo(() => !hostProfileAddress, [hostProfileAddress]);

  const {
    isConnected: midiConnected,
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

  const activeLayer = useMemo(() => tabToLayerIdMap[activeTab] || 1, [activeTab]);
  const config = useMemo(() => layerConfigs?.[activeLayer] || getDefaultLayerConfigTemplate(), [layerConfigs, activeLayer]);

  const midiMonitorRef = useRef(null);

  useEffect(() => {
    if (midiMonitorRef.current && showMidiMonitor) {
      midiMonitorRef.current.scrollTop = midiMonitorRef.current.scrollHeight;
    }
  }, [midiMonitorData, showMidiMonitor]);

  const handleEnterMIDILearnMode = useCallback(
    (paramName) => {
      if (!isProfileOwner) return; 
      if (!midiConnected) { alert("Please connect a MIDI device first to enable MIDI Learn."); return; }
      const isValidParam = sliderParams.some((p) => p.prop === paramName);
      if (!isValidParam) {
        if (import.meta.env.DEV) console.warn(`[ECP] Attempted to learn MIDI for invalid param: ${paramName}`);
        return;
      }
      startMIDILearn(paramName, activeLayer);
    },
    [isProfileOwner, midiConnected, startMIDILearn, activeLayer],
  );

  const handleEnterLayerMIDILearnMode = useCallback(
    (layer) => {
      if (!isProfileOwner) return; 
      if (!midiConnected) { alert("Please connect a MIDI device first."); return; }
      startLayerMIDILearn(layer);
    },
    [isProfileOwner, midiConnected, startLayerMIDILearn],
  );

  const handleMidiChannelChange = useCallback((e) => { setChannelFilter(parseInt(e.target.value, 10)); }, [setChannelFilter]);
  const handleClearMidiMonitor = useCallback(() => { clearMIDIMonitor(); }, [clearMIDIMonitor]);
  
  const handleResetAllMappings = useCallback(() => {
    // Reset button is disabled if no host profile, or if in preview mode (via canSave), or if not owner (via canSave)
    if (disableHostLayerControls || !canSave) { 
      if (import.meta.env.DEV) {
        console.warn("[ECP] Reset all MIDI mappings (for host profile) blocked. DisableHostControls:", disableHostLayerControls, "CanSave:", canSave);
      }
      return;
    }
    clearAllMappings();
  }, [disableHostLayerControls, canSave, clearAllMappings]);

  const handleToggleMonitor = useCallback(() => { setShowMidiMonitor(prev => !prev); }, [setShowMidiMonitor]);
  const handleCancelMIDILearn = useCallback(() => { stopMIDILearn?.(); }, [stopMIDILearn]);
  const handleCancelLayerMIDILearn = useCallback(() => { stopLayerMIDILearn?.(); }, [stopLayerMIDILearn]);

  const displayMidiMapping = useCallback(
    (layer, param) => {
      const mapping = midiMap?.[String(layer)]?.[param];
      if (!mapping) return "None";
      const channelDisplay = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
      if (mapping.type === "cc") return `CC ${mapping.number}${channelDisplay}`;
      if (mapping.type === "note") return `Note ${mapping.number}${channelDisplay}`;
      if (mapping.type === "pitchbend") return `Pitch${channelDisplay}`;
      return "Unknown";
    },
    [midiMap],
  );

  const displayLayerMidiMapping = useCallback(
    (layer) => {
      const mapping = layerMappings[String(layer)]?.layerSelect;
      if (!mapping) return "-";
      const channelDisplay = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
      if (mapping.type === "note") return `Note ${mapping.number}${channelDisplay}`;
      return "Unknown";
    },
    [layerMappings],
  );

  const handleSliderChange = useCallback((e) => {
    if (disableHostLayerControls) return;
    const { name, value } = e.target;
    const parsedValue = parseFloat(value);
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, name, parsedValue);
    }
  }, [disableHostLayerControls, onLayerConfigChange, activeLayer]);

  const handleBlendModeChange = useCallback((e) => {
    if (disableHostLayerControls) return;
    const { value } = e.target;
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "blendMode", value);
    }
  }, [disableHostLayerControls, onLayerConfigChange, activeLayer]);

  const handleDirectionToggle = useCallback(() => {
    if (disableHostLayerControls) return;
    const currentDirection = config.direction || 1;
    const newDirection = -currentDirection;
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "direction", newDirection);
    }
  }, [disableHostLayerControls, config.direction, onLayerConfigChange, activeLayer]);

  const handleEnabledToggle = useCallback((e) => {
    if (disableHostLayerControls) return;
    const newEnabledState = e.target.checked;
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "enabled", newEnabledState);
    }
  }, [disableHostLayerControls, onLayerConfigChange, activeLayer]);

  const adminVisitorMessage = isVisitor && isParentAdmin && !disableHostLayerControls && !canSave && (
    <div className="visitor-message info">
      As an admin visitor, you can experiment with controls. Changes won't save to this profile.
    </div>
  );

  const generalVisitorMessage = isVisitor && !isParentAdmin && !disableHostLayerControls && !canSave && (
      <div className="visitor-message info">
          Viewing another profile. Changes will not be saved.
      </div>
  );

  // This message appears if !hostProfileAddress (via disableHostLayerControls)
  // OR if isPreviewMode is true.
  const readOnlyUIMessage = (disableHostLayerControls || isPreviewMode) && (
    <div className="visitor-message warning">
      {isPreviewMode ? "Preview Mode: Controls are view-only." : // This message is for general preview
       !hostProfileAddress ? "Connect or load a host profile to enable its layer controls." :
       "Host layer controls are currently disabled."} {/* Fallback, should be covered by the others */}
    </div>
  );
  
  const getMIDILearnButtonTitle = (paramProp, paramLabel) => {
    if (!isProfileOwner) return "MIDI Learn disabled when viewing another profile";
    if (!midiConnected) return "Connect MIDI device to enable Learn";
    // If host controls are generally disabled (e.g. no profile), learn is also implicitly disabled
    if (disableHostLayerControls) return "MIDI Learn disabled as host controls are inactive"; 
    return `Map MIDI to ${paramLabel}. Current: ${displayMidiMapping(String(activeLayer), paramProp)}`;
  };
  
  const getLayerMIDILearnButtonTitle = (layerNum) => {
    if (!isProfileOwner) return "MIDI Learn for layer selection disabled when viewing another profile";
    if (!midiConnected) return "Connect MIDI device to enable Learn";
    if (disableHostLayerControls) return "MIDI Learn disabled as host controls are inactive";
    return `Map MIDI to select Layer ${layerNum}`;
  };

  return (
    <Panel
      title={`Layer ${activeLayer} Controls`}
      onClose={onToggleMinimize}
      className="panel-from-toolbar enhanced-control-panel"
    >
      <div className="compact-panel-header">
        <div className="tab-navigation">
          <button type="button" className={`tab-button ${activeTab === "tab1" ? "active" : ""}`} onClick={() => onTabChange && onTabChange("tab1")} title={`Layer 3 (Top)`} aria-label="Select Top Layer (Layer 3)"> <img src={toplayerIcon} alt="L3" className="tab-icon" /> </button>
          <button type="button" className={`tab-button ${activeTab === "tab2" ? "active" : ""}`} onClick={() => onTabChange && onTabChange("tab2")} title={`Layer 2 (Middle)`} aria-label="Select Middle Layer (Layer 2)"> <img src={middlelayerIcon} alt="L2" className="tab-icon" /> </button>
          <button type="button" className={`tab-button ${activeTab === "tab3" ? "active" : ""}`} onClick={() => onTabChange && onTabChange("tab3")} title={`Layer 1 (Bottom)`} aria-label="Select Bottom Layer (Layer 1)"> <img src={bottomlayerIcon} alt="L1" className="tab-icon" /> </button>
        </div>
      </div>

      {(midiLearning || learningLayer !== null) && (
        <div className={`midi-learning-container ${learningLayer !== null ? "layer-learning" : ""}`} >
          <span className="midi-learning-text">
            {learningLayer !== null ? `Mapping: LAYER ${learningLayer} SELECTION` : `Mapping: ${midiLearning?.param?.toUpperCase()} for Layer ${midiLearning?.layer}`}
          </span>
          <button type="button" className="midi-cancel-btn" onClick={ learningLayer !== null ? handleCancelLayerMIDILearn : handleCancelMIDILearn } >
            Cancel
          </button>
        </div>
      )}

      <div className="vertical-layout control-panel-content">
        {midiConnected && (
          <div className="layer-mappings">
            <div className="layer-mapping-grid">
              {[3, 2, 1].map((layerNum) => (
                <div key={`layer_mapping_${layerNum}`} className={`layer-mapping-item ${activeLayer === layerNum ? "active" : ""}`} >
                  <div className="layer-mapping-label">Layer {layerNum}</div>
                  <div className="layer-mapping-controls">
                    <span className="layer-mapping-text" title={displayLayerMidiMapping(String(layerNum))} >
                      {displayLayerMidiMapping(String(layerNum))}
                    </span>
                    {isProfileOwner && ( 
                      <button
                        type="button"
                        className={`midi-learn-btn small-action-button ${learningLayer === layerNum ? "learning" : ""}`}
                        onClick={() => handleEnterLayerMIDILearnMode(layerNum)}
                        disabled={disableHostLayerControls || !midiConnected || learningLayer !== null || (learningLayer !== null && learningLayer !== layerNum)}
                        title={getLayerMIDILearnButtonTitle(layerNum)}
                        aria-label={`Map MIDI to select Layer ${layerNum}`}
                      >
                        {learningLayer === layerNum ? "..." : "Map"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sliderParams.map(
          (paramConfig) => {
            const { prop, label, min, max, step, formatDecimals, defaultValue = 0 } = paramConfig;
            const isLearningThis = midiLearning?.param === prop && midiLearning?.layer === activeLayer;
            const currentValue = config[prop] !== undefined ? config[prop] : defaultValue;
            return (
              <div key={prop} className="slider-container">
                <div className="slider-header">
                  <span className="slider-label">
                    {label}
                  </span>
                  <div className="slider-controls">
                    <span className="slider-value"> {formatValue(currentValue, formatDecimals)} </span>
                    {midiConnected && isProfileOwner && ( 
                      <button
                        type="button"
                        className={`midi-btn small-action-button ${isLearningThis ? "learning" : ""}`}
                        onClick={() => handleEnterMIDILearnMode(prop)}
                        disabled={disableHostLayerControls || !midiConnected || !!learningLayer || (midiLearning !== null && !(midiLearning?.param === prop && midiLearning?.layer === activeLayer))}
                        title={getMIDILearnButtonTitle(prop, label)}
                        aria-label={`Map MIDI to ${label}`}
                      >
                        {isLearningThis ? "..." : "M"}
                      </button>
                    )}
                  </div>
                </div>
                <input type="range" name={prop} min={min} max={max} step={step} value={currentValue} onChange={handleSliderChange} disabled={disableHostLayerControls || isLearningThis} className="horizontal-slider" aria-label={label} />
              </div>
            );
          },
        )}

        <div className="controls-footer">
          <div className="blendmode-container">
            <label htmlFor={`blendModeVertical-${activeLayer}`}>BLEND MODE</label>
            <select id={`blendModeVertical-${activeLayer}`} className="custom-select blend-mode-select" name="blendMode" value={config.blendMode || "normal"} onChange={handleBlendModeChange} disabled={disableHostLayerControls} aria-label="Select Blend Mode">
              {blendModes.map((mode) => ( <option key={mode} value={mode}> {mode.charAt(0).toUpperCase() + mode.slice(1).replace("-", " ")} </option> ))}
            </select>
          </div>
          <button type="button" className="changerotation-btn icon-button" onClick={handleDirectionToggle} title="Change Rotation Direction" disabled={disableHostLayerControls} aria-label="Change Rotation Direction">
            <img src={rotateIcon} className="changerotation-icon" alt="Change Rotation Direction" />
          </button>
          <div className="enabled-control-vertical">
            <label htmlFor={`enabled-v-${activeLayer}`}>Enabled</label>
            <input type="checkbox" id={`enabled-v-${activeLayer}`} name="enabled" checked={config.enabled ?? true} onChange={handleEnabledToggle} disabled={disableHostLayerControls} />
          </div>
        </div>

        {midiConnected && (
          <div className="midi-tools">
              <button type="button" className="midi-monitor-btn" onClick={handleToggleMonitor}> {showMidiMonitor ? "Hide Monitor" : "Show Monitor"} </button>
              <button 
                  type="button" 
                  className="midi-reset-btn" 
                  onClick={handleResetAllMappings} 
                  title="Reset all MIDI mappings for this controller (saved on host profile)" 
                  disabled={disableHostLayerControls || !canSave} 
              > 
                  Reset Mappings 
              </button>
              <select className="midi-channel-select" value={selectedChannel} onChange={handleMidiChannelChange} title="Filter MIDI messages by channel" aria-label="Select MIDI Channel Filter" >
                <option value="0">All Channels</option>
                {[...Array(16)].map((_, i) => ( <option key={i + 1} value={i + 1}> Channel {i + 1} </option> ))}
              </select>
          </div>
        )}
        {!midiConnected && (
            <p className="midi-disconnected-message">MIDI Disconnected. Connect a device to enable MIDI features.</p>
        )}
      </div>

      {midiConnected && showMidiMonitor && (
        <div className="midi-monitor" ref={midiMonitorRef}>
          <div className="midi-monitor-header">
            <h4>MIDI Monitor</h4>
            <button type="button" className="midi-clear-btn small-action-button" onClick={handleClearMidiMonitor}> Clear </button>
          </div>
          <div className="midi-monitor-content">
            {midiMonitorData.length === 0 ? ( <div className="midi-monitor-empty"> No MIDI messages received yet. </div> ) : (
              midiMonitorData.map((msg, index) => (
                <div key={`${msg.timestamp}-${index}`} className="midi-monitor-msg">
                  <span className="midi-monitor-time">{msg.timestamp}</span>
                  <span className="midi-monitor-type">{msg.type}</span>
                  <span className="midi-monitor-channel">Ch{msg.channel}</span>
                  <span className="midi-monitor-data">D1:{msg.data1}</span>
                  <span className="midi-monitor-data">D2:{msg.data2}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {adminVisitorMessage}
      {generalVisitorMessage}
      {readOnlyUIMessage /* This message will show if disableHostLayerControls is true OR isPreviewMode is true */}
    </Panel>
  );
};

EnhancedControlPanel.propTypes = {
  onLayerConfigChange: PropTypes.func.isRequired,
  blendModes: PropTypes.arrayOf(PropTypes.string).isRequired,
  onToggleMinimize: PropTypes.func.isRequired,
  activeTab: PropTypes.string,
  onTabChange: PropTypes.func,
};
EnhancedControlPanel.defaultProps = {
  activeTab: "tab1",
  onTabChange: () => {},
};

export default React.memo(EnhancedControlPanel);