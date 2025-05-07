// src/context/MIDIContext.jsx
import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef, useMemo
} from 'react';
import PropTypes from 'prop-types';
import { useConfig } from './ConfigContext';
import { useUpProvider } from './UpProvider';
import { RADAR_MIDI_MAP_KEY } from '../config/global-config';
import { hexToString } from 'viem';

// Constants & Config
const MAX_MONITOR_ENTRIES = 100;
const PENDING_ACTION_EXPIRY_MS = 1000;
const MIDI_CONNECT_TIMEOUT_MS = 10000;

// Helper Functions
const normalizeMIDIValue = (value, type = 'cc') => {
if (type === 'pitchbend') {
  return Math.max(0, Math.min(1, value / 16383));
}
return Math.max(0, Math.min(1, value / 127));
};
const getMidiMessageType = (status) => {
  const type = status & 0xF0;
  switch (type) {
    case 0x80: return 'Note Off'; case 0x90: return 'Note On';
    case 0xA0: return 'Poly Aftertouch'; case 0xB0: return 'Control Change';
    case 0xC0: return 'Program Change'; case 0xD0: return 'Channel Aftertouch';
    case 0xE0: return 'Pitch Bend'; case 0xF0: /* System messages */
      switch (status) {
        case 0xF0: return 'SysEx Start'; case 0xF1: return 'MIDI Time Code Qtr Frame';
        case 0xF2: return 'Song Position Pointer'; case 0xF3: return 'Song Select';
        case 0xF6: return 'Tune Request'; case 0xF7: return 'SysEx End';
        case 0xF8: return 'Timing Clock'; case 0xFA: return 'Start';
        case 0xFB: return 'Continue'; case 0xFC: return 'Stop';
        case 0xFE: return 'Active Sensing'; case 0xFF: return 'System Reset';
        default: return 'System';
      }
    default: return `Unknown (${type})`;
  }
};

// Create MIDI Context
const defaultContextValue = {
  midiAccess: null, isConnected: false, isConnecting: false, error: null, midiInputs: [],
  midiMap: {}, layerMappings: { 1: {}, 2: {}, 3: {} }, globalMappings: {},
  midiLearning: null, learningLayer: null, selectedChannel: 0, midiMonitorData: [],
  showMidiMonitor: false, pendingLayerSelect: null, pendingParamUpdate: null,
  connectMIDI: () => Promise.resolve(null), disconnectMIDI: () => {}, startMIDILearn: () => {},
  stopMIDILearn: () => {}, startLayerMIDILearn: () => {}, stopLayerMIDILearn: () => {},
  clearAllMappings: () => {}, setChannelFilter: () => {}, clearMIDIMonitor: () => {},
  mapLayerToMIDI: () => {}, setShowMidiMonitor: () => {},
  clearPendingActions: () => {}, mapParameterToMIDI: () => {},
};
const MIDIContext = createContext(defaultContextValue);

