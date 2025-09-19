// src/components/LayerConfiguration.jsx
import React, { useEffect, useRef, useMemo, useCallback } from "react";
import PropTypes from "prop-types";

import { useProfileSessionState } from "../../hooks/configSelectors"; // Local hook
import { useMIDI } from "../../context/MIDIContext"; // Local context

// Import sliderParams from its direct source file
import { sliderParams } from "../../config/sliderParams";

import { midiIcon, rotateIcon } from "../../assets"; // Local assets

import "./LayerConfigurationStyles/LayerConfiguration.css"; // Local styles

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
 * @typedef {object} LayerConfigValue
 * @property {number|string|boolean|object} [enabled] - Whether the layer is enabled.
 * @property {string} [blendMode] - CSS mix-blend-mode.
 * @property {number} [opacity] - Layer opacity (0-1).
 * @property {number} [size] - Size multiplier.
 * @property {number} [speed] - Animation speed.
 * @property {number} [drift] - Drift magnitude.
 * @property {number} [driftSpeed] - Drift oscillation speed.
 * @property {number} [angle] - Rotation angle in degrees.
 * @property {number} [xaxis] - X-axis offset.
 * @property {number} [yaxis] - Y-axis offset.
 * @property {number} [direction] - Animation direction (-1 or 1).
 * @property {object} [driftState] - Internal state for drift effect.
 */

/**
 * @typedef {object} LayerConfigurationProps
 * @property {Object.<string|number, LayerConfigValue>} layerConfigs - An object containing configurations for all layers, keyed by layer ID.
 * @property {(layerId: number, key: string, value: any) => void} onLayerConfigChange - Callback to update a layer's configuration property.
 * @property {string[]} [blendModes=[]] - Array of available blend mode strings for the blend mode selector.
 * @property {number} [activeLayer=1] - The ID of the currently active layer being controlled (e.g., 1, 2, or 3).
 * @property {boolean} [readOnly=false] - Prop to explicitly set read-only mode. This can be overridden by session state (e.g., if user is not owner or in preview mode).
 * @property {boolean} [showMidiConnect=true] - Whether to show the MIDI connection status and related controls.
 */

/**
 * LayerConfiguration component provides UI controls for manipulating parameters
 * of a single visual layer.
 *
 * @param {LayerConfigurationProps} props - Component props.
 * @returns {JSX.Element} The rendered LayerConfiguration panel.
 */
