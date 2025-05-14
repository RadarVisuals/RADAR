// src/components/Panels/EnhancedControlPanel.jsx
import React, { useCallback, useMemo } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel"; // Local component
import { useProfileSessionState, useVisualLayerState } from "../../hooks/configSelectors"; // Local hooks
import { useMIDI } from "../../context/MIDIContext"; // Local context

// Import only icons that are actually used in this component's JSX
import {
  toplayerIcon,
  middlelayerIcon,
  bottomlayerIcon,
  rotateIcon, // Used for direction toggle button
} from "../../assets"; // Local assets

import "./PanelStyles/EnhancedControlPanel.css"; // Local styles

/**
 * Returns a default template object for a single visual layer's configuration.
 * This ensures a consistent structure for all layers.
 * @returns {import('../../context/VisualConfigContext').LayerConfig} The default layer configuration template.
 */
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


/**
 * Formats a numerical value to a string with a specified number of decimal places.
 * Returns a default string if the input is not a valid number.
 * @param {number|string|null|undefined} value - The value to format.
 * @param {number} [decimals=1] - The number of decimal places to use.
 * @returns {string} The formatted string representation of the value.
 */
const formatValue = (value, decimals = 1) => {
  const numValue = Number(value);
  if (value === undefined || value === null || isNaN(numValue)) {
    return "0".padEnd(decimals > 0 ? decimals + 2 : 1, "0");
  }
  return numValue.toFixed(decimals);
};

/**
 * Configuration for slider parameters used in the control panel.
 * @type {Array<{prop: string, label: string, icon: string, min: number, max: number, step: number, formatDecimals: number, defaultValue?: number}>}
 */
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

/**
 * Maps tab identifiers to their corresponding numerical layer IDs.
 * @type {Object.<string, number>}
 */
const tabToLayerIdMap = { tab1: 3, tab2: 2, tab3: 1 };

/**
 * @typedef {object} EnhancedControlPanelProps
 * @property {(layerId: string | number, key: string, value: any) => void} onLayerConfigChange - Callback invoked when a layer's configuration property changes.
 * @property {string[]} blendModes - An array of available blend mode strings for the blend mode selector.
 * @property {() => void} onToggleMinimize - Callback invoked to close/minimize the panel.
 * @property {string} [activeTab='tab1'] - The identifier of the currently active layer tab.
 * @property {(tabId: string) => void} [onTabChange] - Callback invoked when a layer tab is changed.
 */

/**
 * EnhancedControlPanel: A UI component that provides detailed controls for visual layers.
 * @param {EnhancedControlPanelProps} props - The component's props.
 * @returns {JSX.Element} The rendered EnhancedControlPanel component.
 */