export function MIDIProvider({ children }) {
const {
  updateMidiMap: configUpdateMidiMap,
  configServiceRef,
  configServiceInstanceReady, // Use the new, more accurate flag
} = useConfig();
const { accounts } = useUpProvider();
const controllerAddress = useMemo(() => accounts?.[0], [accounts]);

const [midiAccess, setMidiAccess] = useState(null);
const [isConnected, setIsConnected] = useState(false);
const [isConnecting, setIsConnecting] = useState(false);
const [error, setError] = useState(null);
const [midiInputs, setMidiInputs] = useState([]);
const [layerMappings, setLayerMappings] = useState({ 1: {}, 2: {}, 3: {} });
const [globalMappings, setGlobalMappings] = useState({});
const [midiLearning, setMidiLearning] = useState(null);
const [learningLayer, setLearningLayer] = useState(null);
const [selectedChannel, setSelectedChannel] = useState(0);
const [midiMonitorData, setMidiMonitorData] = useState([]);
const [showMidiMonitor, setShowMidiMonitor] = useState(false);
const [pendingLayerSelect, setPendingLayerSelect] = useState(null);
const [pendingParamUpdate, setPendingParamUpdate] = useState(null);

const [activeControllerMidiMap, setActiveControllerMidiMap] = useState({});
const activeControllerMidiMapRef = useRef(activeControllerMidiMap);

useEffect(() => {
    activeControllerMidiMapRef.current = activeControllerMidiMap;
}, [activeControllerMidiMap]);

const layerMappingsRef = useRef(layerMappings);
const globalMappingsRef = useRef(globalMappings);
const midiLearningRef = useRef(midiLearning);
const learningLayerRef = useRef(learningLayer);
const selectedChannelRef = useRef(selectedChannel);
const connectionInProgressRef = useRef(false);
const pendingTimeoutRef = useRef(null);
const connectTimeoutRef = useRef(null);
const isUnmountingRef = useRef(false);
const midiAccessRefForCallbacks = useRef(midiAccess);
const handleMIDIMessageRef = useRef(null);

useEffect(() => { midiAccessRefForCallbacks.current = midiAccess; }, [midiAccess]);
useEffect(() => { layerMappingsRef.current = layerMappings; }, [layerMappings]);
useEffect(() => { globalMappingsRef.current = globalMappings; }, [globalMappings]);
useEffect(() => { midiLearningRef.current = midiLearning; }, [midiLearning]);
useEffect(() => { learningLayerRef.current = learningLayer; }, [learningLayer]);
useEffect(() => { selectedChannelRef.current = selectedChannel; }, [selectedChannel]);

useEffect(() => {
  const handleForceEndLoading = () => {
    if (connectionInProgressRef.current) {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      setIsConnecting(false); connectionInProgressRef.current = false; setError("Connection attempt force-ended.");
    }
  };
  document.addEventListener('force-end-loading', handleForceEndLoading);
  return () => document.removeEventListener('force-end-loading', handleForceEndLoading);
}, []);

useEffect(() => {
    if (pendingLayerSelect || pendingParamUpdate) {
        if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = setTimeout(() => { setPendingLayerSelect(null); setPendingParamUpdate(null); pendingTimeoutRef.current = null; }, PENDING_ACTION_EXPIRY_MS);
    }
    return () => { if (pendingTimeoutRef.current) { clearTimeout(pendingTimeoutRef.current); } };
}, [pendingLayerSelect, pendingParamUpdate]);

useEffect(() => {
  const loadControllerMap = async () => {
      const logPrefix = `[MIDIContext LoadControllerMap Addr:${controllerAddress?.slice(0, 6) || 'N/A'}]`;
      if (controllerAddress && configServiceInstanceReady && configServiceRef.current) {
          console.log(`${logPrefix} Attempting to load controller MIDI map (Instance Ready: ${configServiceInstanceReady})...`);
          try {
              const hexData = await configServiceRef.current.loadDataFromKey(controllerAddress, RADAR_MIDI_MAP_KEY);
              if (hexData && hexData !== '0x') {
                  console.log(`${logPrefix} Received hexData: ${hexData.substring(0, 100)}...`);
                  const jsonString = hexToString(hexData);
                  console.log(`${logPrefix} Decoded JSON string: ${jsonString.substring(0, 100)}...`);
                  const parsedMap = JSON.parse(jsonString);
                  if (parsedMap && typeof parsedMap === 'object') {
                      setActiveControllerMidiMap(parsedMap);
                      console.log(`${logPrefix} Controller MIDI map loaded and parsed successfully:`, parsedMap);
                  } else {
                       setActiveControllerMidiMap({});
                       console.warn(`${logPrefix} Parsed MIDI map invalid structure. Parsed:`, parsedMap, ". Map reset.");
                  }
              } else {
                  setActiveControllerMidiMap({});
                  console.log(`${logPrefix} No MIDI map data found (hexData is null or '0x'). Controller map reset.`);
              }
          } catch (error) {
              console.error(`${logPrefix} Error loading or parsing controller MIDI map:`, error);
              setActiveControllerMidiMap({});
              console.log(`${logPrefix} Controller map reset due to error.`);
          }
      } else {
           setActiveControllerMidiMap({});
           if (!controllerAddress) console.log(`${logPrefix} Skipped: No controller address. Map reset.`);
           else if (!configServiceInstanceReady) console.log(`${logPrefix} Skipped: Config service INSTANCE not ready (Flag value: ${configServiceInstanceReady}). Map reset.`);
           else if (configServiceInstanceReady && !configServiceRef.current) console.log(`${logPrefix} Skipped: Config service INSTANCE ready but ref.current is null. Map reset.`);
           else console.log(`${logPrefix} Skipped: Unknown reason, conditions not met. Map reset.`);
      }
  };
  loadControllerMap();
}, [controllerAddress, configServiceInstanceReady, configServiceRef]);


const mapParameterToMIDI = useCallback((param, layer, mappingData) => {
    setActiveControllerMidiMap(prevControllerMap => {
        const baseMap = prevControllerMap || {};
        const updatedActiveMap = {
            ...baseMap,
            [String(layer)]: {
                ...(baseMap[String(layer)] || {}),
                [param]: mappingData
            }
        };
        if (typeof configUpdateMidiMap === 'function') {
            configUpdateMidiMap(updatedActiveMap);
        } else {
            console.error("[MIDIContext] mapParameterToMIDI: configUpdateMidiMap is not a function!");
        }
        return updatedActiveMap;
    });
}, [configUpdateMidiMap]);

const mapLayerToMIDI = useCallback((layer, mappingData) => {
  setLayerMappings(prev => ({ ...prev, [String(layer)]: { ...(prev[String(layer)] || {}), layerSelect: mappingData } }));
}, []);

const startMIDILearn = useCallback((param, layer) => { setMidiLearning({ param: param, layer: layer }); setLearningLayer(null); }, []);
const stopMIDILearn = useCallback(() => { if (midiLearningRef.current) setMidiLearning(null); }, []);
const startLayerMIDILearn = useCallback((layer) => { setLearningLayer(layer); setMidiLearning(null); }, []);
const stopLayerMIDILearn = useCallback(() => { if (learningLayerRef.current !== null) setLearningLayer(null); }, []);

const handleMIDIMessage = useCallback((message) => {
  if (!message || !message.data || message.data.length === 0) return;
  const [status, data1, data2] = message.data; const msgChan = status & 0x0F; const msgType = getMidiMessageType(status); const timestamp = Date.now();
  setMidiMonitorData(prev => { const newEntry = { timestamp: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 }), status, data1, data2, channel: msgChan + 1, type: msgType }; const updated = [...prev, newEntry]; return updated.length > MAX_MONITOR_ENTRIES ? updated.slice(-MAX_MONITOR_ENTRIES) : updated; });
  if (selectedChannelRef.current > 0 && (msgChan + 1) !== selectedChannelRef.current) return;
  const isCC = msgType === 'Control Change'; const isNoteOn = msgType === 'Note On' && data2 > 0; const isPitch = msgType === 'Pitch Bend';
  const currentLearningState = midiLearningRef.current;

  if (currentLearningState) {
      if (isCC || isNoteOn || isPitch) {
          const mappingData = { type: isCC ? 'cc' : (isNoteOn ? 'note' : 'pitchbend'), number: data1, channel: msgChan };
          mapParameterToMIDI(currentLearningState.param, currentLearningState.layer, mappingData);
          stopMIDILearn();
      }
      return;
  }
  if (learningLayerRef.current !== null) {
      if (isNoteOn) { const mappingData = { type: 'note', number: data1, channel: msgChan }; mapLayerToMIDI(learningLayerRef.current, mappingData); stopLayerMIDILearn(); }
      return;
  }

  let actionTaken = false;
  if (isNoteOn) {
     Object.entries(layerMappingsRef.current).forEach(([layerId, mapping]) => {
        const lsm = mapping.layerSelect;
        if (lsm?.type === 'note' && lsm.number === data1 && (lsm.channel === undefined || lsm.channel === msgChan)) {
            actionTaken = true; setPendingLayerSelect({ layer: parseInt(layerId, 10), timestamp });
        }
     });
  }

  if ((isCC || isPitch || isNoteOn) && !actionTaken) {
    const currentControllerMap = activeControllerMidiMapRef.current || {};
    Object.entries(currentControllerMap).forEach(([layerId, layerParams]) => {
      if (typeof layerParams !== 'object' || layerParams === null) return;
      Object.entries(layerParams).forEach(([paramName, mappingData]) => {
        if (!mappingData) return; let isMatch = false; let rawValue = data2; let midiMsgType = 'unknown';
        if (mappingData.type === 'cc' && isCC && mappingData.number === data1 && (mappingData.channel === undefined || mappingData.channel === msgChan)) { isMatch = true; rawValue = data2; midiMsgType = 'cc'; }
        else if (mappingData.type === 'note' && isNoteOn && mappingData.number === data1 && (mappingData.channel === undefined || mappingData.channel === msgChan)) { isMatch = true; rawValue = data2; midiMsgType = 'note'; }
        else if (mappingData.type === 'pitchbend' && isPitch && (mappingData.channel === undefined || mappingData.channel === msgChan)) { isMatch = true; rawValue = (data2 << 7) | data1; midiMsgType = 'pitchbend'; }
        if (isMatch) {
          actionTaken = true;
          const normalizedValue = normalizeMIDIValue(rawValue, midiMsgType);
          const updatePayload = { layer: parseInt(layerId, 10), param: paramName, value: normalizedValue, timestamp };
          setPendingParamUpdate(updatePayload);
        }
      });
    });
  }
}, [mapLayerToMIDI, mapParameterToMIDI, stopMIDILearn, stopLayerMIDILearn]);

