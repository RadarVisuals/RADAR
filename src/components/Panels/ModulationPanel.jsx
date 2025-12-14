// src/components/Panels/ModulationPanel.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Panel from './Panel';
import { useVisualEngineContext } from '../../context/VisualEngineContext';
import { EFFECT_MANIFEST } from '../../config/EffectManifest';
import SignalBus from '../../utils/SignalBus'; // Import SignalBus for high-freq updates
import './PanelStyles/ModulationPanel.css';

// Define available signal sources
const SIGNAL_SOURCES = [
    { value: '', label: '+ Add Modulation...' },
    { label: '--- AUDIO ---', options: [
        { value: 'audio.bass', label: 'Audio Bass' },
        { value: 'audio.mid', label: 'Audio Mid' },
        { value: 'audio.treble', label: 'Audio High' },
        { value: 'audio.level', label: 'Audio Level' }
    ]},
    { label: '--- LFO ---', options: [
        { value: 'lfo.slow.sine', label: 'LFO Slow (Sine)' },
        { value: 'lfo.mid.sine', label: 'LFO Mid (Sine)' },
        { value: 'lfo.fast.sine', label: 'LFO Fast (Sine)' },
        { value: 'lfo.pulse', label: 'LFO Pulse' },
        { value: 'lfo.chaos', label: 'Random Chaos' }
    ]}
];

