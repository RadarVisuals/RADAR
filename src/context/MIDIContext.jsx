import React, { createContext, useContext, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useProjectStore } from '../store/useProjectStore'; // Changed
import { useEngineStore } from '../store/useEngineStore';

const MIDI_CONNECT_TIMEOUT_MS = 10000;

const MIDIContext = createContext(null);

const normalizeMIDIValue = (value, type = 'cc') => {
  if (type === 'pitchbend') return Math.max(0, Math.min(1, value / 16383));
  return Math.max(0, Math.min(1, value / 127));
};

const getMidiMessageType = (status) => {
  const type = status & 0xF0;
  switch (type) {
    case 0x80: return 'Note Off';
    case 0x90: return 'Note On';
    case 0xB0: return 'Control Change';
    case 0xC0: return 'Program Change';
    case 0xD0: return 'Channel Aftertouch';
    case 0xE0: return 'Pitch Bend';
    case 0xF0: return 'System';
    default: return `Unknown (${type.toString(16)})`;
  }
};

export function MIDIProvider({ children }) {
  // --- REFACTOR: Use Store Selectors ---
  const stagedSetlist = useProjectStore(s => s.stagedSetlist);
  const updateGlobalMidiMap = useProjectStore(s => s.updateGlobalMidiMap);
  const updateLayerMidiMappings = (layerId, mapping) => {
     const currentMap = useProjectStore.getState().stagedSetlist.globalUserMidiMap || {};
     const newLayerSelects = { ...(currentMap.layerSelects || {}), [layerId]: mapping };
     updateGlobalMidiMap({ ...currentMap, layerSelects: newLayerSelects });
  };
  // --- END REFACTOR ---
  
  const activeMidiMap = useMemo(() => stagedSetlist?.globalUserMidiMap || {}, [stagedSetlist]);
  const layerMappings = useMemo(() => activeMidiMap?.layerSelects || {}, [activeMidiMap]);

  // Refs for event listener callback
  const stateRefs = useRef({
      activeMidiMap,
      layerMappings
  });

  useEffect(() => {
      stateRefs.current = { activeMidiMap, layerMappings };
  }, [activeMidiMap, layerMappings]);

  const connectionInProgressRef = useRef(false);
  const connectTimeoutRef = useRef(null);
  const midiAccessRef = useRef(null);

  const handleMIDIMessage = useCallback((message) => {
    if (!message || !message.data) return;
    const [status, data1, data2] = message.data;
    const msgChan = status & 0x0F;
    const msgType = getMidiMessageType(status);
    
    // Direct Store Writes
    const store = useEngineStore.getState();
    const { 
        midiLearning, learningLayer, selectedChannel, 
        addMidiMonitorData, setMidiLearning, setLearningLayer, 
        queueMidiAction 
    } = store;

    addMidiMonitorData({ 
        timestamp: new Date().toLocaleTimeString(), 
        status, data1, data2, channel: msgChan + 1, type: msgType 
    });

    if (selectedChannel > 0 && (msgChan + 1) !== selectedChannel) return;

    const { activeMidiMap, layerMappings } = stateRefs.current;
    
    const isCC = (status & 0xF0) === 0xB0;
    const isNoteOn = (status & 0xF0) === 0x90 && data2 > 0;
    const isPitch = (status & 0xF0) === 0xE0;

    // Learning Mode
    if (midiLearning) {
      if (isCC || isNoteOn || isPitch) {
        const mappingData = { type: isCC ? 'cc' : (isNoteOn ? 'note' : 'pitchbend'), number: data1, channel: msgChan };
        
        if (midiLearning.type === 'param') {
            const currentMap = activeMidiMap || {};
            const updated = { 
                ...currentMap, 
                [String(midiLearning.layer)]: { 
                    ...(currentMap[String(midiLearning.layer)] || {}), 
                    [midiLearning.param]: mappingData 
                } 
            };
            updateGlobalMidiMap(updated);
        } else if (midiLearning.type === 'global') {
            const currentMap = activeMidiMap || {};
            const updated = { 
                ...currentMap, 
                global: { 
                    ...(currentMap.global || {}), 
                    [midiLearning.control]: mappingData 
                } 
            };
            updateGlobalMidiMap(updated);
        }
        setMidiLearning(null);
      }
      return;
    }

    if (learningLayer !== null) {
      if (isNoteOn) {
        updateLayerMidiMappings(learningLayer, { type: 'note', number: data1, channel: msgChan });
        setLearningLayer(null);
      }
      return;
    }

    // Execution Mode
    if (activeMidiMap.global) {
        const cfMap = activeMidiMap.global['crossfader'];
        if (cfMap) {
            let isMatch = false;
            let rawValue = data2;
            let type = 'cc';

            if (cfMap.type === 'cc' && isCC && cfMap.number === data1 && (cfMap.channel === undefined || cfMap.channel === msgChan)) {
                isMatch = true;
            } else if (cfMap.type === 'pitchbend' && isPitch && (cfMap.channel === undefined || cfMap.channel === msgChan)) {
                isMatch = true;
                rawValue = (data2 << 7) | data1;
                type = 'pitchbend';
            }

            if (isMatch) {
                const val = normalizeMIDIValue(rawValue, type);
                store.setCrossfader(val);
                return;
            }
        }

        const actions = [
            { key: 'nextScene', type: 'nextScene' },
            { key: 'prevScene', type: 'prevScene' },
            { key: 'nextWorkspace', type: 'nextWorkspace' },
            { key: 'prevWorkspace', type: 'prevWorkspace' },
            { key: 'pLockToggle', type: 'globalAction', action: 'pLockToggle' }
        ];

        for (const actionDef of actions) {
            const mapping = activeMidiMap.global[actionDef.key];
            if (mapping && 
               ((mapping.type === 'note' && isNoteOn) || (mapping.type === 'cc' && isCC)) && 
               mapping.number === data1 && 
               (mapping.channel === undefined || mapping.channel === msgChan)) {
                
                queueMidiAction(actionDef.action ? { type: actionDef.type, action: actionDef.action } : { type: actionDef.type });
                return;
            }
        }
    }

    if (isNoteOn) {
        for (const layerId in layerMappings) {
            const lsm = layerMappings[layerId];
            if (lsm && lsm.type === 'note' && lsm.number === data1 && (lsm.channel === undefined || lsm.channel === msgChan)) {
                queueMidiAction({ type: 'layerSelect', layer: parseInt(layerId, 10) });
                return;
            }
        }
    }

    for (const layerIdStr in activeMidiMap) {
        if (layerIdStr === 'global' || layerIdStr === 'layerSelects') continue;
        const layerParams = activeMidiMap[layerIdStr];
        
        for (const paramName in layerParams) {
            const mapping = layerParams[paramName];
            if (!mapping) continue;

            let isMatch = false;
            let rawValue = data2;
            let type = 'cc';

            if (mapping.type === 'cc' && isCC && mapping.number === data1 && (mapping.channel === undefined || mapping.channel === msgChan)) {
                isMatch = true;
            } else if (mapping.type === 'pitchbend' && isPitch && (mapping.channel === undefined || mapping.channel === msgChan)) {
                isMatch = true;
                rawValue = (data2 << 7) | data1;
                type = 'pitchbend';
            } else if (mapping.type === 'note' && isNoteOn && mapping.number === data1 && (mapping.channel === undefined || mapping.channel === msgChan)) {
                isMatch = true;
            }

            if (isMatch) {
                const normalized = normalizeMIDIValue(rawValue, type);
                queueMidiAction({ type: 'paramUpdate', layer: parseInt(layerIdStr, 10), param: paramName, value: normalized });
                return;
            }
        }
    }

  }, [updateGlobalMidiMap]); // updateLayerMidiMappings is defined inline inside

  const connectMIDI = useCallback(async () => {
      if (connectionInProgressRef.current) return;
      if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
          useEngineStore.getState().setMidiConnectionStatus(false, false, "Web MIDI API not supported");
          return;
      }
      
      connectionInProgressRef.current = true;
      useEngineStore.getState().setMidiConnectionStatus(false, true, null);

      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
          if (connectionInProgressRef.current) {
              useEngineStore.getState().setMidiConnectionStatus(false, false, "Connection timed out");
              connectionInProgressRef.current = false;
          }
      }, MIDI_CONNECT_TIMEOUT_MS);

      try {
          const access = await navigator.requestMIDIAccess({ sysex: false });
          if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
          
          midiAccessRef.current = access;
          useEngineStore.getState().setMidiAccess(access);
          
          const inputs = [];
          access.inputs.forEach(input => {
              inputs.push({ id: input.id, name: input.name, state: input.state });
              input.onmidimessage = handleMIDIMessage;
          });
          
          useEngineStore.getState().setMidiInputs(inputs);
          useEngineStore.getState().setMidiConnectionStatus(true, false, null);
          
          access.onstatechange = (e) => {
              const newInputs = [];
              e.target.inputs.forEach(i => {
                  newInputs.push({ id: i.id, name: i.name, state: i.state });
                  if (i.state === 'connected' && !i.onmidimessage) {
                      i.onmidimessage = handleMIDIMessage;
                  }
              });
              useEngineStore.getState().setMidiInputs(newInputs);
          };

      } catch (e) {
          if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
          useEngineStore.getState().setMidiConnectionStatus(false, false, e.message || "Failed to access MIDI");
      } finally {
          connectionInProgressRef.current = false;
      }
  }, [handleMIDIMessage]);

  const disconnectMIDI = useCallback((force = false) => {
      if (midiAccessRef.current) {
          midiAccessRef.current.inputs.forEach(input => input.onmidimessage = null);
          midiAccessRef.current.onstatechange = null;
      }
      useEngineStore.getState().setMidiAccess(null);
      useEngineStore.getState().setMidiConnectionStatus(false, false, null);
      connectionInProgressRef.current = false;
  }, []);

  useEffect(() => {
      return () => disconnectMIDI(true);
  }, [disconnectMIDI]);

  const contextValue = {
      connectMIDI,
      disconnectMIDI,
      midiMap: activeMidiMap,
      layerMappings,
      startMIDILearn: (param, layer) => useEngineStore.getState().setMidiLearning({ type: 'param', param, layer }),
      startGlobalMIDILearn: (control) => useEngineStore.getState().setMidiLearning({ type: 'global', control }),
      stopMIDILearn: () => useEngineStore.getState().setMidiLearning(null),
      startLayerMIDILearn: (layer) => useEngineStore.getState().setLearningLayer(layer),
      stopLayerMIDILearn: () => useEngineStore.getState().setLearningLayer(null),
      clearAllMappings: () => {
          if (window.confirm("Reset all MIDI mappings?")) {
              updateGlobalMidiMap({});
          }
      },
      midiStateRef: { current: { liveCrossfaderValue: 0 } }
  };

  return <MIDIContext.Provider value={contextValue}>{children}</MIDIContext.Provider>;
}

MIDIProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useMIDI = () => {
    const context = useContext(MIDIContext);
    if (!context) throw new Error("useMIDI must be used within a MIDIProvider");
    const store = useEngineStore();
    return { ...context, ...store };
};