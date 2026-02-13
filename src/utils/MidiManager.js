// src/utils/MidiManager.js
import { useEngineStore } from '../store/useEngineStore';
import { useProjectStore } from '../store/useProjectStore';
import { sliderParams } from '../config/sliderParams';
import { getParamDefinition } from '../config/EffectManifest';
import SignalBus from './SignalBus';
import { getPixiEngine } from '../hooks/usePixiOrchestrator';
import { syncBridge } from './SyncBridge';

/**
 * High-Performance MidiManager with Parameter Catching (Soft Takeover)
 * 
 * Bypasses the React render cycle for knobs/sliders for zero latency.
 * Correctly detects and dispatches global actions (Pads) for scene/workspace navigation.
 * 
 * UPDATED: Now supports mapping ANY parameter defined in EffectManifest.
 * UPDATED: Broadcasts changes via SyncBridge to support Dual-Screen Mode.
 */
class MidiManager {
  constructor() {
    this.midiAccess = null;
    
    // Throttling mechanism for Store Sync (Persistence)
    this.storeSyncThrottle = null;
    this.pendingSyncs = new Map();

    // SOFT TAKEOVER STATE
    this.catchStatus = new Map();
    this.CATCH_THRESHOLD = 0.06; // Normalized 0-1 scale
  }

