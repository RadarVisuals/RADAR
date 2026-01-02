// src/components/Panels/ModulationPanel.jsx
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import Panel from './Panel';
import { useVisualEngine } from '../../hooks/useVisualEngine';
import { EFFECT_MANIFEST } from '../../config/EffectManifest';
import SignalBus from '../../utils/SignalBus'; 
import './PanelStyles/ModulationPanel.css';

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

// --- Sub-components (Unchanged logic) ---

const LfoConfigurator = ({ lfoId, label, settings, onChange }) => {
    const { frequency, type } = settings || { frequency: 1, type: 'sine' };
    const dotRef = useRef(null);

    useEffect(() => {
        const handleSignal = (signals) => {
            if (!dotRef.current) return;
            const val = signals[lfoId] || 0;
            const norm = (val + 1) / 2; 
            dotRef.current.style.opacity = 0.3 + (norm * 0.7);
            dotRef.current.style.transform = `scale(${0.8 + (norm * 0.4)})`;
            
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
                    />
                </div>
            </div>
        </div>
    );
};

const ParamControl = ({ paramId, def, currentValue, patches, onUpdateBase, onAddPatch, onRemovePatch, onUpdatePatch }) => {
    const [selectedSource, setSelectedSource] = useState('');
    const visualizerRef = useRef(null);
    const valueDisplayRef = useRef(null);
    const isModulatable = def.type === 'float' || def.type === 'int';

    useEffect(() => {
        if (!isModulatable) return;
        const handleUpdate = (allValues) => {
            const liveValue = allValues[paramId];
            if (liveValue === undefined) return;
            if (valueDisplayRef.current) {
                valueDisplayRef.current.innerText = def.type === 'int' ? Math.floor(liveValue) : liveValue.toFixed(2);
            }
            if (visualizerRef.current) {
                const range = def.max - def.min;
                const safeRange = range === 0 ? 1 : range;
                let percent = ((liveValue - def.min) / safeRange) * 100;
                visualizerRef.current.style.width = `${Math.max(0, Math.min(100, percent))}%`;
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

    return (
        <div className="param-block">
            <div className="param-header">
                <span className="param-name">{def.label}</span>
                {isModulatable && (
                    <span ref={valueDisplayRef} className="param-value-display">
                        {Number(currentValue).toFixed(def.type === 'int' ? 0 : 2)}
                    </span>
                )}
            </div>
            
            <div className="param-control-row">
                {def.type === 'bool' ? (
                    <div className="checkbox-wrapper">
                        <label className="toggle-switch">
                            <input 
                                type="checkbox" 
                                checked={currentValue > 0.5} 
                                onChange={(e) => onUpdateBase(paramId, e.target.checked ? 1 : 0)} 
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                ) : def.type === 'select' ? (
                    <select 
                        className="custom-select" 
                        value={Math.floor(currentValue)} 
                        onChange={(e) => onUpdateBase(paramId, parseInt(e.target.value))}
                    >
                        {def.options.map((opt, idx) => (
                            <option key={idx} value={idx}>{opt}</option>
                        ))}
                    </select>
                ) : (
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
                )}
            </div>

            {isModulatable && myPatches.length > 0 && (
                <div className="active-patches">
                    {myPatches.map(patch => (
                        <div key={patch.id} className="patch-row">
                            <span className="patch-source-name">{patch.source.replace('audio.', 'A.').replace('lfo_', 'LFO ')}</span>
                            <div className="patch-slider-container">
                                <input 
                                    type="range" 
                                    className="patch-amount-slider" 
                                    min="-2.0" max="2.0" step="0.01" 
                                    value={patch.amount} 
                                    onChange={(e) => onUpdatePatch(patch.source, paramId, parseFloat(e.target.value))} 
                                />
                            </div>
                            <button className="btn-remove-patch" onClick={() => onRemovePatch(patch.id)}>×</button>
                        </div>
                    ))}
                </div>
            )}

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
                    <button className="btn-add-patch" onClick={handleAddClick} disabled={!selectedSource}>+</button>
                </div>
            )}
        </div>
    );
};

// --- Main Panel ---

const ModulationPanel = ({ onClose }) => {
    const { 
        baseValues, patches, setModulationValue, 
        addPatch, removePatch, 
        lfoSettings, setLfoSetting,
        clearAllPatches,
        resetBaseValues 
    } = useVisualEngine();
    
    // --- REFACTORED CATEGORY LOGIC ---
    // Instead of hardcoded arrays, we group by the 'category' string in the Manifest
    const categorizedEffects = useMemo(() => {
        const groups = {};
        
        // Ensure Core Physics comes first
        groups['Core Physics'] = [];

        Object.entries(EFFECT_MANIFEST).forEach(([key, config]) => {
            if (key.startsWith('layer')) {
                groups['Core Physics'].push({ key, config });
            } else {
                const cat = config.category || 'Other';
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push({ key, config });
            }
        });

        // Sort keys to ensure 'Core Physics' is first, 'Other' is last
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (a === 'Core Physics') return -1;
            if (b === 'Core Physics') return 1;
            if (a === 'Other') return 1;
            if (b === 'Other') return -1;
            return a.localeCompare(b);
        });

        return sortedKeys.map(k => [k, groups[k]]);
    }, []);

    const [expandedCategories, setExpandedCategories] = useState({ 'Core Physics': true });
    const [expandedEffects, setExpandedEffects] = useState({});

    return (
        <Panel title="MODULATION MATRIX" onClose={onClose} className="panel-from-toolbar modulation-panel events-panel-custom-scroll">
            <div className="lfo-generator-section section-box">
                <h4 className="section-title-small">LFO Generators</h4>
                <LfoConfigurator lfoId="lfo_1" label="LFO 1" settings={lfoSettings['lfo_1']} onChange={setLfoSetting} />
                <LfoConfigurator lfoId="lfo_2" label="LFO 2" settings={lfoSettings['lfo_2']} onChange={setLfoSetting} />
                <LfoConfigurator lfoId="lfo_3" label="LFO 3" settings={lfoSettings['lfo_3']} onChange={setLfoSetting} />
            </div>

            <div className="mod-actions-row">
                <button className="btn-link-action" onClick={resetBaseValues}>Clear Effects</button>
                <div className="vertical-divider"></div>
                <button className="btn-link-danger" onClick={clearAllPatches}>Clear Modulation</button>
            </div>

            <div className="mod-list-container">
                {categorizedEffects.map(([categoryName, effects]) => (
                    <div key={categoryName} className="category-block">
                        <div className={`category-header ${expandedCategories[categoryName] ? 'open' : ''}`} onClick={() => setExpandedCategories(p => ({...p, [categoryName]: !p[categoryName]}))}>
                            <span>{categoryName}</span>
                            <span className="chevron">{expandedCategories[categoryName] ? '▼' : '▶'}</span>
                        </div>

                        {expandedCategories[categoryName] && (
                            <div className="category-content">
                                {effects.map(({ key: effectKey, config }) => {
                                    const isExpanded = expandedEffects[effectKey];
                                    const enabledParamId = config.params.enabled ? config.params.enabled.id : null;
                                    const isEnabled = enabledParamId ? (baseValues[enabledParamId] > 0.5) : true;

                                    return (
                                        <div key={effectKey} className={`effect-group ${isExpanded ? 'expanded' : ''} ${isEnabled ? 'active-effect' : ''}`}>
                                            <div className="effect-group-header" onClick={() => setExpandedEffects(p => ({...p, [effectKey]: !p[effectKey]}))}>
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
                        )}
                    </div>
                ))}
            </div>
        </Panel>
    );
};

ModulationPanel.propTypes = { onClose: PropTypes.func.isRequired };
export default React.memo(ModulationPanel);