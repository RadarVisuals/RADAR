// src/context/MIDIContext.jsx
import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef, useMemo
} from 'react';
import PropTypes from 'prop-types';
import { useConfig } from './ConfigContext';
import { useUpProvider } from './UpProvider';
import { RADAR_MIDI_MAP_KEY } from '../config/global-config';
import { hexToString } from 'viem';
import { usePresetManagement } from './PresetManagementContext'; // For preset load signals
import { sliderParams } from '../components/Panels/EnhancedControlPanel'; // For parameter ranges

// Constants & Config
const MAX_MONITOR_ENTRIES = 100;
const PENDING_ACTION_EXPIRY_MS = 1000;
const MIDI_CONNECT_TIMEOUT_MS = 10000;
const CATCH_MODE_NORMALIZATION_EPSILON = 0.01; // Tolerance for considering MIDI value at preset target

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
    case 0xE0: return 'Pitch Bend'; case 0xF0: 
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

/**
 * @typedef {object} CatchModeParamState
 * @property {number} value - The target parameter value from the loaded preset.
 * @property {boolean} caught - True if the physical MIDI control has "caught up" to or passed this value.
 * @property {number | null} lastMidiValue - The last known normalized (0-1) MIDI value for this parameter, used for crossing detection.
 */

/**
 * @typedef {Object.<string, CatchModeParamState>} CatchModeTargetValues
 * An object where keys are strings in the format 'layerId_paramName' (e.g., '1_speed'),
 * and values are `CatchModeParamState` objects. This state manages the soft takeover
 * behavior for each MIDI-mapped parameter after a preset load.
 */