  async connect() {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      console.error("Web MIDI API not supported");
      return;
    }
    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.midiAccess.onstatechange = () => this._setupInputs();
      this._setupInputs();
    } catch (err) {
      console.error("[MIDI] Connection failed:", err);
    }
  }

  _setupInputs() {
    if (!this.midiAccess) return;
    this.midiAccess.inputs.forEach((input) => {
      input.onmidimessage = (msg) => this.handleMessage(msg);
    });
  }

  /**
   * Resets all caught flags. Use this when loading a new scene or workspace.
   */
  resetCatchState() {
    this.catchStatus.clear();
    if (import.meta.env.DEV) console.log("[MIDI] Catch status reset for new context.");
  }

  /**
   * SOFT TAKEOVER CHECK
   */
  _checkCatch(groupKey, param, physicalVal) {
    const fullId = param.includes('.') ? param : `${groupKey}.${param}`;
    
    // 1. Resolve Definition
    // Try explicit ID first, then generic
    const targetDef = getParamDefinition(fullId) || getParamDefinition(param);

    // Skip catch logic for booleans (buttons/pads), they should trigger instantly
    if (targetDef && targetDef.type === 'bool') return true;

    const catchKey = `${groupKey}:${param}`;
    if (this.catchStatus.get(catchKey)) return true;

    const store = useEngineStore.getState();
    let softwareVal = 0;

    // 2. Determine Software Value (Normalized 0-1)
    if (groupKey === 'global' && param === 'crossfader') {
        softwareVal = store.crossfader;
    } 
    else if (['1', '2', '3'].includes(groupKey)) {
        // Legacy Layer Logic (Read from Engine for best accuracy on layers)
        const engine = getPixiEngine();
        if (engine) {
            const liveVal = engine.getLiveValue(groupKey, param);
            const config = sliderParams.find(p => p.prop === param);
            if (config) {
                softwareVal = (liveVal - config.min) / (config.max - config.min);
            }
        }
    } 
    else {
        // Effect Logic (Read from Store BaseValues)
        // We use baseValues because modulation is additive, and MIDI controls the base knob.
        const rawVal = store.baseValues[fullId];
        if (targetDef && rawVal !== undefined) {
             const range = targetDef.max - targetDef.min;
             softwareVal = range === 0 ? 0 : (rawVal - targetDef.min) / range;
        }
    }

    // 3. Compare
    const distance = Math.abs(physicalVal - softwareVal);
    if (distance <= this.CATCH_THRESHOLD) {
        this.catchStatus.set(catchKey, true);
        return true;
    }
    return false;
  }

  handleMessage(message) {
    if (!message || !message.data) return;
    const [status, data1, data2] = message.data;
    const type = status & 0xf0;
    const msgChan = status & 0x0f;

    const isCC = type === 0xb0;
    const isNoteOn = type === 0x90 && data2 > 0;
    const isPitch = type === 0xe0;

    const engineStore = useEngineStore.getState();

    // 1. MIDI Monitor Update
    if (engineStore.showMidiMonitor) {
        engineStore.addMidiMonitorData({
            timestamp: Date.now(),
            status, data1, data2, channel: msgChan + 1,
            type: isCC ? "CC" : isNoteOn ? "Note" : isPitch ? "Pitch" : "Other"
        });
    }

    if (engineStore.selectedChannel > 0 && (msgChan + 1) !== engineStore.selectedChannel) return;

    // 2. Handle Learning Mode
    if (engineStore.midiLearning) {
      if (isCC || isNoteOn || isPitch) {
        // midiLearning structure: { type: 'param', param: 'intensity', layer: 'bloom' }
        this._handleParamMapping(engineStore.midiLearning, {
          type: isCC ? "cc" : (isNoteOn ? "note" : "pitchbend"),
          number: data1, 
          channel: msgChan,
          isToggle: isNoteOn // Hint for boolean handling
        });
      }
      return;
    }

    if (engineStore.learningLayer !== null && isNoteOn) {
      this._handleLayerMapping(engineStore.learningLayer, { type: "note", number: data1, channel: msgChan });
      return;
    }

    // 3. High Speed Execution Mode
    const projectStore = useProjectStore.getState();
    const midiMap = projectStore.stagedSetlist.globalUserMidiMap || {};

    // --- A. GLOBAL CROSSFADER ---
    if (midiMap.global?.crossfader) {
        const mapping = midiMap.global.crossfader;
        if (this._isMatch(mapping, type, data1, msgChan)) {
            const val = this._normalize(data2, mapping.type, data1);
            if (this._checkCatch('global', 'crossfader', val)) {
                // Update Local
                SignalBus.emit('crossfader:set', val);
                // Update Remote
                syncBridge.sendCrossfader(val);
                
                this._scheduleStoreSync('global', 'crossfader', val);
            }
            return;
        }
    }

    // --- B. PARAMETER MAPPINGS (Unified: Layers + Effects) ---
    for (const groupKey in midiMap) {
      // Skip special keys
      if (groupKey === "global" || groupKey === "layerSelects") continue;
      
      const groupParams = midiMap[groupKey];
      if (!groupParams) continue;

      for (const paramKey in groupParams) {
        const mapping = groupParams[paramKey];
        
        if (mapping && this._isMatch(mapping, type, data1, msgChan)) {
          
          // Construct ID to find definition
          const fullId = paramKey.includes('.') ? paramKey : `${groupKey}.${paramKey}`;
          const paramDef = getParamDefinition(fullId) || getParamDefinition(paramKey);

          if (paramDef) {
              // --- TYPE: BOOLEAN (Toggle) ---
              if (paramDef.type === 'bool') {
                  // Only toggle on Note On press, or CC thresholds
                  if (isNoteOn || (isCC && isNoteOn === false)) { 
                      let newVal; 
                      if (isNoteOn) {
                          const currentVal = engineStore.baseValues[paramDef.id] || 0;
                          newVal = currentVal > 0.5 ? 0 : 1; // Flip
                      } else {
                          newVal = data2 > 63 ? 1 : 0;
                      }
                      
                      // Immediate Update
                      const engine = getPixiEngine();
                      if (engine) engine.setModulationValue(paramDef.id, newVal);
                      
                      // Sync to Receiver
                      syncBridge.sendModValue(paramDef.id, newVal);

                      // Persist
                      this._scheduleStoreSync(groupKey, paramKey, newVal);
                  }
              } 
              // --- TYPE: FLOAT/INT (Slider/Knob) ---
              else {
                  const normalized = this._normalize(data2, mapping.type, data1);
                  
                  // Scale from 0-1 to Min-Max
                  const scaledVal = paramDef.min + (normalized * (paramDef.max - paramDef.min));

                  // Catch Check
                  if (this._checkCatch(groupKey, paramKey, normalized)) {
                      
                      const engine = getPixiEngine();
                      if (engine) {
                          if (['1','2','3'].includes(groupKey)) {
                              // Layer: Use SignalBus for smooth interpolation hook
                              SignalBus.emit('param:update', { 
                                  layerId: groupKey, param: paramKey, value: scaledVal, isNormalized: false 
                              });
                              // Sync to Receiver (Layer Param)
                              syncBridge.sendParamUpdate(groupKey, paramKey, scaledVal);
                          } else {
                              // Effect: Direct Set
                              engine.setModulationValue(paramDef.id, scaledVal);
                              // Sync to Receiver (Modulation Value)
                              syncBridge.sendModValue(paramDef.id, scaledVal);
                          }
                      }
                      this._scheduleStoreSync(groupKey, paramKey, scaledVal);
                  }
              }
          } 
          // --- FALLBACK (Old Layer Logic - Safety Net) ---
          else {
              const normalized = this._normalize(data2, mapping.type, data1);
              if (['1','2','3'].includes(groupKey)) {
                  if (this._checkCatch(groupKey, paramKey, normalized)) {
                      SignalBus.emit('param:update', { 
                          layerId: groupKey, param: paramKey, value: normalized, isNormalized: true 
                      });
                      
                      // Calculate approximate scaled value for sync
                      const config = sliderParams.find(p => p.prop === paramKey);
                      let finalVal = normalized;
                      if (config) finalVal = config.min + (normalized * (config.max - config.min));
                      
                      // Sync to Receiver
                      syncBridge.sendParamUpdate(groupKey, paramKey, finalVal);

                      this._scheduleStoreSync(groupKey, paramKey, normalized);
                  }
              }
          }
          return; // Stop processing after match
        }
      }
    }

    // --- C. GLOBAL ACTIONS ---
    if (midiMap.global) {
      const actions = [
        { key: 'nextScene', type: 'nextScene' },
        { key: 'prevScene', type: 'prevScene' },
        { key: 'nextWorkspace', type: 'nextWorkspace' },
        { key: 'prevWorkspace', type: 'prevWorkspace' },
        { key: 'pLockToggle', type: 'globalAction', action: 'pLockToggle' }
      ];

      for (const a of actions) {
        const mapping = midiMap.global[a.key];
        if (mapping && this._isMatch(mapping, type, data1, msgChan)) {
          if (isNoteOn || (isCC && data2 > 64)) {
            engineStore.queueMidiAction(a.action ? { type: a.type, action: a.action } : { type: a.type });
            return;
          }
        }
      }
    }

    // --- D. LAYER SELECT PADS ---
    if (isNoteOn && midiMap.layerSelects) {
      for (const layerId in midiMap.layerSelects) {
        const mapping = midiMap.layerSelects[layerId];
        if (mapping && this._isMatch(mapping, type, data1, msgChan)) {
          engineStore.queueMidiAction({ type: "layerSelect", layer: parseInt(layerId, 10) });
          return;
        }
      }
    }
  }

  _isMatch(mapping, type, data1, msgChan) {
    if (!mapping) return false;
    if (mapping.channel !== undefined && mapping.channel !== msgChan) return false;
    if (mapping.type === "cc" && type === 0xb0 && mapping.number === data1) return true;
    if (mapping.type === "note" && type === 0x90 && mapping.number === data1) return true;
    if (mapping.type === "pitchbend" && type === 0xe0) return true;
    return false;
  }

  _normalize(value, type, data1) {
    if (type === "pitchbend") return Math.max(0, Math.min(1, ((value << 7) | data1) / 16383));
    return value / 127;
  }

  _scheduleStoreSync(groupKey, param, value) {
    // Throttled update to Zustand to prevent persistence lag
    const key = `${groupKey}:${param}`;
    this.pendingSyncs.set(key, { groupKey, param, value });

    if (!this.storeSyncThrottle) {
      this.storeSyncThrottle = setTimeout(() => {
        const engine = useEngineStore.getState();
        const project = useProjectStore.getState();
        
        this.pendingSyncs.forEach(({ groupKey, param, value }) => {
          if (groupKey === 'global' && param === 'crossfader') {
            engine.setCrossfader(value);
          } 
          else if (['1','2','3'].includes(groupKey)) {
            // Legacy Scaler for fallback support if needed
            const config = sliderParams.find(p => p.prop === param);
            let finalVal = value;
            if (value <= 1.0 && config && config.max > 1.0) {
                 finalVal = config.min + (value * (config.max - config.min));
            }
            engine.updateActiveDeckConfig(groupKey, param, finalVal);
          } 
          else {
            // Effect Param: Just set base value
            const fullId = param.includes('.') ? param : `${groupKey}.${param}`;
            engine.setEffectBaseValue(fullId, value);
          }
        });

        project.setHasPendingChanges(true);
        this.pendingSyncs.clear();
        this.storeSyncThrottle = null;
      }, 60); 
    }
  }

  _handleParamMapping(learning, mappingData) {
    const projectStore = useProjectStore.getState();
    const currentMap = JSON.parse(JSON.stringify(projectStore.stagedSetlist.globalUserMidiMap || {}));
    
    const group = String(learning.layer);
    if (!currentMap[group]) currentMap[group] = {};
    
    currentMap[group][learning.param] = mappingData;

    // --- FORCE CATCH ENABLED ---
    // This explicitly allows immediate override without needing to cross the threshold
    // specifically for the control we just learned.
    const catchKey = `${group}:${learning.param}`;
    this.catchStatus.set(catchKey, true);
    
    projectStore.updateGlobalMidiMap(currentMap);
    useEngineStore.getState().setMidiLearning(null);
  }

  _handleLayerMapping(layerId, mappingData) {
    const projectStore = useProjectStore.getState();
    const currentMap = { ...projectStore.stagedSetlist.globalUserMidiMap };
    const layerSelects = { ...(currentMap.layerSelects || {}), [layerId]: mappingData };
    projectStore.updateGlobalMidiMap({ ...currentMap, layerSelects });
    useEngineStore.getState().setLearningLayer(null);
  }

  disconnect() {
    if (this.midiAccess) {
        this.midiAccess.inputs.forEach(i => i.onmidimessage = null);
        this.midiAccess = null;
    }
  }
}

export const midiManager = new MidiManager();