const LayerConfiguration = ({
  layerConfigs,
  onLayerConfigChange,
  blendModes = [],
  activeLayer = 1,
  readOnly: propReadOnly = false,
  showMidiConnect = true,
}) => {
  // isPreviewMode is not directly used, canInteract already considers it.
  const { isVisitor, isParentAdmin, canInteract } = useProfileSessionState();
  const {
    isConnected: midiConnected,
    connectMIDI,
    midiMap,
    layerMappings,
    midiLearning,
    learningLayer,
    selectedChannel,
    midiMonitorData,
    showMidiMonitor: displayMidiMonitor,
    setShowMidiMonitor,
    startMIDILearn,
    stopMIDILearn,
    startLayerMIDILearn,
    stopLayerMIDILearn,
    setChannelFilter,
    clearMIDIMonitor,
    clearAllMappings,
  } = useMIDI();

  /** @type {React.RefObject<HTMLDivElement | null>} */
  const midiMonitorRef = useRef(null);

  const effectiveReadOnly = useMemo(() => {
    if (!canInteract) return true;
    return propReadOnly;
  }, [canInteract, propReadOnly]);

  const config = useMemo(() => layerConfigs[activeLayer] || {}, [layerConfigs, activeLayer]);

  useEffect(() => {
    if (midiMonitorRef.current && displayMidiMonitor) {
      midiMonitorRef.current.scrollTop = midiMonitorRef.current.scrollHeight;
    }
  }, [midiMonitorData, displayMidiMonitor]);

  const handleSliderChange = useCallback((e) => {
    if (effectiveReadOnly) return;
    const { name, value } = e.target;
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, name, parseFloat(value));
    } else if (import.meta.env.DEV) {
      console.warn("[LayerConfiguration] onLayerConfigChange is not a function.");
    }
  }, [effectiveReadOnly, onLayerConfigChange, activeLayer]);

  const handleBlendModeChange = useCallback((e) => {
    if (effectiveReadOnly) return;
    const { value } = e.target;
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "blendMode", value);
    } else if (import.meta.env.DEV) {
      console.warn("[LayerConfiguration] onLayerConfigChange is not a function.");
    }
  }, [effectiveReadOnly, onLayerConfigChange, activeLayer]);

  const handleDirectionToggle = useCallback(() => {
    if (effectiveReadOnly) return;
    const currentDirection = config.direction || 1;
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "direction", -currentDirection);
    } else if (import.meta.env.DEV) {
      console.warn("[LayerConfiguration] onLayerConfigChange is not a function.");
    }
  }, [effectiveReadOnly, config.direction, onLayerConfigChange, activeLayer]);

  const enterMIDILearnMode = useCallback((paramName) => {
    if (effectiveReadOnly) return;
    if (!midiConnected) {
      alert("Please connect your MIDI device first using the 'Connect MIDI' button.");
      return;
    }
    if (typeof startMIDILearn === 'function') {
      startMIDILearn(paramName, activeLayer);
    }
  }, [effectiveReadOnly, midiConnected, startMIDILearn, activeLayer]);

  const enterLayerMIDILearnMode = useCallback((layer) => {
    if (effectiveReadOnly) return;
    if (!midiConnected) {
      alert("Please connect your MIDI device first using the 'Connect MIDI' button.");
      return;
    }
    if (typeof startLayerMIDILearn === 'function') {
      startLayerMIDILearn(layer);
    }
  }, [effectiveReadOnly, midiConnected, startLayerMIDILearn]);

  const connectMidiCb = useCallback(() => {
    if (typeof connectMIDI === 'function') {
      connectMIDI().catch((err) => {
        alert(`Failed to access MIDI devices: ${err.message}`);
      });
    }
  }, [connectMIDI]);

  const handleMidiChannelChangeCb = useCallback((e) => {
    if (typeof setChannelFilter === 'function') {
      setChannelFilter(parseInt(e.target.value, 10));
    }
  }, [setChannelFilter]);

  const clearMidiMonitorDataCb = useCallback(() => {
    if (typeof clearMIDIMonitor === 'function') {
      clearMIDIMonitor();
    }
  }, [clearMIDIMonitor]);

  const resetAllMappingsDataCb = useCallback(() => {
    if (effectiveReadOnly) return;
    if (typeof clearAllMappings === 'function') {
      clearAllMappings();
    }
  }, [effectiveReadOnly, clearAllMappings]);

  const formatMidiMappingDisplay = useCallback((mapping) => {
    if (!mapping) return "None";
    const channelText = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
    if (mapping.type === "cc") return `CC ${mapping.number}${channelText}`;
    if (mapping.type === "note") return `Note ${mapping.number}${channelText}`;
    if (mapping.type === "pitchbend") return `Pitch${channelText}`;
    return "Unknown";
  }, []);

  const currentParamMidiMappings = useMemo(() => midiMap[activeLayer] || {}, [midiMap, activeLayer]);

  const visitorOnShowcaseMessage = isVisitor && isParentAdmin && !effectiveReadOnly && (
    <div className="visitor-message info">
      As an admin visitor, you can experiment with all controls on this demo page.
      Changes won't be saved permanently.
    </div>
  );

  return (
    <div className="layer-configuration">
      {showMidiConnect && (
        <div className="midi-status-section">
          <div className="midi-status-row">
            <span>MIDI: {midiConnected ? "Connected" : "Not Connected"}</span>
            {!midiConnected ? (
              <button type="button" className="midi-connect-btn" onClick={connectMidiCb} aria-label="Connect MIDI device">
                <img src={midiIcon} alt="" className="midi-icon" />
                Connect MIDI
              </button>
            ) : (
              <div className="midi-buttons">
                <button
                  type="button"
                  className="midi-tool-button"
                  onClick={() => setShowMidiMonitor && setShowMidiMonitor(!displayMidiMonitor)}
                >
                  {displayMidiMonitor ? "Hide Monitor" : "Show Monitor"}
                </button>
                <button
                  type="button"
                  className="midi-tool-button midi-reset-btn"
                  onClick={resetAllMappingsDataCb}
                  title="Reset all MIDI mappings for current controller"
                  disabled={effectiveReadOnly}
                  aria-label="Reset all MIDI mappings"
                >
                  Reset Mappings
                </button>
                <select
                  className="midi-channel-select custom-select"
                  value={selectedChannel}
                  onChange={handleMidiChannelChangeCb}
                  title="Filter MIDI messages by channel"
                  aria-label="Select MIDI channel filter"
                >
                  <option value="0">All Channels</option>
                  {[...Array(16)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Channel {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {midiLearning && midiLearning.layer === activeLayer && (
            <div className="midi-learning-container">
              <span className="midi-learning-text">
                Mapping: {midiLearning.param.toUpperCase()}
              </span>
              <div className="midi-learning-instructions">
                Move a knob or press a button/pad on your MIDI controller
                <button
                  type="button"
                  className="midi-cancel-btn"
                  onClick={() => stopMIDILearn && stopMIDILearn()}
                  aria-label="Cancel MIDI learning for parameter"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {learningLayer !== null && (
            <div className="midi-learning-container layer-learning">
              <span className="midi-learning-text">
                Mapping: LAYER {learningLayer}
              </span>
              <div className="midi-learning-instructions">
                Press a key/pad on your MIDI controller
                <button
                  type="button"
                  className="midi-cancel-btn"
                  onClick={() => stopLayerMIDILearn && stopLayerMIDILearn()}
                  aria-label="Cancel MIDI learning for layer selection"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {displayMidiMonitor && midiConnected && (
        <div className="midi-monitor" ref={midiMonitorRef}>
          <div className="midi-monitor-header">
            <h4>MIDI Monitor</h4>
            <button type="button" className="midi-clear-btn small-action-button" onClick={clearMidiMonitorDataCb} aria-label="Clear MIDI Monitor">
              Clear
            </button>
          </div>
          <div className="midi-monitor-content">
            {midiMonitorData.length === 0 ? (
              <div className="midi-monitor-empty">
                No MIDI messages received yet. Try moving controls on your MIDI device.
              </div>
            ) : (
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

      <div className="layer-mappings">
        <h4 className="section-title">LAYER SELECTION MAPPINGS</h4>
        <div className="layer-mapping-grid">
          {[1, 2, 3].map((layerNum) => (
            <div
              key={`layer_select_mapping_${layerNum}`}
              className={`layer-mapping-item ${learningLayer === layerNum ? "learning-active" : ""}`}
            >
              <div className="layer-mapping-label">Layer {layerNum}</div>
              <div className="layer-mapping-controls">
                <span className="layer-mapping-text" title={`Current MIDI mapping for Layer ${layerNum} selection`}>
                  {layerMappings[layerNum]?.layerSelect
                    ? formatMidiMappingDisplay(layerMappings[layerNum].layerSelect)
                    : "Not mapped"}
                </span>
                <button
                  type="button"
                  className={`midi-learn-btn small-action-button ${learningLayer === layerNum ? "learning" : ""}`}
                  onClick={() => enterLayerMIDILearnMode(layerNum)}
                  disabled={effectiveReadOnly || !midiConnected || (learningLayer !== null && learningLayer !== layerNum)}
                  aria-label={`Map MIDI to select Layer ${layerNum}`}
                >
                  {learningLayer === layerNum ? "..." : "Map"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="slider-group-container">
        {sliderParams.map(({prop, label, min, max, step, formatDecimals, defaultValue = 0}) => (
            <div className="slider-container" key={`${activeLayer}-${prop}`}>
                <div className="slider-header">
                    <span className="slider-label">{label}</span>
                    <span className="slider-value">
                        {formatValue(config[prop] !== undefined ? config[prop] : defaultValue, formatDecimals)}
                    </span>
                    {showMidiConnect && midiConnected && (
                        <div className="midi-mapping-info">
                            <span className="midi-mapping-text" title={`Current MIDI mapping for ${label}`}>
                                {formatMidiMappingDisplay(currentParamMidiMappings[prop])}
                            </span>
                            <button
                                type="button"
                                className={`midi-learn-btn small-action-button ${midiLearning?.param === prop && midiLearning?.layer === activeLayer ? "learning" : ""}`}
                                onClick={() => enterMIDILearnMode(prop)}
                                disabled={effectiveReadOnly || !midiConnected || (midiLearning !== null && !(midiLearning?.param === prop && midiLearning?.layer === activeLayer))}
                                title={`Click to map ${label} to a MIDI controller`}
                                aria-label={`Map MIDI to ${label}`}
                            >
                                {midiLearning?.param === prop && midiLearning?.layer === activeLayer ? "..." : "Map"}
                            </button>
                        </div>
                    )}
                </div>
                <input
                    type="range"
                    name={prop}
                    min={min}
                    max={max}
                    step={step}
                    value={config[prop] !== undefined ? config[prop] : defaultValue}
                    onChange={handleSliderChange}
                    disabled={effectiveReadOnly || (midiLearning?.param === prop && midiLearning?.layer === activeLayer)}
                    className="horizontal-slider"
                    aria-label={`${label} slider`}
                />
            </div>
        ))}
      </div>


      <div className="controls-footer">
        <div className="blendmode-container">
          <label htmlFor={`blendMode-${activeLayer}`}>BLEND MODE</label>
          <select
            id={`blendMode-${activeLayer}`}
            className="custom-select blend-mode-select"
            name="blendMode"
            value={config.blendMode || "normal"}
            onChange={handleBlendModeChange}
            disabled={effectiveReadOnly}
            aria-label="Select Blend Mode"
          >
            {blendModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="changerotation-btn icon-button"
          onClick={handleDirectionToggle}
          disabled={effectiveReadOnly}
          title="Change Rotation Direction"
          aria-label="Change Rotation Direction"
        >
          <img
            src={rotateIcon}
            alt="Change Rotation Direction"
            className="direction-icon"
          />
        </button>
      </div>
      {visitorOnShowcaseMessage}
    </div>
  );
};

LayerConfiguration.propTypes = {
  layerConfigs: PropTypes.object.isRequired,
  onLayerConfigChange: PropTypes.func.isRequired,
  blendModes: PropTypes.array,
  activeLayer: PropTypes.number,
  readOnly: PropTypes.bool,
  showMidiConnect: PropTypes.bool,
};

export default LayerConfiguration;