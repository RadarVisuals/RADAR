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

    // High-frequency listener for crossfader movements (Auto-fades and Manual)
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

  /**
   * Sets the identity of this tab.
   * @param {'sender' | 'receiver'} newRole 
   */
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
        // Update both the Logic Engine and the current active deck
        SignalBus.emit('param:update', {
          layerId: msg.layerId,
          param: msg.param,
          value: msg.value,
          isNormalized: false
        });
        break;

      case 'CROSSFADER':
        // Frame-by-frame fader sync for smooth crossfades
        SignalBus.emit('crossfader:set', msg.value);
        useEngineStore.getState().setCrossfader(msg.value);
        useEngineStore.getState().setRenderedCrossfader(msg.value);
        break;

      case 'AUDIO_DATA':
        // Inject remote audio analysis into the local SignalBus
        SignalBus.emit('audio:analysis', msg.data);
        break;

      case 'MAPPING_CONFIG':
        // Update Video Mapping Iris Mask
        if (msg.config) {
          Object.entries(msg.config).forEach(([key, val]) => {
            useUIStore.getState().updateMappingConfig(key, val);
          });
        }
        break;

      case 'DECK_CONFIG':
        // Load Side A/B data when scenes are swapped/selected
        useEngineStore.getState().setDeckConfig(msg.side, msg.config);
        break;

      case 'MOD_VALUE':
        // Shader/FX Base value change
        if (engine) engine.setModulationValue(msg.paramId, msg.value);
        useEngineStore.getState().setEffectBaseValue(msg.paramId, msg.value);
        break;

      case 'PATCH_ADD':
        // Modulation Patch Wiring
        if (engine) engine.addModulationPatch(msg.source, msg.target, msg.amount);
        useEngineStore.getState().addPatch(msg.source, msg.target, msg.amount);
        break;

      case 'PATCH_REMOVE':
        // Modulation Patch Unwiring
        if (engine) engine.removeModulationPatch(msg.patchId);
        useEngineStore.getState().removePatch(msg.patchId);
        break;

      case 'LFO_CONFIG':
        // LFO Speed/Type updates
        if (engine) engine.lfo.setConfig(msg.lfoId, msg.param, msg.value);
        useEngineStore.getState().setLfoSetting(msg.lfoId, msg.param, msg.value);
        break;

      default:
        break;
    }
  }
}

export const syncBridge = new SyncBridge();