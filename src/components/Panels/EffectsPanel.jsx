// src/components/Panels/EffectsPanel.jsx
import React from 'react';
import PropTypes from 'prop-types';
import Panel from './Panel';
import { useVisualEngineContext } from '../../context/VisualEngineContext';
import './PanelStyles/EffectsPanel.css';

const EffectControl = ({ label, effectKey, params, config, onChange }) => {
    const isEnabled = config[effectKey]?.enabled || false;

    const handleToggle = (e) => {
        onChange(effectKey, 'enabled', e.target.checked);
    };

    const handleSliderChange = (param, e) => {
        onChange(effectKey, param, parseFloat(e.target.value));
    };

    // New handler for dropdown inputs
    const handleSelectChange = (param, e) => {
        onChange(effectKey, param, parseFloat(e.target.value));
    };

    return (
        <div className={`effect-control-group ${isEnabled ? 'active' : ''}`}>
            <div className="effect-header">
                <span className="effect-label">{label}</span>
                <label className="toggle-switch">
                    <input type="checkbox" checked={isEnabled} onChange={handleToggle} />
                    <span className="toggle-slider"></span>
                </label>
            </div>
            {isEnabled && (
                <div className="effect-params">
                    {params.map(p => (
                        <div key={p.key} className="param-row">
                            <span className="param-label">{p.label}</span>
                            {p.type === 'select' ? (
                                <select 
                                    className="custom-select custom-select-sm"
                                    value={config[effectKey]?.[p.key] !== undefined ? config[effectKey][p.key] : p.default}
                                    onChange={(e) => handleSelectChange(p.key, e)}
                                    style={{ flexGrow: 1, padding: '2px 5px', height: '20px' }}
                                >
                                    {p.options.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            ) : (
                                <>
                                    <input 
                                        type="range" 
                                        min={p.min} 
                                        max={p.max} 
                                        step={p.step}
                                        value={config[effectKey]?.[p.key] !== undefined ? config[effectKey][p.key] : p.default}
                                        onChange={(e) => handleSliderChange(p.key, e)}
                                        className="param-slider"
                                    />
                                    <span className="param-value">{(config[effectKey]?.[p.key] !== undefined ? config[effectKey][p.key] : p.default).toFixed(p.decimals || 1)}</span>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

EffectControl.propTypes = {
    label: PropTypes.string.isRequired,
    effectKey: PropTypes.string.isRequired,
    params: PropTypes.array.isRequired,
    config: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
};

const EffectsPanel = ({ onClose }) => {
    const { effectsConfig, updateEffectConfig } = useVisualEngineContext();

    return (
        <Panel title="GLOBAL EFFECTS" onClose={onClose} className="panel-from-toolbar effects-panel">
            <div className="effects-content">
                
                <h4 className="config-section-title" style={{marginTop:0}}>Distortion & Transition</h4>
                
                {/* 1. Kaleidoscope - NEW EFFECT */}
                <EffectControl 
                    label="KALEIDOSCOPE (MIRROR)" 
                    effectKey="kaleidoscope"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { 
                            key: 'sides', 
                            label: 'Pattern', 
                            type: 'select',
                            default: 6,
                            options: [
                                { value: 2, label: 'Mirror (2)' },
                                { value: 3, label: 'Triad (3)' },
                                { value: 4, label: 'Quad (4)' },
                                { value: 6, label: 'Hex (6)' },
                                { value: 8, label: 'Octo (8)' },
                                { value: 12, label: 'Dodeca (12)' },
                                { value: 20, label: 'Hyper (20)' },
                            ]
                        },
                        { key: 'angle', label: 'Angle', min: 0, max: 6.28, step: 0.01, default: 0, decimals: 2 }
                    ]}
                />

                {/* 2. Datamosh */}
                <EffectControl 
                    label="DATAMOSH (X-FADE)" 
                    effectKey="datamosh"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'scale', label: 'Melt Amount', min: 0, max: 500, step: 10, default: 200, decimals: 0 },
                        { key: 'speed', label: 'Flow Speed', min: 0, max: 20, step: 0.5, default: 2, decimals: 1 },
                        { key: 'zoom', label: 'Wave Size', min: 0.1, max: 3.0, step: 0.1, default: 1.0, decimals: 1 },
                        { key: 'angle', label: 'Flow Angle', min: 0, max: 360, step: 1, default: 25, decimals: 0 }
                    ]}
                />

                {/* 3. Twist */}
                <EffectControl 
                    label="VOID VORTEX (TWIST)" 
                    effectKey="twist"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'radius', label: 'Radius', min: 100, max: 1000, step: 10, default: 400, decimals: 0 },
                        { key: 'angle', label: 'Twist Strength', min: -10, max: 10, step: 0.1, default: 4, decimals: 1 }
                    ]}
                />

                {/* 4. Zoom Blur */}
                <EffectControl 
                    label="WARP DRIVE (ZOOM)" 
                    effectKey="zoomBlur"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'strength', label: 'Intensity', min: 0, max: 0.5, step: 0.01, default: 0.1, decimals: 2 },
                        { key: 'innerRadius', label: 'Safe Zone', min: 0, max: 200, step: 10, default: 50, decimals: 0 }
                    ]}
                />

                <h4 className="config-section-title">Lighting & Glitch</h4>

                {/* 5. God Rays */}
                <EffectControl 
                    label="GOD RAYS (VOLUMETRIC)" 
                    effectKey="godray"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'gain', label: 'Brightness', min: 0, max: 1, step: 0.01, default: 0.5, decimals: 2 },
                        { key: 'lacunarity', label: 'Density', min: 0, max: 5, step: 0.1, default: 2.5, decimals: 1 }
                    ]}
                />

                {/* 6. Glitch */}
                <EffectControl 
                    label="DIGITAL NOISE (GLITCH)" 
                    effectKey="glitch"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'slices', label: 'Slices', min: 2, max: 50, step: 1, default: 10, decimals: 0 },
                        { key: 'offset', label: 'Offset', min: 0, max: 100, step: 1, default: 10, decimals: 0 },
                        { key: 'direction', label: 'Direction', min: 0, max: 360, step: 10, default: 0, decimals: 0 }
                    ]}
                />

                {/* 7. RGB Split */}
                <EffectControl 
                    label="CHROMATIC ABERRATION" 
                    effectKey="rgb"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'red', label: 'Red Offset', min: -20, max: 20, step: 1, default: 2, decimals: 0 },
                        { key: 'blue', label: 'Blue Offset', min: -20, max: 20, step: 1, default: 2, decimals: 0 },
                        { key: 'green', label: 'Green Offset', min: -20, max: 20, step: 1, default: 0, decimals: 0 }
                    ]}
                />

                <h4 className="config-section-title">Post Processing</h4>

                {/* 8. Bloom */}
                <EffectControl 
                    label="BLOOM (GLOW)" 
                    effectKey="bloom"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'intensity', label: 'Intensity', min: 0, max: 5, step: 0.1, default: 1 },
                        { key: 'threshold', label: 'Threshold', min: 0, max: 1, step: 0.01, default: 0.5 },
                        { key: 'blur', label: 'Blur', min: 0, max: 20, step: 1, default: 8, decimals: 0 }
                    ]}
                />

                {/* 9. CRT */}
                <EffectControl 
                    label="CRT MONITOR (RETRO)" 
                    effectKey="crt"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'curvature', label: 'Curvature', min: 0, max: 10, step: 0.1, default: 1, decimals: 1 },
                        { key: 'lineWidth', label: 'Scanlines', min: 0, max: 5, step: 0.1, default: 1, decimals: 1 },
                        { key: 'noise', label: 'Static', min: 0, max: 0.5, step: 0.01, default: 0.1, decimals: 2 }
                    ]}
                />

                {/* 10. Pixelate */}
                <EffectControl 
                    label="PIXELATE (8-BIT)" 
                    effectKey="pixelate"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'size', label: 'Block Size', min: 2, max: 100, step: 1, default: 10, decimals: 0 }
                    ]}
                />
            </div>
        </Panel>
    );
};

EffectsPanel.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default EffectsPanel;