const EnhancedControlPanel = ({
  onLayerConfigChange,
  blendModes,
  onToggleMinimize,
  activeTab = "tab1",
  onTabChange,
}) => {
  const { isVisitor, isParentAdmin, isPreviewMode, canSave, canInteract, currentProfileAddress } = useProfileSessionState();
  const { layerConfigs } = useVisualLayerState();

  const effectiveReadOnly = useMemo(() => !canInteract, [canInteract]);

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

  const handleEnterMIDILearnMode = useCallback(
    (paramName) => {
      if (effectiveReadOnly) return;
      if (!midiConnected) { alert("Please connect a MIDI device first to enable MIDI Learn."); return; }
      const isValidParam = sliderParams.some((p) => p.prop === paramName);
      if (!isValidParam) {
        if (import.meta.env.DEV) console.warn(`[ECP] Attempted to learn MIDI for invalid param: ${paramName}`);
        return;
      }
      startMIDILearn(paramName, activeLayer);
    },
    [midiConnected, startMIDILearn, activeLayer, effectiveReadOnly],
  );

  const handleEnterLayerMIDILearnMode = useCallback(
    (layer) => {
      if (effectiveReadOnly) return;
      if (!midiConnected) { alert("Please connect a MIDI device first."); return; }
      startLayerMIDILearn(layer);
    },
    [midiConnected, startLayerMIDILearn, effectiveReadOnly],
  );

  const handleMidiChannelChange = useCallback((e) => { setChannelFilter(parseInt(e.target.value, 10)); }, [setChannelFilter]);
  const handleClearMidiMonitor = useCallback(() => { clearMIDIMonitor(); }, [clearMIDIMonitor]);
  const handleResetAllMappings = useCallback(() => {
    if (!effectiveReadOnly && canSave) {
        clearAllMappings();
    } else if (import.meta.env.DEV) {
        console.warn("[ECP] Reset all MIDI mappings blocked. ReadOnly:", effectiveReadOnly, "CanSave:", canSave);
    }
  }, [effectiveReadOnly, canSave, clearAllMappings]);
  const handleToggleMonitor = useCallback(() => { setShowMidiMonitor(prev => !prev); }, [setShowMidiMonitor]);
  const handleCancelMIDILearn = useCallback(() => { stopMIDILearn?.(); }, [stopMIDILearn]);
  const handleCancelLayerMIDILearn = useCallback(() => { stopLayerMIDILearn?.(); }, [stopLayerMIDILearn]);

  const displayMidiMapping = useCallback(
    (layer, param) => {
      const mapping = midiMap?.[layer]?.[param];
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
      const mapping = layerMappings[layer]?.layerSelect;
      if (!mapping) return "-";
      const channelDisplay = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
      if (mapping.type === "note") return `Note ${mapping.number}${channelDisplay}`;
      return "Unknown";
    },
    [layerMappings],
  );

  const handleSliderChange = useCallback((e) => {
    if (effectiveReadOnly) return;
    const { name, value } = e.target;
    const parsedValue = parseFloat(value);
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, name, parsedValue);
    } else if (import.meta.env.DEV) {
      console.error("[ECP] onLayerConfigChange prop is MISSING or not a function!", { activeLayer, name, parsedValue });
    }
  }, [effectiveReadOnly, onLayerConfigChange, activeLayer]);

  const handleBlendModeChange = useCallback((e) => {
    if (effectiveReadOnly) return;
    const { value } = e.target;
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "blendMode", value);
    } else if (import.meta.env.DEV) {
      console.error("[ECP] onLayerConfigChange prop is MISSING or not a function for blend mode!", { activeLayer, value });
    }
  }, [effectiveReadOnly, onLayerConfigChange, activeLayer]);

  const handleDirectionToggle = useCallback(() => {
    if (effectiveReadOnly) return;
    const currentDirection = config.direction || 1;
    const newDirection = -currentDirection;
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "direction", newDirection);
    } else if (import.meta.env.DEV) {
      console.error("[ECP] onLayerConfigChange prop is MISSING or not a function for direction toggle!", { activeLayer, newDirection });
    }
  }, [effectiveReadOnly, config.direction, onLayerConfigChange, activeLayer]);

  const handleEnabledToggle = useCallback((e) => {
    if (effectiveReadOnly) return;
    const newEnabledState = e.target.checked;
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "enabled", newEnabledState);
    } else if (import.meta.env.DEV) {
      console.error("[ECP] onLayerConfigChange prop is MISSING or not a function for enabled toggle!", { activeLayer, newEnabledState });
    }
  }, [effectiveReadOnly, onLayerConfigChange, activeLayer]);

  const adminVisitorMessage = isVisitor && isParentAdmin && canInteract && !canSave && (
    <div className="visitor-message info">
      As an admin visitor, you can experiment with controls. Changes won't save to this profile.
    </div>
  );

  const generalVisitorMessage = isVisitor && !isParentAdmin && canInteract && !canSave && (
      <div className="visitor-message info">
          Viewing another profile. Changes will not be saved.
      </div>
  );

  const readOnlyUIMessage = !canInteract && (
    <div className="visitor-message warning">
      {isPreviewMode ? "Preview Mode: Controls are view-only." :
       !currentProfileAddress ? "Connect or load a profile to enable controls." :
       "Controls are currently disabled."}
    </div>
  );


  return (
    <Panel
      title={`Layer ${activeLayer} Controls`}
      onClose={onToggleMinimize}
      className="panel-from-toolbar enhanced-control-panel"
    >
      <div className="compact-panel-header">
        <div className="tab-navigation">
          <button key="tab1" className={`tab-button ${activeTab === "tab1" ? "active" : ""}`} onClick={() => onTabChange && onTabChange("tab1")} title={`Layer 3 (Top)`} aria-label="Select Top Layer (Layer 3)"> <img src={toplayerIcon} alt="L3" className="tab-icon" /> </button>
          <button key="tab2" className={`tab-button ${activeTab === "tab2" ? "active" : ""}`} onClick={() => onTabChange && onTabChange("tab2")} title={`Layer 2 (Middle)`} aria-label="Select Middle Layer (Layer 2)"> <img src={middlelayerIcon} alt="L2" className="tab-icon" /> </button>
          <button key="tab3" className={`tab-button ${activeTab === "tab3" ? "active" : ""}`} onClick={() => onTabChange && onTabChange("tab3")} title={`Layer 1 (Bottom)`} aria-label="Select Bottom Layer (Layer 1)"> <img src={bottomlayerIcon} alt="L1" className="tab-icon" /> </button>
        </div>
      </div>

      {(midiLearning || learningLayer !== null) && (
        <div className={`midi-learning-container ${learningLayer !== null ? "layer-learning" : ""}`} >
          <span className="midi-learning-text">
            {learningLayer !== null ? `Mapping: LAYER ${learningLayer} SELECTION` : `Mapping: ${midiLearning?.param?.toUpperCase()} for Layer ${midiLearning?.layer}`}
          </span>
          <button className="midi-cancel-btn" onClick={ learningLayer !== null ? handleCancelLayerMIDILearn : handleCancelMIDILearn } >
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
                    <button
                      className={`midi-learn-btn small-action-button ${learningLayer === layerNum ? "learning" : ""}`}
                      onClick={() => handleEnterLayerMIDILearnMode(layerNum)}
                      disabled={!midiConnected || effectiveReadOnly || learningLayer !== null}
                      aria-label={`Map MIDI to select Layer ${layerNum}`}
                    >
                      {learningLayer === layerNum ? "..." : "Map"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sliderParams.map(
          // Removed 'icon' from destructuring as it's not rendered next to the label
          // The 'icon' property still exists on the 'paramConfig' object if needed elsewhere.
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
                    {midiConnected && (
                      <button
                        className={`midi-btn small-action-button ${isLearningThis ? "learning" : ""}`}
                        onClick={() => handleEnterMIDILearnMode(prop)}
                        disabled={!midiConnected || effectiveReadOnly || !!midiLearning}
                        title={`Map MIDI to ${label}. Current: ${displayMidiMapping(String(activeLayer), prop)}`}
                        aria-label={`Map MIDI to ${label}`}
                      >
                        {isLearningThis ? "..." : "M"}
                      </button>
                    )}
                  </div>
                </div>
                <input type="range" name={prop} min={min} max={max} step={step} value={currentValue} onChange={handleSliderChange} disabled={effectiveReadOnly || isLearningThis} className="horizontal-slider" aria-label={label} />
              </div>
            );
          },
        )}

        <div className="controls-footer">
          <div className="blendmode-container">
            <label htmlFor={`blendModeVertical-${activeLayer}`}>BLEND MODE</label>
            <select id={`blendModeVertical-${activeLayer}`} className="custom-select blend-mode-select" name="blendMode" value={config.blendMode || "normal"} onChange={handleBlendModeChange} disabled={effectiveReadOnly} aria-label="Select Blend Mode">
              {blendModes.map((mode) => ( <option key={mode} value={mode}> {mode.charAt(0).toUpperCase() + mode.slice(1).replace("-", " ")} </option> ))}
            </select>
          </div>
          <button className="changerotation-btn icon-button" onClick={handleDirectionToggle} title="Change Rotation Direction" disabled={effectiveReadOnly} aria-label="Change Rotation Direction">
            <img src={rotateIcon} className="changerotation-icon" alt="Change Rotation Direction" />
          </button>
          <div className="enabled-control-vertical">
            <label htmlFor={`enabled-v-${activeLayer}`}>Enabled</label>
            <input type="checkbox" id={`enabled-v-${activeLayer}`} name="enabled" checked={config.enabled ?? true} onChange={handleEnabledToggle} disabled={effectiveReadOnly} />
          </div>
        </div>

        {midiConnected && (
          <div className="midi-tools">
              <button className="midi-monitor-btn" onClick={handleToggleMonitor}> {showMidiMonitor ? "Hide Monitor" : "Show Monitor"} </button>
              <button className="midi-reset-btn" onClick={handleResetAllMappings} title="Reset all MIDI mappings for this controller" disabled={effectiveReadOnly || !canSave}> Reset Mappings </button>
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
        <div className="midi-monitor">
          <div className="midi-monitor-header">
            <h4>MIDI Monitor</h4>
            <button className="midi-clear-btn small-action-button" onClick={handleClearMidiMonitor}> Clear </button>
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
      {readOnlyUIMessage}
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