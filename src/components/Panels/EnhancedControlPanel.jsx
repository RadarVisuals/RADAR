// src/components/Panels/EnhancedControlPanel.jsx
import React, { useCallback, useMemo } from "react"; // Added useMemo
import PropTypes from "prop-types";
import Panel from "./Panel";
// useVisualLayerState will now come from configSelectors, which sources from VisualConfigContext
import { useProfileSessionState, useVisualLayerState } from "../../hooks/configSelectors";
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

// Configuration for parameters, exported for use in other components
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

// Map tab identifiers to layer IDs
const tabToLayerIdMap = { tab1: 3, tab2: 2, tab3: 1 };

/**
 * EnhancedControlPanel provides UI controls for manipulating visual layer parameters.
 * It consumes `useProfileSessionState` to determine read-only status and
 * `useVisualLayerState` (which sources from `VisualConfigContext`) to get current `layerConfigs`.
 * It receives `onLayerConfigChange` (originating from `VisualConfigContext` via `MainView`)
 * to propagate changes.
 *
 * @param {object} props
 * @param {(layerId: string | number, key: string, value: any) => void} props.onLayerConfigChange - Callback to update layer configuration.
 * @param {Array<string>} props.blendModes - Array of available blend mode strings.
 * @param {() => void} props.onToggleMinimize - Callback to close/minimize the panel.
 * @param {string} [props.activeTab="tab1"] - The currently active layer tab.
 * @param {(tabId: string) => void} props.onTabChange - Callback when the active layer tab changes.
 * @returns {JSX.Element} The rendered EnhancedControlPanel component.
 */
