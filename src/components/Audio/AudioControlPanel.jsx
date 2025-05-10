// src/components/Audio/AudioControlPanel.jsx
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Panel from "../Panels/Panel";
import "./AudioStyles/AudioControlPanel.css";

// --- TUNABLE PARAMETERS FOR BASS / MID / TREBLE METER INTENSITY ---
const DISPLAY_LEVEL_AMPLIFICATION = 1.8; 
const DISPLAY_TREBLE_AMPLIFICATION = 2.5;
// -----------------------------------------

const AudioControlPanel = React.memo(({
  onClose,
  isAudioActive,
  setIsAudioActive,
  audioSettings,
  setAudioSettings,
  analyzerData,
}) => {
  const [audioDevices, setAudioDevices] = useState([]);

  useEffect(() => {
    let isMounted = true;
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
          if (!isMounted) return;
          const audioInputs = devices.filter((d) => d.kind === "audioinput");
          setAudioDevices(audioInputs);
        })
        .catch((_) => {});
    }
    return () => { isMounted = false; };
  }, []);

  const toggleAnalyzer = () => setIsAudioActive((prev) => !prev);

  const handleSettingChange = (setting, value) => {
    setAudioSettings((prev) => ({
      ...prev,
      [setting]: parseFloat(value),
    }));
  };

  const handleStopListening = () => setIsAudioActive(false);

  // Apply amplification for display purposes only
  const displayLevel = Math.min(1, (analyzerData?.level || 0) * DISPLAY_LEVEL_AMPLIFICATION);
  const displayBass = analyzerData?.frequencyBands?.bass || 0;
  const displayMid = analyzerData?.frequencyBands?.mid || 0;
  const displayTreble = Math.min(1, (analyzerData?.frequencyBands?.treble || 0) * DISPLAY_TREBLE_AMPLIFICATION);
  
  const currentSmoothing = audioSettings?.smoothingFactor ?? 0.6;

  return (
    <Panel
      title="AUDIO VISUALIZER"
      onClose={onClose}
      className="panel-from-toolbar"
    >
      <div className="audio-control-content">
        <div className="audio-toggle-section">
          <div className="toggle-description">
            <h3>Audio Responsive Layers</h3>
            <p>
              Make the visual layers respond to audio playing through your
              device.
            </p>
          </div>
          <div className="toggle-switch-wrapper">
            <label className="toggle-switch">
              <input type="checkbox" checked={isAudioActive} onChange={toggleAnalyzer} />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-state">{isAudioActive ? "ON" : "OFF"}</span>
          </div>
        </div>

        {isAudioActive && (
          <>
            <div className="device-selector-info">
              <label htmlFor="audio-device-display">Detected Audio Inputs:</label>
              <select id="audio-device-display" disabled className="device-select">
                <option value="">System Default / Granted Device</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Input ${device.deviceId.substring(0, 8)}`}
                  </option>
                ))}
              </select>
              <p className="device-note">Note: Actual input depends on browser permissions & system settings.</p>
            </div>

            <div className="audio-meters-display">
              <div className="meters-header">
                <div className="listening-indicator">
                  <div className="signal-waves">
                    <span className="wave wave-1"></span>
                    <span className="wave wave-2"></span>
                    <span className="wave wave-3"></span>
                  </div>
                  <span>Listening to Audio</span>
                </div>
              </div>

              <div className="level-meter">
                <div className="meter-label">Level</div>
                <div className="meter-bar">
                  <div
                    className="meter-fill level"
                    style={{ width: `${Math.min(100, displayLevel * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="frequency-meters">
                <div className="frequency-meter">
                  <div className="meter-label">Bass</div>
                  <div className="meter-bar">
                    <div
                      className="meter-fill bass"
                      style={{ width: `${Math.min(100, displayBass * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="frequency-meter">
                  <div className="meter-label">Mid</div>
                  <div className="meter-bar">
                    <div
                      className="meter-fill mid"
                      style={{ width: `${Math.min(100, displayMid * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="frequency-meter">
                  <div className="meter-label">Treble</div>
                  <div className="meter-bar">
                    <div
                      className="meter-fill treble"
                      style={{ width: `${Math.min(100, displayTreble * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
               <button
                 className="stop-listening-button"
                 onClick={handleStopListening}
               >
                 Stop Listening
               </button>
            </div>

            <div className="audio-settings-section">
              <div className="slider-group">
                <div className="slider-container">
                  <div className="slider-header">
                    <span className="slider-label">Bass Impact (L1 Size)</span>
                    <span className="slider-value">{(audioSettings?.bassIntensity || 1.0).toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.bassIntensity || 1.0} onChange={(e) => handleSettingChange("bassIntensity", e.target.value)} className="bass-slider intensity-slider" />
                </div>
                <div className="slider-container">
                  <div className="slider-header">
                    <span className="slider-label">Mid Impact (L2 Size)</span>
                    <span className="slider-value">{(audioSettings?.midIntensity || 1.0).toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.midIntensity || 1.0} onChange={(e) => handleSettingChange("midIntensity", e.target.value)} className="mid-slider intensity-slider" />
                </div>
                <div className="slider-container">
                  <div className="slider-header">
                    <span className="slider-label">Treble Impact (L3 Size)</span>
                    <span className="slider-value">{(audioSettings?.trebleIntensity || 1.0).toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.trebleIntensity || 1.0} onChange={(e) => handleSettingChange("trebleIntensity", e.target.value)} className="treble-slider intensity-slider" />
                </div>
                <div className="slider-container">
                  <div className="slider-header">
                    <span className="slider-label">Smoothing Algorithm</span>
                    <span className="slider-value">{currentSmoothing.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.95"
                    step="0.01"
                    value={currentSmoothing}
                    onChange={(e) => handleSettingChange("smoothingFactor", e.target.value)}
                    className="smoothness-slider intensity-slider"
                    title="Adjust response smoothness (Left=Sharp/Sawtooth, Right=Smooth/Sine)"
                  />
                   <div className="slider-labels">
                       <span>Sawtooth</span>
                       <span>Sinewave</span>
                   </div>
                </div>
              </div>
            </div>
          </>
        )}

        {!isAudioActive && (
          <div className="inactive-state">
            <div className="inactive-description">
              <div className="feature-description">
                <p>
                  Enable "Audio Responsive Layers" to make your visual configuration respond to music and onboard sound.
                </p>
                <ul>
                  <li>Bass influences the bottom layer </li>
                  <li>Mid-range frequencies control the middle layer</li>
                  <li>Treble affects the top layer</li>
                  <li>A custom Sawtooth-Sinewave hybrid algorithm stitches the layers together</li>
                </ul>
              </div>
              <div className="usage-note">
                <strong>Note:</strong> RADAR makes use of your microphone access
                to listen to the audio playing through your device. This is
                required for the visualizer to work. Please ensure you have
                granted microphone access to your browser.
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}); 

AudioControlPanel.displayName = 'AudioControlPanel';

AudioControlPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
  isAudioActive: PropTypes.bool.isRequired,
  setIsAudioActive: PropTypes.func.isRequired,
  audioSettings: PropTypes.shape({
      bassIntensity: PropTypes.number,
      midIntensity: PropTypes.number,
      trebleIntensity: PropTypes.number,
      smoothingFactor: PropTypes.number,
  }),
  setAudioSettings: PropTypes.func,
  analyzerData: PropTypes.shape({
      level: PropTypes.number,
      frequencyBands: PropTypes.shape({
          bass: PropTypes.number,
          mid: PropTypes.number,
          treble: PropTypes.number,
      }),
  }),
};

AudioControlPanel.defaultProps = {
  audioSettings: {
    bassIntensity: 1.0,
    midIntensity: 1.0,
    trebleIntensity: 1.0,
    smoothingFactor: 0.6,
  },
  setAudioSettings: () => {},
  analyzerData: { level: 0, frequencyBands: { bass: 0, mid: 0, treble: 0 } },
};

export default AudioControlPanel;