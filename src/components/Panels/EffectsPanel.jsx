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

    const handleChange = (param, value) => {
        onChange(effectKey, param, parseFloat(value));
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
                                    onChange={(e) => handleChange(p.key, e.target.value)}
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
                                        onChange={(e) => handleChange(p.key, e.target.value)}
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
    params: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        type: PropTypes.string,
        min: PropTypes.number,
        max: PropTypes.number,
        step: PropTypes.number,
        default: PropTypes.number,
        decimals: PropTypes.number,
        options: PropTypes.arrayOf(PropTypes.shape({
            value: PropTypes.number.isRequired,
            label: PropTypes.string.isRequired
        }))
    })).isRequired,
    config: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
};

const EffectsPanel = ({ onClose }) => {
    const { effectsConfig, updateEffectConfig } = useVisualEngineContext();

    return (
        <Panel title="GLOBAL EFFECTS" onClose={onClose} className="panel-from-toolbar effects-panel">
            <div className="effects-content">
                
                {/* --- NEW FEEDBACK SECTION --- */}
                <h4 className="config-section-title" style={{marginTop:0, color: 'var(--color-accent)'}}>Video Feedback</h4>
                
                <EffectControl 
                    label="INFINITY TRAILS" 
                    effectKey="feedback"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'amount', label: 'Decay', min: 0.5, max: 0.99, step: 0.01, default: 0.9, decimals: 2 },
                        { key: 'scale', label: 'Zoom', min: 0.9, max: 1.1, step: 0.001, default: 1.01, decimals: 3 },
                        { key: 'rotation', label: 'Spin', min: -1.0, max: 1.0, step: 0.01, default: 0.0, decimals: 2 },
                        { key: 'xOffset', label: 'Drift X', min: -10, max: 10, step: 0.1, default: 0, decimals: 1 },
                        { key: 'yOffset', label: 'Drift Y', min: -10, max: 10, step: 0.1, default: 0, decimals: 1 },
                    ]}
                />
                
                <h4 className="config-section-title">Glitch & Chaos</h4>

                <EffectControl 
                    label="ADVERSARIAL GLITCH" 
                    effectKey="adversarial"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'intensity', label: 'Power', min: 0, max: 2.0, step: 0.01, default: 0.8, decimals: 2 },
                        { key: 'bands', label: 'Bands', min: 1, max: 64, step: 1, default: 24, decimals: 0 },
                        { key: 'shift', label: 'Shift', min: 0, max: 50, step: 1, default: 12, decimals: 0 },
                        { key: 'noiseScale', label: 'Noise', min: 0.1, max: 12, step: 0.1, default: 3.0, decimals: 1 },
                        { key: 'chromatic', label: 'RGB Split', min: 0, max: 10, step: 0.1, default: 1.5, decimals: 1 },
                        { key: 'scanline', label: 'Scanline', min: 0, max: 1, step: 0.01, default: 0.35, decimals: 2 },
                        { key: 'qNoise', label: 'Crush', min: 0, max: 8, step: 0.1, default: 2.0, decimals: 1 },
                        { key: 'seed', label: 'Seed', min: 0, max: 10, step: 0.01, default: 0.42, decimals: 2 }
                    ]}
                />

                <h4 className="config-section-title">Retro & Terminal</h4>

                <EffectControl 
                    label="ASCII TERMINAL" 
                    effectKey="ascii"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'size', label: 'Grid Size', min: 4, max: 32, step: 1, default: 12, decimals: 0 },
                        { 
                            key: 'charSet', 
                            label: 'Style', 
                            type: 'select',
                            default: 0,
                            options: [
                                { value: 0, label: 'Shapes' },
                                { value: 1, label: 'Data Flow' },
                                { value: 2, label: 'Binary' },
                                { value: 3, label: 'Density' }
                            ]
                        },
                        { 
                            key: 'colorMode', 
                            label: 'Color', 
                            type: 'select',
                            default: 0,
                            options: [
                                { value: 0, label: 'Original' },
                                { value: 1, label: 'Matrix' },
                                { value: 2, label: 'Amber' },
                                { value: 3, label: 'Cyber' },
                                { value: 4, label: 'B&W' }
                            ]
                        },
                        { 
                            key: 'invert', 
                            label: 'Mode', 
                            type: 'select',
                            default: 0,
                            options: [
                                { value: 0, label: 'Normal' },
                                { value: 1, label: 'Inverted' }
                            ]
                        }
                    ]}
                />

                <h4 className="config-section-title">Atmosphere & Flow (Premium)</h4>

                <EffectControl 
                    label="LIQUID FLOW" 
                    effectKey="liquid"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'intensity', label: 'Amount', min: 0, max: 0.1, step: 0.001, default: 0.02, decimals: 3 },
                        { key: 'scale', label: 'Density', min: 0.1, max: 10, step: 0.1, default: 3.0, decimals: 1 },
                        { key: 'speed', label: 'Flow Spd', min: 0, max: 2.0, step: 0.1, default: 0.5, decimals: 1 }
                    ]}
                />

                <EffectControl 
                    label="VOLUMETRIC LIGHT" 
                    effectKey="volumetric"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'exposure', label: 'Brightness', min: 0, max: 1.0, step: 0.01, default: 0.3, decimals: 2 },
                        { key: 'threshold', label: 'Threshold', min: 0, max: 1.0, step: 0.01, default: 0.5, decimals: 2 },
                        { key: 'decay', label: 'Decay', min: 0.8, max: 1.0, step: 0.001, default: 0.95, decimals: 3 },
                        { key: 'density', label: 'Density', min: 0, max: 1.0, step: 0.01, default: 0.8, decimals: 2 },
                        { key: 'x', label: 'Light X', min: 0, max: 1.0, step: 0.01, default: 0.5, decimals: 2 },
                        { key: 'y', label: 'Light Y', min: 0, max: 1.0, step: 0.01, default: 0.5, decimals: 2 }
                    ]}
                />

                <EffectControl 
                    label="WAVE DISTORT" 
                    effectKey="waveDistort"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'intensity', label: 'Amplitude', min: 0, max: 2.0, step: 0.01, default: 0.5, decimals: 2 }
                    ]}
                />

                <h4 className="config-section-title">Distortion & Geometry</h4>
                
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

                <EffectControl 
                    label="VOID VORTEX (TWIST)" 
                    effectKey="twist"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'radius', label: 'Radius', min: 100, max: 1000, step: 10, default: 400, decimals: 0 },
                        { key: 'angle', label: 'Twist', min: -10, max: 10, step: 0.1, default: 4, decimals: 1 }
                    ]}
                />

                <EffectControl 
                    label="WARP DRIVE (ZOOM)" 
                    effectKey="zoomBlur"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'strength', label: 'Strength', min: 0, max: 0.5, step: 0.01, default: 0.1, decimals: 2 },
                        { key: 'innerRadius', label: 'Safe Zone', min: 0, max: 200, step: 10, default: 50, decimals: 0 }
                    ]}
                />

                <h4 className="config-section-title">Color & Texture</h4>

                <EffectControl 
                    label="CHROMATIC ABERRATION" 
                    effectKey="rgb"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'amount', label: 'Offset', min: 0, max: 20, step: 1, default: 2, decimals: 0 }
                    ]}
                />

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

                <EffectControl 
                    label="CRT MONITOR (RETRO)" 
                    effectKey="crt"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'curvature', label: 'Curve', min: 0, max: 10, step: 0.1, default: 1, decimals: 1 },
                        { key: 'lineWidth', label: 'Scanlines', min: 0, max: 5, step: 0.1, default: 1, decimals: 1 },
                        { key: 'noise', label: 'Static', min: 0, max: 0.5, step: 0.01, default: 0.1, decimals: 2 }
                    ]}
                />

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