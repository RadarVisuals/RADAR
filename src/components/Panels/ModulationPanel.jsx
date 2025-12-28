// src/components/Panels/ModulationPanel.jsx
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import Panel from './Panel';
import { useVisualEngineContext } from '../../context/VisualEngineContext';
import { EFFECT_MANIFEST } from '../../config/EffectManifest';
import SignalBus from '../../utils/SignalBus'; 
import './PanelStyles/ModulationPanel.css';

// --- CONFIGURATION ---

const SIGNAL_SOURCES = [
    { value: '', label: '+ MODULATE...' }, 
    { label: '--- AUDIO (0 to 1) ---', options: [
        { value: 'audio.bass', label: 'Bass' },
        { value: 'audio.mid', label: 'Mids' },
        { value: 'audio.treble', label: 'Treble' },
        { value: 'audio.level', label: 'Level' }
    ]},
    { label: '--- LFO (-1 to 1) ---', options: [
        { value: 'lfo_1', label: 'LFO 1 (Slow)' },
        { value: 'lfo_2', label: 'LFO 2 (Mid)' },
        { value: 'lfo_3', label: 'LFO 3 (Fast)' },
        { value: 'lfo.chaos', label: 'Random Chaos' }
    ]},
    { label: '--- EVENTS ---', options: [
        { value: 'event.any', label: 'Any Event' }
    ]}
];

const CATEGORIES = {
    'Core Physics': ['layer1', 'layer2', 'layer3'],
    'Global': ['feedback'],
    'Light & Color': ['bloom', 'volumetric', 'rgb'],
    'Distortion': ['adversarial', 'pixelate', 'waveDistort', 'zoomBlur', 'shockwave'],
    'Texture & Geo': ['liquid', 'ascii', 'kaleidoscope']
};

// --- SUB-COMPONENTS ---

const LfoConfigurator = ({ lfoId, label, settings, onChange }) => {
    const { frequency, type } = settings || { frequency: 1, type: 'sine' };
    const dotRef = useRef(null);

    // Live Visualizer for LFO
    useEffect(() => {
        const handleSignal = (signals) => {
            if (!dotRef.current) return;
            const val = signals[lfoId] || 0;
            // Map -1...1 to Opacity 0.2...1.0 and Scale
            const norm = (val + 1) / 2; 
            dotRef.current.style.opacity = 0.3 + (norm * 0.7);
            dotRef.current.style.transform = `scale(${0.8 + (norm * 0.4)})`;
            
            // Color shift based on polarity
            if (val > 0) dotRef.current.style.backgroundColor = 'var(--color-primary)';
            else dotRef.current.style.backgroundColor = 'var(--color-warning)';
        };
        const unsub = SignalBus.on('signals:update', handleSignal);
        return () => unsub();
    }, [lfoId]);

    return (
        <div className="lfo-config-row">
            <div className="lfo-header-group">
                <div className="lfo-visualizer">
                    <div ref={dotRef} className="lfo-dot-live"></div>
                </div>
                <span className="lfo-label">{label}</span>
            </div>
            
            <div className="lfo-controls">
                <select 
                    className="custom-select lfo-type-select"
                    value={type}
                    onChange={(e) => onChange(lfoId, 'type', e.target.value)}
                >
                    <option value="sine">Sine</option>
                    <option value="saw">Saw</option>
                    <option value="tri">Tri</option>
                    <option value="pulse">Pulse</option>
                </select>

                <div className="lfo-speed-container">
                    <input 
                        type="range" 
                        min="0.01" 
                        max="8.0" 
                        step="0.01" 
                        value={frequency}
                        onChange={(e) => onChange(lfoId, 'frequency', parseFloat(e.target.value))}
                        className="lfo-speed-slider"
                        title={`Frequency: ${frequency.toFixed(2)} Hz`}
                    />
                </div>
            </div>
        </div>
    );
};

LfoConfigurator.propTypes = {
    lfoId: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    settings: PropTypes.object,
    onChange: PropTypes.func.isRequired
};

