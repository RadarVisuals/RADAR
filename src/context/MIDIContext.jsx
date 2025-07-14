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

/**
 * @typedef {object} MIDIDevice
 * @property {string} id - The unique ID of the MIDI device.
 * @property {string} name - The name of the MIDI device.
 * @property {string} manufacturer - The manufacturer of the MIDI device.
 * @property {'connected'|'disconnected'} state - The connection state of the MIDI device.
 */
/**
 * @typedef {object} MIDIMappingData
 * @property {'cc'|'note'|'pitchbend'} type - The type of MIDI message.
 * @property {number} number - The MIDI note number or CC number.
 * @property {number} channel - The MIDI channel (0-15).
 */
/**
 * @typedef {Object.<string, MIDIMappingData>} LayerParamMappings
 * Key is parameter name (e.g., 'opacity', 'speed'), value is `MIDIMappingData`.
 */
/**
 * @typedef {Object.<string, LayerParamMappings>} ControllerMIDIMap
 * Key is layer ID string (e.g., '1', '2', '3'), value is `LayerParamMappings`.
 */
/**
 * @typedef {object} MIDIMonitorEntry
 * @property {string} timestamp - Formatted timestamp of the MIDI message.
 * @property {number} status - The MIDI status byte.
 * @property {number} data1 - The first MIDI data byte.
 * @property {number} data2 - The second MIDI data byte.
 * @property {number} channel - The MIDI channel (1-16).
 * @property {string} type - The human-readable type of the MIDI message.
 */
/**
 * @typedef {object} CatchModeParamState
 * @property {number} value - The target parameter value from the loaded preset (actual scale, not normalized).
 * @property {boolean} caught - True if the physical MIDI control has "caught up" to or passed this value.
 * @property {number | null} lastMidiValue - The last known normalized (0-1) MIDI value for this parameter, used for crossing detection.
 */
/**
 * @typedef {Object.<string, CatchModeParamState>} CatchModeTargetValues
 * An object where keys are strings in the format 'layerId_paramName' (e.g., '1_speed'),
 * and values are `CatchModeParamState` objects. This state manages the soft takeover
 * behavior for each MIDI-mapped parameter after a preset load.
 */
/**
 * @typedef {object} MIDIContextValue
 * @property {MIDIAccess | null} midiAccess - The raw MIDIAccess object from the Web MIDI API.
 * @property {boolean} isConnected - True if at least one MIDI input device is connected.
 * @property {boolean} isConnecting - True if a MIDI connection attempt is currently in progress.
 * @property {Error | string | null} error - Any error related to MIDI connection or setup.
 * @property {Array<MIDIDevice>} midiInputs - An array of available MIDI input devices.
 * @property {ControllerMIDIMap} midiMap - The active MIDI controller mappings loaded from the user's profile or being built.
 * @property {Object.<string, {layerSelect?: MIDIMappingData}>} layerMappings - Mappings for layer selection via MIDI. (Structure might need refinement based on usage)
 * @property {object} globalMappings - Mappings for global controls via MIDI. (Structure might need refinement)
 * @property {{param: string, layer: string|number} | null} midiLearning - Object indicating the parameter and layer currently in MIDI learn mode, or null.
 * @property {string|number|null} learningLayer - The layer ID currently in MIDI learn mode for layer selection, or null.
 * @property {number} selectedChannel - The currently selected MIDI channel filter (0 for Omni, 1-16 for specific channels).
 * @property {Array<MIDIMonitorEntry>} midiMonitorData - An array of recent MIDI messages for display in the monitor.
 * @property {boolean} showMidiMonitor - Whether the MIDI monitor UI should be visible.
 * @property {{layer: number, timestamp: number} | null} pendingLayerSelect - Information about a pending layer selection action triggered by MIDI.
 * @property {{layer: number, param: string, value: number, timestamp: number} | null} pendingParamUpdate - Information about a pending parameter update action triggered by MIDI.
 * @property {() => Promise<MIDIAccess | null>} connectMIDI - Function to initiate connection to MIDI devices.
 * @property {(forceFullDisconnect?: boolean) => void} disconnectMIDI - Function to disconnect from MIDI devices.
 * @property {(param: string, layer: string|number) => void} startMIDILearn - Function to start MIDI learn mode for a specific parameter and layer.
 * @property {() => void} stopMIDILearn - Function to stop MIDI learn mode for parameters.
 * @property {(layer: string|number) => void} startLayerMIDILearn - Function to start MIDI learn mode for layer selection.
 * @property {() => void} stopLayerMIDILearn - Function to stop MIDI learn mode for layer selection.
 * @property {() => void} clearAllMappings - Function to clear all stored MIDI mappings for the current controller.
 * @property {(channel: number) => void} setChannelFilter - Function to set the MIDI channel filter.
 * @property {() => void} clearMIDIMonitor - Function to clear the MIDI monitor data.
 * @property {(layer: string|number, mappingData: MIDIMappingData) => void} mapLayerToMIDI - Function to map a MIDI control to layer selection.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setShowMidiMonitor - Function to toggle the visibility of the MIDI monitor.
 * @property {() => void} clearPendingActions - Function to clear any pending layer selection or parameter update actions.
 * @property {(param: string, layer: string|number, mappingData: MIDIMappingData) => void} mapParameterToMIDI - Function to map a MIDI control to a specific parameter on a layer.
 */