useEffect(() => {
    handleMIDIMessageRef.current = handleMIDIMessage;
}, [handleMIDIMessage]);

const setupMIDIListeners = useCallback((access) => {
    if (!access) return;
    access.inputs.forEach(input => {
        const messageHandlerWrapper = (message) => {
            if (handleMIDIMessageRef.current) { handleMIDIMessageRef.current(message); }
        };
        if (input.onmidimessage) { input.onmidimessage = null; }
        input.onmidimessage = messageHandlerWrapper;
    });
 }, []);

const handleStateChange = useCallback((event) => {
   if (!event || !event.port || event.port.type !== "input") return;
   const currentMidiAccess = midiAccessRefForCallbacks.current;
   if (!currentMidiAccess) return;
   const currentInputs = []; let anyConnected = false;
   currentMidiAccess.inputs.forEach(input => {
     currentInputs.push({ id: input.id, name: input.name || `Input ${input.id}`, manufacturer: input.manufacturer || 'Unknown', state: input.state });
     if (input.state === 'connected') {
       anyConnected = true;
       const messageHandlerWrapper = (message) => {
            if (handleMIDIMessageRef.current) { handleMIDIMessageRef.current(message); }
        };
       if (!input.onmidimessage) { input.onmidimessage = messageHandlerWrapper; }
     } else {
         if (input.onmidimessage) { input.onmidimessage = null; }
     }
   });
   setMidiInputs(currentInputs);
   setIsConnected(wasConnected => {
        if (wasConnected !== anyConnected) {
            if (anyConnected) setError(null); else setError("All MIDI devices disconnected.");
            return anyConnected;
        }
        return wasConnected;
    });
}, []);