const EnhancedControlPanel = ({
  onLayerConfigChange,
  blendModes,
  onToggleMinimize,
  activeTab = "tab1",
  onTabChange,
  // readOnly prop is no longer passed directly; it's derived internally
}) => {
  const { isVisitor, isParentAdmin, isPreviewMode, canSave } = useProfileSessionState();
  // layerConfigs is now sourced from VisualConfigContext via useVisualLayerState
  const { layerConfigs } = useVisualLayerState();

  // Determine effective read-only state based on session and preview mode
  // This logic correctly determines if the controls should be interactive.
  const effectiveReadOnly = useMemo(() => {
    if (isPreviewMode) return true; // Preview mode is always read-only for controls
    // If the user cannot save (e.g., visitor on a non-admin profile, or not owner), controls are read-only.
    // 'canSave' from useProfileSessionState already factors in ownership and preview mode.
    if (!canSave) return true;
    return false; // Otherwise, controls are editable
  }, [isPreviewMode, canSave]);


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
    midiMap, // This is the visitor's MIDI map from MIDIContext
    layerMappings,
  } = useMIDI();

  const activeLayer = tabToLayerIdMap[activeTab] || 1;
  // Get the specific configuration for the active layer from layerConfigs (VisualConfigContext)
  const config = layerConfigs?.[activeLayer] || {};

  const handleEnterMIDILearnMode = useCallback(
    (paramName) => {
      if (effectiveReadOnly) return;
      if (!midiConnected) { alert("Please connect a MIDI device first."); return; }
      const isValidParam = sliderParams.some((p) => p.prop === paramName);
      if (!isValidParam) return; // Should not happen if UI is correct
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

  const handleMidiChannelChange = (e) => { setChannelFilter(parseInt(e.target.value, 10)); };
  const handleClearMidiMonitor = () => { clearMIDIMonitor(); };
  const handleResetAllMappings = () => { if (!effectiveReadOnly) clearAllMappings(); };
  const handleToggleMonitor = () => { setShowMidiMonitor(!showMidiMonitor); };
  const handleCancelMIDILearn = () => { stopMIDILearn?.(); };
  const handleCancelLayerMIDILearn = () => { stopLayerMIDILearn?.(); };

  const displayMidiMapping = useCallback(
    (layer, param) => {
      // midiMap here refers to the visitor's MIDI map from MIDIContext
      const mapping = midiMap?.[layer]?.[param];
      if (!mapping) return "None";
      const channel = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
      if (mapping.type === "cc") return `CC ${mapping.number}${channel}`;
      if (mapping.type === "note") return `Note ${mapping.number}${channel}`;
      if (mapping.type === "pitchbend") return `Pitch${channel}`;
      return "Unknown";
    },
    [midiMap], // Depends on the visitor's MIDI map
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

  // These handlers now call onLayerConfigChange, which traces back to VisualConfigContext.updateLayerConfig
  const handleSliderChange = (e) => {
    if (effectiveReadOnly) return;
    const { name, value } = e.target;
    const parsedValue = parseFloat(value);
    if (onLayerConfigChange && typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, name, parsedValue);
    } else {
      console.error("[ECP] onLayerConfigChange prop is MISSING or not a function!", onLayerConfigChange);
    }
  };

  const handleBlendModeChange = (e) => {
    if (effectiveReadOnly) return;
    const { value } = e.target;
    if (onLayerConfigChange && typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "blendMode", value);
    } else {
      console.error("[ECP] onLayerConfigChange prop is MISSING or not a function for blend mode!");
    }
  };

  const handleDirectionToggle = () => {
    if (effectiveReadOnly) return;
    const currentDirection = config.direction || 1;
    const newDirection = -currentDirection;
    if (onLayerConfigChange && typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "direction", newDirection);
    } else {
      console.error("[ECP] onLayerConfigChange prop is MISSING or not a function for direction toggle!");
    }
  };

  const handleEnabledToggle = (e) => {
    if (effectiveReadOnly) return;
    const newEnabledState = e.target.checked;
    if (onLayerConfigChange && typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "enabled", newEnabledState);
    } else {
      console.error("[ECP] onLayerConfigChange prop is MISSING or not a function for enabled toggle!");
    }
  };

  // Message for visitors on the showcase/admin profile who can experiment
  const visitorOnShowcaseMessage = isVisitor && isParentAdmin && !effectiveReadOnly && (
    <div className="visitor-message">
      As a visitor, you can experiment with all controls on this demo page.
      Changes won't be saved permanently.
    </div>
  );
  // Message for users who cannot edit (e.g. visitor on non-admin profile, or preview mode)
  const readOnlyMessage = effectiveReadOnly && !(isVisitor && isParentAdmin) && (
    <div className="visitor-message warning">
      {isPreviewMode ? "Preview Mode: Controls are view-only." : "Viewing Mode: Controls are disabled."}
    </div>
  );

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
              {[3, 2, 1].map((layer) => ( // Assuming layer IDs are 1, 2, 3 and map to tabs 3, 2, 1
                <div key={`layer_${layer}`} className={`layer-mapping-item ${activeLayer === layer ? "active" : ""}`} >
                  <div className="layer-mapping-label">Layer {layer}</div>
                  <div className="layer-mapping-controls">
                    <span className="layer-mapping-text" title={displayLayerMidiMapping(layer)} >
                      {displayLayerMidiMapping(layer)}
                    </span>
                    <button className={`midi-learn-btn ${learningLayer === layer ? "learning" : ""}`} onClick={() => handleEnterLayerMIDILearnMode(layer)} disabled={ !midiConnected || effectiveReadOnly || learningLayer !== null } >
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
                      <button className={`midi-btn ${isLearningThis ? "learning" : ""}`} onClick={() => handleEnterMIDILearnMode(prop)} disabled={ !midiConnected || effectiveReadOnly || !!midiLearning } title={`MIDI: ${displayMidiMapping(activeLayer, prop)}`} >
                        {isLearningThis ? "..." : "M"}
                      </button>
                    )}
                  </div>
                </div>
                <input type="range" name={prop} min={min} max={max} step={step} value={displayValue} onChange={handleSliderChange} disabled={effectiveReadOnly || isLearningThis} className="horizontal-slider" />
              </div>
            );
          },
        )}

        <div className="controls-footer">
          <div className="blendmode-container">
            <label htmlFor="blendModeVertical">BLEND MODE</label>
            <select id="blendModeVertical" className="custom-select blend-mode-select" name="blendMode" value={config.blendMode || "normal"} onChange={handleBlendModeChange} disabled={effectiveReadOnly} >
              {blendModes.map((mode) => ( <option key={mode} value={mode}> {mode.charAt(0).toUpperCase() + mode.slice(1).replace("-", " ")} </option> ))}
            </select>
          </div>
          <button className="changerotation-btn" onClick={handleDirectionToggle} title="Change Direction" disabled={effectiveReadOnly} >
            <img src={rotateIcon} className="changerotation-icon" alt="Rotate" />
          </button>
          <div className="enabled-control-vertical">
            <label htmlFor={`enabled-v-${activeLayer}`}>Enabled</label>
            <input type="checkbox" id={`enabled-v-${activeLayer}`} name="enabled" checked={config.enabled ?? true} onChange={handleEnabledToggle} disabled={effectiveReadOnly} />
          </div>
        </div>

        <div className="midi-tools">
          {midiConnected ? (
            <>
              <button className="midi-monitor-btn" onClick={handleToggleMonitor}> {showMidiMonitor ? "Hide Monitor" : "Show Monitor"} </button>
              <button className="midi-reset-btn" onClick={handleResetAllMappings} title="Reset all MIDI mappings" disabled={effectiveReadOnly}> Reset Mappings </button>
              <select className="midi-channel-select" value={selectedChannel} onChange={handleMidiChannelChange} title="Filter MIDI messages by channel" >
                <option value="0">All Channels</option>
                {[...Array(16)].map((_, i) => ( <option key={i + 1} value={i + 1}> Channel {i + 1} </option> ))}
              </select>
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
      {/* Display appropriate message based on user status and effective read-only state */}
      {visitorOnShowcaseMessage}
      {readOnlyMessage}
    </Panel>
  );
};

EnhancedControlPanel.propTypes = {
  onLayerConfigChange: PropTypes.func.isRequired,
  blendModes: PropTypes.arrayOf(PropTypes.string).isRequired,
  onToggleMinimize: PropTypes.func.isRequired,
  activeTab: PropTypes.string,
  onTabChange: PropTypes.func,
  // readOnly prop is removed as it's now derived internally from useProfileSessionState
};
EnhancedControlPanel.defaultProps = { activeTab: "tab1" };

export default EnhancedControlPanel;