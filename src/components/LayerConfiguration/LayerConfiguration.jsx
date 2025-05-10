import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useProfileSessionState } from "../../hooks/configSelectors"; // Use the selector
import { useMIDI } from "../../context/MIDIContext";
import { midiIcon, rotateIcon } from "../../assets";
import "./LayerConfigurationStyles/LayerConfiguration.css";

const LayerConfiguration = ({
  layerConfigs,
  onLayerConfigChange,
  blendModes = [],
  activeLayer = 1,
  readOnly: propReadOnly = false, // Rename prop to avoid conflict
  showMidiConnect = true,
}) => {
  const { isVisitor, isParentAdmin, isPreviewMode } = useProfileSessionState();
  const {
    isConnected: midiConnected,
    connectMIDI,
    midiMap, // Use midiMap from MIDIContext
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

  const midiMonitorRef = useRef(null);

  // Determine if controls should be effectively read-only
  // Controls are read-only if:
  // 1. isPreviewMode is true
  // 2. OR (isVisitor is true AND the current host profile is NOT the special admin/parent one)
  const effectiveReadOnly = useMemo(() => {
    if (isPreviewMode) return true;
    if (isVisitor && !isParentAdmin) return true;
    return propReadOnly; // Fallback to prop if other conditions don't make it read-only
  }, [isPreviewMode, isVisitor, isParentAdmin, propReadOnly]);


  const config = layerConfigs[activeLayer] || {};

  useEffect(() => {
    if (midiMonitorRef.current) {
      midiMonitorRef.current.scrollTop = midiMonitorRef.current.scrollHeight;
    }
  }, [midiMonitorData]);

  const handleSliderChange = (e) => {
    if (effectiveReadOnly) return;
    const { name, value } = e.target;
    onLayerConfigChange(activeLayer, name, parseFloat(value));
  };

  const handleBlendModeChange = (e) => {
    if (effectiveReadOnly) return;
    const { value } = e.target;
    onLayerConfigChange(activeLayer, "blendMode", value);
  };

  const handleDirectionToggle = () => {
    if (effectiveReadOnly) return;
    const currentDirection = config.direction || 1;
    onLayerConfigChange(activeLayer, "direction", -currentDirection);
  };

  const enterMIDILearnMode = (paramName) => {
    if (effectiveReadOnly) return;
    if (!midiConnected) {
      alert("Please connect your MIDI device first using the 'Connect MIDI' button.");
      return;
    }
    startMIDILearn(paramName, activeLayer);
  };

  const enterLayerMIDILearnMode = (layer) => {
    if (effectiveReadOnly) return;
    if (!midiConnected) {
      alert("Please connect your MIDI device first using the 'Connect MIDI' button.");
      return;
    }
    startLayerMIDILearn(layer);
  };

  const connectMidi = () => {
    connectMIDI().catch((err) => {
      alert("Failed to access MIDI devices: " + err.message);
    });
  };

  const handleMidiChannelChange = (e) => {
    setChannelFilter(parseInt(e.target.value));
  };

  const clearMidiMonitorData = () => {
    clearMIDIMonitor();
  };

  const resetAllMappingsData = () => {
    if (effectiveReadOnly) return;
    clearAllMappings();
  };

  const formatMidiMapping = (mapping) => {
    if (!mapping) return "None";
    const channel = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
    if (mapping.type === "cc") return `CC ${mapping.number}${channel}`;
    if (mapping.type === "note") return `Note ${mapping.number}${channel}`;
    if (mapping.type === "pitchbend") return `Pitch${channel}`;
    return "Unknown";
  };
  
  const currentParamMidiMappings = midiMap[activeLayer] || {};

  // Message for visitors on the showcase/admin profile
  const visitorOnShowcaseMessage = isVisitor && isParentAdmin && !effectiveReadOnly && (
    <div className="visitor-message">
      As a visitor, you can experiment with all controls on this demo page.
      Changes won't be saved permanently.
    </div>
  );

  return (
    <div className="layer-configuration">
      {showMidiConnect && (
        <div className="midi-status">
          <div className="midi-status-row">
            <span>MIDI: {midiConnected ? "Connected" : "Not Connected"}</span>
            {!midiConnected ? (
              <button className="midi-connect-btn" onClick={connectMidi}>
                <img src={midiIcon} alt="MIDI Icon" className="midi-icon" />
                Connect MIDI
              </button>
            ) : (
              <div className="midi-buttons">
                <button
                  className="midi-monitor-btn"
                  onClick={() => setShowMidiMonitor(!displayMidiMonitor)}
                >
                  {displayMidiMonitor ? "Hide Monitor" : "Show Monitor"}
                </button>
                <button
                  className="midi-reset-btn"
                  onClick={resetAllMappingsData}
                  title="Reset all MIDI mappings"
                  disabled={effectiveReadOnly}
                >
                  Reset Mappings
                </button>
                <select
                  className="midi-channel-select"
                  value={selectedChannel}
                  onChange={handleMidiChannelChange}
                  title="Filter MIDI messages by channel"
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
              <span className="midi-learning">
                Mapping: {midiLearning.param.toUpperCase()}
              </span>
              <div className="midi-learning-instructions">
                Move a knob or press a button/pad on your MIDI controller
                <button
                  className="midi-cancel-btn"
                  onClick={() => stopMIDILearn()}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {learningLayer !== null && (
            <div className="midi-learning-container layer-learning">
              <span className="midi-learning">
                Mapping: LAYER {learningLayer}
              </span>
              <div className="midi-learning-instructions">
                Press a key/pad on your MIDI controller
                <button
                  className="midi-cancel-btn"
                  onClick={() => stopLayerMIDILearn()}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {displayMidiMonitor && (
        <div className="midi-monitor" ref={midiMonitorRef}>
          <div className="midi-monitor-header">
            <h4>MIDI Monitor</h4>
            <button className="midi-clear-btn" onClick={clearMidiMonitorData}>
              Clear
            </button>
          </div>
          <div className="midi-monitor-content">
            {midiMonitorData.length === 0 ? (
              <div className="midi-monitor-empty">
                No MIDI messages received yet. Try moving controls on your MIDI
                device.
              </div>
            ) : (
              midiMonitorData.map((msg, index) => (
                <div key={index} className="midi-monitor-msg">
                  <span className="midi-monitor-time">{msg.timestamp}</span>
                  <span className="midi-monitor-type">{msg.type}</span>
                  <span className="midi-monitor-channel">
                    Ch {msg.channel + 1}
                  </span>
                  <span className="midi-monitor-data">{msg.data1}</span>
                  <span className="midi-monitor-data">{msg.data2}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="layer-mappings">
        <h4 className="section-title">LAYER MAPPINGS</h4>
        <div className="layer-mapping-grid">
          {[1, 2, 3].map((layer) => (
            <div
              key={`layer_${layer}`}
              className={`layer-mapping-item ${activeLayer === layer ? "active" : ""}`}
            >
              <div className="layer-mapping-label">Layer {layer}</div>
              <div className="layer-mapping-controls">
                <span className="layer-mapping-text">
                  {layerMappings[layer]?.layerSelect
                    ? formatMidiMapping(layerMappings[layer].layerSelect)
                    : "Not mapped"}
                </span>
                <button
                  className="midi-learn-btn"
                  onClick={() => enterLayerMIDILearnMode(layer)}
                  disabled={effectiveReadOnly || !midiConnected}
                >
                  {learningLayer === layer ? "Cancel" : "Map"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="slider-container">
        <div className="slider-header">
          <span className="slider-label">SPEED</span>
          <span className="slider-value">
            {Number(config.speed || 0).toFixed(3)}
          </span>
          <div className="midi-mapping-info">
            <span className="midi-mapping-text" title="Current MIDI mapping">
              {currentParamMidiMappings.speed
                ? formatMidiMapping(currentParamMidiMappings.speed)
                : "None"}
            </span>
            <button
              className="midi-learn-btn"
              onClick={() => enterMIDILearnMode("speed")}
              disabled={effectiveReadOnly || !midiConnected}
              title="Click to map a MIDI controller"
            >
              MIDI
            </button>
          </div>
        </div>
        <input
          type="range"
          name="speed"
          min="0.001"
          max="0.5"
          step="0.001"
          value={config.speed || 0}
          onChange={handleSliderChange}
          disabled={effectiveReadOnly}
        />
      </div>

      <div className="slider-container">
        <div className="slider-header">
          <span className="slider-label">SIZE</span>
          <span className="slider-value">
            {Number(config.size || 0).toFixed(1)}
          </span>
          <div className="midi-mapping-info">
            <span className="midi-mapping-text" title="Current MIDI mapping">
              {currentParamMidiMappings.size
                ? formatMidiMapping(currentParamMidiMappings.size)
                : "None"}
            </span>
            <button
              className="midi-learn-btn"
              onClick={() => enterMIDILearnMode("size")}
              disabled={effectiveReadOnly || !midiConnected}
              title="Click to map a MIDI controller"
            >
              MIDI
            </button>
          </div>
        </div>
        <input
          type="range"
          name="size"
          min="0.1"
          max="8.0"
          step="0.0001"
          value={config.size || 0}
          onChange={handleSliderChange}
          disabled={effectiveReadOnly}
        />
      </div>

      <div className="slider-container">
        <div className="slider-header">
          <span className="slider-label">OPACITY</span>
          <span className="slider-value">
            {Number(config.opacity !== undefined ? config.opacity : 1).toFixed(
              2,
            )}
          </span>
          <div className="midi-mapping-info">
            <span className="midi-mapping-text" title="Current MIDI mapping">
              {currentParamMidiMappings.opacity
                ? formatMidiMapping(currentParamMidiMappings.opacity)
                : "None"}
            </span>
            <button
              className="midi-learn-btn"
              onClick={() => enterMIDILearnMode("opacity")}
              disabled={effectiveReadOnly || !midiConnected}
              title="Click to map a MIDI controller"
            >
              MIDI
            </button>
          </div>
        </div>
        <input
          type="range"
          name="opacity"
          min="0"
          max="1"
          step="0.01"
          value={config.opacity !== undefined ? config.opacity : 1}
          onChange={handleSliderChange}
          disabled={effectiveReadOnly}
        />
      </div>

      <div className="slider-container">
        <div className="slider-header">
          <span className="slider-label">DRIFT</span>
          <span className="slider-value">
            {Number(config.drift || 0).toFixed(1)}
          </span>
          <div className="midi-mapping-info">
            <span className="midi-mapping-text" title="Current MIDI mapping">
              {currentParamMidiMappings.drift
                ? formatMidiMapping(currentParamMidiMappings.drift)
                : "None"}
            </span>
            <button
              className="midi-learn-btn"
              onClick={() => enterMIDILearnMode("drift")}
              disabled={effectiveReadOnly || !midiConnected}
              title="Click to map a MIDI controller"
            >
              MIDI
            </button>
          </div>
        </div>
        <input
          type="range"
          name="drift"
          min="0"
          max="100"
          step="0.0001"
          value={config.drift || 0}
          onChange={handleSliderChange}
          disabled={effectiveReadOnly}
        />
      </div>

      <div className="slider-container">
        <div className="slider-header">
          <span className="slider-label">DRIFT SPEED</span>
          <span className="slider-value">
            {Number(config.driftSpeed || 0).toFixed(1)}
          </span>
          <div className="midi-mapping-info">
            <span className="midi-mapping-text" title="Current MIDI mapping">
              {currentParamMidiMappings.driftSpeed
                ? formatMidiMapping(currentParamMidiMappings.driftSpeed)
                : "None"}
            </span>
            <button
              className="midi-learn-btn"
              onClick={() => enterMIDILearnMode("driftSpeed")}
              disabled={effectiveReadOnly || !midiConnected}
              title="Click to map a MIDI controller"
            >
              MIDI
            </button>
          </div>
        </div>
        <input
          type="range"
          name="driftSpeed"
          min="0"
          max="1"
          step="0.0001"
          value={config.driftSpeed || 0}
          onChange={handleSliderChange}
          disabled={effectiveReadOnly}
        />
      </div>

      <div className="slider-container">
        <div className="slider-header">
          <span className="slider-label">X POSITION</span>
          <span className="slider-value">{Math.round(config.xaxis || 0)}</span>
          <div className="midi-mapping-info">
            <span className="midi-mapping-text" title="Current MIDI mapping">
              {currentParamMidiMappings.xaxis
                ? formatMidiMapping(currentParamMidiMappings.xaxis)
                : "None"}
            </span>
            <button
              className="midi-learn-btn"
              onClick={() => enterMIDILearnMode("xaxis")}
              disabled={effectiveReadOnly || !midiConnected}
              title="Click to map a MIDI controller"
            >
              MIDI
            </button>
          </div>
        </div>
        <input
          type="range"
          name="xaxis"
          min="-10000"
          max="10000"
          step="0.001"
          value={config.xaxis || 0}
          onChange={handleSliderChange}
          disabled={effectiveReadOnly}
        />
      </div>

      <div className="slider-container">
        <div className="slider-header">
          <span className="slider-label">Y POSITION</span>
          <span className="slider-value">{Math.round(config.yaxis || 0)}</span>
          <div className="midi-mapping-info">
            <span className="midi-mapping-text" title="Current MIDI mapping">
              {currentParamMidiMappings.yaxis
                ? formatMidiMapping(currentParamMidiMappings.yaxis)
                : "None"}
            </span>
            <button
              className="midi-learn-btn"
              onClick={() => enterMIDILearnMode("yaxis")}
              disabled={effectiveReadOnly || !midiConnected}
              title="Click to map a MIDI controller"
            >
              MIDI
            </button>
          </div>
        </div>
        <input
          type="range"
          name="yaxis"
          min="-10000"
          max="10000"
          step="0.001"
          value={config.yaxis || 0}
          onChange={handleSliderChange}
          disabled={effectiveReadOnly}
        />
      </div>

      <div className="form-group">
        <label htmlFor="blendMode">BLEND MODE</label>
        <select
          id="blendMode"
          className="custom-select"
          name="blendMode"
          value={config.blendMode || "normal"}
          onChange={handleBlendModeChange}
          disabled={effectiveReadOnly}
        >
          {blendModes.map((mode) => (
            <option key={mode} value={mode}>
              {mode
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")}
            </option>
          ))}
        </select>
      </div>

      <button
        className="btn btn-block direction-toggle-btn"
        onClick={handleDirectionToggle}
        disabled={effectiveReadOnly}
        title="Change Direction"
      >
        <img
          src={rotateIcon}
          alt="Change Direction"
          className="direction-icon"
        />
      </button>
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