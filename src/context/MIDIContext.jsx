// src/context/MIDIContext.jsx
import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef, useMemo
} from 'react';
import PropTypes from 'prop-types';

import { usePresetManagement } from './PresetManagementContext';
import { sliderParams } from '../components/Panels/EnhancedControlPanel';

const MAX_MONITOR_ENTRIES = 100;
const PENDING_ACTION_EXPIRY_MS = 1000;
const MIDI_CONNECT_TIMEOUT_MS = 10000;
const CATCH_MODE_NORMALIZATION_EPSILON = 0.01;

const defaultContextValue = {
  midiAccess: null, isConnected: false, isConnecting: false, error: null, midiInputs: [],
  midiMap: {}, layerMappings: { "1": {}, "2": {}, "3": {} },
  midiLearning: null, learningLayer: null, selectedChannel: 0, midiMonitorData: [],
  showMidiMonitor: false, pendingLayerSelect: null, pendingParamUpdate: null,
  pendingGlobalAction: null,
  connectMIDI: async () => { if (import.meta.env.DEV) console.warn("connectMIDI called on default MIDIContext"); return null; },
  disconnectMIDI: () => { if (import.meta.env.DEV) console.warn("disconnectMIDI called on default MIDIContext"); },
  startMIDILearn: () => { if (import.meta.env.DEV) console.warn("startMIDILearn called on default MIDIContext"); },
  stopMIDILearn: () => { if (import.meta.env.DEV) console.warn("stopMIDILearn called on default MIDIContext"); },
  startLayerMIDILearn: () => { if (import.meta.env.DEV) console.warn("startLayerMIDILearn called on default MIDIContext"); },
  stopLayerMIDILearn: () => { if (import.meta.env.DEV) console.warn("stopLayerMIDILearn called on default MIDIContext"); },
  startGlobalMIDILearn: () => { if (import.meta.env.DEV) console.warn("startGlobalMIDILearn called on default MIDIContext"); },
  clearAllMappings: () => { if (import.meta.env.DEV) console.warn("clearAllMappings called on default MIDIContext"); },
  setChannelFilter: () => { if (import.meta.env.DEV) console.warn("setChannelFilter called on default MIDIContext"); },
  clearMIDIMonitor: () => { if (import.meta.env.DEV) console.warn("clearMIDIMonitor called on default MIDIContext"); },
  setShowMidiMonitor: () => { if (import.meta.env.DEV) console.warn("setShowMidiMonitor called on default MIDIContext"); },
  clearPendingActions: () => { if (import.meta.env.DEV) console.warn("clearPendingActions called on default MIDIContext"); },
  mapParameterToMIDI: () => { if (import.meta.env.DEV) console.warn("mapParameterToMIDI called on default MIDIContext"); },
};

const MIDIContext = createContext(defaultContextValue);

const normalizeMIDIValue = (value, type = 'cc') => {
  if (type === 'pitchbend') return Math.max(0, Math.min(1, value / 16383));
  return Math.max(0, Math.min(1, value / 127));
};

const getMidiMessageType = (status) => {
  const type = status & 0xF0;
  switch (type) {
    case 0x80: return 'Note Off'; case 0x90: return 'Note On'; case 0xA0: return 'Poly Aftertouch';
    case 0xB0: return 'Control Change'; case 0xC0: return 'Program Change'; case 0xD0: return 'Channel Aftertouch';
    case 0xE0: return 'Pitch Bend';
    case 0xF0:
      switch (status) {
        case 0xF0: return 'SysEx Start'; case 0xF1: return 'MIDI Time Code Qtr Frame'; case 0xF2: return 'Song Position Pointer';
        case 0xF3: return 'Song Select'; case 0xF6: return 'Tune Request'; case 0xF7: return 'SysEx End';
        case 0xF8: return 'Timing Clock'; case 0xFA: return 'Start'; case 0xFB: return 'Continue';
        case 0xFC: return 'Stop'; case 0xFE: return 'Active Sensing'; case 0xFF: return 'System Reset';
        default: return 'System Common';
      }
    default: return `Unknown (${type.toString(16)})`;
  }
};

