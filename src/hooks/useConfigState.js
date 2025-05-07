// src/hooks/useConfigState.js (Cleaned)
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
    const completeConfig = { ...defaultLayerConfig };
    for (const key in layerConfig) {
        if (Object.hasOwnProperty.call(layerConfig, key) && (layerConfig[key] !== null && layerConfig[key] !== undefined)) {
            completeConfig[key] = layerConfig[key];
        }
        if (key === 'driftState' && typeof layerConfig[key] === 'object') {
             completeConfig[key] = { ...defaultLayerConfig.driftState, ...layerConfig[key] };
        }
    }
    if (typeof completeConfig.enabled !== 'boolean') {
        completeConfig.enabled = defaultLayerConfig.enabled;
    }
    return completeConfig;
};

// Helper to get a default config structure
const getDefaultLayerConfigTemplate = () => ({
    enabled: true, blendMode: 'normal', opacity: 1.0, size: 1.0,
    speed: 0.01, drift: 0, driftSpeed: 0.1, angle: 0,
    xaxis: 0, yaxis: 0, direction: 1,
    driftState: { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false },
});

/**
 * Manages the core configuration state of the application, including layer settings,
 * token assignments, MIDI mappings, event reactions, and preset management (load, save, delete).
 * It interacts with the ConfigurationService to persist and retrieve data from the
 * user's Universal Profile based on the provided profileAddress. It also handles
 * loading status, errors, pending changes, and triggers updates via a nonce.
 *
 * @param {string | null} profileAddress - The address of the Universal Profile whose configuration is being managed.
 * @returns {{...}} An object containing the configuration state and associated actions.
 */