const connectMIDI = useCallback(async () => {
  if (connectionInProgressRef.current) return midiAccessRefForCallbacks.current;
  if (isConnected && midiAccessRefForCallbacks.current) return midiAccessRefForCallbacks.current;
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) { setError("Web MIDI API not supported"); return null; }
  connectionInProgressRef.current = true; setIsConnecting(true); setError(null);
  connectTimeoutRef.current = setTimeout(() => { if (isConnecting && connectionInProgressRef.current) { setError("MIDI connection timed out."); setIsConnecting(false); connectionInProgressRef.current = false; } }, MIDI_CONNECT_TIMEOUT_MS);
  let access = null;
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null;
    setMidiAccess(access);
    const inputs = []; let anyDeviceConnected = false;
    access.inputs.forEach(input => { inputs.push({ id: input.id, name: input.name || `Input ${input.id}`, manufacturer: input.manufacturer || 'Unknown', state: input.state }); if (input.state === 'connected') anyDeviceConnected = true; });
    setMidiInputs(inputs);
    setupMIDIListeners(access);
    access.onstatechange = handleStateChange;
    setIsConnected(anyDeviceConnected);
    setIsConnecting(false); connectionInProgressRef.current = false;
    return access;
  } catch (err) {
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null;
    setError(`MIDI access failed: ${err.message || err.name || 'Unknown'}`);
    setMidiAccess(null); setIsConnected(false); setIsConnecting(false); connectionInProgressRef.current = false;
    return null;
  }
}, [isConnected, setupMIDIListeners, handleStateChange, isConnecting]);