export function MIDIProvider({ children }) {
  const { 
    activeMidiMap, 
    updateGlobalMidiMap,
    updateLayerMidiMappings,
    configLoadNonce, 
    loadedLayerConfigsFromPreset,
    isInitiallyResolved
  } = usePresetManagement();
  
  const [midiAccess, setMidiAccess] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [midiInputs, setMidiInputs] = useState([]);
  const [midiLearning, setMidiLearning] = useState(null);
  const [learningLayer, setLearningLayer] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(0);
  const [midiMonitorData, setMidiMonitorData] = useState([]);
  const [showMidiMonitor, setShowMidiMonitor] = useState(false);
  const [pendingLayerSelect, setPendingLayerSelect] = useState(null);
  const [pendingParamUpdate, setPendingParamUpdate] = useState(null);
  const [pendingGlobalAction, setPendingGlobalAction] = useState(null);
  const [catchModeTargetValues, setCatchModeTargetValues] = useState({});

  const catchModeTargetValuesRef = useRef(catchModeTargetValues);
  const activeControllerMidiMapRef = useRef(activeMidiMap);
  const midiLearningRef = useRef(midiLearning);
  const learningLayerRef = useRef(learningLayer);
  const selectedChannelRef = useRef(selectedChannel);
  const connectionInProgressRef = useRef(false);
  const pendingTimeoutRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const isUnmountingRef = useRef(false);
  const midiAccessRefForCallbacks = useRef(midiAccess);
  const handleMIDIMessageRef = useRef(null);
  const isConnectedRef = useRef(isConnected);

  const layerMappings = useMemo(() => activeMidiMap?.layerSelects || {}, [activeMidiMap]);
  const layerMappingsRef = useRef(layerMappings);

  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);
  useEffect(() => { activeControllerMidiMapRef.current = activeMidiMap; }, [activeMidiMap]);
  useEffect(() => { catchModeTargetValuesRef.current = catchModeTargetValues; }, [catchModeTargetValues]);
  useEffect(() => { midiAccessRefForCallbacks.current = midiAccess; }, [midiAccess]);
  useEffect(() => { layerMappingsRef.current = layerMappings; }, [layerMappings]);
  useEffect(() => { midiLearningRef.current = midiLearning; }, [midiLearning]);
  useEffect(() => { learningLayerRef.current = learningLayer; }, [learningLayer]);
  useEffect(() => { selectedChannelRef.current = selectedChannel; }, [selectedChannel]);

  useEffect(() => {
    if (configLoadNonce > 0 && loadedLayerConfigsFromPreset && activeControllerMidiMapRef.current) {
      const newCatchTargets = {};
      for (const layerIdStr in activeControllerMidiMapRef.current) {
        if (layerIdStr === 'global' || layerIdStr === 'layerSelects') continue;
        const layerParams = activeControllerMidiMapRef.current[layerIdStr];
        if (layerParams) {
          for (const paramName in layerParams) {
            const presetValue = loadedLayerConfigsFromPreset[layerIdStr]?.[paramName];
            if (typeof presetValue === 'number') {
              const catchKey = `${layerIdStr}_${paramName}`;
              newCatchTargets[catchKey] = { value: presetValue, caught: false, lastMidiValue: null };
            }
          }
        }
      }
      setCatchModeTargetValues(newCatchTargets);
    }
  }, [configLoadNonce, loadedLayerConfigsFromPreset]);

  useEffect(() => {
    const handleForceEndLoading = () => {
      if (connectionInProgressRef.current) {
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        setIsConnecting(false);
        connectionInProgressRef.current = false;
        setError("Connection attempt force-ended.");
      }
    };
    document.addEventListener('force-end-loading', handleForceEndLoading);
    return () => document.removeEventListener('force-end-loading', handleForceEndLoading);
  }, []);

  useEffect(() => {
    if (pendingLayerSelect || pendingParamUpdate || pendingGlobalAction) {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = setTimeout(() => {
        setPendingLayerSelect(null);
        setPendingParamUpdate(null);
        setPendingGlobalAction(null);
        pendingTimeoutRef.current = null;
      }, PENDING_ACTION_EXPIRY_MS);
    }
    return () => { if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current); };
  }, [pendingLayerSelect, pendingParamUpdate, pendingGlobalAction]);

  const mapParameterToMIDI = useCallback((param, layer, mappingData) => {
    const currentMap = activeMidiMap || {};
    const updatedActiveMap = {
      ...currentMap,
      [String(layer)]: {
        ...(currentMap[String(layer)] || {}),
        [param]: mappingData
      }
    };
    updateGlobalMidiMap(updatedActiveMap);
  }, [activeMidiMap, updateGlobalMidiMap]);

  const clearAllMappings = useCallback(() => {
    if (window.confirm("Are you sure you want to reset ALL persistent MIDI parameter mappings? This will be staged until you save.")) {
      updateGlobalMidiMap({});
    }
  }, [updateGlobalMidiMap]);

  const startMIDILearn = useCallback((param, layer) => {
    setMidiLearning({ type: 'param', param, layer });
    setLearningLayer(null);
  }, []);
  const startGlobalMIDILearn = useCallback((controlName) => {
    setMidiLearning({ type: 'global', control: controlName });
    setLearningLayer(null);
  }, []);
  const stopMIDILearn = useCallback(() => { if (midiLearningRef.current) setMidiLearning(null); }, []);
  const startLayerMIDILearn = useCallback((layer) => { setLearningLayer(layer); setMidiLearning(null); }, []);
  const stopLayerMIDILearn = useCallback(() => { if (learningLayerRef.current !== null) setLearningLayer(null); }, []);

  const handleMIDIMessage = useCallback((message) => {
    if (!message || !message.data || message.data.length === 0) return;
    const [status, data1, data2] = message.data;
    const msgChan = status & 0x0F;
    const msgType = getMidiMessageType(status);
    const timestamp = Date.now();

    setMidiMonitorData(prev => {
      const newEntry = { timestamp: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 }), status, data1, data2, channel: msgChan + 1, type: msgType };
      const updated = [...prev, newEntry];
      return updated.length > MAX_MONITOR_ENTRIES ? updated.slice(-MAX_MONITOR_ENTRIES) : updated;
    });
    
    if (selectedChannelRef.current > 0 && (msgChan + 1) !== selectedChannelRef.current) return;

    const isCC = msgType === 'Control Change';
    const isNoteOn = msgType === 'Note On' && data2 > 0;
    const isPitch = msgType === 'Pitch Bend';

    if (midiLearningRef.current) {
      if (isCC || isNoteOn || isPitch) {
        const mappingData = { type: isCC ? 'cc' : (isNoteOn ? 'note' : 'pitchbend'), number: data1, channel: msgChan };
        const currentLearningState = midiLearningRef.current;

        if (currentLearningState.type === 'param' && currentLearningState.param && currentLearningState.layer) {
          mapParameterToMIDI(currentLearningState.param, currentLearningState.layer, mappingData);
        } else if (currentLearningState.type === 'global' && currentLearningState.control) {
          const currentMap = activeControllerMidiMapRef.current || {};
          const updatedActiveMap = {
            ...currentMap,
            global: {
              ...(currentMap.global || {}),
              [currentLearningState.control]: mappingData
            }
          };
          updateGlobalMidiMap(updatedActiveMap);
        }
        
        stopMIDILearn();
      }
      return;
    }

    if (learningLayerRef.current !== null) {
      if (isNoteOn) {
        const mappingData = { type: 'note', number: data1, channel: msgChan };
        updateLayerMidiMappings(learningLayerRef.current, mappingData);
        stopLayerMIDILearn();
      }
      return;
    }

    if (!isCC && !isNoteOn && !isPitch) return;

    const currentControllerMap = activeControllerMidiMapRef.current || {};
    
    const globalControls = currentControllerMap.global;
    if (globalControls) {
        const pLockMapping = globalControls['pLockToggle'];
        if (pLockMapping) {
          let isMatch = (pLockMapping.type === 'note' && isNoteOn && pLockMapping.number === data1 && (pLockMapping.channel === undefined || pLockMapping.channel === msgChan)) ||
                        (pLockMapping.type === 'cc' && isCC && pLockMapping.number === data1 && (pLockMapping.channel === undefined || pLockMapping.channel === msgChan));
          
          if (isMatch) {
            setPendingGlobalAction({ action: 'pLockToggle', timestamp });
            return;
          }
        }
    }

    if (isNoteOn) {
        for (const layerId in layerMappingsRef.current) {
            const lsm = layerMappingsRef.current[layerId];
            if (lsm?.type === 'note' && lsm.number === data1 && (lsm.channel === undefined || lsm.channel === msgChan)) {
                setPendingLayerSelect({ layer: parseInt(layerId, 10), timestamp });
                return;
            }
        }
    }
    
    for (const layerIdStr in currentControllerMap) {
        if (layerIdStr === 'global' || layerIdStr === 'layerSelects') continue;

        const layerParams = currentControllerMap[layerIdStr];
        if (typeof layerParams !== 'object' || layerParams === null) continue;

        for (const paramName in layerParams) {
            const mappingData = layerParams[paramName];
            if (!mappingData) continue;

            let isMatch = false;
            let rawValue = data2;
            let midiMsgTypeForNormalization = 'cc';

            if (mappingData.type === 'cc' && isCC && Number(mappingData.number) === Number(data1) && (mappingData.channel === undefined || Number(mappingData.channel) === Number(msgChan))) {
                isMatch = true; rawValue = data2;
            } else if (mappingData.type === 'note' && isNoteOn && Number(mappingData.number) === Number(data1) && (mappingData.channel === undefined || Number(mappingData.channel) === Number(msgChan))) {
                isMatch = true; rawValue = data2;
            } else if (mappingData.type === 'pitchbend' && isPitch && (mappingData.channel === undefined || Number(mappingData.channel) === Number(msgChan))) {
                isMatch = true; rawValue = (data2 << 7) | data1; midiMsgTypeForNormalization = 'pitchbend';
            }

            if (isMatch) {
                const currentNormalizedMidiVal = normalizeMIDIValue(rawValue, midiMsgTypeForNormalization);
                const catchKey = `${layerIdStr}_${paramName}`;
                const paramCatchState = catchModeTargetValuesRef.current[catchKey];

                if (paramCatchState) {
                    let { value: presetValueActual, caught, lastMidiValue: lastNormalizedMidiVal } = paramCatchState;
                    if (!caught) {
                        const sliderConfig = sliderParams.find(p => p.prop === paramName);
                        if (sliderConfig) {
                            const { min: sliderMin, max: sliderMax } = sliderConfig;
                            let normalizedPresetValue = 0.5;
                            if (sliderMax > sliderMin) {
                                normalizedPresetValue = (presetValueActual - sliderMin) / (sliderMax - sliderMin);
                                normalizedPresetValue = Math.max(0, Math.min(1, normalizedPresetValue));
                            }

                            let hasCaught = false;
                            if (lastNormalizedMidiVal !== null) {
                                hasCaught = (lastNormalizedMidiVal <= normalizedPresetValue && currentNormalizedMidiVal >= normalizedPresetValue) || (lastNormalizedMidiVal >= normalizedPresetValue && currentNormalizedMidiVal <= normalizedPresetValue);
                            } else if (Math.abs(currentNormalizedMidiVal - normalizedPresetValue) < CATCH_MODE_NORMALIZATION_EPSILON) {
                                hasCaught = true;
                            }

                            if (hasCaught) {
                                setCatchModeTargetValues(prev => ({ ...prev, [catchKey]: { ...paramCatchState, caught: true, lastMidiValue: currentNormalizedMidiVal } }));
                                setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
                            } else {
                                setCatchModeTargetValues(prev => ({ ...prev, [catchKey]: { ...paramCatchState, lastMidiValue: currentNormalizedMidiVal } }));
                            }
                        } else {
                            setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
                        }
                    } else {
                        setCatchModeTargetValues(prev => ({ ...prev, [catchKey]: { ...paramCatchState, lastMidiValue: currentNormalizedMidiVal } }));
                        setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
                    }
                } else {
                    setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
                }
                return;
            }
        }
    }
  }, [mapParameterToMIDI, stopMIDILearn, updateGlobalMidiMap, stopLayerMIDILearn, updateLayerMidiMappings]);

  useEffect(() => { handleMIDIMessageRef.current = handleMIDIMessage; }, [handleMIDIMessage]);
  
  const processMidiInputs = useCallback((midiAccessObject) => {
    if (!midiAccessObject) return;
    const currentInputs = [];
    let anyDevicePhysicallyConnected = false;
    
    const messageHandlerWrapper = (message) => { 
      if (handleMIDIMessageRef.current) handleMIDIMessageRef.current(message); 
    };

    midiAccessObject.inputs.forEach(input => {
      currentInputs.push({ id: input.id, name: input.name || `Input ${input.id}`, manufacturer: input.manufacturer || 'Unknown', state: input.state });
      
      if (input.state === 'connected') {
        anyDevicePhysicallyConnected = true;
        if (isInitiallyResolved) {
            try {
                if (input.onmidimessage !== messageHandlerWrapper) {
                    input.onmidimessage = messageHandlerWrapper;
                }
            } catch (e) {
                if (import.meta.env.DEV) console.error(`[MIDI] FAILED to attach listener for device: ${input.name}. Error:`, e);
            }
        } else {
            if (input.onmidimessage) {
                input.onmidimessage = null;
            }
        }
      } else {
        if (input.onmidimessage) {
          input.onmidimessage = null;
        }
      }
    });

    setMidiInputs(currentInputs);
    
    if (!anyDevicePhysicallyConnected) {
      setError("No MIDI devices found or connected.");
      setIsConnected(false);
    } else {
      setError(null);
      setIsConnected(true);
    }
  }, [isInitiallyResolved]);

  useEffect(() => {
    if (isInitiallyResolved && midiAccess) {
      processMidiInputs(midiAccess);
    }
  }, [isInitiallyResolved, midiAccess, processMidiInputs]);

  const handleStateChange = useCallback((event) => {
    const currentMidiAccess = midiAccessRefForCallbacks.current;
    if (!currentMidiAccess) return;
    processMidiInputs(currentMidiAccess);
  }, [processMidiInputs]);

  const connectMIDI = useCallback(async () => {
    if (connectionInProgressRef.current || isConnectedRef.current) return midiAccessRefForCallbacks.current;
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setError("Web MIDI API not supported");
      return null;
    }
    connectionInProgressRef.current = true;
    setIsConnecting(true);
    setError(null);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = setTimeout(() => {
      if (connectionInProgressRef.current) {
        setError("MIDI connection timed out.");
        setIsConnecting(false);
        connectionInProgressRef.current = false;
      }
    }, MIDI_CONNECT_TIMEOUT_MS);

    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      if (isUnmountingRef.current) return null;

      setMidiAccess(access);
      access.onstatechange = handleStateChange;
      
      processMidiInputs(access);
      
      return access;
    } catch (err) {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      const errorMessage = err.message || err.name || 'Unknown MIDI access error';
      setError(`MIDI access failed: ${errorMessage}`);
      setMidiAccess(null);
      setIsConnected(false);
      return null;
    } finally {
      if (connectionInProgressRef.current) {
        setIsConnecting(false);
        connectionInProgressRef.current = false;
      }
    }
  }, [handleStateChange, processMidiInputs]);
  
  const disconnectMIDI = useCallback((forceFullDisconnect = false) => {
    const isDevelopment = import.meta.env.DEV;
    const isFinalUnmount = isUnmountingRef.current && forceFullDisconnect;
    const currentMidiAccess = midiAccessRefForCallbacks.current;
    if (currentMidiAccess) {
      if (currentMidiAccess.onstatechange) currentMidiAccess.onstatechange = null;
      currentMidiAccess.inputs.forEach(input => {
        if (input.onmidimessage) input.onmidimessage = null;
      });
    }
    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
    if (pendingTimeoutRef.current) { clearTimeout(pendingTimeoutRef.current); pendingTimeoutRef.current = null; }
    connectionInProgressRef.current = false;
    if (forceFullDisconnect || isFinalUnmount || !isDevelopment) {
      setMidiAccess(null);
      setIsConnected(false);
      setIsConnecting(false);
      setMidiInputs([]);
      setError(null);
    } else {
      setIsConnecting(false);
    }
  }, []);

  const setChannelFilter = useCallback((channel) => {
    const ch = parseInt(String(channel), 10);
    if (!isNaN(ch) && ch >= 0 && ch <= 16) {
      setSelectedChannel(ch);
    }
  }, []);
  const clearMIDIMonitor = useCallback(() => { setMidiMonitorData([]); }, []);
  const clearPendingActions = useCallback(() => {
    setPendingLayerSelect(null);
    setPendingParamUpdate(null);
    setPendingGlobalAction(null);
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    isUnmountingRef.current = false;
    return () => {
      isUnmountingRef.current = true;
      disconnectMIDI(true);
    };
  }, [disconnectMIDI]);

  const contextValue = useMemo(() => ({
    midiAccess, isConnected, isConnecting, error, midiInputs,
    midiMap: activeMidiMap,
    layerMappings, midiLearning, learningLayer, selectedChannel,
    midiMonitorData, showMidiMonitor, pendingLayerSelect, pendingParamUpdate,
    pendingGlobalAction, 
    setShowMidiMonitor,
    connectMIDI, disconnectMIDI, startMIDILearn, stopMIDILearn,
    startLayerMIDILearn, stopLayerMIDILearn, clearAllMappings, setChannelFilter,
    clearMIDIMonitor, mapParameterToMIDI, clearPendingActions,
    startGlobalMIDILearn,
  }), [
    midiAccess, isConnected, isConnecting, error, midiInputs, 
    activeMidiMap,
    layerMappings, midiLearning, learningLayer, selectedChannel,
    midiMonitorData, showMidiMonitor, pendingLayerSelect, pendingParamUpdate,
    pendingGlobalAction, 
    connectMIDI, disconnectMIDI, clearAllMappings, mapParameterToMIDI,
    setChannelFilter, clearMIDIMonitor, setShowMidiMonitor, clearPendingActions, stopMIDILearn,
    startMIDILearn, startLayerMIDILearn, stopLayerMIDILearn,
    startGlobalMIDILearn,
  ]);

  return (
    <MIDIContext.Provider value={contextValue}>
      {children}
    </MIDIContext.Provider>
  );
}

MIDIProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useMIDI() {
  const context = useContext(MIDIContext);
  if (context === undefined) {
    throw new Error('useMIDI must be used within a MIDIProvider component.');
  }
  return context;
}