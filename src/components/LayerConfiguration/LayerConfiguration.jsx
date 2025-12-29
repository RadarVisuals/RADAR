// src/components/LayerConfiguration/LayerConfiguration.jsx
import React, { useEffect, useRef, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { useShallow } from 'zustand/react/shallow';

import { useProfileSessionState } from "../../hooks/configSelectors";
import { useEngineStore } from "../../store/useEngineStore";
import { useProjectStore } from "../../store/useProjectStore";
import { sliderParams } from "../../config/sliderParams";
import { midiIcon, rotateIcon } from "../../assets";

import "./LayerConfigurationStyles/LayerConfiguration.css";

const formatValue = (value, decimals = 1) => {
  const numValue = Number(value);
  if (value === undefined || value === null || isNaN(numValue)) {
    return "0".padEnd(decimals > 0 ? decimals + 2 : 1, "0");
  }
  return numValue.toFixed(decimals);
};

const LayerConfiguration = ({
  layerConfigs,
  onLayerConfigChange,
  blendModes = [],
  activeLayer = 1,
  readOnly: propReadOnly = false,
  showMidiConnect = true,
}) => {
  const { isVisitor, isParentAdmin, canInteract } = useProfileSessionState();

  // Pull MIDI state directly from Engine Store
  const midiState = useEngineStore(useShallow(s => ({
    isConnected: s.isConnected,
    connectMIDI: s.connectMIDI,
    midiLearning: s.midiLearning,
    learningLayer: s.learningLayer,
    selectedChannel: s.selectedChannel,
    midiMonitorData: s.midiMonitorData,
    showMidiMonitor: s.showMidiMonitor,
    setShowMidiMonitor: s.setShowMidiMonitor,
    startMIDILearn: (param, layer) => s.setMidiLearning({ type: 'param', param, layer }),
    stopMIDILearn: () => s.setMidiLearning(null),
    startLayerMIDILearn: (layer) => s.setLearningLayer(layer),
    stopLayerMIDILearn: () => s.setLearningLayer(null),
    setChannelFilter: s.setSelectedChannel,
    clearMIDIMonitor: s.clearMidiMonitorData,
  })));

  // Pull mappings from Project Store
  const stagedSetlist = useProjectStore(s => s.stagedSetlist);
  const updateGlobalMidiMap = useProjectStore(s => s.updateGlobalMidiMap);

  const midiMap = stagedSetlist?.globalUserMidiMap || {};
  const layerMappings = midiMap.layerSelects || {};

  const midiMonitorRef = useRef(null);

  const effectiveReadOnly = useMemo(() => {
    if (!canInteract) return true;
    return propReadOnly;
  }, [canInteract, propReadOnly]);

  const config = useMemo(() => layerConfigs[activeLayer] || {}, [layerConfigs, activeLayer]);

  useEffect(() => {
    if (midiMonitorRef.current && midiState.showMidiMonitor) {
      midiMonitorRef.current.scrollTop = midiMonitorRef.current.scrollHeight;
    }
  }, [midiState.midiMonitorData, midiState.showMidiMonitor]);

  const handleSliderChange = useCallback((e) => {
    if (effectiveReadOnly) return;
    const { name, value } = e.target;
    onLayerConfigChange(activeLayer, name, parseFloat(value));
  }, [effectiveReadOnly, onLayerConfigChange, activeLayer]);

  const handleBlendModeChange = useCallback((e) => {
    if (effectiveReadOnly) return;
    onLayerConfigChange(activeLayer, "blendMode", e.target.value);
  }, [effectiveReadOnly, onLayerConfigChange, activeLayer]);

  const handleDirectionToggle = useCallback(() => {
    if (effectiveReadOnly) return;
    const currentDirection = config.direction || 1;
    onLayerConfigChange(activeLayer, "direction", -currentDirection);
  }, [effectiveReadOnly, config.direction, onLayerConfigChange, activeLayer]);

  const enterMIDILearnMode = (paramName) => {
    if (effectiveReadOnly) return;
    if (!midiState.isConnected) {
      alert("Please connect your MIDI device first.");
      return;
    }
    midiState.startMIDILearn(paramName, activeLayer);
  };

  const enterLayerMIDILearnMode = (layer) => {
    if (effectiveReadOnly) return;
    if (!midiState.isConnected) {
      alert("Please connect your MIDI device first.");
      return;
    }
    midiState.startLayerMIDILearn(layer);
  };

  const formatMidiMappingDisplay = (mapping) => {
    if (!mapping) return "None";
    const ch = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
    if (mapping.type === "cc") return `CC ${mapping.number}${ch}`;
    if (mapping.type === "note") return `Note ${mapping.number}${ch}`;
    if (mapping.type === "pitchbend") return `Pitch${ch}`;
    return "Unknown";
  };

  const clearAllMappings = () => {
    if (window.confirm("Reset all MIDI mappings for this controller?")) {
      updateGlobalMidiMap({});
    }
  };

  const currentParamMidiMappings = useMemo(() => midiMap[activeLayer] || {}, [midiMap, activeLayer]);

  return (
    <div className="layer-configuration">
      {showMidiConnect && (
        <div className="midi-status-section">
          <div className="midi-status-row">
            <span>MIDI: {midiState.isConnected ? "Connected" : "Not Connected"}</span>
            {!midiState.isConnected ? (
              <button type="button" className="midi-connect-btn" onClick={midiState.connectMIDI}>
                <img src={midiIcon} alt="" className="midi-icon" />
                Connect MIDI
              </button>
            ) : (
              <div className="midi-buttons">
                <button
                  type="button"
                  className="midi-tool-button"
                  onClick={() => midiState.setShowMidiMonitor(!midiState.showMidiMonitor)}
                >
                  {midiState.showMidiMonitor ? "Hide Monitor" : "Show Monitor"}
                </button>
                <button
                  type="button"
                  className="midi-tool-button midi-reset-btn"
                  onClick={clearAllMappings}
                  disabled={effectiveReadOnly}
                >
                  Reset Mappings
                </button>
                <select
                  className="midi-channel-select custom-select"
                  value={midiState.selectedChannel}
                  onChange={(e) => midiState.setChannelFilter(parseInt(e.target.value, 10))}
                >
                  <option value="0">All Channels</option>
                  {[...Array(16)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>Ch {i + 1}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {midiState.midiLearning && midiState.midiLearning.layer === activeLayer && (
            <div className="midi-learning-container">
              <span className="midi-learning-text">Mapping: {midiState.midiLearning.param.toUpperCase()}</span>
              <div className="midi-learning-instructions">
                Move a control on your device
                <button type="button" className="midi-cancel-btn" onClick={midiState.stopMIDILearn}>Cancel</button>
              </div>
            </div>
          )}

          {midiState.learningLayer !== null && (
            <div className="midi-learning-container layer-learning">
              <span className="midi-learning-text">Mapping: LAYER {midiState.learningLayer}</span>
              <div className="midi-learning-instructions">
                Press a pad/key
                <button type="button" className="midi-cancel-btn" onClick={midiState.stopLayerMIDILearn}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {midiState.showMidiMonitor && midiState.isConnected && (
        <div className="midi-monitor" ref={midiMonitorRef}>
          <div className="midi-monitor-header">
            <h4>MIDI Monitor</h4>
            <button type="button" className="midi-clear-btn small-action-button" onClick={midiState.clearMIDIMonitor}>Clear</button>
          </div>
          <div className="midi-monitor-content">
            {midiState.midiMonitorData.length === 0 ? (
              <div className="midi-monitor-empty">No activity...</div>
            ) : (
              midiState.midiMonitorData.map((msg, index) => (
                <div key={index} className="midi-monitor-msg">
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
          {[1, 2, 3].map((num) => (
            <div key={num} className={`layer-mapping-item ${midiState.learningLayer === num ? "learning-active" : ""}`}>
              <div className="layer-mapping-label">Layer {num}</div>
              <div className="layer-mapping-controls">
                <span className="layer-mapping-text">{formatMidiMappingDisplay(layerMappings[num])}</span>
                <button
                  type="button"
                  className={`midi-learn-btn small-action-button ${midiState.learningLayer === num ? "learning" : ""}`}
                  onClick={() => enterLayerMIDILearnMode(num)}
                  disabled={effectiveReadOnly || !midiState.isConnected}
                >
                  {midiState.learningLayer === num ? "..." : "Map"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="slider-group-container">
        {sliderParams.map(({ prop, label, min, max, step, formatDecimals, defaultValue = 0 }) => (
          <div className="slider-container" key={`${activeLayer}-${prop}`}>
            <div className="slider-header">
              <span className="slider-label">{label}</span>
              <span className="slider-value">
                {formatValue(config[prop] !== undefined ? config[prop] : defaultValue, formatDecimals)}
              </span>
              {showMidiConnect && midiState.isConnected && (
                <div className="midi-mapping-info">
                  <span className="midi-mapping-text">{formatMidiMappingDisplay(currentParamMidiMappings[prop])}</span>
                  <button
                    type="button"
                    className={`midi-learn-btn small-action-button ${midiState.midiLearning?.param === prop && midiState.midiLearning?.layer === activeLayer ? "learning" : ""}`}
                    onClick={() => enterMIDILearnMode(prop)}
                    disabled={effectiveReadOnly}
                  >
                    {midiState.midiLearning?.param === prop ? "..." : "Map"}
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
              disabled={effectiveReadOnly}
              className="horizontal-slider"
            />
          </div>
        ))}
      </div>

      <div className="controls-footer">
        <div className="blendmode-container">
          <label>BLEND MODE</label>
          <select className="custom-select" value={config.blendMode || "normal"} onChange={handleBlendModeChange} disabled={effectiveReadOnly}>
            {blendModes.map((mode) => (
              <option key={mode} value={mode}>{mode.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <button type="button" className="changerotation-btn icon-button" onClick={handleDirectionToggle} disabled={effectiveReadOnly}>
          <img src={rotateIcon} alt="" className="direction-icon" />
        </button>
      </div>
      {isVisitor && isParentAdmin && !effectiveReadOnly && (
        <div className="visitor-message info">Admin Visitor: Testing mode enabled.</div>
      )}
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