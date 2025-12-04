// src/components/Audio/AudioControlPanel.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { useEngineStore } from "../../store/useEngineStore"; 

import Panel from "../Panels/Panel";
import "./AudioStyles/AudioControlPanel.css";

const DISPLAY_LEVEL_AMPLIFICATION = 1.8;
const DISPLAY_TREBLE_AMPLIFICATION = 2.5;
const DEFAULT_SMOOTHING = 0.6;

const AudioControlPanel = React.memo(({
  onClose,
  isAudioActive,
  setIsAudioActive,
  audioSettings,
  setAudioSettings,
}) => {
  const [audioDevices, setAudioDevices] = useState([]);
  
  // Get destruction state
  const isDestructionMode = useEngineStore((state) => state.isDestructionMode);
  const setDestructionMode = useEngineStore((state) => state.setDestructionMode);
  
  const levelRef = useRef(null);
  const bassRef = useRef(null);
  const midRef = useRef(null);
  const trebleRef = useRef(null);

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

  useEffect(() => {
    if (!isAudioActive) return;

    const handleAudioUpdate = (event) => {
        const { level, frequencyBands } = event.detail;
        
        if (levelRef.current) {
            const displayLevel = Math.min(100, level * DISPLAY_LEVEL_AMPLIFICATION * 100);
            levelRef.current.style.width = `${displayLevel}%`;
        }
        if (bassRef.current) {
            bassRef.current.style.width = `${Math.min(100, frequencyBands.bass * 100)}%`;
        }
        if (midRef.current) {
            midRef.current.style.width = `${Math.min(100, frequencyBands.mid * 100)}%`;
        }
        if (trebleRef.current) {
            const displayTreble = Math.min(100, frequencyBands.treble * DISPLAY_TREBLE_AMPLIFICATION * 100);
            trebleRef.current.style.width = `${displayTreble}%`;
        }
    };

    window.addEventListener('radar-audio-analysis', handleAudioUpdate);
    return () => {
        window.removeEventListener('radar-audio-analysis', handleAudioUpdate);
    };
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
                  <div ref={levelRef} className="meter-fill level" style={{ width: '0%' }} role="meter"></div>
                </div>
              </div>

              <div className="frequency-meters">
                <div className="frequency-meter">
                  <div className="meter-label">Bass</div>
                  <div className="meter-bar"><div ref={bassRef} className="meter-fill bass" style={{ width: '0%' }} role="meter"></div></div>
                </div>
                <div className="frequency-meter">
                  <div className="meter-label">Mid</div>
                  <div className="meter-bar"><div ref={midRef} className="meter-fill mid" style={{ width: '0%' }} role="meter"></div></div>
                </div>
                <div className="frequency-meter">
                  <div className="meter-label">Treble</div>
                  <div className="meter-bar"><div ref={trebleRef} className="meter-fill treble" style={{ width: '0%' }} role="meter"></div></div>
                </div>
              </div>
               <button className="stop-listening-button btn btn-secondary" onClick={handleStopListening} aria-label="Stop listening to audio">
                 Stop Listening
               </button>
            </div>

            {/* --- NEW: INDUSTRIAL DESTRUCTION MODE SECTION --- */}
            <div className="section-box" style={{ borderColor: 'var(--color-error)', background: 'rgba(255, 0, 0, 0.05)' }}>
                <h4 className="config-section-title" style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{fontSize: '1.2em'}}>⚠️</span> INDUSTRIAL MODE
                </h4>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <p className="device-note" style={{ color: 'var(--color-error-a90)', margin: 0, maxWidth: '70%' }}>
                        Extreme distortion. Audio drives chaos. Photosensitivity warning.
                    </p>
                    <div className="toggle-switch-wrapper" style={{flexShrink: 0}}>
                        <label className="toggle-switch" style={{ width: '50px' }}>
                            <input 
                                type="checkbox" 
                                checked={isDestructionMode} 
                                onChange={(e) => setDestructionMode(e.target.checked)} 
                            />
                            <span className="toggle-slider" style={{ 
                                backgroundColor: isDestructionMode ? 'var(--color-error-a30)' : '',
                                borderColor: isDestructionMode ? 'var(--color-error)' : ''
                            }}></span>
                        </label>
                        <span className="toggle-state" style={{ color: isDestructionMode ? 'var(--color-error)' : '', fontSize: '10px', marginTop: '4px' }}>
                            {isDestructionMode ? "DESTROY" : "SAFE"}
                        </span>
                    </div>
                </div>
            </div>
            {/* --- END NEW SECTION --- */}

            <div className="audio-settings-section section-box">
              <h4 className="config-section-title">Audio Reactivity Settings</h4>
              <div className="slider-group">
                <div className="slider-container">
                  <div className="slider-header"><span className="slider-label">Bass Impact (L1 Size)</span><span className="slider-value">{(audioSettings?.bassIntensity || 1.0).toFixed(1)}x</span></div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.bassIntensity || 1.0} onChange={(e) => handleSettingChange("bassIntensity", e.target.value)} className="bass-slider intensity-slider horizontal-slider" aria-label="Bass impact intensity"/>
                </div>
                <div className="slider-container">
                  <div className="slider-header"><span className="slider-label">Mid Impact (L2 Size)</span><span className="slider-value">{(audioSettings?.midIntensity || 1.0).toFixed(1)}x</span></div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.midIntensity || 1.0} onChange={(e) => handleSettingChange("midIntensity", e.target.value)} className="mid-slider intensity-slider horizontal-slider" aria-label="Mid-range impact intensity"/>
                </div>
                <div className="slider-container">
                  <div className="slider-header"><span className="slider-label">Treble Impact (L3 Size)</span><span className="slider-value">{(audioSettings?.trebleIntensity || 1.0).toFixed(1)}x</span></div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.trebleIntensity || 1.0} onChange={(e) => handleSettingChange("trebleIntensity", e.target.value)} className="treble-slider intensity-slider horizontal-slider" aria-label="Treble impact intensity"/>
                </div>
                <div className="slider-container">
                  <div className="slider-header"><span className="slider-label">Smoothing Algorithm</span><span className="slider-value">{currentSmoothing.toFixed(2)}</span></div>
                  <input type="range" min="0.05" max="0.95" step="0.01" value={currentSmoothing} onChange={(e) => handleSettingChange("smoothingFactor", e.target.value)} className="smoothness-slider intensity-slider horizontal-slider" title="Adjust response smoothness (Left=Sharp/Sawtooth, Right=Smooth/Sine)" aria-label="Audio response smoothing factor"/>
                   <div className="slider-labels"><span>Sharp</span><span>Smooth</span></div>
                </div>
              </div>
            </div>
          </>
        )}

        {!isAudioActive && (
          <div className="inactive-state section-box">
            <div className="inactive-description">
              <div className="feature-description">
                <p>Enable "Audio Responsive Layers" to make your visual configuration respond to music and onboard sound.</p>
                <ul>
                  <li>Bass influences the bottom layer's size.</li>
                  <li>Mid-range frequencies control the middle layer's size.</li>
                  <li>Treble affects the top layer's size.</li>
                  <li>A custom algorithm blends these influences for dynamic visuals.</li>
                </ul>
              </div>
              <div className="usage-note">
                <strong>Note:</strong> RADAR makes use of your microphone access to listen to the audio playing through your device. This is required for the visualizer to work. Please ensure you have granted microphone access to your browser for this site.
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
};

AudioControlPanel.defaultProps = {
  audioSettings: {
    bassIntensity: 1.0,
    midIntensity: 1.0,
    trebleIntensity: 1.0,
    smoothingFactor: DEFAULT_SMOOTHING,
  },
  setAudioSettings: () => {
    if (import.meta.env.DEV) console.warn("setAudioSettings called on default AudioControlPanel prop");
  },
};

export default AudioControlPanel;