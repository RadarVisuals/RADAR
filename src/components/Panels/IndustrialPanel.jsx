// src/components/Panels/IndustrialPanel.jsx
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Panel from './Panel';
import { useEngineStore } from '../../store/useEngineStore';
import { useShallow } from 'zustand/react/shallow';
import { FireIcon, BoltIcon, SignalIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/solid';
import './PanelStyles/IndustrialPanel.css';

const TARGET_LABELS = {
    rgbStrength: 'RGB TEAR',
    glitchIntensity: 'DATA MOSH',
    pixelateSize: 'BIT CRUSH',
    zoomStrength: 'KICK ZOOM',
    crtNoise: 'STATIC NOISE',
    crtGeometry: 'CRT GEOMETRY',
    scanlineScale: 'SCAN WIDTH',
    chromaticShift: 'COLOR SHIFT',
    binaryThreshold: '1-BIT THRESHOLD',
    invertStrobe: 'NEGATIVE STROBE',
    crossfaderShred: 'SCENE SHREDDER'
};

const SOURCE_LABELS = {
    bass: 'BASS',
    mid: 'MID',
    treble: 'HIGH',
    level: 'LEVEL'
};

// Mini-component for signal visualizer
const SignalDot = ({ source }) => {
    const ref = useRef(null);
    useEffect(() => {
        const handleAudio = (e) => {
            if (!ref.current) return;
            const { level, frequencyBands } = e.detail;
            let val = 0;
            if (source === 'level') val = level;
            else val = frequencyBands[source] || 0;
            
            ref.current.style.opacity = 0.3 + (val * 0.7);
            ref.current.style.boxShadow = `0 0 ${val * 8}px var(--color-primary)`;
        };
        window.addEventListener('radar-audio-analysis', handleAudio);
        return () => window.removeEventListener('radar-audio-analysis', handleAudio);
    }, [source]);

    return (
        <div className="signal-dot" ref={ref} />
    );
};

SignalDot.propTypes = { source: PropTypes.string.isRequired };

const IndustrialPanel = ({ onClose }) => {
    const config = useEngineStore(useShallow(state => state.industrialConfig));
    const setIndustrialEnabled = useEngineStore(state => state.setIndustrialEnabled);
    const setIndustrialChaos = useEngineStore(state => state.setIndustrialChaos);
    const setIndustrialMasterDrive = useEngineStore(state => state.setIndustrialMasterDrive);
    const updateMapping = useEngineStore(state => state.updateIndustrialMapping);

    const toggleMain = () => setIndustrialEnabled(!config.enabled);

    return (
        <Panel title="SIGNAL ROUTER" onClose={onClose} className="panel-from-toolbar industrial-panel">
            <div className="panel-content">
                
                {/* --- MASTER SWITCH --- */}
                <div className={`master-switch-container ${config.enabled ? 'active' : ''}`}>
                    <div className="switch-info">
                        <FireIcon className="switch-icon"/>
                        <div>
                            <div className="switch-title">OVERDRIVE CORE</div>
                            <div className="switch-subtitle">
                                {config.enabled ? 'PATH: REROUTED' : 'PATH: BYPASSED'}
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={toggleMain}
                        className={`engage-button ${config.enabled ? 'active' : ''}`}
                    >
                        {config.enabled ? 'ON' : 'OFF'}
                    </button>
                </div>

                {/* --- GLOBAL CONTROLS --- */}
                <div className="global-controls-grid">
                    <div className="control-cell">
                        <div className="control-header">
                            <span className="control-label"><AdjustmentsHorizontalIcon className="icon-inline"/> MASTER DRIVE</span>
                            <span className="control-value">{(config.masterDrive * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.01" 
                            value={config.masterDrive} 
                            onChange={(e) => setIndustrialMasterDrive(parseFloat(e.target.value))}
                            className="master-slider drive-slider"
                            title="Global Intensity"
                        />
                    </div>
                    <div className="control-cell">
                        <div className="control-header">
                            <span className="control-label"><BoltIcon className="icon-inline"/> CHAOS</span>
                            <span className="control-value">{(config.chaos * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.01" 
                            value={config.chaos} 
                            onChange={(e) => setIndustrialChaos(parseFloat(e.target.value))}
                            className="master-slider chaos-slider"
                            title="Randomness Factor"
                        />
                    </div>
                </div>

                {/* --- PATCH BAY --- */}
                <div className="patch-bay-container">
                    <div className="patch-bay-header">
                        <span>ON</span>
                        <span>MODULE</span>
                        <span>SRC</span>
                        <span style={{textAlign:'right'}}>AMOUNT</span>
                    </div>

                    <div className="patch-list">
                        {Object.entries(config.mappings).map(([key, map]) => (
                            <div key={key} className={`patch-row ${map.enabled ? 'enabled' : 'disabled'}`}>
                                {/* Toggle */}
                                <label className="patch-toggle">
                                    <input 
                                        type="checkbox" 
                                        checked={map.enabled} 
                                        onChange={(e) => updateMapping(key, { enabled: e.target.checked })}
                                    />
                                    <span className="toggle-indicator"></span>
                                </label>

                                {/* Label */}
                                <span className="patch-name">
                                    {TARGET_LABELS[key] || key}
                                </span>

                                {/* Source Select */}
                                <div className="patch-source">
                                    <SignalDot source={map.source} />
                                    <select 
                                        value={map.source}
                                        onChange={(e) => updateMapping(key, { source: e.target.value })}
                                        className="source-select"
                                    >
                                        {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Gain Slider */}
                                <div className="patch-gain">
                                    <input 
                                        type="range" min="0" max="3.0" step="0.1"
                                        value={map.amount}
                                        onChange={(e) => updateMapping(key, { amount: parseFloat(e.target.value) })}
                                        className="gain-slider"
                                        title={`Effect Amount: ${map.amount}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="panel-footer">
                    <SignalIcon className="footer-icon" />
                    <span>SIGNAL FLOW: AUDIO &rarr; MAP &rarr; DRIVE &rarr; FX</span>
                </div>

            </div>
        </Panel>
    );
};

IndustrialPanel.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default React.memo(IndustrialPanel);