// src/hooks/useConfigState.js
import { useState, useEffect, useCallback, useRef } from "react";
import { useUpProvider } from "../context/UpProvider";
import ConfigurationService from "../services/ConfigurationService";
import { useToast } from "../context/ToastContext";
import {
  RADAR_EVENT_REACTIONS_KEY,
  RADAR_MIDI_MAP_KEY,
} from "../config/global-config";
import { stringToHex } from "viem";

/**
 * Transforms an array of preset name strings into an array of objects,
 * suitable for components like PresetSelectorBar.
 * @param {string[]} list - Array of preset name strings.
 * @returns {{ name: string }[]} Array of preset objects.
 */
const transformStringListToObjects = (list) => {
  if (!Array.isArray(list)) return [];
  return list
    .filter(item => typeof item === 'string')
    .map(name => ({ name }));
};

// Helper function to ensure all default keys are present
const ensureCompleteLayerConfig = (layerConfig, defaultLayerConfig) => {
    const completeConfig = { ...defaultLayerConfig }; // Start with defaults
    for (const key in layerConfig) {
        // Override with actual values if they exist and are not null/undefined
        // Allow explicit 'false' for 'enabled'
        if (Object.hasOwnProperty.call(layerConfig, key) && (layerConfig[key] !== null && layerConfig[key] !== undefined)) {
            completeConfig[key] = layerConfig[key];
        }
        // Special handling for driftState if needed (assuming default is okay otherwise)
        if (key === 'driftState' && typeof layerConfig[key] === 'object') {
             completeConfig[key] = { ...defaultLayerConfig.driftState, ...layerConfig[key] };
        }
    }
    // Explicitly ensure boolean 'enabled' is present
    if (typeof completeConfig.enabled !== 'boolean') {
        completeConfig.enabled = defaultLayerConfig.enabled; // Use default if somehow missing/invalid
    }
    return completeConfig;
};

// Helper to get a default config structure (matches CanvasManager's default)
const getDefaultLayerConfigTemplate = () => ({
    enabled: true, blendMode: 'normal', opacity: 1.0, size: 1.0,
    speed: 0.01, drift: 0, driftSpeed: 0.1, angle: 0,
    xaxis: 0, yaxis: 0, direction: 1,
    driftState: { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false },
    // audioSource: 'level', // Include if needed
});

/**
 * Manages the core configuration state of the application, including layer settings,
 * token assignments, MIDI mappings, event reactions, and preset management (load, save, delete).
 * It interacts with the ConfigurationService to persist and retrieve data from the
 * user's Universal Profile based on the provided profileAddress. It also handles
 * loading status, errors, pending changes, and triggers updates via a nonce.
 *
 * @param {string | null} profileAddress - The address of the Universal Profile whose configuration is being managed.
 * @returns {{
 *  configServiceReady: boolean,
 *  configServiceRef: React.RefObject<ConfigurationService | null>,
 *  currentConfigName: string | null,
 *  layerConfigs: object,
 *  tokenAssignments: object,
 *  savedReactions: object,
 *  midiMap: object,
 *  isLoading: boolean,
 *  loadError: Error | null,
 *  isSaving: boolean,
 *  saveError: Error | null,
 *  saveSuccess: boolean,
 *  hasPendingChanges: boolean,
 *  savedConfigList: { name: string }[],
 *  isInitiallyResolved: boolean,
 *  configLoadNonce: number,
 *  saveVisualPreset: (nameToSave: string, setAsDefault: boolean, includeReactions: boolean, includeMidi: boolean) => Promise<{ success: boolean, error?: string }>,
 *  saveGlobalReactions: () => Promise<{ success: boolean, error?: string }>,
 *  saveGlobalMidiMap: () => Promise<{ success: boolean, error?: string }>,
 *  loadNamedConfig: (name: string) => Promise<{ success: boolean, error?: string, config?: object }>,
 *  loadDefaultConfig: () => Promise<{ success: boolean, error?: string, config?: object }>,
 *  loadSavedConfigList: () => Promise<{ success: boolean, error?: string, list?: { name: string }[] }>,
 *  deleteNamedConfig: (nameToDelete: string) => Promise<{ success: boolean, error?: string }>,
 *  updateLayerConfig: (layerId: string | number, key: string, value: any) => void,
 *  updateTokenAssignment: (layerId: string | number, tokenId: string | object | null) => void,
 *  updateSavedReaction: (eventType: string, reactionData: object) => void,
 *  deleteSavedReaction: (eventType: string) => void,
 *  updateMidiMap: (newMap: object) => void,
 *  setHasPendingChanges: React.Dispatch<React.SetStateAction<boolean>>
 * }} An object containing the configuration state and associated actions.
 */