const ParamControl = ({ paramId, def, currentValue, patches, onUpdateBase, onAddPatch, onRemovePatch, onUpdatePatch }) => {
    const [selectedSource, setSelectedSource] = useState('');
    
    // Refs for Zero-Render Updates
    const visualizerRef = useRef(null);
    const valueDisplayRef = useRef(null);

    // Subscribe to Modulation Engine Updates via SignalBus
    useEffect(() => {
        // Only run this logic for float/int sliders that need animation
        if (def.type !== 'float' && def.type !== 'int') return;

        const handleUpdate = (allValues) => {
            const liveValue = allValues[paramId];
            if (liveValue === undefined) return;

            // 1. Update the visual bar width
            if (visualizerRef.current) {
                const range = def.max - def.min;
                const safeRange = range === 0 ? 1 : range; // Prevent div by zero
                const percent = Math.max(0, Math.min(100, ((liveValue - def.min) / safeRange) * 100));
                visualizerRef.current.style.width = `${percent}%`;
            }

            // 2. Update the text display
            if (valueDisplayRef.current) {
                valueDisplayRef.current.innerText = def.type === 'int' ? Math.floor(liveValue) : liveValue.toFixed(2);
            }
        };

        const unsubscribe = SignalBus.on('modulation:update', handleUpdate);
        return () => unsubscribe();
    }, [paramId, def]);

    const handleAddClick = () => {
        if (!selectedSource) return;
        onAddPatch(selectedSource, paramId, 0.5); // Default amount
        setSelectedSource('');
    };

    // Filter patches relevant to this specific parameter
    const myPatches = patches.filter(p => p.target === paramId);

    const renderInput = () => {
        if (def.type === 'bool') {
            return (
                <div style={{display:'flex', alignItems:'center', gap:'8px', height:'20px'}}>
                    <input 
                        type="checkbox" 
                        checked={currentValue > 0.5} 
                        onChange={(e) => onUpdateBase(paramId, e.target.checked ? 1 : 0)}
                        style={{accentColor:'var(--color-primary)'}}
                    />
                    <span className="param-value-display">{currentValue > 0.5 ? 'ON' : 'OFF'}</span>
                </div>
            );
        }
        
        if (def.type === 'select') {
            return (
                <select 
                    className="source-select" 
                    value={Math.floor(currentValue)} 
                    onChange={(e) => onUpdateBase(paramId, parseInt(e.target.value))}
                    style={{width:'100%'}}
                >
                    {def.options.map((opt, idx) => (
                        <option key={idx} value={idx}>{opt}</option>
                    ))}
                </select>
            );
        }

        // Float/Int with Visualizer
        return (
            <div className="slider-wrapper">
                {/* The "Ghost" Bar showing real-time modulation */}
                <div ref={visualizerRef} className="mod-visualizer-bar"></div>
                
                {/* The Interactive Slider (Controls Base Value) */}
                <input 
                    type="range" 
                    className="base-slider"
                    min={def.min} 
                    max={def.max} 
                    step={def.type === 'int' ? 1 : 0.01}
                    value={currentValue}
                    onChange={(e) => onUpdateBase(paramId, parseFloat(e.target.value))}
                />
            </div>
        );
    };

    return (
        <div className="param-block">
            <div className="param-header">
                <span className="param-name">{def.label}</span>
                {/* Use ref for high-freq text updates to avoid React renders */}
                {(def.type === 'float' || def.type === 'int') ? (
                    <span ref={valueDisplayRef} className="param-value-display">
                        {Number(currentValue).toFixed(2)}
                    </span>
                ) : null}
            </div>
            
            {/* BASE VALUE CONTROL */}
            <div style={{marginBottom: '4px'}}>
                {renderInput()}
            </div>

            {/* ACTIVE PATCHES */}
            {myPatches.length > 0 && (
                <div className="active-patches">
                    {myPatches.map(patch => (
                        <div key={patch.id} className="patch-row">
                            <span className="patch-source-name" title={patch.source}>
                                {patch.source.replace('audio.', 'A.').replace('lfo.', 'L.')}
                            </span>
                            <input 
                                type="range" 
                                className="patch-amount-slider"
                                min="-2.0" max="2.0" step="0.1"
                                value={patch.amount}
                                onChange={(e) => onUpdatePatch(patch.source, paramId, parseFloat(e.target.value))}
                                title={`Modulation Amount: ${patch.amount}`}
                            />
                            <button className="btn-remove-patch" onClick={() => onRemovePatch(patch.id)}>×</button>
                        </div>
                    ))}
                </div>
            )}

            {/* ADD PATCH UI */}
            <div className="add-patch-ui">
                <select 
                    className="source-select" 
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
                    title="Connect Wire"
                >
                    +
                </button>
            </div>
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

const ModulationPanel = ({ onClose }) => {
    // Access the new store slices via Context
    const { 
        baseValues, 
        patches, 
        updateEffectConfig, // Used for Base Values
        addPatch, 
        removePatch 
    } = useVisualEngineContext();

    // Local state for accordion
    const [expandedGroup, setExpandedGroup] = useState(null);

    const toggleGroup = (key) => {
        setExpandedGroup(expandedGroup === key ? null : key);
    };

    const effectEntries = useMemo(() => Object.entries(EFFECT_MANIFEST), []);

    return (
        <Panel title="MODULATION MATRIX" onClose={onClose} className="panel-from-toolbar modulation-panel events-panel-custom-scroll">
            <div className="mod-header">
                <h4 className="mod-section-title">Global FX Routing</h4>
            </div>

            {effectEntries.map(([effectKey, config]) => {
                const isExpanded = expandedGroup === effectKey;
                
                // Check if effect is "Active" (enabled param > 0.5)
                // We look for a param named "enabled" inside this effect group
                const enabledParamId = config.params.enabled ? config.params.enabled.id : null;
                const isEnabled = enabledParamId ? (baseValues[enabledParamId] > 0.5) : false;

                return (
                    <div key={effectKey} className={`effect-group ${isExpanded ? 'active' : ''}`}>
                        <div className="effect-group-header" onClick={() => toggleGroup(effectKey)}>
                            <span className="effect-label" style={{color: isEnabled ? 'var(--color-primary)' : 'var(--color-text-muted)'}}>
                                {config.label}
                            </span>
                            <span className="effect-toggle">{isExpanded ? '▼' : '▶'}</span>
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
                                        onUpdateBase={(id, val) => updateEffectConfig(effectKey, id.split('.')[1], val)}
                                        onAddPatch={addPatch}
                                        onRemovePatch={removePatch}
                                        onUpdatePatch={addPatch} // addPatch handles updates if ID exists
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </Panel>
    );
};

ModulationPanel.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default React.memo(ModulationPanel);