// src/components/Panels/ModulationPanel.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Panel from './Panel';
import { useVisualEngineContext } from '../../context/VisualEngineContext';
import { EFFECT_MANIFEST } from '../../config/EffectManifest';
import SignalBus from '../../utils/SignalBus'; 
import './PanelStyles/ModulationPanel.css';

const SIGNAL_SOURCES = [
    { value: '', label: '+ MODULATE...' }, 
    { label: '--- GENERATORS ---', options: [
        { value: 'lfo_1', label: 'LFO 1' },
        { value: 'lfo_2', label: 'LFO 2' },
        { value: 'lfo_3', label: 'LFO 3' },
        { value: 'lfo.chaos', label: 'Random Chaos' }
    ]},
    { label: '--- AUDIO ---', options: [
        { value: 'audio.bass', label: 'Audio Bass' },
        { value: 'audio.mid', label: 'Audio Mid' },
        { value: 'audio.treble', label: 'Audio High' },
        { value: 'audio.level', label: 'Audio Level' }
    ]}
];

const LfoConfigurator = ({ lfoId, label, settings, onChange }) => {
    const { frequency, type } = settings || { frequency: 1, type: 'sine' };

    return (
        <div className="lfo-config-row">
            <span className="lfo-label">{label}</span>
            
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
                    <span className="lfo-speed-label">Hz: {frequency.toFixed(2)}</span>
                    <input 
                        type="range" 
                        min="0.01" 
                        max="10.0" 
                        step="0.01" 
                        value={frequency}
                        onChange={(e) => onChange(lfoId, 'frequency', parseFloat(e.target.value))}
                        className="lfo-speed-slider"
                    />
                </div>
            </div>
            
            <div className="lfo-visualizer">
                <div className={`lfo-dot-anim ${lfoId}`} style={{ animationDuration: `${1/frequency}s` }}></div>
            </div>
        </div>
    );
};

LfoConfigurator.propTypes = {
    lfoId: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    settings: PropTypes.shape({
        frequency: PropTypes.number,
        type: PropTypes.string
    }),
    onChange: PropTypes.func.isRequired
};

const ParamControl = ({ paramId, def, currentValue, patches, onUpdateBase, onAddPatch, onRemovePatch, onUpdatePatch }) => {
    const [selectedSource, setSelectedSource] = useState('');
    
    const visualizerRef = useRef(null);
    const valueDisplayRef = useRef(null);

    useEffect(() => {
        if (def.type !== 'float' && def.type !== 'int') return;

        const handleUpdate = (allValues) => {
            const liveValue = allValues[paramId];
            if (liveValue === undefined) return;

            if (visualizerRef.current) {
                const range = def.max - def.min;
                const safeRange = range === 0 ? 1 : range; 
                const percent = Math.max(0, Math.min(100, ((liveValue - def.min) / safeRange) * 100));
                visualizerRef.current.style.width = `${percent}%`;
            }

            if (valueDisplayRef.current) {
                valueDisplayRef.current.innerText = def.type === 'int' ? Math.floor(liveValue) : liveValue.toFixed(2);
            }
        };

        const unsubscribe = SignalBus.on('modulation:update', handleUpdate);
        return () => unsubscribe();
    }, [paramId, def]);

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

        return (
            <div className="slider-wrapper">
                <div className="slider-track-bg">
                    <div ref={visualizerRef} className="mod-visualizer-bar"></div>
                </div>
                
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
                {(def.type === 'float' || def.type === 'int') ? (
                    <span ref={valueDisplayRef} className="param-value-display">{Number(currentValue).toFixed(2)}</span>
                ) : null}
            </div>
            
            <div className="param-control-row">{renderInput()}</div>

            {myPatches.length > 0 && (
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
                                    min="-2.0" max="2.0" step="0.1" 
                                    value={patch.amount} 
                                    onChange={(e) => onUpdatePatch(patch.source, paramId, parseFloat(e.target.value))} 
                                    title={`Depth: ${patch.amount}`} 
                                />
                            </div>
                            <button className="btn-remove-patch" onClick={() => onRemovePatch(patch.id)}>×</button>
                        </div>
                    ))}
                </div>
            )}

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
                    title="Add Modulation"
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
    const { 
        baseValues, patches, setModulationValue, 
        addPatch, removePatch, 
        lfoSettings, setLfoSetting 
    } = useVisualEngineContext();
    
    const [expandedGroup, setExpandedGroup] = useState(null);
    const toggleGroup = (key) => setExpandedGroup(expandedGroup === key ? null : key);
    const effectEntries = useMemo(() => Object.entries(EFFECT_MANIFEST), []);

    return (
        <Panel title="MODULATION MATRIX" onClose={onClose} className="panel-from-toolbar modulation-panel events-panel-custom-scroll">
            
            <div className="lfo-generator-section section-box">
                <h4 className="section-title-small">LFO Generators</h4>
                <LfoConfigurator lfoId="lfo_1" label="LFO 1" settings={lfoSettings['lfo_1']} onChange={setLfoSetting} />
                <LfoConfigurator lfoId="lfo_2" label="LFO 2" settings={lfoSettings['lfo_2']} onChange={setLfoSetting} />
                <LfoConfigurator lfoId="lfo_3" label="LFO 3" settings={lfoSettings['lfo_3']} onChange={setLfoSetting} />
            </div>

            <div className="mod-list-container">
                {effectEntries.map(([effectKey, config]) => {
                    const isExpanded = expandedGroup === effectKey;
                    
                    const enabledParamId = config.params.enabled ? config.params.enabled.id : null;
                    const isEnabled = enabledParamId ? (baseValues[enabledParamId] > 0.5) : false;

                    return (
                        <div key={effectKey} className={`effect-group ${isExpanded ? 'expanded' : ''} ${isEnabled ? 'active-effect' : ''}`}>
                            <div className="effect-group-header" onClick={() => toggleGroup(effectKey)}>
                                <div className="effect-header-left">
                                    <span className={`effect-status-dot ${isEnabled ? 'on' : 'off'}`}></span>
                                    <span className="effect-label">{config.label}</span>
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
        </Panel>
    );
};

ModulationPanel.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default React.memo(ModulationPanel);