const useConfigState = (profileAddress) => {
  const { provider, walletClient, publicClient } = useUpProvider();
  const { addToast } = useToast();
  const configServiceRef = useRef(null);
  const [configServiceReadyForRead, setConfigServiceReadyForRead] = useState(false);
  const [configServiceReadyForWrite, setConfigServiceReadyForWrite] = useState(false);
  const [currentConfigName, setCurrentConfigName] = useState(null);
  const [layerConfigs, setLayerConfigs] = useState({});
  const [tokenAssignments, setTokenAssignments] = useState({});
  const [savedReactions, setSavedReactions] = useState({});
  const [midiMap, setMidiMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
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

  // Service Initialization Effect
  useEffect(() => {
    const isReadClientReady = !!publicClient;
    const isWriteClientReady = !!publicClient && !!walletClient;

    setConfigServiceReadyForRead(isReadClientReady);
    setConfigServiceReadyForWrite(isWriteClientReady);

    if (isReadClientReady && !configServiceRef.current) {
      const service = new ConfigurationService(provider, walletClient, publicClient);
      service.initialize().then(() => {
          configServiceRef.current = service;
      }).catch(err => {
          console.error("[useConfigState] Error during async ConfigurationService init (if any):", err); // Keep Error
          setConfigServiceReadyForRead(false);
          setConfigServiceReadyForWrite(false);
      });
    } else if (isReadClientReady && configServiceRef.current) {
      configServiceRef.current.publicClient = publicClient;
      configServiceRef.current.walletClient = walletClient;
      configServiceRef.current.initialized = true;
    } else if (!isReadClientReady && configServiceRef.current) {
      configServiceRef.current = null;
      setIsInitiallyResolved(false);
      initialLoadPerformedRef.current = false;
      setSavedConfigList([]);
      setCurrentConfigName(null);
    }
  }, [publicClient, walletClient, provider]);

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

      setLoadError(null);

      if (loadedData?.error) {
        console.error(`${logPrefix} Load error received:`, loadedData.error); // Keep Error
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

        const defaultLayerTemplate = getDefaultLayerConfigTemplate();
        const completeLayers = {};
         for (const layerId of ['1', '2', '3']) {
            completeLayers[layerId] = ensureCompleteLayerConfig(newLayers[layerId], defaultLayerTemplate);
        }

        setLayerConfigs(completeLayers);
        setTokenAssignments(newTokens);
        setSavedReactions(newReactions);
        setMidiMap(newMidi);

        if (finalName !== currentConfigName) {
            setCurrentConfigName(finalName);
        }

        setHasPendingChanges(false);
        setConfigLoadNonce(prevNonce => prevNonce + 1);

      } else {
        // Clearing data
        setLayerConfigs({});
        setTokenAssignments({});
        setSavedReactions({});
        setMidiMap({});
        setCurrentConfigName(null);
        setHasPendingChanges(false);
        setConfigLoadNonce(0);
      }

      // Set resolved state AFTER applying data
      if (!isInitiallyResolved) {
          setIsInitiallyResolved(true);
      }
      if (reason === "initial") {
        initialLoadPerformedRef.current = true;
      } else if (reason.startsWith("load:") && loadedData) {
         addToast(`Loaded preset: ${finalName}`, 'success', 3000);
      }
    },
    [addToast, currentConfigName, isInitiallyResolved],
  );

  /** Fetches the list of saved configuration names from the profile. */
  const loadSavedConfigList = useCallback(async () => {
    if (!configServiceReadyForRead || !configServiceRef.current) {
        addToast("Configuration service not ready for reading.", "warning");
        return { success: false, error: "Service not ready for reading." };
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
      console.error("[useConfigState loadSavedConfigList] Error:", error); // Keep Error
      addToast(`Failed to load preset list: ${error.message}`, 'error');
      setSavedConfigList([]);
      return { success: false, error: error.message || "Failed to load list." };
    }
  }, [configServiceReadyForRead, profileAddress, addToast]);

  /** Core function to load configuration (default or named). */
  const performLoad = useCallback(
    async (address, configName = null, customKey = null, reason = "manual") => {
      if (!configServiceReadyForRead || !configServiceRef.current) {
          addToast("Configuration service not ready for reading.", "warning");
          return { success: false, error: "Service not ready for reading." };
      }
      if (!address) {
          addToast("No profile address selected.", "error");
          return { success: false, error: "No address." };
      }

      const targetName = configName || "Default";
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
          loadSavedConfigList().catch(err => console.error("Error refreshing list after load:", err)); // Keep Error
        }
        return { success: loadSuccessful, error: loadedData?.error, config: loadedData?.config };
      } catch (error) {
        console.error(`[useConfigState performLoad] Unexpected load error:`, error); // Keep Error
        const errorMsg = error.message || "Unknown load error";
        applyLoadedData({ error: errorMsg }, reason, address, targetName);
        setIsLoading(false);
        return { success: false, error: errorMsg };
      }
    },
    [configServiceReadyForRead, applyLoadedData, addToast, loadSavedConfigList],
  );

  // Initial Load Effect
  useEffect(() => {
    const logPrefix = `[useConfigState AutoLoad Addr:${profileAddress?.slice(0, 6)}]`;
    const shouldLoad = profileAddress && configServiceReadyForRead && !initialLoadPerformedRef.current;

    if (initialLoadTimeoutRef.current) {
        clearTimeout(initialLoadTimeoutRef.current);
        initialLoadTimeoutRef.current = null;
    }

    if (shouldLoad) {
        initialLoadTimeoutRef.current = setTimeout(() => {
            initialLoadPerformedRef.current = true;
            setIsInitiallyResolved(false); // Reset before load
            performLoad(profileAddress, null, null, "initial")
                .then(({ success }) => {
                    if (success) {
                        loadSavedConfigList().catch(err => console.error("Error loading list after initial load:", err)); // Keep Error
                    }
                })
                .catch((err) => {
                    console.error(`${logPrefix} Uncaught initial load error via setTimeout:`, err); // Keep Error
                    addToast(`Failed initial configuration load: ${err.message}`, 'error');
                    setIsInitiallyResolved(true); // Ensure UI unblocks on critical failure
                })
                .finally(() => {
                    initialLoadTimeoutRef.current = null;
                });
        }, 100);

    } else if (!profileAddress) {
       // Reset logic when address is cleared
       if (initialLoadPerformedRef.current || isInitiallyResolved) {
         applyLoadedData(null, "address_cleared", null);
         setIsInitiallyResolved(false);
         initialLoadPerformedRef.current = false;
         setSavedConfigList([]);
         setConfigLoadNonce(0);
       }
    } // No need for else logging 'why not'

    return () => {
        if (initialLoadTimeoutRef.current) {
            clearTimeout(initialLoadTimeoutRef.current);
            initialLoadTimeoutRef.current = null;
        }
    };
  }, [profileAddress, configServiceReadyForRead, isInitiallyResolved, performLoad, applyLoadedData, addToast, loadSavedConfigList]);


  /** Saves the current visual preset and optionally global settings. */
  const saveCurrentConfig = useCallback(
    async (nameToSave, setAsDefault, includeReactions, includeMidi) => {
      if (!configServiceReadyForWrite || !configServiceRef.current) {
          addToast("Cannot save: Wallet not connected or service not ready.", "error");
          return { success: false, error: "Write service not ready." };
      }
      if (!profileAddress) {
          addToast("No profile address selected.", "error");
          return { success: false, error: "No profile address." };
      }
      if (!nameToSave?.trim()) {
          addToast("Preset name cannot be empty.", "warning");
          return { success: false, error: "Preset name required." };
      }

      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const defaultLayerTemplate = getDefaultLayerConfigTemplate();
      const completeLayerConfigsForSave = {};
      for (const layerId of ['1', '2', '3']) {
          const currentLayerState = layerConfigs[layerId] || {};
          completeLayerConfigsForSave[layerId] = ensureCompleteLayerConfig(currentLayerState, defaultLayerTemplate);
      }

      const dataToSave = {
        layers: completeLayerConfigsForSave,
        tokenAssignments: tokenAssignments,
        reactions: includeReactions ? savedReactions : undefined,
        midi: includeMidi ? midiMap : undefined,
      };

      try {
        const result = await configServiceRef.current.saveConfiguration(
          profileAddress, dataToSave, nameToSave, setAsDefault, true, includeReactions, includeMidi, null
        );
        if (result.success) {
          addToast(`Preset '${nameToSave}' saved successfully!`, 'success');
          setSaveSuccess(true);
          setHasPendingChanges(false);
          setCurrentConfigName(nameToSave);
          loadSavedConfigList().catch(err => console.error("Error refreshing list after save:", err)); // Keep Error
        } else {
          throw new Error(result.error || "Save configuration failed.");
        }
        setIsSaving(false);
        return result;
      } catch (error) {
        console.error(`[useConfigState saveCurrentConfig] Save failed:`, error); // Keep Error
        const errorMsg = error.message || "Unknown save error.";
        setSaveError(errorMsg);
        addToast(`Error saving preset: ${errorMsg}`, 'error');
        setIsSaving(false);
        setSaveSuccess(false);
        return { success: false, error: errorMsg };
      }
    },
    [configServiceReadyForWrite, profileAddress, layerConfigs, tokenAssignments, savedReactions, midiMap, addToast, loadSavedConfigList],
  );

  /** Saves only the current event reaction settings globally. */
  const saveGlobalReactions = useCallback(async () => {
     if (!configServiceReadyForWrite || !configServiceRef.current) {
         addToast("Cannot save: Wallet not connected or service not ready.", "error");
         return { success: false, error: "Write service not ready." };
     }
     if (!profileAddress) {
         addToast("No profile address selected.", "error");
         return { success: false, error: "No profile address." };
     }
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
      console.error(`[useConfigState saveGlobalReactions] Save failed:`, error); // Keep Error
      const errorMsg = error.message || `Unknown reactions save error.`;
      setSaveError(errorMsg);
      addToast(`Error saving reactions: ${errorMsg}`, 'error');
      setIsSaving(false);
      setSaveSuccess(false);
      return { success: false, error: errorMsg };
    }
  }, [configServiceReadyForWrite, profileAddress, savedReactions, addToast]);

  /** Saves only the current MIDI map settings globally. */
  const saveGlobalMidiMap = useCallback(async () => {
     if (!configServiceReadyForWrite || !configServiceRef.current) {
         addToast("Cannot save: Wallet not connected or service not ready.", "error");
         return { success: false, error: "Write service not ready." };
     }
     if (!profileAddress) {
         addToast("No profile address selected.", "error");
         return { success: false, error: "No profile address." };
     }
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
      console.error(`[useConfigState saveGlobalMidiMap] Save failed:`, error); // Keep Error
      const errorMsg = error.message || `Unknown MIDI save error.`;
      setSaveError(errorMsg);
      addToast(`Error saving MIDI map: ${errorMsg}`, 'error');
      setIsSaving(false);
      setSaveSuccess(false);
      return { success: false, error: errorMsg };
    }
  }, [configServiceReadyForWrite, profileAddress, midiMap, addToast]);

  /** Deletes a named configuration preset from the profile. */
  const deleteNamedConfig = useCallback(
    async (nameToDelete) => {
      if (!configServiceReadyForWrite || !configServiceRef.current) {
          addToast("Cannot delete: Wallet not connected or service not ready.", "error");
          return { success: false, error: "Write service not ready." };
      }
      if (!profileAddress) {
          addToast("No profile address selected.", "error");
          return { success: false, error: "No profile address." };
      }
      if (!nameToDelete) {
           addToast("No preset name provided to delete.", "warning");
           return { success: false, error: "No name provided." };
      }

      setIsSaving(true);
      setSaveError(null);

      try {
        const result = await configServiceRef.current.deleteConfiguration(profileAddress, nameToDelete);
        if (result.success) {
          addToast(`Preset '${nameToDelete}' deleted.`, 'success');
          setSaveSuccess(true);
          await loadSavedConfigList();
          if (currentConfigName === nameToDelete) {
              await performLoad(profileAddress, null, null, `delete_cleanup:${nameToDelete}`);
          }
        } else {
          throw new Error(result.error || "Delete operation failed.");
        }
        setIsSaving(false);
        return result;
      } catch (error) {
        console.error(`[useConfigState delete] Delete failed:`, error); // Keep Error
        const errorMsg = error.message || "Unknown delete error.";
        setSaveError(errorMsg);
        addToast(`Error deleting preset: ${errorMsg}`, 'error');
        setIsSaving(false);
        return { success: false, error: errorMsg };
      }
    },
    [configServiceReadyForWrite, profileAddress, performLoad, addToast, loadSavedConfigList, currentConfigName],
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
  }, []);

  /** Removes a locally staged reaction configuration. */
  const deleteSavedReaction = useCallback((eventType) => {
    if (!eventType) return;
    setSavedReactions((prev) => {
      const newState = { ...prev };
      if (newState[eventType]) {
        delete newState[eventType];
        setHasPendingChanges(true);
        return newState;
      }
      return prev;
    });
  }, []);

    // Return state and functions
    return {
        configServiceReady: configServiceReadyForRead, // Indicate general readiness based on read capability
        // configServiceReadyForWrite, // Can expose if needed
        configServiceRef,
        currentConfigName,
        layerConfigs,
        tokenAssignments,
        savedReactions,
        midiMap,
        isLoading,
        loadError,
        isSaving,
        saveError,
        saveSuccess,
        hasPendingChanges,
        savedConfigList,
        isInitiallyResolved,
        configLoadNonce,
        saveVisualPreset: saveCurrentConfig,
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