const useConfigState = (profileAddress) => {
  const { provider, walletClient, publicClient } = useUpProvider();
  const { addToast } = useToast();
  const configServiceRef = useRef(null);
  const [configServiceReady, setConfigServiceReady] = useState(false);

  const [currentConfigName, setCurrentConfigName] = useState(null);
  const [layerConfigs, setLayerConfigs] = useState({});
  const [tokenAssignments, setTokenAssignments] = useState({});
  const [savedReactions, setSavedReactions] = useState({});
  const [midiMap, setMidiMap] = useState({});
  const [isLoading, setIsLoading] = useState(false); // Changed from isConfigLoading
  const [loadError, setLoadError] = useState(null);
  const [isInitiallyResolved, setIsInitiallyResolved] = useState(false);
  const [configLoadNonce, setConfigLoadNonce] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [savedConfigList, setSavedConfigList] = useState([]);
  const initialLoadPerformedRef = useRef(false);
  const initialLoadTimeoutRef = useRef(null);

  useEffect(() => {
    if (publicClient && walletClient && !configServiceRef.current) {
      const service = new ConfigurationService(provider, walletClient, publicClient);
      service.initialize()
        .then((ready) => {
          if (ready) {
            configServiceRef.current = service;
            setConfigServiceReady(true);
          } else {
            console.error("[useConfigState] ConfigurationService failed init.");
            addToast("Configuration service failed to initialize.", "error");
            setConfigServiceReady(false);
          }
        })
        .catch((err) => {
          console.error("[useConfigState] Error initializing Service:", err);
          addToast(`Error initializing config service: ${err.message}`, "error");
          setConfigServiceReady(false);
        });
    } else if ((!publicClient || !walletClient) && configServiceRef.current) {
      // Reset state if provider disconnects
      configServiceRef.current = null;
      setConfigServiceReady(false);
      setIsInitiallyResolved(false);
      initialLoadPerformedRef.current = false;
      setSavedConfigList([]);
      setCurrentConfigName(null);
    }
  }, [publicClient, walletClient, provider, addToast]);

  /** Updates the MIDI mapping state and marks changes as pending. */
  const updateMidiMap = useCallback((newMap) => {
      const mapToSet = typeof newMap === "object" && newMap !== null ? newMap : {};
      setMidiMap(mapToSet);
      setHasPendingChanges(true);
    }, []);

  /** Applies loaded configuration data to the state. */
  const applyLoadedData = useCallback(
    (loadedData, reason = "unknown", targetAddress, targetName = null) => {
      const logPrefix = `[useConfigState applyLoadedData Addr:${targetAddress?.slice(0, 6)}]`;
      // Log raw loaded data
      console.log(`${logPrefix} Received raw loadedData:`, JSON.parse(JSON.stringify(loadedData || {})));

      setLoadError(null);

      if (loadedData?.error) {
        console.error(`${logPrefix} Load error received:`, loadedData.error);
        setLoadError(loadedData.error);
        addToast(`Error loading configuration: ${loadedData.error}`, 'error');
        if (reason === "initial") {
          setIsInitiallyResolved(true);
          initialLoadPerformedRef.current = true;
        }
        return;
      }

      const finalName = loadedData?.config?.name ?? targetName ?? null;

      if (loadedData) {
        const newLayers = loadedData.config?.layers || {};
        const newTokens = loadedData.config?.tokenAssignments || {};
        const newReactions = loadedData.reactions || {};
        const newMidi = loadedData.midi || {};

        // Log parsed layers before setting state
        console.log(`${logPrefix} Parsed Layers BEFORE setState:`, JSON.parse(JSON.stringify(newLayers)));
        const layer3Key = '3'; // Assuming layer IDs are strings '1', '2', '3'
        if (newLayers[layer3Key]) {
            console.log(`${logPrefix} Parsed Layer 3 'enabled' BEFORE setState: ${newLayers[layer3Key].enabled}`);
        } else {
            console.log(`${logPrefix} Parsed data missing Layer 3 object (using key '${layer3Key}') BEFORE setState.`);
        }

        setLayerConfigs(newLayers);
        setTokenAssignments(newTokens);
        setSavedReactions(newReactions);
        setMidiMap(newMidi);

        if (finalName !== currentConfigName) {
            console.log(`${logPrefix} Updating currentConfigName from '${currentConfigName}' to '${finalName}' based on loaded data/target.`);
            setCurrentConfigName(finalName);
        }

        setHasPendingChanges(false);

        const nextNonce = configLoadNonce + 1;
        setConfigLoadNonce(nextNonce);
        console.log(`${logPrefix} Data application complete. Nonce Incremented (${nextNonce}). Final Name: ${finalName}`);

      } else {
        // Clearing data
        setLayerConfigs({});
        setTokenAssignments({});
        setSavedReactions({});
        setMidiMap({});
        setCurrentConfigName(null);
        setHasPendingChanges(false);
        setConfigLoadNonce(0);
        console.log(`${logPrefix} Data cleared. Nonce Reset (0).`);
      }

      if (reason === "initial") {
        setIsInitiallyResolved(true);
        initialLoadPerformedRef.current = true;
      } else if (reason.startsWith("load:") && loadedData) {
         addToast(`Loaded preset: ${finalName}`, 'success', 3000);
      }
    },
    [addToast, configLoadNonce, currentConfigName],
  );

  /** Fetches the list of saved configuration names from the profile. */
  const loadSavedConfigList = useCallback(async () => {
    if (!configServiceReady || !configServiceRef.current) {
        addToast("Configuration service not ready.", "error");
        return { success: false, error: "Service not ready." };
    }
    if (!profileAddress) {
        addToast("No profile address selected.", "error");
        return { success: false, error: "No profile address." };
    }
    try {
      const stringList = await configServiceRef.current.loadSavedConfigurations(profileAddress);
      const objectList = transformStringListToObjects(stringList);
      setSavedConfigList(objectList);
      return { success: true, list: objectList };
    } catch (error) {
      console.error("[useConfigState loadSavedConfigList] Error:", error);
      addToast(`Failed to load preset list: ${error.message}`, 'error');
      setSavedConfigList([]);
      return { success: false, error: error.message || "Failed to load list." };
    }
  }, [configServiceReady, profileAddress, addToast]);

  /** Core function to load configuration (default or named). */
  const performLoad = useCallback(
    async (address, configName = null, customKey = null, reason = "manual") => {
      if (!configServiceReady || !configServiceRef.current) {
          addToast("Configuration service not ready.", "error");
          return { success: false, error: "Service not ready." };
      }
      if (!address) {
          addToast("No profile address selected.", "error");
          return { success: false, error: "No address." };
      }

      const logPrefix = `[useConfigState performLoad Addr:${address.slice(0, 6)}]`;
      const targetName = configName || "Default";
      console.log(`${logPrefix} Triggered. Reason: ${reason}. Target Name: ${targetName}.`);

      setIsLoading(true);
      setLoadError(null);

      try {
        const loadedData = await configServiceRef.current.loadConfiguration(
          address,
          configName,
          customKey,
        );

        const loadedNameFromData = loadedData?.config?.name;
        applyLoadedData(loadedData, reason, address, loadedNameFromData ?? targetName);

        setIsLoading(false);
        const loadSuccessful = !loadedData?.error;
        if (loadSuccessful) {
          loadSavedConfigList().catch(err => console.error("Error refreshing list after load:", err));
        }
        return { success: loadSuccessful, error: loadedData?.error, config: loadedData?.config };
      } catch (error) {
        console.error(`${logPrefix} Unexpected load error:`, error);
        const errorMsg = error.message || "Unknown load error";
        applyLoadedData({ error: errorMsg }, reason, address, targetName);
        setIsLoading(false);
        return { success: false, error: errorMsg };
      }
    },
    [configServiceReady, applyLoadedData, addToast, loadSavedConfigList],
  );

  // Effect to auto-load default configuration on mount or profile change
  useEffect(() => {
    const logPrefix = `[useConfigState AutoLoad Addr:${profileAddress?.slice(0, 6)}]`;
    const shouldLoad = profileAddress && configServiceReady && !initialLoadPerformedRef.current;

    if (shouldLoad) {
      if (initialLoadTimeoutRef.current) {
        clearTimeout(initialLoadTimeoutRef.current);
      }
      initialLoadTimeoutRef.current = setTimeout(() => {
        initialLoadPerformedRef.current = true;
        setIsInitiallyResolved(false);
        setConfigLoadNonce(0);
        performLoad(profileAddress, null, null, "initial")
          .then(({ success }) => {
            if (success) {
              loadSavedConfigList().catch(err => console.error("Error loading list after initial load:", err));
            }
          })
          .catch((err) => {
            console.error(`${logPrefix} Uncaught initial load error via setTimeout:`, err);
            addToast(`Failed initial configuration load: ${err.message}`, 'error');
            setIsInitiallyResolved(true);
          });
      }, 100);

    } else if (!profileAddress) {
      if (initialLoadPerformedRef.current || isInitiallyResolved) {
        if (initialLoadTimeoutRef.current) {
          clearTimeout(initialLoadTimeoutRef.current);
          initialLoadTimeoutRef.current = null;
        }
        applyLoadedData(null, "address_cleared", null);
        setIsInitiallyResolved(false);
        initialLoadPerformedRef.current = false;
        setSavedConfigList([]);
      }
    }
    return () => {
      if (initialLoadTimeoutRef.current) {
        clearTimeout(initialLoadTimeoutRef.current);
      }
    };
  }, [profileAddress, configServiceReady, performLoad, applyLoadedData, addToast, isInitiallyResolved, loadSavedConfigList]);

  /** Saves the current visual preset (layers, tokens) and optionally global settings. */
  const saveCurrentConfig = useCallback(
    async (nameToSave, setAsDefault, includeReactions, includeMidi) => {
      if (!configServiceReady || !configServiceRef.current) {
          addToast("Configuration service not ready.", "error");
          return { success: false, error: "Service not ready." };
      }
      if (!profileAddress) {
          addToast("No profile address selected.", "error");
          return { success: false, error: "No profile address." };
      }
      if (!nameToSave?.trim()) {
          addToast("Preset name cannot be empty.", "warning");
          return { success: false, error: "Preset name required." };
      }

      const logPrefix = `[useConfigState saveCurrentConfig Addr:${profileAddress.slice(0, 6)} Name:${nameToSave}]`;
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      // --- FIX APPLIED HERE ---
      // Create a complete, validated layers object before saving
      const defaultLayerTemplate = getDefaultLayerConfigTemplate();
      const completeLayerConfigsForSave = {};
      for (const layerId of ['1', '2', '3']) { // Assuming layer IDs are strings '1', '2', '3'
          const currentLayerState = layerConfigs[layerId] || {}; // Get current state or empty object
          completeLayerConfigsForSave[layerId] = ensureCompleteLayerConfig(currentLayerState, defaultLayerTemplate);
      }
      // --- END FIX ---

      const dataToSave = {
        // Use the completed/validated object for saving
        layers: completeLayerConfigsForSave,
        tokenAssignments: tokenAssignments,
        reactions: includeReactions ? savedReactions : undefined,
        midi: includeMidi ? midiMap : undefined,
      };

      // --- PRE-SAVE LOGGING (Using completed object) ---
      console.log('[useConfigState saveCurrentConfig] State JUST BEFORE save (using completed layers):', {
          layers: JSON.parse(JSON.stringify(completeLayerConfigsForSave)), // Log the prepared object
          tokens: JSON.parse(JSON.stringify(tokenAssignments)),
          reactions: includeReactions ? JSON.parse(JSON.stringify(savedReactions)) : undefined,
          midi: includeMidi ? JSON.parse(JSON.stringify(midiMap)) : undefined,
          name: nameToSave,
          default: setAsDefault,
          profile: profileAddress
      });
       // Log Layer 3 specifically from the object being saved
       const layer3Key = '3'; // Confirm this matches your layer ID convention
       if (completeLayerConfigsForSave && completeLayerConfigsForSave[layer3Key]) {
            console.log(`${logPrefix} Layer 3 'enabled' in OBJECT being saved: ${completeLayerConfigsForSave[layer3Key].enabled}`);
       } else {
            console.warn(`${logPrefix} Layer 3 (key '${layer3Key}') missing in object being saved!`);
       }
      // --- END PRE-SAVE LOGGING ---

      try {
        // Pass the original dataToSave which now contains completeLayerConfigsForSave
        const result = await configServiceRef.current.saveConfiguration(
          profileAddress, dataToSave, nameToSave, setAsDefault, true, includeReactions, includeMidi, null
        );
        if (result.success) {
          addToast(`Preset '${nameToSave}' saved successfully!`, 'success');
          setSaveSuccess(true);
          setHasPendingChanges(false);
          setCurrentConfigName(nameToSave);
          loadSavedConfigList().catch(err => console.error("Error refreshing list after save:", err));
        } else {
          throw new Error(result.error || "Save configuration failed.");
        }
        setIsSaving(false);
        return result;
      } catch (error) {
        console.error(`${logPrefix} Save failed:`, error);
        const errorMsg = error.message || "Unknown save error.";
        setSaveError(errorMsg);
        addToast(`Error saving preset: ${errorMsg}`, 'error');
        setIsSaving(false);
        setSaveSuccess(false);
        return { success: false, error: errorMsg };
      }
    },
    [configServiceReady, profileAddress, layerConfigs, tokenAssignments, savedReactions, midiMap, addToast, loadSavedConfigList],
  );

  /** Saves only the current event reaction settings globally. */
  const saveGlobalReactions = useCallback(async () => {
     if (!configServiceReady || !configServiceRef.current) {
          addToast("Configuration service not ready.", "error");
          return { success: false, error: "Service not ready." };
      }
      if (!profileAddress) {
          addToast("No profile address selected.", "error");
          return { success: false, error: "No profile address." };
      }
    const logPrefix = `[useConfigState saveGlobalReactions Addr:${profileAddress.slice(0, 6)}]`;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const dataKey = RADAR_EVENT_REACTIONS_KEY;
      const dataToSave = savedReactions || {};
      const jsonString = JSON.stringify(dataToSave);
      const hexValue = stringToHex(jsonString);
      const result = await configServiceRef.current.saveDataToKey(profileAddress, dataKey, hexValue);
      if (result.success) {
        addToast(`Global reactions saved successfully!`, 'success');
        setSaveSuccess(true);
        setHasPendingChanges(false);
      } else {
        throw new Error(result.error || "Save reactions failed.");
      }
      setIsSaving(false);
      return result;
    } catch (error) {
      console.error(`${logPrefix} Save failed:`, error);
      const errorMsg = error.message || `Unknown reactions save error.`;
      setSaveError(errorMsg);
      addToast(`Error saving reactions: ${errorMsg}`, 'error');
      setIsSaving(false);
      setSaveSuccess(false);
      return { success: false, error: errorMsg };
    }
  }, [configServiceReady, profileAddress, savedReactions, addToast]);

  /** Saves only the current MIDI map settings globally. */
  const saveGlobalMidiMap = useCallback(async () => {
     if (!configServiceReady || !configServiceRef.current) {
          addToast("Configuration service not ready.", "error");
          return { success: false, error: "Service not ready." };
      }
      if (!profileAddress) {
          addToast("No profile address selected.", "error");
          return { success: false, error: "No profile address." };
      }
    const logPrefix = `[useConfigState saveGlobalMidiMap Addr:${profileAddress.slice(0, 6)}]`;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const dataKey = RADAR_MIDI_MAP_KEY;
      const dataToSave = midiMap || {};
      const jsonString = JSON.stringify(dataToSave);
      const hexValue = stringToHex(jsonString);
      const result = await configServiceRef.current.saveDataToKey(profileAddress, dataKey, hexValue);
      if (result.success) {
        addToast(`Global MIDI map saved successfully!`, 'success');
        setSaveSuccess(true);
        setHasPendingChanges(false);
      } else {
        throw new Error(result.error || "Save MIDI map failed.");
      }
      setIsSaving(false);
      return result;
    } catch (error) {
      console.error(`${logPrefix} Save failed:`, error);
      const errorMsg = error.message || `Unknown MIDI save error.`;
      setSaveError(errorMsg);
      addToast(`Error saving MIDI map: ${errorMsg}`, 'error');
      setIsSaving(false);
      setSaveSuccess(false);
      return { success: false, error: errorMsg };
    }
  }, [configServiceReady, profileAddress, midiMap, addToast]);

  /** Deletes a named configuration preset from the profile. */
  const deleteNamedConfig = useCallback(
    async (nameToDelete) => {
      if (!configServiceReady || !configServiceRef.current) {
          addToast("Configuration service not ready.", "error");
          return { success: false, error: "Service not ready." };
      }
      if (!profileAddress) {
          addToast("No profile address selected.", "error");
          return { success: false, error: "No profile address." };
      }
      if (!nameToDelete) {
           addToast("No preset name provided to delete.", "warning");
           return { success: false, error: "No name provided." };
      }

      const logPrefix = `[useConfigState delete Addr:${profileAddress.slice(0, 6)} Name:${nameToDelete}]`;
      setIsSaving(true);
      setSaveError(null);

      try {
        const result = await configServiceRef.current.deleteConfiguration(profileAddress, nameToDelete);
        if (result.success) {
          addToast(`Preset '${nameToDelete}' deleted.`, 'success');
          setSaveSuccess(true);
          await loadSavedConfigList();
          if (currentConfigName === nameToDelete) {
              console.log(`${logPrefix} Deleted the active preset. Loading default...`);
              await performLoad(profileAddress, null, null, `delete_cleanup:${nameToDelete}`);
          }
        } else {
          throw new Error(result.error || "Delete operation failed.");
        }
        setIsSaving(false);
        return result;
      } catch (error) {
        console.error(`${logPrefix} Delete failed:`, error);
        const errorMsg = error.message || "Unknown delete error.";
        setSaveError(errorMsg);
        addToast(`Error deleting preset: ${errorMsg}`, 'error');
        setIsSaving(false);
        return { success: false, error: errorMsg };
      }
    },
    [configServiceReady, profileAddress, performLoad, addToast, loadSavedConfigList, currentConfigName],
  );

  /** Updates a specific property within a layer's configuration. */
  const updateLayerConfig = useCallback((layerId, key, value) => {
    setLayerConfigs((prev) => ({
      ...prev,
      [String(layerId)]: { ...(prev[String(layerId)] || {}), [key]: value },
    }));
    setHasPendingChanges(true);
  }, []);

  /** Updates the assigned token for a specific layer. */
  const updateTokenAssignment = useCallback((layerId, tokenId) => {
    setTokenAssignments((prev) => ({ ...prev, [String(layerId)]: tokenId }));
    setHasPendingChanges(true);
  }, []);

  /** Stages a reaction configuration locally (doesn't save globally yet). */
  const updateSavedReaction = useCallback((eventType, reactionData) => {
    if (!eventType || !reactionData) return;
    setSavedReactions((prev) => ({ ...prev, [eventType]: reactionData }));
    setHasPendingChanges(true);
    console.log(`[useConfigState] Staged reaction for event: ${eventType}`);
  }, []);

  /** Removes a locally staged reaction configuration. */
  const deleteSavedReaction = useCallback((eventType) => {
    if (!eventType) return;
    setSavedReactions((prev) => {
      const newState = { ...prev };
      if (newState[eventType]) {
        delete newState[eventType];
        setHasPendingChanges(true);
        console.log(`[useConfigState] Removed staged reaction for event: ${eventType}`);
        return newState;
      }
      return prev;
    });
  }, []);

    return {
        configServiceReady,
        configServiceRef,
        currentConfigName,
        layerConfigs,
        tokenAssignments,
        savedReactions,
        midiMap,
        isLoading, // Changed from isConfigLoading
        loadError,
        isSaving,
        saveError,
        saveSuccess,
        hasPendingChanges,
        savedConfigList,
        isInitiallyResolved,
        configLoadNonce,
        saveVisualPreset: saveCurrentConfig, // Use the modified function
        saveGlobalReactions,
        saveGlobalMidiMap,
        loadNamedConfig: (name) =>
          performLoad(profileAddress, name, null, `load:${name}`),
        loadDefaultConfig: () =>
          performLoad(profileAddress, null, null, "load:default"),
        loadSavedConfigList,
        deleteNamedConfig,
        updateLayerConfig,
        updateTokenAssignment,
        updateSavedReaction,
        deleteSavedReaction,
        updateMidiMap,
        setHasPendingChanges,
      };
};

export default useConfigState;