export function MIDIProvider({ children }) {
  const {
    updateMidiMap: configUpdateMidiMap,
    configServiceRef,
    configServiceInstanceReady,
  } = useConfig();
  const { accounts } = useUpProvider();
  const controllerAddress = useMemo(() => accounts?.[0], [accounts]);

  const { configLoadNonce, loadedLayerConfigsFromPreset } = usePresetManagement();

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
  
  /**
   * @type {[CatchModeTargetValues, React.Dispatch<React.SetStateAction<CatchModeTargetValues>>]}
   * State for MIDI Soft Takeover (Parameter Catch Mode).
   * Stores the target values from the last loaded preset and tracks whether
   * the physical MIDI control has "caught" that value.
   */
  const [catchModeTargetValues, setCatchModeTargetValues] = useState({});
  const catchModeTargetValuesRef = useRef(catchModeTargetValues);

  const activeControllerMidiMapRef = useRef(activeControllerMidiMap);

  useEffect(() => { activeControllerMidiMapRef.current = activeControllerMidiMap; }, [activeControllerMidiMap]);
  useEffect(() => { catchModeTargetValuesRef.current = catchModeTargetValues; }, [catchModeTargetValues]);

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

  /**
   * Effect to initialize or reset the MIDI Soft Takeover (Parameter Catch Mode) state.
   * This runs when a new preset is loaded (signaled by `configLoadNonce` changing)
   * and the `loadedLayerConfigsFromPreset` data is available.
   * For each parameter currently mapped in `activeControllerMidiMap`, it retrieves
   * the parameter's value from the newly loaded preset and stores it as the target
   * for catch mode, resetting its `caught` status to `false`.
   */
  useEffect(() => {
    // Check if a new preset has been loaded (configLoadNonce > 0 indicates initial load or subsequent loads)
    // and if the preset data and the active MIDI map are available.
    if (configLoadNonce > 0 && loadedLayerConfigsFromPreset && activeControllerMidiMapRef.current) {
      if (import.meta.env.DEV) {
        console.log(`[MIDIContext] Preset loaded (nonce: ${configLoadNonce}). Initializing catch mode targets.`);
      }
      const newCatchTargets = {};
      // Iterate through layers defined in the active MIDI map.
      for (const layerIdStr in activeControllerMidiMapRef.current) {
        const layerParams = activeControllerMidiMapRef.current[layerIdStr];
        if (layerParams) {
          // Iterate through parameters mapped for this layer.
          for (const paramName in layerParams) {
            // Get the parameter's value from the newly loaded preset.
            const presetValue = loadedLayerConfigsFromPreset[layerIdStr]?.[paramName];
            // Only set up catch mode if the preset actually defines a value for this parameter.
            if (typeof presetValue === 'number') {
              const catchKey = `${layerIdStr}_${paramName}`;
              newCatchTargets[catchKey] = {
                value: presetValue, // Store the actual parameter value from the preset.
                caught: false,      // Reset 'caught' status; MIDI control needs to "catch up".
                lastMidiValue: null,// Reset last known MIDI value (normalized 0-1).
              };
            } else {
              if (import.meta.env.DEV && activeControllerMidiMapRef.current[layerIdStr]?.[paramName]) {
                // console.warn(`[MIDIContext Catch Init] No preset value for mapped L${layerIdStr}-${paramName}. It won't enter catch mode.`);
              }
            }
          }
        }
      }
      // Update the state that holds all catch mode targets.
      setCatchModeTargetValues(newCatchTargets);
    }
  }, [configLoadNonce, loadedLayerConfigsFromPreset]); // Re-run when a new preset is loaded.

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
        if (import.meta.env.DEV) console.log(`${logPrefix} Attempting to load controller MIDI map (Instance Ready: ${configServiceInstanceReady})...`);
        try {
          const hexData = await configServiceRef.current.loadDataFromKey(controllerAddress, RADAR_MIDI_MAP_KEY);
          if (hexData && hexData !== '0x') {
            if (import.meta.env.DEV) console.log(`${logPrefix} Received hexData: ${hexData.substring(0, 100)}...`);
            const jsonString = hexToString(hexData);
            if (import.meta.env.DEV) console.log(`${logPrefix} Decoded JSON string: ${jsonString.substring(0, 100)}...`);
            const parsedMap = JSON.parse(jsonString);
            if (parsedMap && typeof parsedMap === 'object') {
              setActiveControllerMidiMap(parsedMap);
              if (import.meta.env.DEV) console.log(`${logPrefix} Controller MIDI map loaded and parsed successfully:`, parsedMap);
            } else {
              setActiveControllerMidiMap({});
              if (import.meta.env.DEV) console.warn(`${logPrefix} Parsed MIDI map invalid structure. Parsed:`, parsedMap, ". Map reset.");
            }
          } else {
            setActiveControllerMidiMap({});
            if (import.meta.env.DEV) console.log(`${logPrefix} No MIDI map data found (hexData is null or '0x'). Controller map reset.`);
          }
        } catch (error) {
          if (import.meta.env.DEV) console.error(`${logPrefix} Error loading or parsing controller MIDI map:`, error);
          setActiveControllerMidiMap({});
          if (import.meta.env.DEV) console.log(`${logPrefix} Controller map reset due to error.`);
        }
      } else {
        setActiveControllerMidiMap({});
        if (import.meta.env.DEV) {
          if (!controllerAddress) console.log(`${logPrefix} Skipped: No controller address. Map reset.`);
          else if (!configServiceInstanceReady) console.log(`${logPrefix} Skipped: Config service INSTANCE not ready (Flag value: ${configServiceInstanceReady}). Map reset.`);
          else if (configServiceInstanceReady && !configServiceRef.current) console.log(`${logPrefix} Skipped: Config service INSTANCE ready but ref.current is null. Map reset.`);
          else console.log(`${logPrefix} Skipped: Unknown reason, conditions not met. Map reset.`);
        }
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
        if (import.meta.env.DEV) console.error("[MIDIContext] mapParameterToMIDI: configUpdateMidiMap is not a function!");
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

  /**
   * Handles incoming MIDI messages.
   * Implements MIDI Learn for parameters and layers.
   * Implements MIDI Soft Takeover (Parameter Catch Mode) for mapped parameters:
   * - If a parameter is in "catch mode" (i.e., `paramCatchState.caught` is false),
   *   it normalizes the incoming MIDI value and the parameter's preset target value.
   * - It then checks if the incoming MIDI value has "crossed" the preset target value
   *   since the last MIDI message for that parameter.
   * - If crossed, the parameter is "caught" (`paramCatchState.caught` becomes true),
   *   and the MIDI value is processed to update the visual parameter.
   * - If not caught, the MIDI value is ignored for visual updates, but `lastMidiValue` is updated.
   * - Once caught, subsequent MIDI messages for that parameter directly update visuals.
   * - Catch mode is reset for all parameters when a new preset is loaded.
   */
  const handleMIDIMessage = useCallback((message) => {
    if (!message || !message.data || message.data.length === 0) return;
    const [status, data1, data2] = message.data; const msgChan = status & 0x0F; const msgType = getMidiMessageType(status); const timestamp = Date.now();
    setMidiMonitorData(prev => { const newEntry = { timestamp: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 }), status, data1, data2, channel: msgChan + 1, type: msgType }; const updated = [...prev, newEntry]; return updated.length > MAX_MONITOR_ENTRIES ? updated.slice(-MAX_MONITOR_ENTRIES) : updated; });
    if (selectedChannelRef.current > 0 && (msgChan + 1) !== selectedChannelRef.current) return;
    const isCC = msgType === 'Control Change'; const isNoteOn = msgType === 'Note On' && data2 > 0; const isPitch = msgType === 'Pitch Bend';
    const currentLearningState = midiLearningRef.current;

    // Handle MIDI Learn mode for parameters
    if (currentLearningState) {
      if (isCC || isNoteOn || isPitch) {
        const mappingData = { type: isCC ? 'cc' : (isNoteOn ? 'note' : 'pitchbend'), number: data1, channel: msgChan };
        mapParameterToMIDI(currentLearningState.param, currentLearningState.layer, mappingData);
        stopMIDILearn();
      }
      return;
    }
    // Handle MIDI Learn mode for layer selection
    if (learningLayerRef.current !== null) {
      if (isNoteOn) { const mappingData = { type: 'note', number: data1, channel: msgChan }; mapLayerToMIDI(learningLayerRef.current, mappingData); stopLayerMIDILearn(); }
      return;
    }

    let actionTaken = false;
    let catchStateModified = false; // Flag to trigger setCatchModeTargetValues if any catch state changes

    // Handle layer selection via MIDI Note On
    if (isNoteOn) {
      Object.entries(layerMappingsRef.current).forEach(([layerId, mapping]) => {
        const lsm = mapping.layerSelect;
        if (lsm?.type === 'note' && lsm.number === data1 && (lsm.channel === undefined || lsm.channel === msgChan)) {
          actionTaken = true; setPendingLayerSelect({ layer: parseInt(layerId, 10), timestamp });
        }
      });
    }

    // Handle parameter control via MIDI CC, Note On (for velocity-sensitive params), or Pitch Bend
    if ((isCC || isPitch || isNoteOn) && !actionTaken) {
      const currentControllerMap = activeControllerMidiMapRef.current || {};
      Object.entries(currentControllerMap).forEach(([layerIdStr, layerParams]) => {
        if (typeof layerParams !== 'object' || layerParams === null) return;
        Object.entries(layerParams).forEach(([paramName, mappingData]) => {
          if (!mappingData) return; 
          let isMatch = false; 
          let rawValue = data2; // Default for CC and Note On
          let midiMsgTypeForNormalization = 'unknown';

          // Determine if the incoming MIDI message matches the mapped control
          if (mappingData.type === 'cc' && isCC && mappingData.number === data1 && (mappingData.channel === undefined || mappingData.channel === msgChan)) { 
            isMatch = true; rawValue = data2; midiMsgTypeForNormalization = 'cc'; 
          } else if (mappingData.type === 'note' && isNoteOn && mappingData.number === data1 && (mappingData.channel === undefined || mappingData.channel === msgChan)) { 
            isMatch = true; rawValue = data2; midiMsgTypeForNormalization = 'note'; 
          } else if (mappingData.type === 'pitchbend' && isPitch && (mappingData.channel === undefined || mappingData.channel === msgChan)) { 
            isMatch = true; rawValue = (data2 << 7) | data1; midiMsgTypeForNormalization = 'pitchbend'; 
          }
          
          if (isMatch) {
            actionTaken = true; // Mark that this MIDI message has been handled
            const currentNormalizedMidiVal = normalizeMIDIValue(rawValue, midiMsgTypeForNormalization);
            const catchKey = `${layerIdStr}_${paramName}`;
            const paramCatchState = catchModeTargetValuesRef.current[catchKey];

            if (paramCatchState) { // This parameter is under catch mode management
              let { value: presetValueActual, caught, lastMidiValue: lastNormalizedMidiVal } = paramCatchState;
              
              if (!caught) { // If the parameter hasn't been "caught" yet
                const sliderConfig = sliderParams.find(p => p.prop === paramName);
                if (sliderConfig) {
                  const { min: sliderMin, max: sliderMax } = sliderConfig;
                  // Normalize the preset's target value to the 0-1 range for comparison
                  let normalizedPresetValue = 0.5; // Default if range is zero or invalid
                  if (sliderMax > sliderMin) {
                    normalizedPresetValue = (presetValueActual - sliderMin) / (sliderMax - sliderMin);
                    normalizedPresetValue = Math.max(0, Math.min(1, normalizedPresetValue)); // Clamp to [0,1]
                  }

                  let hasCaught = false;
                  if (lastNormalizedMidiVal !== null) { // If we have a previous MIDI value to compare against
                    // Check if the MIDI control has crossed the preset's target value
                    const wentUpwards = lastNormalizedMidiVal <= normalizedPresetValue && currentNormalizedMidiVal >= normalizedPresetValue;
                    const wentDownwards = lastNormalizedMidiVal >= normalizedPresetValue && currentNormalizedMidiVal <= normalizedPresetValue;
                    hasCaught = wentUpwards || wentDownwards;
                  } else { // This is the first MIDI event for this parameter since the preset load
                    // If the first MIDI value is already very close to the target, consider it caught.
                    if (Math.abs(currentNormalizedMidiVal - normalizedPresetValue) < CATCH_MODE_NORMALIZATION_EPSILON) {
                      hasCaught = true;
                    }
                  }

                  if (hasCaught) {
                    if(import.meta.env.DEV) console.log(`[MIDI Catch] L${layerIdStr}-${paramName} CAUGHT! PresetValNorm: ${normalizedPresetValue.toFixed(3)}, LastMidiNorm: ${lastNormalizedMidiVal?.toFixed(3)}, CurrMidiNorm: ${currentNormalizedMidiVal.toFixed(3)}`);
                    // Update catch state: now caught, and store current MIDI value as last.
                    catchModeTargetValuesRef.current[catchKey] = { ...paramCatchState, caught: true, lastMidiValue: currentNormalizedMidiVal };
                    catchStateModified = true;
                    // Send the update to MainView to apply the visual change.
                    setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
                  } else { // Not caught yet
                     if(import.meta.env.DEV && lastNormalizedMidiVal !== null) console.log(`[MIDI Catch] L${layerIdStr}-${paramName} NOT caught. PresetValNorm: ${normalizedPresetValue.toFixed(3)}, LastMidiNorm: ${lastNormalizedMidiVal?.toFixed(3)}, CurrMidiNorm: ${currentNormalizedMidiVal.toFixed(3)}`);
                    // Update last MIDI value but don't send visual update yet.
                    catchModeTargetValuesRef.current[catchKey] = { ...paramCatchState, lastMidiValue: currentNormalizedMidiVal };
                    catchStateModified = true;
                  }
                } else { // No sliderConfig found for this parameter, cannot normalize preset value.
                         // Apply MIDI directly without catch mode for this specific parameter.
                  if(import.meta.env.DEV) console.warn(`[MIDI Catch] No sliderConfig for ${paramName}, applying MIDI directly.`);
                  setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
                }
              } else { // Already caught, normal operation: directly apply MIDI value.
                catchModeTargetValuesRef.current[catchKey] = { ...paramCatchState, lastMidiValue: currentNormalizedMidiVal };
                catchStateModified = true;
                setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
              }
            } else { // Parameter is not under catch mode management (e.g., not in current preset, or preset not loaded recently).
                     // Apply MIDI directly.
              setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
            }
          }
        });
      });
    }
    // If any catch state was modified, trigger a state update for catchModeTargetValues
    // to ensure React is aware of changes within the ref's object.
    if (catchStateModified) {
      setCatchModeTargetValues({ ...catchModeTargetValuesRef.current });
    }
  }, [mapLayerToMIDI, mapParameterToMIDI, stopMIDILearn, stopLayerMIDILearn, setCatchModeTargetValues]);


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
    const currentInputs = []; let anyConnected = false;
    currentMidiAccess.inputs.forEach(input => {
      currentInputs.push({ id: input.id, name: input.name || `Input ${input.id}`, manufacturer: input.manufacturer || 'Unknown', state: input.state });
      if (input.state === 'connected') {
        anyConnected = true;
        const messageHandlerWrapper = (message) => { if (handleMIDIMessageRef.current) { handleMIDIMessageRef.current(message); } };
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
      if (!anyDeviceConnected) { setError("No MIDI devices found or connected."); }
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

    if(import.meta.env.DEV) console.log(`[MIDIContext] disconnectMIDI called. Force: ${forceFullDisconnect}, isDev: ${isDevelopment}, isUnmounting: ${isUnmountingRef.current}`);

    if (currentMidiAccess) {
      if (currentMidiAccess.onstatechange) {
        currentMidiAccess.onstatechange = null;
        if(import.meta.env.DEV) console.log("[MIDIContext] Cleared onstatechange listener.");
      }
      currentMidiAccess.inputs.forEach(input => {
        if (input.onmidimessage) {
          input.onmidimessage = null;
          if(import.meta.env.DEV) console.log(`[MIDIContext] Cleared onmidimessage for input: ${input.id}`);
        }
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
      setShowMidiMonitor(false); 
      if(import.meta.env.DEV) console.log("[MIDIContext] Full MIDI Disconnect executed: States reset.");
    } else { 
      setIsConnecting(false);
      if(import.meta.env.DEV) console.log("[MIDIContext] Soft MIDI Disconnect (dev mode, no force). isConnecting set to false.");
    }
  }, []); 

  const clearAllMappings = useCallback(() => {
    if (window.confirm("Reset ALL persistent MIDI parameter mappings?")) {
      if(typeof configUpdateMidiMap === 'function') {
        configUpdateMidiMap({});
      }
      setActiveControllerMidiMap({});
      setLayerMappings({ 1: {}, 2: {}, 3: {} });
      setGlobalMappings({});
      setCatchModeTargetValues({}); 
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