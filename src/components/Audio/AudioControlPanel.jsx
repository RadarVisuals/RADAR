// src/components/Audio/AudioControlPanel.jsx
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

import Panel from "../Panels/Panel"; // Local component

import "./AudioStyles/AudioControlPanel.css"; // Local styles

// Tunable parameters for meter display intensity (visual only, does not affect actual analysis)
const DISPLAY_LEVEL_AMPLIFICATION = 1.8;
const DISPLAY_TREBLE_AMPLIFICATION = 2.5;
const DEFAULT_SMOOTHING = 0.6; // Define locally for this component's use

/**
 * @typedef {object} AudioDevice
 * @property {string} deviceId - Unique identifier for the audio device.
 * @property {string} label - Human-readable label for the device.
 * @property {string} kind - Type of device (e.g., "audioinput").
 */

/**
 * @typedef {object} AudioControlPanelProps
 * @property {() => void} onClose - Callback function to close the panel.
 * @property {boolean} isAudioActive - Whether audio analysis is currently active.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setIsAudioActive - Function to toggle the audio analysis state.
 * @property {import('../../hooks/useAudioVisualizer').AudioVisualizerSettings} audioSettings - Current settings for audio reactivity (intensities, smoothing factor).
 * @property {React.Dispatch<React.SetStateAction<import('../../hooks/useAudioVisualizer').AudioVisualizerSettings>>} setAudioSettings - Function to update audio settings.
 * @property {import('../../hooks/useAudioVisualizer').RawAudioAnalyzerData} analyzerData - Data from the audio analyzer (level, frequency bands).
 */

/**
 * AudioControlPanel provides UI controls for managing audio reactivity.
 * It allows users to toggle audio analysis, view detected audio input devices (display-only),
 * observe real-time audio levels (overall, bass, mid, treble), and adjust
 * parameters like intensity of audio impact on layers and the smoothing algorithm.
 *
 * @param {AudioControlPanelProps} props - Component props.
 * @returns {JSX.Element} The rendered AudioControlPanel component.
 */
