// src/utils/MidiManager.js
import { useEngineStore } from '../store/useEngineStore';
import { useProjectStore } from '../store/useProjectStore';
import { sliderParams } from '../config/sliderParams'; 
import SignalBus from './SignalBus';
import debounce from './debounce';

/**
 * High-Performance MidiManager
 * 
 * Bypasses the React render cycle for knobs/sliders for zero latency.
 * Correctly detects and dispatches global actions (Pads) for scene/workspace navigation.
 */
class MidiManager {
  constructor() {
    this.midiAccess = null;
    
    // Throttling mechanism for Store Sync (Persistence)
    // We only update the heavy Project Store every 60ms for knobs.
    this.storeSyncThrottle = null;
    this.pendingSyncs = new Map();
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
        this._handleParamMapping(engineStore.midiLearning, {
          type: isCC ? "cc" : (isNoteOn ? "note" : "pitchbend"),
          number: data1, channel: msgChan,
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

    // --- A. CROSSFADER CHECK ---
    if (midiMap.global?.crossfader) {
        const mapping = midiMap.global.crossfader;
        if (this._isMatch(mapping, type, data1, msgChan)) {
            const val = this._normalize(data2, mapping.type, data1);
            SignalBus.emit('crossfader:set', val);
            this._scheduleStoreSync('global', 'crossfader', val);
            return;
        }
    }

    // --- B. PARAMETER MAPPINGS (Knobs) ---
    // We check these first as they are high-frequency
    for (const layerId in midiMap) {
      if (layerId === "global" || layerId === "layerSelects") continue;
      
      const layerParams = midiMap[layerId];
      if (!layerParams) continue;

      for (const paramName in layerParams) {
        const mapping = layerParams[paramName];
        if (mapping && this._isMatch(mapping, type, data1, msgChan)) {
          
          const normalized = this._normalize(data2, mapping.type, data1);

          // FAST PATH: Visual Bypass
          SignalBus.emit('param:update', { 
              layerId, param: paramName, value: normalized, isNormalized: true 
          });

          // SLOW PATH: Throttled Store Sync
          this._scheduleStoreSync(layerId, paramName, normalized);
          return;
        }
      }
    }

    // --- C. GLOBAL ACTIONS (Pads/Buttons) ---
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
          // Actions should only trigger on NoteOn or a CC value spike
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

  /**
   * Helper to match a mapping against a message
   */
  _isMatch(mapping, type, data1, msgChan) {
    if (!mapping) return false;
    // Check channel if it was specified in the mapping
    if (mapping.channel !== undefined && mapping.channel !== msgChan) return false;
    
    if (mapping.type === "cc" && type === 0xb0 && mapping.number === data1) return true;
    if (mapping.type === "note" && type === 0x90 && mapping.number === data1) return true;
    if (mapping.type === "pitchbend" && type === 0xe0) return true;
    
    return false;
  }

  /**
   * Helper to normalize MIDI data to 0.0 - 1.0
   */
  _normalize(value, type, data1) {
    if (type === "pitchbend") return Math.max(0, Math.min(1, ((value << 7) | data1) / 16383));
    return value / 127;
  }

  /**
   * Background Store Sync logic for high-frequency performance
   */
  _scheduleStoreSync(layerId, param, normalizedValue) {
    const key = `${layerId}:${param}`;
    this.pendingSyncs.set(key, { layerId, param, value: normalizedValue });

    if (!this.storeSyncThrottle) {
      this.storeSyncThrottle = setTimeout(() => {
        const engine = useEngineStore.getState();
        const project = useProjectStore.getState();
        
        this.pendingSyncs.forEach(({ layerId, param, value }) => {
          if (layerId === 'global') {
            engine.setCrossfader(value);
          } else {
            const config = sliderParams.find(p => p.prop === param);
            const scaled = config ? config.min + (value * (config.max - config.min)) : value;
            engine.updateActiveDeckConfig(layerId, param, scaled);
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
    const currentMap = { ...projectStore.stagedSetlist.globalUserMidiMap };
    
    if (learning.type === 'param') {
      const lKey = String(learning.layer);
      currentMap[lKey] = { ...(currentMap[lKey] || {}), [learning.param]: mappingData };
    } else {
      if (!currentMap.global) currentMap.global = {};
      currentMap.global[learning.control] = mappingData;
    }
    
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