const disconnectMIDI = useCallback((forceFullDisconnect = false) => {
  const isDevelopment = import.meta.env.DEV;
  const isFinalUnmount = isUnmountingRef.current && forceFullDisconnect;
  const currentMidiAccess = midiAccessRefForCallbacks.current;
  if (currentMidiAccess) {
    if (currentMidiAccess.onstatechange) currentMidiAccess.onstatechange = null;
    currentMidiAccess.inputs.forEach(input => { if (input.onmidimessage) { input.onmidimessage = null; } });
  }
  if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null;
  if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current); pendingTimeoutRef.current = null;
  connectionInProgressRef.current = false;
  if (!isDevelopment || isFinalUnmount) {
      setMidiAccess(null); setIsConnected(false); setIsConnecting(false);
      setMidiInputs([]); setError(null);
  } else { setIsConnecting(false); }
}, []);

const clearAllMappings = useCallback(() => {
    if (window.confirm("Reset ALL persistent MIDI parameter mappings?")) {
        if(typeof configUpdateMidiMap === 'function') {
            configUpdateMidiMap({});
        }
        setActiveControllerMidiMap({});
        setLayerMappings({ 1: {}, 2: {}, 3: {} });
        setGlobalMappings({});
    }
}, [configUpdateMidiMap]);

const setChannelFilter = useCallback((channel) => { const ch = parseInt(channel, 10); if (!isNaN(ch) && ch >= 0 && ch <= 16) setSelectedChannel(ch); }, []);
const clearMIDIMonitor = useCallback(() => { setMidiMonitorData([]); }, []);
const clearPendingActions = useCallback(() => { setPendingLayerSelect(null); setPendingParamUpdate(null); if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current); }, []);

useEffect(() => {
  isUnmountingRef.current = false;
  return () => {
    isUnmountingRef.current = true;
    disconnectMIDI(true);
  };
}, [disconnectMIDI]);

const contextValue = useMemo(() => ({
  midiAccess, isConnected, isConnecting, error, midiInputs,
  midiMap: activeControllerMidiMap,
  layerMappings, globalMappings, midiLearning, learningLayer, selectedChannel,
  midiMonitorData, showMidiMonitor, pendingLayerSelect, pendingParamUpdate,
  setShowMidiMonitor, connectMIDI, disconnectMIDI, startMIDILearn, stopMIDILearn,
  startLayerMIDILearn, stopLayerMIDILearn, clearAllMappings, setChannelFilter,
  clearMIDIMonitor, mapParameterToMIDI, mapLayerToMIDI, clearPendingActions,
}), [
  midiAccess, isConnected, isConnecting, error, midiInputs, activeControllerMidiMap,
  layerMappings, globalMappings, midiLearning, learningLayer, selectedChannel,
  midiMonitorData, showMidiMonitor, pendingLayerSelect, pendingParamUpdate,
  connectMIDI, disconnectMIDI, clearAllMappings, mapParameterToMIDI, mapLayerToMIDI,
  setChannelFilter, clearMIDIMonitor, setShowMidiMonitor, clearPendingActions, stopMIDILearn,
  startMIDILearn, startLayerMIDILearn, stopLayerMIDILearn
]);

return (
  <MIDIContext.Provider value={contextValue}>
    {children}
  </MIDIContext.Provider>
);
}

MIDIProvider.propTypes = { children: PropTypes.node.isRequired };

export function useMIDI() {
  const context = useContext(MIDIContext);
  if (context === undefined || context === defaultContextValue) {
    throw new Error('useMIDI must be used within a MIDIProvider');
  }
  return context;
}