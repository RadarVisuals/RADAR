import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useUpProvider } from "../context/UpProvider";
import ConfigurationService from "../services/ConfigurationService";
import { useToast } from "../context/ToastContext";
import {
  RADAR_EVENT_REACTIONS_KEY,
  RADAR_MIDI_MAP_KEY,
} from "../config/global-config";
import { stringToHex } from "viem";

// Helper functions (assuming they are defined elsewhere or replace with actual implementations)
const transformStringListToObjects = (list) => {
    if (!Array.isArray(list)) return [];
    return list.filter(item => typeof item === 'string').map(name => ({ name }));
};
const ensureCompleteLayerConfig = (layerConfig, defaultLayerConfig) => {
    const completeConfig = { ...defaultLayerConfig };
    if (layerConfig && typeof layerConfig === 'object') {
        for (const key in layerConfig) {
            if (Object.hasOwnProperty.call(layerConfig, key) && layerConfig[key] !== null && layerConfig[key] !== undefined) {
                completeConfig[key] = layerConfig[key];
            }
            if (key === 'driftState' && typeof layerConfig[key] === 'object') {
                 completeConfig[key] = { ...defaultLayerConfig.driftState, ...layerConfig[key] };
            }
        }
    }
    if (typeof completeConfig.enabled !== 'boolean') {
        completeConfig.enabled = defaultLayerConfig.enabled;
    }
    return completeConfig;
};
const getDefaultLayerConfigTemplate = () => ({
    enabled: true, blendMode: 'normal', opacity: 1.0, size: 1.0,
    speed: 0.01, drift: 0, driftSpeed: 0.1, angle: 0,
    xaxis: 0, yaxis: 0, direction: 1,
    driftState: { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false },
});


/**
 * @typedef {object} ConfigStateAPI The interface returned by the useConfigState hook.
 * @property {boolean} configServiceInstanceReady - Indicates if the ConfigurationService is ready for reads.
 * @property {React.RefObject<ConfigurationService | null>} configServiceRef - Ref to the ConfigurationService instance.
 * @property {string | null} currentConfigName - Name of the currently loaded preset.
 * @property {object} layerConfigs - Configuration object for all visual layers.
 * @property {object} tokenAssignments - Object mapping layer IDs to assigned token identifiers.
 * @property {object} savedReactions - Configuration object for event reactions.
 * @property {object} midiMap - Configuration object for MIDI mappings.
 * @property {boolean} isLoading - True if configuration is currently being loaded.
 * @property {Error | string | null} loadError - Error object or message from the last load attempt.
 * @property {boolean} isSaving - True if configuration is currently being saved.
 * @property {Error | string | null} saveError - Error object or message from the last save attempt.
 * @property {boolean} saveSuccess - True if the last save operation was successful.
 * @property {boolean} hasPendingChanges - True if the current configuration has unsaved modifications.
 * @property {Array<{name: string}>} savedConfigList - List of saved preset names.
 * @property {boolean} isInitiallyResolved - True once the initial configuration load attempt has completed (success or fail).
 * @property {number} configLoadNonce - A counter that increments upon successful configuration load/application.
 * @property {(nameToSave: string, setAsDefault: boolean, includeReactions: boolean, includeMidi: boolean) => Promise<{success: boolean, error?: string}>} saveVisualPreset - Saves the current visual preset.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalReactions - Saves only the global event reactions.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalMidiMap - Saves only the global MIDI map.
 * @property {(name: string) => Promise<{success: boolean, error?: string, config?: object | null}>} loadNamedConfig - Loads a specific named preset.
 * @property {() => Promise<{success: boolean, error?: string, config?: object | null}>} loadDefaultConfig - Loads the default preset for the profile.
 * @property {() => Promise<{success: boolean, list?: Array<{name: string}>, error?: string}>} loadSavedConfigList - Reloads the list of saved presets.
 * @property {(nameToDelete: string) => Promise<{success: boolean, error?: string}>} deleteNamedConfig - Deletes a named preset.
 * @property {(layerId: string | number, key: string, value: any) => void} updateLayerConfig - Updates a specific property within a layer's configuration.
 * @property {(layerId: string | number, tokenId: string | object | null) => void} updateTokenAssignment - Updates the token assigned to a layer.
 * @property {(eventType: string, reactionData: object) => void} updateSavedReaction - Adds or updates a specific event reaction configuration.
 * @property {(eventType: string) => void} deleteSavedReaction - Removes an event reaction configuration.
 * @property {(newMap: object) => void} updateMidiMap - Replaces the entire MIDI map configuration.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setHasPendingChanges - Manually sets the pending changes flag.
 */

