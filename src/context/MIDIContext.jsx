// src/context/MIDIContext.jsx
import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef, useMemo
} from 'react';
import PropTypes from 'prop-types';

import { useConfig } from './ConfigContext'; // Local context
import { useUpProvider } from './UpProvider'; // Local context
import { usePresetManagement } from './PresetManagementContext'; // Local context

import { RADAR_MIDI_MAP_KEY } from '../config/global-config'; // Local config
import { sliderParams } from '../components/Panels/EnhancedControlPanel'; // Local component-specific config

import { hexToString } from 'viem'; // Third-party library

// Constants & Config
const MAX_MONITOR_ENTRIES = 100;
const PENDING_ACTION_EXPIRY_MS = 1000; // ms for pending layer/param selection to auto-clear
const MIDI_CONNECT_TIMEOUT_MS = 10000; // ms to wait for MIDI connection before timing out
const CATCH_MODE_NORMALIZATION_EPSILON = 0.01; // Tolerance for considering MIDI value "at" preset target for catch mode

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

/** @type {MIDIContextValue} */
const defaultContextValue = {
  midiAccess: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  midiInputs: [],
  midiMap: {}, // Represents activeControllerMidiMap
  layerMappings: { "1": {}, "2": {}, "3": {} },
  globalMappings: {},
  midiLearning: null,
  learningLayer: null,
  selectedChannel: 0,
  midiMonitorData: [],
  showMidiMonitor: false,
  pendingLayerSelect: null,
  pendingParamUpdate: null,
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

/**
 * Normalizes a raw MIDI value (0-127 for CC/Note, 0-16383 for Pitch Bend) to a 0-1 range.
 * @param {number} value - The raw MIDI value.
 * @param {'cc' | 'note' | 'pitchbend'} [type='cc'] - The type of MIDI message.
 * @returns {number} The normalized value (0-1).
 */
const normalizeMIDIValue = (value, type = 'cc') => {
  if (type === 'pitchbend') {
    return Math.max(0, Math.min(1, value / 16383)); // 14-bit range for pitch bend
  }
  return Math.max(0, Math.min(1, value / 127)); // 7-bit range for CC and Note Velocity
};

/**
 * Converts a MIDI status byte to a human-readable message type string.
 * @param {number} status - The MIDI status byte.
 * @returns {string} The human-readable MIDI message type.
 */
const getMidiMessageType = (status) => {
  const type = status & 0xF0; // Mask out channel bits
  switch (type) {
    case 0x80: return 'Note Off';
    case 0x90: return 'Note On';
    case 0xA0: return 'Poly Aftertouch';
    case 0xB0: return 'Control Change';
    case 0xC0: return 'Program Change';
    case 0xD0: return 'Channel Aftertouch';
    case 0xE0: return 'Pitch Bend';
    case 0xF0: // System Common Messages
      switch (status) { // Check full status byte for specific system messages
        case 0xF0: return 'SysEx Start';
        case 0xF1: return 'MIDI Time Code Qtr Frame';
        case 0xF2: return 'Song Position Pointer';
        case 0xF3: return 'Song Select';
        // 0xF4, 0xF5 are undefined
        case 0xF6: return 'Tune Request';
        case 0xF7: return 'SysEx End';
        // System Real-Time Messages
        case 0xF8: return 'Timing Clock';
        // 0xF9 is undefined
        case 0xFA: return 'Start';
        case 0xFB: return 'Continue';
        case 0xFC: return 'Stop';
        // 0xFD is undefined
        case 0xFE: return 'Active Sensing';
        case 0xFF: return 'System Reset';
        default: return 'System Common'; // For unlisted 0xFx messages
      }
    default: return `Unknown (${type.toString(16)})`;
  }
};


/**
 * Provides MIDI connectivity, mapping, learning, and monitoring capabilities to the application.
 * It manages access to MIDI devices, handles incoming messages, allows mapping MIDI controls
 * to application parameters, and supports a "soft takeover" or "parameter catch" mode
 * to prevent value jumps when presets are loaded.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to be rendered within this provider.
 * @returns {JSX.Element} The MIDIProvider component.
 */
export function MIDIProvider({ children }) {
  const {
    updateMidiMap: configUpdateMidiMap, // This is from ConfigContext, used to persist the controller's map
    configServiceRef,
    configServiceInstanceReady,
  } = useConfig();
  const { accounts } = useUpProvider();
  const controllerAddress = useMemo(() => accounts?.[0], [accounts]); // Address of the UP controlling the visuals

  const { configLoadNonce, loadedLayerConfigsFromPreset } = usePresetManagement();

  /** @type {[MIDIAccess | null, React.Dispatch<React.SetStateAction<MIDIAccess|null>>]} */
  const [midiAccess, setMidiAccess] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  /** @type {[Error | string | null, React.Dispatch<React.SetStateAction<Error|string|null>>]} */
  const [error, setError] = useState(null);
  /** @type {[Array<MIDIDevice>, React.Dispatch<React.SetStateAction<Array<MIDIDevice>>>]} */
  const [midiInputs, setMidiInputs] = useState([]);
  /** @type {[Object.<string, {layerSelect?: MIDIMappingData}>, React.Dispatch<React.SetStateAction<Object.<string, {layerSelect?: MIDIMappingData}>>>]} */
  const [layerMappings, setLayerMappings] = useState({ "1": {}, "2": {}, "3": {} }); // Local, ephemeral mappings for UI interaction
  /** @type {[object, React.Dispatch<React.SetStateAction<object>>]} */
  const [globalMappings, setGlobalMappings] = useState({}); // Local, ephemeral mappings
  /** @type {[{param: string, layer: string|number} | null, React.Dispatch<React.SetStateAction<{param: string, layer: string|number} | null>>]} */
  const [midiLearning, setMidiLearning] = useState(null);
  /** @type {[string|number|null, React.Dispatch<React.SetStateAction<string|number|null>>]} */
  const [learningLayer, setLearningLayer] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(0); // 0 for Omni
  /** @type {[Array<MIDIMonitorEntry>, React.Dispatch<React.SetStateAction<Array<MIDIMonitorEntry>>>]} */
  const [midiMonitorData, setMidiMonitorData] = useState([]);
  const [showMidiMonitor, setShowMidiMonitor] = useState(false);
  /** @type {[{layer: number, timestamp: number} | null, React.Dispatch<React.SetStateAction<{layer: number, timestamp: number} | null>>]} */
  const [pendingLayerSelect, setPendingLayerSelect] = useState(null);
  /** @type {[{layer: number, param: string, value: number, timestamp: number} | null, React.Dispatch<React.SetStateAction<{layer: number, param: string, value: number, timestamp: number} | null>>]} */
  const [pendingParamUpdate, setPendingParamUpdate] = useState(null);
  /** @type {[ControllerMIDIMap, React.Dispatch<React.SetStateAction<ControllerMIDIMap>>]} */
  const [activeControllerMidiMap, setActiveControllerMidiMap] = useState({}); // The map loaded from/saved to the controller's UP

  /** @type {[CatchModeTargetValues, React.Dispatch<React.SetStateAction<CatchModeTargetValues>>]} */
  const [catchModeTargetValues, setCatchModeTargetValues] = useState({});

  /** @type {React.RefObject<CatchModeTargetValues>} */
  const catchModeTargetValuesRef = useRef(catchModeTargetValues);
  /** @type {React.RefObject<ControllerMIDIMap>} */
  const activeControllerMidiMapRef = useRef(activeControllerMidiMap);
  /** @type {React.RefObject<Object.<string, {layerSelect?: MIDIMappingData}>>} */
  const layerMappingsRef = useRef(layerMappings);
  /** @type {React.RefObject<object>} */
  const globalMappingsRef = useRef(globalMappings);
  /** @type {React.RefObject<{param: string, layer: string|number} | null>} */
  const midiLearningRef = useRef(midiLearning);
  /** @type {React.RefObject<string|number|null>} */
  const learningLayerRef = useRef(learningLayer);
  /** @type {React.RefObject<number>} */
  const selectedChannelRef = useRef(selectedChannel);
  /** @type {React.RefObject<boolean>} */
  const connectionInProgressRef = useRef(false);
  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const pendingTimeoutRef = useRef(null);
  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const connectTimeoutRef = useRef(null);
  /** @type {React.RefObject<boolean>} */
  const isUnmountingRef = useRef(false);
  /** @type {React.RefObject<MIDIAccess | null>} */
  const midiAccessRefForCallbacks = useRef(midiAccess);
  /** @type {React.RefObject<((message: WebMidi.MIDIInputEvent) => void) | null>} */
  const handleMIDIMessageRef = useRef(null); // Will hold the memoized handleMIDIMessage

  useEffect(() => { activeControllerMidiMapRef.current = activeControllerMidiMap; }, [activeControllerMidiMap]);
  useEffect(() => { catchModeTargetValuesRef.current = catchModeTargetValues; }, [catchModeTargetValues]);
  useEffect(() => { midiAccessRefForCallbacks.current = midiAccess; }, [midiAccess]);
  useEffect(() => { layerMappingsRef.current = layerMappings; }, [layerMappings]);
  useEffect(() => { globalMappingsRef.current = globalMappings; }, [globalMappings]);
  useEffect(() => { midiLearningRef.current = midiLearning; }, [midiLearning]);
  useEffect(() => { learningLayerRef.current = learningLayer; }, [learningLayer]);
  useEffect(() => { selectedChannelRef.current = selectedChannel; }, [selectedChannel]);

  // Initialize catch mode targets when a new preset is loaded
  useEffect(() => {
    if (configLoadNonce > 0 && loadedLayerConfigsFromPreset && activeControllerMidiMapRef.current) {
      if (import.meta.env.DEV) {
        console.log(`[MIDIContext] Preset loaded (nonce: ${configLoadNonce}). Initializing catch mode targets.`);
      }
      const newCatchTargets = {};
      for (const layerIdStr in activeControllerMidiMapRef.current) {
        const layerParams = activeControllerMidiMapRef.current[layerIdStr];
        if (layerParams) {
          for (const paramName in layerParams) {
            const presetValue = loadedLayerConfigsFromPreset[layerIdStr]?.[paramName];
            if (typeof presetValue === 'number') {
              const catchKey = `${layerIdStr}_${paramName}`;
              newCatchTargets[catchKey] = {
                value: presetValue,
                caught: false,
                lastMidiValue: null,
              };
            } else if (import.meta.env.DEV && activeControllerMidiMapRef.current[layerIdStr]?.[paramName]) {
              // console.warn(`[MIDIContext Catch Init] No preset value for mapped L${layerIdStr}-${paramName}. It won't enter catch mode.`);
            }
          }
        }
      }
      setCatchModeTargetValues(newCatchTargets);
    }
  }, [configLoadNonce, loadedLayerConfigsFromPreset]);

  // Handle forced end of loading (e.g., from external event)
  useEffect(() => {
    const handleForceEndLoading = () => {
      if (connectionInProgressRef.current) {
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        setIsConnecting(false);
        connectionInProgressRef.current = false;
        setError("Connection attempt force-ended.");
        if (import.meta.env.DEV) console.log("[MIDIContext] Connection attempt force-ended by event.");
      }
    };
    document.addEventListener('force-end-loading', handleForceEndLoading);
    return () => document.removeEventListener('force-end-loading', handleForceEndLoading);
  }, []); // No dependencies, runs once

  // Auto-clear pending actions after a timeout
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

  // Load MIDI map for the current controllerAddress when it changes or service becomes ready
  useEffect(() => {
    const loadControllerMap = async () => {
      const logPrefix = `[MIDIContext LoadControllerMap Addr:${controllerAddress?.slice(0, 6) || 'N/A'}]`;
      if (controllerAddress && configServiceInstanceReady && configServiceRef.current) {
        if (import.meta.env.DEV) console.log(`${logPrefix} Attempting to load controller MIDI map (Instance Ready: ${configServiceInstanceReady})...`);
        try {
          const hexData = await configServiceRef.current.loadDataFromKey(controllerAddress, RADAR_MIDI_MAP_KEY);
          if (hexData && hexData !== '0x') {
            if (import.meta.env.DEV) console.log(`${logPrefix} Received hexData: ${hexData.substring(0, 100)}...`);
            const jsonString = hexToString(/** @type {`0x${string}`} */ (hexData));
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
        setActiveControllerMidiMap({}); // Reset if no address or service not ready
        if (import.meta.env.DEV) {
          if (!controllerAddress) console.log(`${logPrefix} Skipped: No controller address. Map reset.`);
          else if (!configServiceInstanceReady) console.log(`${logPrefix} Skipped: Config service INSTANCE not ready (Flag value: ${configServiceInstanceReady}). Map reset.`);
          else if (configServiceInstanceReady && !configServiceRef.current) console.log(`${logPrefix} Skipped: Config service INSTANCE ready but ref.current is null. Map reset.`);
          // else console.log(`${logPrefix} Skipped: Unknown reason, conditions not met. Map reset.`); // This log can be noisy
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
        configUpdateMidiMap(updatedActiveMap); // Persist this to ConfigContext/on-chain
      } else if (import.meta.env.DEV) {
        console.error("[MIDIContext] mapParameterToMIDI: configUpdateMidiMap is not a function!");
      }
      return updatedActiveMap;
    });
  }, [configUpdateMidiMap]);

  const mapLayerToMIDI = useCallback((layer, mappingData) => {
    // This updates local ephemeral state for UI, not persisted controller map
    setLayerMappings(prev => ({ ...prev, [String(layer)]: { ...(prev[String(layer)] || {}), layerSelect: mappingData } }));
  }, []); // setLayerMappings is stable

  const startMIDILearn = useCallback((param, layer) => { setMidiLearning({ param: param, layer: layer }); setLearningLayer(null); }, []);
  const stopMIDILearn = useCallback(() => { if (midiLearningRef.current) setMidiLearning(null); }, []); // midiLearningRef for condition
  const startLayerMIDILearn = useCallback((layer) => { setLearningLayer(layer); setMidiLearning(null); }, []);
  const stopLayerMIDILearn = useCallback(() => { if (learningLayerRef.current !== null) setLearningLayer(null); }, []); // learningLayerRef for condition

  const handleMIDIMessage = useCallback((message) => {
    if (!message || !message.data || message.data.length === 0) return;
    const [status, data1, data2] = message.data;
    const msgChan = status & 0x0F; // MIDI channel (0-15)
    const msgType = getMidiMessageType(status);
    const timestamp = Date.now();

    setMidiMonitorData(prev => {
      const newEntry = { timestamp: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 }), status, data1, data2, channel: msgChan + 1, type: msgType };
      const updated = [...prev, newEntry];
      return updated.length > MAX_MONITOR_ENTRIES ? updated.slice(-MAX_MONITOR_ENTRIES) : updated;
    });

    if (selectedChannelRef.current > 0 && (msgChan + 1) !== selectedChannelRef.current) return; // Channel filter

    const isCC = msgType === 'Control Change';
    const isNoteOn = msgType === 'Note On' && data2 > 0; // Note On with velocity > 0
    const isPitch = msgType === 'Pitch Bend';
    const currentLearningState = midiLearningRef.current;

    if (currentLearningState) { // Parameter learn mode
      if (isCC || isNoteOn || isPitch) {
        const mappingData = { type: isCC ? 'cc' : (isNoteOn ? 'note' : 'pitchbend'), number: data1, channel: msgChan };
        mapParameterToMIDI(currentLearningState.param, currentLearningState.layer, mappingData);
        stopMIDILearn();
      }
      return;
    }
    if (learningLayerRef.current !== null) { // Layer select learn mode
      if (isNoteOn) {
        const mappingData = { type: 'note', number: data1, channel: msgChan };
        mapLayerToMIDI(learningLayerRef.current, mappingData);
        stopLayerMIDILearn();
      }
      return;
    }

    let actionTaken = false;
    let catchStateModified = false;

    if (isNoteOn) { // Layer selection via MIDI Note On
      Object.entries(layerMappingsRef.current).forEach(([layerId, mapping]) => {
        const lsm = mapping.layerSelect;
        if (lsm?.type === 'note' && lsm.number === data1 && (lsm.channel === undefined || lsm.channel === msgChan)) {
          actionTaken = true;
          setPendingLayerSelect({ layer: parseInt(layerId, 10), timestamp });
        }
      });
    }

    if ((isCC || isPitch || isNoteOn) && !actionTaken) { // Parameter control
      const currentControllerMap = activeControllerMidiMapRef.current || {};
      Object.entries(currentControllerMap).forEach(([layerIdStr, layerParams]) => {
        if (typeof layerParams !== 'object' || layerParams === null) return;
        Object.entries(layerParams).forEach(([paramName, mappingData]) => {
          if (!mappingData) return;
          let isMatch = false;
          let rawValue = data2;
          let midiMsgTypeForNormalization = 'cc'; // Default

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

            if (paramCatchState) { // Parameter is under catch mode
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
                    if(import.meta.env.DEV) console.log(`[MIDI Catch] L${layerIdStr}-${paramName} CAUGHT! PresetValNorm: ${normalizedPresetValue.toFixed(3)}, LastMidiNorm: ${lastNormalizedMidiVal?.toFixed(3)}, CurrMidiNorm: ${currentNormalizedMidiVal.toFixed(3)}`);
                    catchModeTargetValuesRef.current[catchKey] = { ...paramCatchState, caught: true, lastMidiValue: currentNormalizedMidiVal };
                    catchStateModified = true;
                    setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
                  } else {
                     if(import.meta.env.DEV && lastNormalizedMidiVal !== null) {
                        // console.log(`[MIDI Catch] L${layerIdStr}-${paramName} NOT caught. PresetValNorm: ${normalizedPresetValue.toFixed(3)}, LastMidiNorm: ${lastNormalizedMidiVal?.toFixed(3)}, CurrMidiNorm: ${currentNormalizedMidiVal.toFixed(3)}`);
                     }
                    catchModeTargetValuesRef.current[catchKey] = { ...paramCatchState, lastMidiValue: currentNormalizedMidiVal };
                    catchStateModified = true;
                  }
                } else {
                  if(import.meta.env.DEV) console.warn(`[MIDI Catch] No sliderConfig for ${paramName}, applying MIDI directly.`);
                  setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
                }
              } else { // Already caught
                catchModeTargetValuesRef.current[catchKey] = { ...paramCatchState, lastMidiValue: currentNormalizedMidiVal };
                catchStateModified = true;
                setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
              }
            } else { // Parameter not under catch mode
              setPendingParamUpdate({ layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp });
            }
          }
        });
      });
    }
    if (catchStateModified) {
      setCatchModeTargetValues({ ...catchModeTargetValuesRef.current });
    }
  }, [mapLayerToMIDI, mapParameterToMIDI, stopMIDILearn, stopLayerMIDILearn]); // Removed setCatchModeTargetValues as it's updated via ref and then spread

  useEffect(() => { handleMIDIMessageRef.current = handleMIDIMessage; }, [handleMIDIMessage]);

  const setupMIDIListeners = useCallback((access) => {
    if (!access) return;
    access.inputs.forEach(input => {
      const messageHandlerWrapper = (message) => { if (handleMIDIMessageRef.current) { handleMIDIMessageRef.current(message); } };
      if (input.onmidimessage) { input.onmidimessage = null; } // Clear previous if any
      input.onmidimessage = messageHandlerWrapper;
    });
  }, []); // handleMIDIMessageRef is stable

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
        if (!input.onmidimessage) { // Re-attach if it was lost or never set
          input.onmidimessage = messageHandlerWrapper;
        }
      } else { // Disconnected
        if (input.onmidimessage) {
          input.onmidimessage = null;
        }
      }
    });
    setMidiInputs(currentInputs);
    setIsConnected(wasConnected => {
      if (wasConnected !== anyConnected) {
        if (anyConnected) setError(null);
        // else setError("All MIDI devices disconnected."); // This can be noisy if a device is unplugged intentionally
        return anyConnected;
      }
      return wasConnected;
    });
  }, []); // midiAccessRefForCallbacks, handleMIDIMessageRef are stable

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
      if (isConnecting && connectionInProgressRef.current) { // Check both flags
        setError("MIDI connection timed out.");
        setIsConnecting(false);
        connectionInProgressRef.current = false;
        if (import.meta.env.DEV) console.warn("[MIDIContext] MIDI connection timed out.");
      }
    }, MIDI_CONNECT_TIMEOUT_MS);

    let access = null;
    try {
      access = await navigator.requestMIDIAccess({ sysex: false }); // Request MIDI access
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;

      if (isUnmountingRef.current) { // Check if component unmounted during await
          if (import.meta.env.DEV) console.log("[MIDIContext] connectMIDI: Unmounted during access request. Aborting setup.");
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
      access.onstatechange = handleStateChange; // Attach state change handler

      setIsConnected(anyDeviceConnected);
      setIsConnecting(false);
      connectionInProgressRef.current = false;
      if (!anyDeviceConnected) {
        setError("No MIDI devices found or connected.");
        if (import.meta.env.DEV) console.log("[MIDIContext] No MIDI devices found or connected after access grant.");
      } else if (import.meta.env.DEV) {
        console.log("[MIDIContext] MIDI connected successfully.");
      }
      return access;
    } catch (err) {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
      const errorMessage = err.message || err.name || 'Unknown MIDI access error';
      setError(`MIDI access failed: ${errorMessage}`);
      if (import.meta.env.DEV) console.error("[MIDIContext] MIDI access failed:", err);
      setMidiAccess(null);
      setIsConnected(false);
      setIsConnecting(false);
      connectionInProgressRef.current = false;
      return null;
    }
  }, [isConnected, setupMIDIListeners, handleStateChange, isConnecting]); // isConnecting added

  const disconnectMIDI = useCallback((forceFullDisconnect = false) => {
    const isDevelopment = import.meta.env.DEV;
    const isFinalUnmount = isUnmountingRef.current && forceFullDisconnect;
    const currentMidiAccess = midiAccessRefForCallbacks.current;

    if(isDevelopment) console.log(`[MIDIContext] disconnectMIDI called. Force: ${forceFullDisconnect}, isDev: ${isDevelopment}, isUnmounting: ${isUnmountingRef.current}`);

    if (currentMidiAccess) {
      if (currentMidiAccess.onstatechange) {
        currentMidiAccess.onstatechange = null;
        if(isDevelopment) console.log("[MIDIContext] Cleared onstatechange listener.");
      }
      currentMidiAccess.inputs.forEach(input => {
        if (input.onmidimessage) {
          input.onmidimessage = null;
          if(isDevelopment) console.log(`[MIDIContext] Cleared onmidimessage for input: ${input.id}`);
        }
      });
    }

    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
    if (pendingTimeoutRef.current) { clearTimeout(pendingTimeoutRef.current); pendingTimeoutRef.current = null; }
    connectionInProgressRef.current = false; // Ensure this is reset

    // Full disconnect logic for production, forced, or unmounting scenarios
    if (forceFullDisconnect || isFinalUnmount || !isDevelopment) {
      setMidiAccess(null);
      setIsConnected(false);
      setIsConnecting(false);
      setMidiInputs([]);
      setError(null);
      // setShowMidiMonitor(false); // Consider if this should be reset here or managed by UI state
      if(isDevelopment) console.log("[MIDIContext] Full MIDI Disconnect executed: States reset.");
    } else { // Soft disconnect for development (keeps state for easier debugging)
      setIsConnecting(false); // At least mark as not connecting
      if(isDevelopment) console.log("[MIDIContext] Soft MIDI Disconnect (dev mode, no force). isConnecting set to false.");
    }
  }, []); // midiAccessRefForCallbacks is stable

  const clearAllMappings = useCallback(() => {
    // Consider adding a confirmation dialog for the user
    if (window.confirm("Are you sure you want to reset ALL persistent MIDI parameter mappings for the current controller? This cannot be undone easily.")) {
      if(typeof configUpdateMidiMap === 'function') {
        configUpdateMidiMap({}); // Update the persisted map in ConfigContext
      }
      setActiveControllerMidiMap({}); // Clear local active map
      setLayerMappings({ "1": {}, "2": {}, "3": {} }); // Reset ephemeral UI mappings
      setGlobalMappings({}); // Reset ephemeral UI mappings
      setCatchModeTargetValues({}); // Reset catch mode state
      if (import.meta.env.DEV) console.log("[MIDIContext] All MIDI mappings cleared.");
    }
  }, [configUpdateMidiMap]);

  const setChannelFilter = useCallback((channel) => {
    const ch = parseInt(String(channel), 10);
    if (!isNaN(ch) && ch >= 0 && ch <= 16) { // 0 for Omni, 1-16 for channels
      setSelectedChannel(ch);
    } else if (import.meta.env.DEV) {
      console.warn(`[MIDIContext] Invalid channel for setChannelFilter: ${channel}`);
    }
  }, []); // setSelectedChannel is stable

  const clearMIDIMonitor = useCallback(() => { setMidiMonitorData([]); }, []);
  const clearPendingActions = useCallback(() => {
    setPendingLayerSelect(null);
    setPendingParamUpdate(null);
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
  }, []); // Setters are stable

  // Cleanup on unmount
  useEffect(() => {
    isUnmountingRef.current = false; // Set to false on mount/re-render
    return () => {
      isUnmountingRef.current = true; // Set to true when unmounting
      disconnectMIDI(true); // Force full disconnect on unmount
    };
  }, [disconnectMIDI]); // disconnectMIDI is memoized

  const contextValue = useMemo(() => ({
    midiAccess, isConnected, isConnecting, error, midiInputs,
    midiMap: activeControllerMidiMap, // This is the active map for the current controller
    layerMappings, globalMappings, midiLearning, learningLayer, selectedChannel,
    midiMonitorData, showMidiMonitor, pendingLayerSelect, pendingParamUpdate,
    setShowMidiMonitor, // Direct setter
    connectMIDI, disconnectMIDI, startMIDILearn, stopMIDILearn,
    startLayerMIDILearn, stopLayerMIDILearn, clearAllMappings, setChannelFilter,
    clearMIDIMonitor, mapParameterToMIDI, mapLayerToMIDI, clearPendingActions,
  }), [
    midiAccess, isConnected, isConnecting, error, midiInputs, activeControllerMidiMap,
    layerMappings, globalMappings, midiLearning, learningLayer, selectedChannel,
    midiMonitorData, showMidiMonitor, pendingLayerSelect, pendingParamUpdate,
    connectMIDI, disconnectMIDI, clearAllMappings, mapParameterToMIDI, mapLayerToMIDI,
    setChannelFilter, clearMIDIMonitor, setShowMidiMonitor, clearPendingActions, stopMIDILearn,
    startMIDILearn, startLayerMIDILearn, stopLayerMIDILearn
    // Note: setActiveControllerMidiMap, setLayerMappings, etc. are not part of the public context API
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

/**
 * Custom hook to consume the `MIDIContext`.
 * Provides access to MIDI state, device information, mappings, and control functions.
 * Throws an error if used outside of a `MIDIProvider`.
 *
 * @returns {MIDIContextValue} The current value of the MIDIContext.
 * @throws {Error} If the hook is not used within a `MIDIProvider`.
 */
export function useMIDI() {
  const context = useContext(MIDIContext);
  if (context === undefined) { // Check for undefined, which is the value if no provider is found
    const err = new Error('useMIDI must be used within a MIDIProvider component.');
    if (import.meta.env.DEV) {
        console.error("useMIDI context details: Attempted to use context but found undefined. This usually means MIDIProvider is missing as an ancestor of the component calling useMIDI.", err.stack);
    }
    throw err;
  }
  // The check `context === defaultContextValue` might be too strict if the default object reference is somehow used initially.
  // `context === undefined` is the standard and most reliable check for a missing provider.
  return context;
}