const AudioControlPanel = React.memo(({
  onClose,
  isAudioActive,
  setIsAudioActive,
  audioSettings,
  setAudioSettings,
  analyzerData,
}) => {
  /** @type {[AudioDevice[], React.Dispatch<React.SetStateAction<AudioDevice[]>>]} */
  const [audioDevices, setAudioDevices] = useState([]);

  useEffect(() => {
    let isMounted = true;
    if (isAudioActive && navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === "function") {
      navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
          if (!isMounted) return;
          const audioInputs = devices.filter((d) => d.kind === "audioinput");
          setAudioDevices(audioInputs);
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.warn("[AudioControlPanel] Error enumerating audio devices:", err);
          }
        });
    } else if (!isAudioActive) {
        setAudioDevices([]);
    }
    return () => { isMounted = false; };
  }, [isAudioActive]);

  const toggleAnalyzer = useCallback(() => {
    if (typeof setIsAudioActive === 'function') {
        setIsAudioActive((prev) => !prev);
    }
  }, [setIsAudioActive]);

  const handleSettingChange = useCallback((setting, value) => {
    if (typeof setAudioSettings === 'function') {
        setAudioSettings((prev) => ({
          ...prev,
          [setting]: parseFloat(value),
        }));
    }
  }, [setAudioSettings]);

  const handleStopListening = useCallback(() => {
    if (typeof setIsAudioActive === 'function') {
        setIsAudioActive(false);
    }
  }, [setIsAudioActive]);

  const displayLevel = Math.min(1, (analyzerData?.level || 0) * DISPLAY_LEVEL_AMPLIFICATION);
  const displayBass = analyzerData?.frequencyBands?.bass || 0;
  const displayMid = analyzerData?.frequencyBands?.mid || 0;
  const displayTreble = Math.min(1, (analyzerData?.frequencyBands?.treble || 0) * DISPLAY_TREBLE_AMPLIFICATION);

  const currentSmoothing = audioSettings?.smoothingFactor ?? DEFAULT_SMOOTHING;

  return (
    <Panel
      title="AUDIO VISUALIZER"
      onClose={onClose}
      className="panel-from-toolbar audio-control-panel"
    >
      <div className="audio-control-content">
        <div className="audio-toggle-section section-box">
          <div className="toggle-description">
            <h3>Audio Responsive Layers</h3>
            <p>
              Make the visual layers respond to audio playing through your
              device. Requires microphone access.
            </p>
          </div>
          <div className="toggle-switch-wrapper">
            <label className="toggle-switch" htmlFor="audio-active-toggle" aria-label="Toggle Audio Reactivity">
              <input type="checkbox" id="audio-active-toggle" checked={isAudioActive} onChange={toggleAnalyzer} />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-state" aria-live="polite">{isAudioActive ? "ON" : "OFF"}</span>
          </div>
        </div>

        {isAudioActive && (
          <>
            <div className="device-selector-info section-box">
              <label htmlFor="audio-device-display">Detected Audio Inputs:</label>
              <select id="audio-device-display" disabled className="device-select custom-select">
                <option value="">System Default / Currently Granted Device</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Input ${device.deviceId.substring(0, 8)}...`}
                  </option>
                ))}
              </select>
              <p className="device-note">Note: Actual input depends on browser permissions & system settings. This list is informational.</p>
            </div>

            <div className="audio-meters-display section-box">
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
                    aria-valuenow={Math.round(displayLevel * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    role="meter"
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
                      aria-valuenow={Math.round(displayBass * 100)} aria-valuemin={0} aria-valuemax={100} role="meter"
                    ></div>
                  </div>
                </div>
                <div className="frequency-meter">
                  <div className="meter-label">Mid</div>
                  <div className="meter-bar">
                    <div
                      className="meter-fill mid"
                      style={{ width: `${Math.min(100, displayMid * 100)}%` }}
                      aria-valuenow={Math.round(displayMid * 100)} aria-valuemin={0} aria-valuemax={100} role="meter"
                    ></div>
                  </div>
                </div>
                <div className="frequency-meter">
                  <div className="meter-label">Treble</div>
                  <div className="meter-bar">
                    <div
                      className="meter-fill treble"
                      style={{ width: `${Math.min(100, displayTreble * 100)}%` }}
                      aria-valuenow={Math.round(displayTreble * 100)} aria-valuemin={0} aria-valuemax={100} role="meter"
                    ></div>
                  </div>
                </div>
              </div>
               <button
                 className="stop-listening-button btn btn-secondary"
                 onClick={handleStopListening}
                 aria-label="Stop listening to audio"
               >
                 Stop Listening
               </button>
            </div>

            <div className="audio-settings-section section-box">
              <h4 className="config-section-title">Audio Reactivity Settings</h4>
              <div className="slider-group">
                <div className="slider-container">
                  <div className="slider-header">
                    <span className="slider-label">Bass Impact (L1 Size)</span>
                    <span className="slider-value">{(audioSettings?.bassIntensity || 1.0).toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.bassIntensity || 1.0} onChange={(e) => handleSettingChange("bassIntensity", e.target.value)} className="bass-slider intensity-slider horizontal-slider" aria-label="Bass impact intensity"/>
                </div>
                <div className="slider-container">
                  <div className="slider-header">
                    <span className="slider-label">Mid Impact (L2 Size)</span>
                    <span className="slider-value">{(audioSettings?.midIntensity || 1.0).toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.midIntensity || 1.0} onChange={(e) => handleSettingChange("midIntensity", e.target.value)} className="mid-slider intensity-slider horizontal-slider" aria-label="Mid-range impact intensity"/>
                </div>
                <div className="slider-container">
                  <div className="slider-header">
                    <span className="slider-label">Treble Impact (L3 Size)</span>
                    <span className="slider-value">{(audioSettings?.trebleIntensity || 1.0).toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.trebleIntensity || 1.0} onChange={(e) => handleSettingChange("trebleIntensity", e.target.value)} className="treble-slider intensity-slider horizontal-slider" aria-label="Treble impact intensity"/>
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
                    className="smoothness-slider intensity-slider horizontal-slider"
                    title="Adjust response smoothness (Left=Sharp/Sawtooth, Right=Smooth/Sine)"
                    aria-label="Audio response smoothing factor"
                  />
                   <div className="slider-labels">
                       <span>Sharp</span>
                       <span>Smooth</span>
                   </div>
                </div>
              </div>
            </div>
          </>
        )}

        {!isAudioActive && (
          <div className="inactive-state section-box">
            <div className="inactive-description">
              <div className="feature-description">
                <p>
                  Enable "Audio Responsive Layers" to make your visual configuration respond to music and onboard sound.
                </p>
                <ul>
                  <li>Bass influences the bottom layer's size.</li>
                  <li>Mid-range frequencies control the middle layer's size.</li>
                  <li>Treble affects the top layer's size.</li>
                  <li>A custom algorithm blends these influences for dynamic visuals.</li>
                </ul>
              </div>
              <div className="usage-note">
                <strong>Note:</strong> RADAR makes use of your microphone access
                to listen to the audio playing through your device. This is
                required for the visualizer to work. Please ensure you have
                granted microphone access to your browser for this site.
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
    smoothingFactor: DEFAULT_SMOOTHING, // Use the defined constant
  },
  setAudioSettings: () => {
    if (import.meta.env.DEV) console.warn("setAudioSettings called on default AudioControlPanel prop");
  },
  analyzerData: { level: 0, frequencyBands: { bass: 0, mid: 0, treble: 0 } },
};

export default AudioControlPanel;