/**
 * Custom hook to manage the application's configuration state, including loading from
 * and saving to a Universal Profile's ERC725Y storage via ConfigurationService.
 *
 * @param {string|null} currentProfileAddress The address of the profile being viewed/interacted with.
 * @returns {ConfigStateAPI} An object containing configuration state and management functions.
 */
const useConfigState = (currentProfileAddress) => {
  const {
      provider, walletClient, publicClient,
      isConnecting: upIsConnecting,
      // upInitializationError, // Not directly used in this hook
      // upFetchStateError, // Not directly used in this hook
      hasCriticalError: upHasCriticalError
  } = useUpProvider();

  const { addToast } = useToast();
  const configServiceRef = useRef(null);
  const initialLoadCompletedForRef = useRef(undefined);
  const prevProfileAddressRef = useRef(currentProfileAddress);

  // --- State Variables ---
  const [currentConfigName, setCurrentConfigName] = useState(null);
  const [layerConfigs, setLayerConfigs] = useState({});
  const [tokenAssignments, setTokenAssignments] = useState({});
  const [savedReactions, setSavedReactions] = useState({});
  const [midiMap, setMidiMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isInitiallyResolved, setIsInitiallyResolved] = useState(false);
  const [configLoadNonce, setConfigLoadNonce] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [savedConfigList, setSavedConfigList] = useState([]);

  const isUpProviderStableForRead = useMemo(() => {
      return !!publicClient && !upIsConnecting && !upHasCriticalError;
  }, [publicClient, upIsConnecting, upHasCriticalError]);

  // Effect to manage ConfigurationService instance AND update its clients
  useEffect(() => {
    if (provider && !configServiceRef.current) {
        configServiceRef.current = new ConfigurationService(provider, walletClient, publicClient);
    }
    if (configServiceRef.current) {
        if (configServiceRef.current.publicClient !== publicClient) {
            configServiceRef.current.publicClient = publicClient;
        }
        if (configServiceRef.current.walletClient !== walletClient) {
            configServiceRef.current.walletClient = walletClient;
        }
        configServiceRef.current.checkReadyForRead();
        configServiceRef.current.checkReadyForWrite();
    }
  }, [provider, publicClient, walletClient]);

  const configServiceInstanceReady = useMemo(() => {
      return !!configServiceRef.current && isUpProviderStableForRead;
  }, [isUpProviderStableForRead]);

  // Process loaded data into state
  const applyLoadedData = useCallback(
    (loadedData, reason = "unknown", loadedForAddress, targetName = null) => {
      setLoadError(null);
      const completionMarker = loadedForAddress;

      if (loadedData?.error) {
        setLoadError(loadedData.error);
        addToast(`Error loading configuration: ${loadedData.error}`, 'error');
        setLayerConfigs({}); setTokenAssignments({});
        setSavedReactions({}); setMidiMap({});
        setCurrentConfigName(null); setHasPendingChanges(false);
      } else if (loadedData) {
        const finalName = loadedData.config?.name ?? targetName ?? null;
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
        if (finalName !== currentConfigName) setCurrentConfigName(finalName);
        setHasPendingChanges(false);
        setConfigLoadNonce(prevNonce => prevNonce + 1);
      } else if (loadedData === null && (reason === "address_cleared" || reason === "no_target_address")) {
          setLayerConfigs({}); setTokenAssignments({});
          setSavedReactions({}); setMidiMap({});
          setCurrentConfigName(null); setHasPendingChanges(false);
          if (reason === "address_cleared") {
              setConfigLoadNonce(0); setIsInitiallyResolved(false);
              initialLoadCompletedForRef.current = undefined; setIsLoading(true);
              return;
          }
      } else {
          if (reason === 'initial' || reason === 'load:default' || reason === 'service_not_ready_initial') {
              setLayerConfigs({}); setTokenAssignments({});
              setSavedReactions({}); setMidiMap({});
              setCurrentConfigName(null); setHasPendingChanges(false);
          }
      }

      if (!isInitiallyResolved) {
          setIsInitiallyResolved(true);
          initialLoadCompletedForRef.current = completionMarker;
      }
      setIsLoading(false);
    }, [addToast, currentConfigName, isInitiallyResolved]);

  // Load saved config list
  const loadSavedConfigList = useCallback(async () => {
    const service = configServiceRef.current;
    const addressToLoad = currentProfileAddress;
    const isReady = !!service && isUpProviderStableForRead;
    if (!isReady || !addressToLoad) {
        const errorMsg = !isReady ? "Service not ready." : "No profile address.";
        addToast(errorMsg, "warning"); setSavedConfigList([]);
        return { success: false, error: errorMsg };
    }
    try {
      const stringList = await service.loadSavedConfigurations(addressToLoad);
      const objectList = transformStringListToObjects(stringList);
      setSavedConfigList(objectList);
      return { success: true, list: objectList };
    } catch (error) {
      addToast(`Failed to load preset list: ${error.message}`, 'error');
      setSavedConfigList([]);
      return { success: false, error: error.message || "Failed to load list." };
    }
  }, [currentProfileAddress, addToast, isUpProviderStableForRead, configServiceRef]);

  // Base function to perform configuration loading
  const performLoad = useCallback(
    async (address, configName = null, customKey = null, reason = "manual") => {
      const service = configServiceRef.current;
      const isReady = !!service && isUpProviderStableForRead;
      if (!isReady || !address) {
          const errorMsg = !isReady ? "Service not ready." : "No address provided.";
          addToast(errorMsg, "warning"); setIsLoading(false);
          return { success: false, error: errorMsg };
      }
      const targetName = configName || "Default";
      setIsLoading(true); setLoadError(null);
      try {
        const loadedData = await service.loadConfiguration(address, configName, customKey);
        applyLoadedData(loadedData, reason, address, targetName);
        const loadSuccessful = !loadedData?.error;
        if (loadSuccessful) { loadSavedConfigList().catch(() => {}); }
        return { success: loadSuccessful, error: loadedData?.error, config: loadedData?.config };
      } catch (error) {
        const errorMsg = error.message || "Unknown load error";
        applyLoadedData({ error: errorMsg }, reason, address, targetName);
        return { success: false, error: errorMsg };
      }
    },
    [isUpProviderStableForRead, applyLoadedData, addToast, loadSavedConfigList, configServiceRef] // Added configServiceRef
  );

  // --- Initial Load Effect ---
  useEffect(() => {
    const addressToLoad = currentProfileAddress;
    const serviceReady = configServiceInstanceReady;
    if (addressToLoad !== prevProfileAddressRef.current) {
        prevProfileAddressRef.current = addressToLoad;
        initialLoadCompletedForRef.current = undefined;
        setIsInitiallyResolved(false);
        setSavedConfigList([]); setConfigLoadNonce(0); setCurrentConfigName(null);
        setLayerConfigs({}); setTokenAssignments({}); setSavedReactions({}); setMidiMap({});
        setIsLoading(true); setLoadError(null);
    }
    const hasLoadCompletedForThisAddress = initialLoadCompletedForRef.current === addressToLoad;
    const shouldAttemptLoad = serviceReady && !hasLoadCompletedForThisAddress && isLoading;
    if (shouldAttemptLoad) {
        if (addressToLoad) {
            performLoad(addressToLoad, null, null, "initial")
                .then(({ success }) => {
                    if (!success && !isInitiallyResolved) {
                        setIsInitiallyResolved(true);
                        initialLoadCompletedForRef.current = addressToLoad;
                    }
                })
                .catch((err) => {
                    addToast(`Failed initial configuration load: ${err.message}`, 'error');
                    applyLoadedData({ error: err.message || "Unknown initial load error" }, "initial", addressToLoad);
                });
        } else {
             applyLoadedData(null, "no_target_address", null);
        }
    } else if (isLoading && isInitiallyResolved && hasLoadCompletedForThisAddress) {
         setIsLoading(false);
    }
  }, [currentProfileAddress, configServiceInstanceReady, performLoad, applyLoadedData, addToast, isLoading, isInitiallyResolved]);


  // --- Save/Delete/Update functions (use currentProfileAddress) ---
  const saveCurrentConfig = useCallback(
    async (nameToSave, setAsDefault, includeReactions, includeMidi) => {
      const service = configServiceRef.current;
      const addressToSave = currentProfileAddress;
      const isReady = !!service && isUpProviderStableForRead && service.checkReadyForWrite();
      if (!isReady || !addressToSave) {
          const errorMsg = !isReady ? "Write service not ready." : "No profile address.";
          addToast(errorMsg, "error"); return { success: false, error: errorMsg };
      }
      if (!nameToSave?.trim()) {
          addToast("Preset name cannot be empty.", "warning"); return { success: false, error: "Preset name required." };
      }
      setIsSaving(true); setSaveError(null); setSaveSuccess(false);
      const defaultLayerTemplate = getDefaultLayerConfigTemplate();
      const completeLayerConfigsForSave = {};
      for (const layerId of ['1', '2', '3']) { completeLayerConfigsForSave[layerId] = ensureCompleteLayerConfig(layerConfigs[layerId] || {}, defaultLayerTemplate); }
      const dataToSave = { layers: completeLayerConfigsForSave, tokenAssignments, reactions: includeReactions ? savedReactions : undefined, midi: includeMidi ? midiMap : undefined };
      try {
        const result = await service.saveConfiguration( addressToSave, dataToSave, nameToSave, setAsDefault, true, includeReactions, includeMidi, null );
        if (result.success) {
            addToast(`Preset '${nameToSave}' saved successfully!`, 'success');
            setSaveSuccess(true); setHasPendingChanges(false);
            setCurrentConfigName(nameToSave); loadSavedConfigList().catch(() => {});
        } else { throw new Error(result.error || "Save configuration failed."); }
        setIsSaving(false); return result;
      } catch (error) {
        const errorMsg = error.message || "Unknown save error."; setSaveError(errorMsg);
        addToast(`Error saving preset: ${errorMsg}`, 'error'); setIsSaving(false);
        setSaveSuccess(false); return { success: false, error: errorMsg };
      }
    }, [currentProfileAddress, layerConfigs, tokenAssignments, savedReactions, midiMap, addToast, loadSavedConfigList, isUpProviderStableForRead, configServiceRef],
  );
  const saveGlobalReactions = useCallback(async () => {
     const service = configServiceRef.current;
     const addressToSave = currentProfileAddress;
     const isReady = !!service && isUpProviderStableForRead && service.checkReadyForWrite();
     if (!isReady || !addressToSave) {
         const errorMsg = !isReady ? "Write service not ready." : "No profile address.";
         addToast(errorMsg, "error"); return { success: false, error: errorMsg };
     }
     setIsSaving(true); setSaveError(null); setSaveSuccess(false);
     try {
         const dataKey = RADAR_EVENT_REACTIONS_KEY; const dataToSave = savedReactions || {};
         const jsonString = JSON.stringify(dataToSave); const hexValue = stringToHex(jsonString);
         const result = await service.saveDataToKey(addressToSave, dataKey, hexValue);
         if (result.success) {
            addToast(`Global reactions saved successfully!`, 'success');
            setSaveSuccess(true); setHasPendingChanges(false);
         } else { throw new Error(result.error || "Save reactions failed."); }
         setIsSaving(false); return result;
     } catch (error) {
        const errorMsg = error.message || `Unknown reactions save error.`; setSaveError(errorMsg);
        addToast(`Error saving reactions: ${errorMsg}`, 'error'); setIsSaving(false);
        setSaveSuccess(false); return { success: false, error: errorMsg };
     }
  }, [currentProfileAddress, savedReactions, addToast, isUpProviderStableForRead, configServiceRef]);

  const saveGlobalMidiMap = useCallback(async () => {
     const service = configServiceRef.current;
     const addressToSave = currentProfileAddress;
     const isReady = !!service && isUpProviderStableForRead && service.checkReadyForWrite();
     if (!isReady || !addressToSave) {
         const errorMsg = !isReady ? "Write service not ready." : "No profile address.";
         addToast(errorMsg, "error"); return { success: false, error: errorMsg };
     }
    setIsSaving(true); setSaveError(null); setSaveSuccess(false);
     try {
        const dataKey = RADAR_MIDI_MAP_KEY; const dataToSave = midiMap || {};
        const jsonString = JSON.stringify(dataToSave); const hexValue = stringToHex(jsonString);
        const result = await service.saveDataToKey(addressToSave, dataKey, hexValue);
        if (result.success) {
            addToast(`Global MIDI map saved successfully!`, 'success');
            setSaveSuccess(true); setHasPendingChanges(false);
         } else { throw new Error(result.error || "Save MIDI map failed."); }
         setIsSaving(false); return result;
     } catch (error) {
        const errorMsg = error.message || `Unknown MIDI save error.`; setSaveError(errorMsg);
        addToast(`Error saving MIDI map: ${errorMsg}`, 'error'); setIsSaving(false);
        setSaveSuccess(false); return { success: false, error: errorMsg };
     }
  }, [currentProfileAddress, midiMap, addToast, isUpProviderStableForRead, configServiceRef]);

  const deleteNamedConfig = useCallback(
    async (nameToDelete) => {
      const service = configServiceRef.current;
      const addressToDeleteFrom = currentProfileAddress;
      const isReady = !!service && isUpProviderStableForRead && service.checkReadyForWrite();
      if (!isReady || !addressToDeleteFrom) {
          const errorMsg = !isReady ? "Write service not ready." : "No profile address.";
          addToast(errorMsg, "error"); return { success: false, error: errorMsg };
      }
      if (!nameToDelete) {
          addToast("No preset name provided to delete.", "warning"); return { success: false, error: "No name provided." };
      }
      setIsSaving(true); setSaveError(null); // Indicate processing
      try {
          const result = await service.deleteConfiguration(addressToDeleteFrom, nameToDelete);
          if (result.success) {
              addToast(`Preset '${nameToDelete}' deleted.`, 'success');
              setSaveSuccess(true);
              await loadSavedConfigList();
              if (currentConfigName === nameToDelete) {
                await performLoad(addressToDeleteFrom, null, null, `delete_cleanup:${nameToDelete}`);
              }
          } else { throw new Error(result.error || "Delete operation failed."); }
          setIsSaving(false);
          return result;
      } catch (error) {
          const errorMsg = error.message || "Unknown delete error."; setSaveError(errorMsg);
          addToast(`Error deleting preset: ${errorMsg}`, 'error'); setIsSaving(false);
          return { success: false, error: errorMsg };
      }
    },
    [currentProfileAddress, performLoad, addToast, loadSavedConfigList, currentConfigName, isUpProviderStableForRead, configServiceRef],
  );

  // --- State Update Callbacks ---
  const updateLayerConfig = useCallback((layerId, key, value) => {
      setLayerConfigs((prev) => ({ ...prev, [String(layerId)]: { ...(prev[String(layerId)] || {}), [key]: value }, }));
      setHasPendingChanges(true);
  }, []);
  const updateTokenAssignment = useCallback((layerId, tokenId) => {
      setTokenAssignments((prev) => ({ ...prev, [String(layerId)]: tokenId }));
      setHasPendingChanges(true);
  }, []);
  const updateSavedReaction = useCallback((eventType, reactionData) => {
      if (!eventType || !reactionData) return;
      setSavedReactions((prev) => ({ ...prev, [eventType]: reactionData }));
      setHasPendingChanges(true);
  }, []);
  const deleteSavedReaction = useCallback((eventType) => {
    if (!eventType) return;
    setSavedReactions((prev) => {
      const newState = { ...prev };
      if (newState[eventType]) { delete newState[eventType]; setHasPendingChanges(true); return newState; }
      return prev;
    });
  }, []);
  const updateMidiMap = useCallback((newMap) => {
    setMidiMap(newMap); setHasPendingChanges(true);
  }, []);

  // --- Define stable load functions OUTSIDE useMemo ---
  const loadNamedConfig = useCallback((name) =>
    performLoad(currentProfileAddress, name, null, `load:${name}`),
    [performLoad, currentProfileAddress]
  );

  const loadDefaultConfig = useCallback(() =>
    performLoad(currentProfileAddress, null, null, "load:default"),
    [performLoad, currentProfileAddress]
  );

  // --- Memoize the final context state ---
  const contextState = useMemo(() => ({
      configServiceInstanceReady,
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
      loadNamedConfig, // Include stable function
      loadDefaultConfig, // Include stable function
      loadSavedConfigList,
      deleteNamedConfig,
      updateLayerConfig,
      updateTokenAssignment,
      updateSavedReaction,
      deleteSavedReaction,
      updateMidiMap,
      setHasPendingChanges,
  }), [
      configServiceInstanceReady, configServiceRef, currentConfigName, layerConfigs,
      tokenAssignments, savedReactions, midiMap, isLoading, loadError, isSaving,
      saveError, saveSuccess, hasPendingChanges, savedConfigList, isInitiallyResolved,
      configLoadNonce, saveCurrentConfig, saveGlobalReactions, saveGlobalMidiMap,
      loadNamedConfig, loadDefaultConfig, // Include stable functions in dependency array
      loadSavedConfigList, deleteNamedConfig, updateLayerConfig, updateTokenAssignment,
      updateSavedReaction, deleteSavedReaction, updateMidiMap, setHasPendingChanges
  ]);

  return contextState;
};

export default useConfigState;