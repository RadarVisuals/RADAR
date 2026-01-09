// src/utils/SyncBridge.js
import SignalBus from './SignalBus';
import { useEngineStore } from '../store/useEngineStore';
import { useUIStore } from '../store/useUIStore';
import { getPixiEngine } from '../hooks/usePixiOrchestrator';

/**
 * SyncBridge: Manages multi-tab communication for Dual-Screen VJing.
 * Uses BroadcastChannel to bypass popup blockers and provide low-latency sync.
 */
class SyncBridge {
  constructor() {
    this.channelName = 'radar_vj_sync_v1';
    this.role = 'sender'; // Default role is Controller
    this.bc = new BroadcastChannel(this.channelName);

    // High-frequency listener for crossfader movements
    SignalBus.on('crossfader:update', (value) => {
      if (this.role === 'sender') {
        this.sendCrossfader(value);
      }
    });

    // Main message router for the Receiver tab
    this.bc.onmessage = (event) => {
      if (this.role !== 'receiver') return;
      this._handleIncomingMessage(event.data);
    };
  }

  setRole(newRole) {
    this.role = newRole;
    if (import.meta.env.DEV) {
      console.log(`[SyncBridge] Role initialized as: ${newRole}`);
    }
  }

  /**
   * SENDER METHODS (Called by Controller)
   */
  sendParamUpdate(layerId, param, value) {
    if (this.role !== 'sender') return;
    this.bc.postMessage({ type: 'PARAM_UPDATE', layerId, param, value });
  }

  sendCrossfader(value) {
    if (this.role !== 'sender') return;
    this.bc.postMessage({ type: 'CROSSFADER', value });
  }

  sendAudioData(data) {
    if (this.role !== 'sender') return;
    this.bc.postMessage({ type: 'AUDIO_DATA', data });
  }

  sendAudioSettings(settings) {
    if (this.role !== 'sender') return;
    this.bc.postMessage({ type: 'AUDIO_SETTINGS', settings });
  }

  sendMappingConfig(config) {
    if (this.role !== 'sender') return;
    this.bc.postMessage({ type: 'MAPPING_CONFIG', config });
  }

  sendDeckConfig(side, config) {
    if (this.role !== 'sender') return;
    this.bc.postMessage({ type: 'DECK_CONFIG', side, config });
  }

  sendModValue(paramId, value) {
    if (this.role !== 'sender') return;
    this.bc.postMessage({ type: 'MOD_VALUE', paramId, value });
  }

  sendPatchAdd(source, target, amount) {
    if (this.role !== 'sender') return;
    this.bc.postMessage({ type: 'PATCH_ADD', source, target, amount });
  }

  sendPatchRemove(patchId) {
    if (this.role !== 'sender') return;
    this.bc.postMessage({ type: 'PATCH_REMOVE', patchId });
  }

  sendLfoConfig(lfoId, param, value) {
    if (this.role !== 'sender') return;
    this.bc.postMessage({ type: 'LFO_CONFIG', lfoId, param, value });
  }

  /**
   * RECEIVER LOGIC (Execution on Projector Tab)
   */
  _handleIncomingMessage(msg) {
    const { type } = msg;
    const engine = getPixiEngine();

    switch (type) {
      case 'PARAM_UPDATE':
        SignalBus.emit('param:update', {
          layerId: msg.layerId,
          param: msg.param,
          value: msg.value,
          isNormalized: false
        });
        break;

      case 'CROSSFADER':
        SignalBus.emit('crossfader:set', msg.value);
        useEngineStore.getState().setCrossfader(msg.value);
        useEngineStore.getState().setRenderedCrossfader(msg.value);
        break;

      case 'AUDIO_DATA':
        SignalBus.emit('audio:analysis', msg.data);
        break;

      case 'AUDIO_SETTINGS':
        useEngineStore.getState().setAudioSettings(msg.settings);
        break;

      case 'MAPPING_CONFIG':
        if (msg.config) {
          Object.entries(msg.config).forEach(([key, val]) => {
            useUIStore.getState().updateMappingConfig(key, val);
          });
        }
        break;

      case 'DECK_CONFIG':
        useEngineStore.getState().setDeckConfig(msg.side, msg.config);
        break;

      case 'MOD_VALUE':
        if (engine) engine.setModulationValue(msg.paramId, msg.value);
        useEngineStore.getState().setEffectBaseValue(msg.paramId, msg.value);
        break;

      case 'PATCH_ADD':
        if (engine) engine.addModulationPatch(msg.source, msg.target, msg.amount);
        useEngineStore.getState().addPatch(msg.source, msg.target, msg.amount);
        break;

      case 'PATCH_REMOVE':
        if (engine) engine.removeModulationPatch(msg.patchId);
        useEngineStore.getState().removePatch(msg.patchId);
        break;

      case 'LFO_CONFIG':
        if (engine) engine.lfo.setConfig(msg.lfoId, msg.param, msg.value);
        useEngineStore.getState().setLfoSetting(msg.lfoId, msg.param, msg.value);
        break;

      default:
        break;
    }
  }
}

export const syncBridge = new SyncBridge();