const ParamControl = ({ paramId, def, currentValue, patches, onUpdateBase, onAddPatch, onRemovePatch, onUpdatePatch }) => {
    const [selectedSource, setSelectedSource] = useState('');
    
    const visualizerRef = useRef(null);
    const valueDisplayRef = useRef(null);

    // Determine if this parameter supports modulation
    // We only allow modulation on Floats (Sliders) and Ints (Steppers)
    // Booleans (Toggles) and Selects (Dropdowns) are excluded.
    const isModulatable = def.type === 'float' || def.type === 'int';

    // Live Modulation Feedback (Zero-Render)
    useEffect(() => {
        if (!isModulatable) return;

        const handleUpdate = (allValues) => {
            const liveValue = allValues[paramId];
            if (liveValue === undefined) return;

            // Update Numeric Display
            if (valueDisplayRef.current) {
                valueDisplayRef.current.innerText = def.type === 'int' ? Math.floor(liveValue) : liveValue.toFixed(2);
            }

            // Update Ghost Bar
            if (visualizerRef.current) {
                const range = def.max - def.min;
                const safeRange = range === 0 ? 1 : range;
                
                // Calculate percentage relative to slider min/max
                let percent = ((liveValue - def.min) / safeRange) * 100;
                
                // Allow bar to go red if out of bounds (clamping indication)
                if (percent < 0 || percent > 100) {
                    visualizerRef.current.style.backgroundColor = 'var(--color-error)';
                } else {
                    visualizerRef.current.style.backgroundColor = 'var(--color-primary)';
                }
                
                percent = Math.max(0, Math.min(100, percent));
                visualizerRef.current.style.width = `${percent}%`;
            }
        };

        const unsubscribe = SignalBus.on('modulation:update', handleUpdate);
        return () => unsubscribe();
    }, [paramId, def, isModulatable]);

    const handleAddClick = () => {
        if (!selectedSource) return;
        onAddPatch(selectedSource, paramId, 0.5); 
        setSelectedSource('');
    };

    const myPatches = patches.filter(p => p.target === paramId);

    const renderInput = () => {
        if (def.type === 'bool') {
            return (
                <div className="checkbox-wrapper">
                    <label className="toggle-switch">
                        <input 
                            type="checkbox" 
                            checked={currentValue > 0.5} 
                            onChange={(e) => onUpdateBase(paramId, e.target.checked ? 1 : 0)} 
                        />
                        <span className="toggle-slider"></span>
                    </label>
                    <span className="param-value-display">{currentValue > 0.5 ? 'ON' : 'OFF'}</span>
                </div>
            );
        }
        
        if (def.type === 'select') {
            return (
                <select 
                    className="custom-select" 
                    value={Math.floor(currentValue)} 
                    onChange={(e) => onUpdateBase(paramId, parseInt(e.target.value))}
                >
                    {def.options.map((opt, idx) => (
                        <option key={idx} value={idx}>{opt}</option>
                    ))}
                </select>
            );
        }

        // Float/Int Slider
        return (
            <div className="slider-wrapper">
                {/* Visualizer Background Track */}
                <div className="slider-track-bg">
                    <div ref={visualizerRef} className="mod-visualizer-bar"></div>
                </div>
                
                {/* Interactive Slider (Base Value) */}
                <input 
                    type="range" 
                    className="base-slider" 
                    min={def.min} 
                    max={def.max} 
                    step={def.type === 'int' ? 1 : (def.step || 0.01)} 
                    value={currentValue} 
                    onChange={(e) => onUpdateBase(paramId, parseFloat(e.target.value))} 
                />
            </div>
        );
    };

    return (
        <div className="param-block">
            <div className="param-header">
                <span className="param-name" title={paramId}>{def.label}</span>
                {/* Only show numeric value for modulatable types */}
                {isModulatable && (
                    <span ref={valueDisplayRef} className="param-value-display">
                        {Number(currentValue).toFixed(def.type === 'int' ? 0 : 2)}
                    </span>
                )}
            </div>
            
            <div className="param-control-row">{renderInput()}</div>

            {/* List of active modulations for this param - ONLY IF MODULATABLE */}
            {isModulatable && myPatches.length > 0 && (
                <div className="active-patches">
                    {myPatches.map(patch => (
                        <div key={patch.id} className="patch-row">
                            <span className="patch-source-name" title={patch.source}>
                                {patch.source.replace('audio.', 'A.').replace('lfo_', 'LFO ')}
                            </span>
                            <div className="patch-slider-container">
                                <input 
                                    type="range" 
                                    className="patch-amount-slider" 
                                    min="-2.0" max="2.0" step="0.01" 
                                    value={patch.amount} 
                                    onChange={(e) => onUpdatePatch(patch.source, paramId, parseFloat(e.target.value))} 
                                    title={`Modulation Depth: ${patch.amount.toFixed(2)}`} 
                                />
                                {/* Center tick for bipolar visual ref */}
                                <div className="center-tick"></div>
                            </div>
                            <button className="btn-remove-patch" onClick={() => onRemovePatch(patch.id)} title="Remove Modulation">×</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add New Patch Dropdown - ONLY IF MODULATABLE */}
            {isModulatable && (
                <div className="add-patch-ui">
                    <select 
                        className="custom-select source-select" 
                        value={selectedSource} 
                        onChange={(e) => setSelectedSource(e.target.value)}
                    >
                        {SIGNAL_SOURCES.map((group, idx) => (
                            group.options ? (
                                <optgroup key={idx} label={group.label}>
                                    {group.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </optgroup>
                            ) : <option key={idx} value={group.value}>{group.label}</option>
                        ))}
                    </select>
                    <button 
                        className="btn-add-patch" 
                        onClick={handleAddClick} 
                        disabled={!selectedSource} 
                        title="Add Connection"
                    >
                        +
                    </button>
                </div>
            )}
        </div>
    );
};

ParamControl.propTypes = {
    paramId: PropTypes.string.isRequired,
    def: PropTypes.object.isRequired,
    currentValue: PropTypes.number.isRequired,
    patches: PropTypes.array.isRequired,
    onUpdateBase: PropTypes.func.isRequired,
    onAddPatch: PropTypes.func.isRequired,
    onRemovePatch: PropTypes.func.isRequired,
    onUpdatePatch: PropTypes.func.isRequired,
};

// --- MAIN PANEL COMPONENT ---

const ModulationPanel = ({ onClose }) => {
    const { 
        baseValues, patches, setModulationValue, 
        addPatch, removePatch, 
        lfoSettings, setLfoSetting,
        clearAllPatches,
        resetBaseValues 
    } = useVisualEngineContext();
    
    // Categorize Effects
    const categorizedEffects = useMemo(() => {
        const result = {};
        // Initialize categories
        Object.keys(CATEGORIES).forEach(k => result[k] = []);
        result['Other'] = [];

        Object.entries(EFFECT_MANIFEST).forEach(([key, config]) => {
            let found = false;
            for (const [catName, keys] of Object.entries(CATEGORIES)) {
                if (keys.includes(key)) {
                    result[catName].push({ key, config });
                    found = true;
                    break;
                }
            }
            if (!found) result['Other'].push({ key, config });
        });
        
        // Filter out empty categories
        return Object.entries(result).filter(([_, items]) => items.length > 0);
    }, []);

    // Accordion State
    const [expandedCategories, setExpandedCategories] = useState({ 'Core Physics': true });
    const toggleCategory = (cat) => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

    // Effect State (within category)
    const [expandedEffects, setExpandedEffects] = useState({});
    const toggleEffect = (key) => setExpandedEffects(prev => ({ ...prev, [key]: !prev[key] }));

    const handleClearWires = useCallback(() => {
        if (!clearAllPatches) {
            console.error("[ModulationPanel] clearAllPatches is not available in context!");
            return;
        }
        if (window.confirm('Remove all modulation wires? (Knobs will stay set)')) {
            clearAllPatches();
        }
    }, [clearAllPatches]);

    const handleResetKnobs = useCallback(() => {
        if (!resetBaseValues) {
            console.error("[ModulationPanel] resetBaseValues is not available in context!");
            return;
        }
        if (window.confirm('Reset all effect knobs to defaults? (Wires will stay connected)')) {
            resetBaseValues();
        }
    }, [resetBaseValues]);

    return (
        <Panel title="MODULATION MATRIX" onClose={onClose} className="panel-from-toolbar modulation-panel events-panel-custom-scroll">
            
            {/* LFO RACK */}
            <div className="lfo-generator-section section-box">
                <div className="section-header-row">
                    <h4 className="section-title-small">LFO Generators</h4>
                </div>
                <LfoConfigurator lfoId="lfo_1" label="LFO 1" settings={lfoSettings['lfo_1']} onChange={setLfoSetting} />
                <LfoConfigurator lfoId="lfo_2" label="LFO 2" settings={lfoSettings['lfo_2']} onChange={setLfoSetting} />
                <LfoConfigurator lfoId="lfo_3" label="LFO 3" settings={lfoSettings['lfo_3']} onChange={setLfoSetting} />
            </div>

            {/* ACTION BUTTONS ROW */}
            <div className="mod-actions-row">
                <button 
                    className="btn-link-action" 
                    onClick={handleResetKnobs}
                    title="Reset all sliders to zero/default"
                >
                    Clear Effects
                </button>
                <div className="vertical-divider"></div>
                <button 
                    className="btn-link-danger" 
                    onClick={handleClearWires}
                    title="Remove all modulation connections"
                >
                    Clear Modulation
                </button>
            </div>

            {/* EFFECT RACKS */}
            <div className="mod-list-container">
                {categorizedEffects.map(([categoryName, effects]) => (
                    <div key={categoryName} className="category-block">
                        <div 
                            className={`category-header ${expandedCategories[categoryName] ? 'open' : ''}`}
                            onClick={() => toggleCategory(categoryName)}
                        >
                            <span>{categoryName}</span>
                            <span className="chevron">{expandedCategories[categoryName] ? '▼' : '▶'}</span>
                        </div>

                        {expandedCategories[categoryName] && (
                            <div className="category-content">
                                {effects.map(({ key: effectKey, config }) => {
                                    const isExpanded = expandedEffects[effectKey];
                                    
                                    // Check if effect is enabled
                                    const enabledParamId = config.params.enabled ? config.params.enabled.id : null;
                                    const isEnabled = enabledParamId ? (baseValues[enabledParamId] > 0.5) : false;
                                    
                                    // Check if modulated (has active patches)
                                    const hasModulation = patches.some(p => p.target.startsWith(effectKey));

                                    return (
                                        <div key={effectKey} className={`effect-group ${isExpanded ? 'expanded' : ''} ${isEnabled ? 'active-effect' : ''}`}>
                                            <div className="effect-group-header" onClick={() => toggleEffect(effectKey)}>
                                                <div className="effect-header-left">
                                                    <span className={`effect-status-dot ${isEnabled ? 'on' : 'off'}`}></span>
                                                    <span className="effect-label">{config.label}</span>
                                                    {hasModulation && <span className="mod-badge">MOD</span>}
                                                </div>
                                                <span className="effect-toggle">{isExpanded ? '−' : '+'}</span>
                                            </div>
                                            
                                            {isExpanded && (
                                                <div className="effect-params-container">
                                                    {Object.values(config.params).map(paramDef => (
                                                        <ParamControl 
                                                            key={paramDef.id} 
                                                            paramId={paramDef.id} 
                                                            def={paramDef} 
                                                            currentValue={baseValues[paramDef.id] ?? paramDef.default} 
                                                            patches={patches} 
                                                            onUpdateBase={setModulationValue}
                                                            onAddPatch={addPatch} 
                                                            onRemovePatch={removePatch} 
                                                            onUpdatePatch={addPatch} 
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Panel>
    );
};

ModulationPanel.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default React.memo(ModulationPanel);