const defaultContextValue = {
  midiAccess: null, isConnected: false, isConnecting: false, error: null, midiInputs: [],
  midiMap: {}, layerMappings: { "1": {}, "2": {}, "3": {} }, globalMappings: {},
  midiLearning: null, learningLayer: null, selectedChannel: 0, midiMonitorData: [],
  showMidiMonitor: false, pendingLayerSelect: null, pendingParamUpdate: null,
  connectMIDI: async () => { if (import.meta.env.DEV) console.warn("connectMIDI called on default MIDIContext"); return null; },
  disconnectMIDI: () => { if (import.meta.env.DEV) console.warn("disconnectMIDI called on default MIDIContext"); },
  startMIDILearn: () => { if (import.meta.env.DEV) console.warn("startMIDILearn called on default MIDIContext"); },
  stopMIDILearn: () => { if (import.meta.env.DEV) console.warn("stopMIDILearn called on default MIDIContext"); },
  startLayerMIDILearn: () => { if (import.meta.env.DEV) console.warn("startLayerMIDILearn called on default MIDIContext"); },
  stopLayerMIDILearn: () => { if (import.meta.env.DEV) console.warn("stopLayerMIDILearn called on default MIDIContext"); },
  clearAllMappings: () => { if (import.meta.env.DEV) console.warn("clearAllMappings called on default MIDIContext"); },
  setChannelFilter: () => { if (import.meta.env.DEV) console.warn("setChannelFilter called on default MIDIContext"); },
  clearMIDIMonitor: () => { if (import.meta.env.DEV) console.warn("clearMIDIMonitor called on default MIDIContext"); },
  mapLayerToMIDI: () => { if (import.meta.env.DEV) console.warn("mapLayerToMIDI called on default MIDIContext"); },
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
  // --- MODIFICATION: Get MIDI state and updaters from PresetManagementContext ---
  const { 
    activeMidiMap, 
    updateGlobalMidiMap, 
    configLoadNonce, 
    loadedLayerConfigsFromPreset 
  } = usePresetManagement();
  // --- END MODIFICATION ---
  
  const [midiAccess, setMidiAccess] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [midiInputs, setMidiInputs] = useState([]);
  const [layerMappings, setLayerMappings] = useState({ "1": {}, "2": {}, "3": {} });
  const [globalMappings, setGlobalMappings] = useState({});
  const [midiLearning, setMidiLearning] = useState(null);
  const [learningLayer, setLearningLayer] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(0);
  const [midiMonitorData, setMidiMonitorData] = useState([]);
  const [showMidiMonitor, setShowMidiMonitor] = useState(false);
  const [pendingLayerSelect, setPendingLayerSelect] = useState(null);
  const [pendingParamUpdate, setPendingParamUpdate] = useState(null);
  const [catchModeTargetValues, setCatchModeTargetValues] = useState({});

  const catchModeTargetValuesRef = useRef(catchModeTargetValues);
  // --- MODIFICATION: This ref now points to the map from the preset context ---
  const activeControllerMidiMapRef = useRef(activeMidiMap);
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

  // --- MODIFICATION: Update ref when activeMidiMap from context changes ---
  useEffect(() => { activeControllerMidiMapRef.current = activeMidiMap; }, [activeMidiMap]);
  useEffect(() => { catchModeTargetValuesRef.current = catchModeTargetValues; }, [catchModeTargetValues]);
  useEffect(() => { midiAccessRefForCallbacks.current = midiAccess; }, [midiAccess]);
  useEffect(() => { layerMappingsRef.current = layerMappings; }, [layerMappings]);
  useEffect(() => { globalMappingsRef.current = globalMappings; }, [globalMappings]);
  useEffect(() => { midiLearningRef.current = midiLearning; }, [midiLearning]);
  useEffect(() => { learningLayerRef.current = learningLayer; }, [learningLayer]);
  useEffect(() => { selectedChannelRef.current = selectedChannel; }, [selectedChannel]);

  useEffect(() => {
    if (configLoadNonce > 0 && loadedLayerConfigsFromPreset && activeControllerMidiMapRef.current) {
      const newCatchTargets = {};
      for (const layerIdStr in activeControllerMidiMapRef.current) {
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
    if (pendingLayerSelect || pendingParamUpdate) {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = setTimeout(() => {
        setPendingLayerSelect(null);
        setPendingParamUpdate(null);
        pendingTimeoutRef.current = null;
      }, PENDING_ACTION_EXPIRY_MS);
    }
    return () => { if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current); };
  }, [pendingLayerSelect, pendingParamUpdate]);

  // --- MODIFICATION: This now calls the centralized updater from PresetManagementContext ---
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
      updateGlobalMidiMap({}); // This now clears both staged and active maps
      setLayerMappings({ "1": {}, "2": {}, "3": {} });
      setGlobalMappings({});
      setCatchModeTargetValues({});
    }
  }, [updateGlobalMidiMap]);
  // --- END MODIFICATION ---

  const mapLayerToMIDI = useCallback((layer, mappingData) => {
    setLayerMappings(prev => ({ ...prev, [String(layer)]: { ...(prev[String(layer)] || {}), layerSelect: mappingData } }));
  }, []);

  const startMIDILearn = useCallback((param, layer) => { setMidiLearning({ param: param, layer: layer }); setLearningLayer(null); }, []);
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
      if (isNoteOn) {
        const mappingData = { type: 'note', number: data1, channel: msgChan };
        mapLayerToMIDI(learningLayerRef.current, mappingData);
        stopLayerMIDILearn();
      }
      return;
    }

    let actionTaken = false;
    let catchStateModified = false;

    if (isNoteOn) {
      Object.entries(layerMappingsRef.current).forEach(([layerId, mapping]) => {
        const lsm = mapping.layerSelect;
        if (lsm?.type === 'note' && lsm.number === data1 && (lsm.channel === undefined || lsm.channel === msgChan)) {
          actionTaken = true;
          setPendingLayerSelect({ layer: parseInt(layerId, 10), timestamp });
        }
      });
    }

    if ((isCC || isPitch || isNoteOn) && !actionTaken) {
      const currentControllerMap = activeControllerMidiMapRef.current || {};
      Object.entries(currentControllerMap).forEach(([layerIdStr, layerParams]) => {
        if (typeof layerParams !== 'object' || layerParams === null) return;
        Object.entries(layerParams).forEach(([paramName, mappingData]) => {
          if (!mappingData) return;
          let isMatch = false;
          let rawValue = data2;
          let midiMsgTypeForNormalization = 'cc';

          if (mappingData.type === 'cc' && isCC && mappingData.number === data1 && (mappingData.channel === undefined || mappingData.channel === msgChan)) {
            isMatch = true; rawValue = data2; midiMsgTypeForNormalization = 'cc';
          } else if (mappingData.type === 'note' && isNoteOn && mappingData.number === data1 && (mappingData.channel === undefined || mappingData.channel === msgChan)) {
            isMatch = true; rawValue = data2; midiMsgTypeForNormalization = 'note';
          } else if (mappingData.type === 'pitchbend' && isPitch && (mappingData.channel === undefined || mappingData.channel === msgChan)) {
            isMatch = true; rawValue = (data2 << 7) | data1; midiMsgTypeForNormalization = 'pitchbend';
          }

          if (isMatch) {
            actionTaken = true;
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
                    const wentUpwards = lastNormalizedMidiVal <= normalizedPresetValue && currentNormalizedMidiVal >= normalizedPresetValue;
                    const wentDownwards = lastNormalizedMidiVal >= normalizedPresetValue && currentNormalizedMidiVal <= normalizedPresetValue;
                    hasCaught = wentUpwards || wentDownwards;
                  } else {
                    if (Math.abs(currentNormalizedMidiVal - normalizedPresetValue) < CATCH_MODE_NORMALIZATION_EPSILON) {
                      hasCaught = true;
                    }
                  }

                  if (hasCaught) {
                    if(import.meta.env.DEV) console.log(`[MIDI Catch] L${layerIdStr}-${paramName} CAUGHT!`);
                    catchModeTargetValuesRef.current[catchKey] = { ...paramCatchState, caught: true, lastMidiValue: currentNormalizedMidiVal };
                    catchStateModified = true;
                    setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
                  } else {
                    catchModeTargetValuesRef.current[catchKey] = { ...paramCatchState, lastMidiValue: currentNormalizedMidiVal };
                    catchStateModified = true;
                  }
                } else {
                  if(import.meta.env.DEV) console.warn(`[MIDI Catch] No sliderConfig for ${paramName}, applying MIDI directly.`);
                  setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
                }
              } else {
                catchModeTargetValuesRef.current[catchKey] = { ...paramCatchState, lastMidiValue: currentNormalizedMidiVal };
                catchStateModified = true;
                setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
              }
            } else {
              setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
            }
          }
        });
      });
    }
    if (catchStateModified) {
      setCatchModeTargetValues({ ...catchModeTargetValuesRef.current });
    }
  }, [mapLayerToMIDI, mapParameterToMIDI, stopMIDILearn, stopLayerMIDILearn]);

  useEffect(() => { handleMIDIMessageRef.current = handleMIDIMessage; }, [handleMIDIMessage]);

  const setupMIDIListeners = useCallback((access) => {
    if (!access) return;
    access.inputs.forEach(input => {
      const messageHandlerWrapper = (message) => { if (handleMIDIMessageRef.current) { handleMIDIMessageRef.current(message); } };
      if (input.onmidimessage) { input.onmidimessage = null; }
      input.onmidimessage = messageHandlerWrapper;
    });
  }, []);

  const handleStateChange = useCallback((event) => {
    if (!event || !event.port || event.port.type !== "input") return;
    const currentMidiAccess = midiAccessRefForCallbacks.current;
    if (!currentMidiAccess) return;

    const currentInputs = [];
    let anyConnected = false;
    currentMidiAccess.inputs.forEach(input => {
      currentInputs.push({ id: input.id, name: input.name || `Input ${input.id}`, manufacturer: input.manufacturer || 'Unknown', state: input.state });
      if (input.state === 'connected') {
        anyConnected = true;
        const messageHandlerWrapper = (message) => { if (handleMIDIMessageRef.current) { handleMIDIMessageRef.current(message); } };
        if (!input.onmidimessage) {
          input.onmidimessage = messageHandlerWrapper;
        }
      } else {
        if (input.onmidimessage) {
          input.onmidimessage = null;
        }
      }
    });
    setMidiInputs(currentInputs);
    setIsConnected(wasConnected => {
      if (wasConnected !== anyConnected) {
        if (anyConnected) setError(null);
        return anyConnected;
      }
      return wasConnected;
    });
  }, []);

  const connectMIDI = useCallback(async () => {
    if (connectionInProgressRef.current) return midiAccessRefForCallbacks.current;
    if (isConnected && midiAccessRefForCallbacks.current) return midiAccessRefForCallbacks.current;
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setError("Web MIDI API not supported");
      return null;
    }
    connectionInProgressRef.current = true;
    setIsConnecting(true);
    setError(null);

    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = setTimeout(() => {
      if (isConnecting && connectionInProgressRef.current) {
        setError("MIDI connection timed out.");
        setIsConnecting(false);
        connectionInProgressRef.current = false;
      }
    }, MIDI_CONNECT_TIMEOUT_MS);

    let access = null;
    try {
      access = await navigator.requestMIDIAccess({ sysex: false });
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;

      if (isUnmountingRef.current) {
          connectionInProgressRef.current = false; setIsConnecting(false);
          return null;
      }

      setMidiAccess(access);
      const inputs = [];
      let anyDeviceConnected = false;
      access.inputs.forEach(input => {
        inputs.push({ id: input.id, name: input.name || `Input ${input.id}`, manufacturer: input.manufacturer || 'Unknown', state: input.state });
        if (input.state === 'connected') anyDeviceConnected = true;
      });
      setMidiInputs(inputs);
      setupMIDIListeners(access);
      access.onstatechange = handleStateChange;

      setIsConnected(anyDeviceConnected);
      setIsConnecting(false);
      connectionInProgressRef.current = false;
      if (!anyDeviceConnected) {
        setError("No MIDI devices found or connected.");
      }
      return access;
    } catch (err) {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
      const errorMessage = err.message || err.name || 'Unknown MIDI access error';
      setError(`MIDI access failed: ${errorMessage}`);
      setMidiAccess(null);
      setIsConnected(false);
      setIsConnecting(false);
      connectionInProgressRef.current = false;
      return null;
    }
  }, [isConnected, setupMIDIListeners, handleStateChange, isConnecting]);

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
    // --- MODIFICATION: midiMap now comes directly from the activeMidiMap state ---
    midiMap: activeMidiMap,
    layerMappings, globalMappings, midiLearning, learningLayer, selectedChannel,
    midiMonitorData, showMidiMonitor, pendingLayerSelect, pendingParamUpdate,
    setShowMidiMonitor,
    connectMIDI, disconnectMIDI, startMIDILearn, stopMIDILearn,
    startLayerMIDILearn, stopLayerMIDILearn, clearAllMappings, setChannelFilter,
    clearMIDIMonitor, mapParameterToMIDI, mapLayerToMIDI, clearPendingActions,
  }), [
    midiAccess, isConnected, isConnecting, error, midiInputs, 
    // --- MODIFICATION: Add activeMidiMap to dependency array ---
    activeMidiMap,
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

MIDIProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useMIDI() {
  const context = useContext(MIDIContext);
  if (context === undefined) {
    const err = new Error('useMIDI must be used within a MIDIProvider component.');
    if (import.meta.env.DEV) {
        console.error("useMIDI context details: Attempted to use context but found undefined. This usually means MIDIProvider is missing as an ancestor of the component calling useMIDI.", err.stack);
    }
    throw err;
  }
  return context;
}