// src/hooks/useConfigState.js
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useUpProvider } from "../context/UpProvider";
import ConfigurationService from "../services/ConfigurationService";
import { useToast } from "../context/ToastContext";
import {
  RADAR_EVENT_REACTIONS_KEY,
  RADAR_MIDI_MAP_KEY,
} from "../config/global-config";
import { stringToHex } from "viem";
import fallbackConfig from "../config/fallback-config.js";

// Helper functions
const transformStringListToObjects = (list) => {
    if (!Array.isArray(list)) return [];
    return list.filter(item => typeof item === 'string').map(name => ({ name }));
};

// This function is now primarily for ensuring the structure from loaded data is complete
// The actual default template for new/empty visual configs will live in VisualConfigContext
const ensureCompleteLayerConfigStructure = (layerConfig, defaultLayerConfigTemplate) => {
    const completeConfig = { ...defaultLayerConfigTemplate }; // Start with a basic template
    if (layerConfig && typeof layerConfig === 'object') {
        for (const key in layerConfig) {
            if (Object.hasOwnProperty.call(layerConfig, key) && layerConfig[key] !== null && layerConfig[key] !== undefined) {
                completeConfig[key] = layerConfig[key];
            }
            if (key === 'driftState' && typeof layerConfig[key] === 'object' && defaultLayerConfigTemplate.driftState) {
                 completeConfig[key] = { ...defaultLayerConfigTemplate.driftState, ...layerConfig[key] };
            }
        }
    }
    if (typeof completeConfig.enabled !== 'boolean' && defaultLayerConfigTemplate.hasOwnProperty('enabled')) {
        completeConfig.enabled = defaultLayerConfigTemplate.enabled;
    }
    return completeConfig;
};

// Minimal template for structure checking, actual defaults are in VisualConfigContext
const getMinimalLayerConfigTemplate = () => ({
  enabled: true, blendMode: 'normal', opacity: 1.0, size: 1.0, speed: 0.01,
  drift: 0, driftSpeed: 0.1, angle: 0, xaxis: 0, yaxis: 0, direction: 1,
  driftState: { x: 0, y: 0, phase: 0, enabled: false },
});


/**
 * @typedef {object} ConfigStateAPI The interface returned by the useConfigState hook.
 * @property {boolean} configServiceInstanceReady - Indicates if the ConfigurationService is ready for reads.
 * @property {React.RefObject<ConfigurationService | null>} configServiceRef - Ref to the ConfigurationService instance.
 * @property {string | null} currentConfigName - Name of the currently loaded preset.
 * @property {object | null} loadedLayerConfigsFromPreset - Layer configurations from the most recently loaded preset (or fallback). This is for VisualConfigProvider.
 * @property {object | null} loadedTokenAssignmentsFromPreset - Token assignments from the most recently loaded preset (or fallback). This is for VisualConfigProvider.
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
 * @property {(nameToSave: string, setAsDefault: boolean, includeReactions: boolean, includeMidi: boolean, layerConfigsToSave: object, tokenAssignmentsToSave: object) => Promise<{success: boolean, error?: string}>} saveVisualPreset - Saves the current visual preset.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalReactions - Saves only the global event reactions.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalMidiMap - Saves only the global MIDI map.
 * @property {(name: string) => Promise<{success: boolean, error?: string, config?: object | null}>} loadNamedConfig - Loads a specific named preset.
 * @property {() => Promise<{success: boolean, error?: string, config?: object | null}>} loadDefaultConfig - Loads the default preset for the profile.
 * @property {() => Promise<{success: boolean, list?: Array<{name: string}>, error?: string}>} loadSavedConfigList - Reloads the list of saved presets.
 * @property {(nameToDelete: string) => Promise<{success: boolean, error?: string}>} deleteNamedConfig - Deletes a named preset.
 * @property {(eventType: string, reactionData: object) => void} updateSavedReaction - Adds or updates a specific event reaction configuration.
 * @property {(eventType: string) => void} deleteSavedReaction - Removes an event reaction configuration.
 * @property {(newMap: object) => void} updateMidiMap - Replaces the entire MIDI map configuration.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setHasPendingChanges - Manually sets the pending changes flag.
 */

/**
 * Custom hook to manage the application's configuration state, including loading from
 * and saving to a Universal Profile's ERC725Y storage via ConfigurationService.
 * This hook focuses on preset management, global settings (reactions, MIDI), and
 * providing loaded visual data for `VisualConfigContext`.
 *
 * @param {string|null} currentProfileAddress The address of the profile being viewed/interacted with.
 * @returns {ConfigStateAPI} An object containing configuration state and management functions.
 */
const useConfigState = (currentProfileAddress) => {
  const {
      provider, walletClient, publicClient,
      isConnecting: upIsConnecting,
      hasCriticalError: upHasCriticalError
  } = useUpProvider();

  const { addToast } = useToast();
  const configServiceRef = useRef(null);
  const initialLoadCompletedForRef = useRef(undefined);
  const prevProfileAddressRef = useRef(currentProfileAddress);

  // --- State Variables ---
  const [currentConfigName, setCurrentConfigName] = useState(null);
  // These two states will hold the data from the last loaded preset for VisualConfigProvider
  const [loadedLayerConfigsFromPreset, setLoadedLayerConfigsFromPreset] = useState(null);
  const [loadedTokenAssignmentsFromPreset, setLoadedTokenAssignmentsFromPreset] = useState(null);

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

  /**
   * Processes loaded data (from presets or fallback) and updates the relevant state variables.
   * This function is responsible for setting `loadedLayerConfigsFromPreset` and `loadedTokenAssignmentsFromPreset`,
   * which are then consumed by `VisualConfigProvider`.
   */
  const applyLoadedData = useCallback(
    (loadedData, reason = "unknown", loadedForAddress, targetName = null) => {
      setLoadError(null);
      const completionMarker = loadedForAddress;
      const minimalLayerTemplate = getMinimalLayerConfigTemplate(); // For structure check

      let finalName = null;
      let finalLayersForPreset = null; // Will be set to loaded data or fallback
      let finalTokensForPreset = null; // Will be set to loaded data or fallback
      let finalReactions = {};
      let finalMidi = {};
      let appliedFallbackVisuals = false;
      let shouldIncrementNonce = false;

      const isInitialDisplayFallbackReason = reason === 'initial_no_address_display_fallback' || reason === 'initial_service_not_ready_display_fallback';

      if (loadedData?.error) {
        setLoadError(loadedData.error);
        addToast(`Error loading configuration: ${loadedData.error}`, 'error');
        finalLayersForPreset = null; finalTokensForPreset = null; finalName = null; // Explicitly null for error
        finalReactions = {}; finalMidi = {};
      } else if (loadedData?.config) {
        finalName = loadedData.config.name ?? targetName ?? "Unnamed Preset";
        const loadedLayersData = loadedData.config.layers || {};
        finalLayersForPreset = {}; // Initialize as object
        for (const layerId of ['1', '2', '3']) {
            finalLayersForPreset[layerId] = ensureCompleteLayerConfigStructure(loadedLayersData[layerId], minimalLayerTemplate);
        }
        finalTokensForPreset = loadedData.config.tokenAssignments || {};
        finalReactions = loadedData.reactions || {};
        finalMidi = loadedData.midi || {};
        shouldIncrementNonce = true;
      } else if (reason === "address_cleared") {
          // When address is cleared, reset all relevant states
          finalLayersForPreset = null; finalTokensForPreset = null; finalReactions = {}; finalMidi = {};
          finalName = null;
          setLoadedLayerConfigsFromPreset(null); // Clear these specific states
          setLoadedTokenAssignmentsFromPreset(null);
          setConfigLoadNonce(0); setIsInitiallyResolved(false);
          initialLoadCompletedForRef.current = undefined; setIsLoading(true);
          return; // Exit early as other state setters below are not needed
      } else { // Fallback case
        appliedFallbackVisuals = true;
        finalName = "Fallback";
        const fallbackLayersData = fallbackConfig.layers || {};
        finalLayersForPreset = {}; // Initialize as object
        for (const layerId of ['1', '2', '3']) {
            finalLayersForPreset[layerId] = ensureCompleteLayerConfigStructure(fallbackLayersData[layerId], minimalLayerTemplate);
        }
        finalTokensForPreset = fallbackConfig.tokenAssignments || {};
        // Still try to load global reactions/midi even if visual config is fallback
        finalReactions = loadedData?.reactions || {}; 
        finalMidi = loadedData?.midi || {};
        console.log(`[useConfigState] Applying fallback visuals. Reason: ${reason}`);

        // Increment nonce for fallback if it's a meaningful state change
        if ( (loadedForAddress && !isInitialDisplayFallbackReason) || (configLoadNonce === 0 && !isInitialDisplayFallbackReason) ) {
            shouldIncrementNonce = true;
        } else {
            console.log(`[useConfigState] Fallback applied but nonce not incremented. Reason: ${reason}, LoadedFor: ${loadedForAddress}, Nonce: ${configLoadNonce}`);
        }
      }

      // Update states that provide data for VisualConfigProvider
      setLoadedLayerConfigsFromPreset(finalLayersForPreset);
      setLoadedTokenAssignmentsFromPreset(finalTokensForPreset);

      // Update other states managed by this hook
      setSavedReactions(finalReactions);
      setMidiMap(finalMidi);
      if (finalName !== currentConfigName) setCurrentConfigName(finalName);
      setHasPendingChanges(false); // Loading a preset clears pending changes

      if (shouldIncrementNonce) {
          setConfigLoadNonce(prevNonce => prevNonce + 1);
          console.log(`[useConfigState] Incremented configLoadNonce. Reason: ${loadedData?.config ? 'Loaded Config' : (appliedFallbackVisuals && shouldIncrementNonce) ? 'Applied Fallback (with nonce)' : 'No Change/Error'}`);
      }

      // Manage initial resolution state
      if ((completionMarker !== undefined && completionMarker !== null) || reason === 'no_target_address_performLoad') {
          if (!isInitiallyResolved) {
            setIsInitiallyResolved(true);
          }
          if (completionMarker !== undefined) {
            initialLoadCompletedForRef.current = completionMarker;
          }
      } else if (isInitialDisplayFallbackReason && !isInitiallyResolved) {
          // For initial display fallbacks, we set isLoading to false but don't mark as fully resolved yet
          // if an address is expected but not yet available.
          console.log("[useConfigState] Initial display fallback applied, isLoading=false, isInitiallyResolved remains false.");
      }
      setIsLoading(false);
    }, [addToast, currentConfigName, isInitiallyResolved, configLoadNonce]); // Added configLoadNonce

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

  const performLoad = useCallback(
    async (address, configName = null, customKey = null, reason = "manual") => {
      const service = configServiceRef.current;
      const isReady = !!service && isUpProviderStableForRead;

      if (!address) {
          console.warn("[useConfigState performLoad] No address provided. Applying fallback.");
          setIsLoading(false); // Set loading false before apply
          applyLoadedData(null, 'no_target_address_performLoad', null);
          return { success: true, config: fallbackConfig }; // Return fallback structure
      }
      if (!isReady) {
          addToast("Configuration service not ready. Applying fallback.", "warning");
          setIsLoading(false); // Set loading false before apply
          applyLoadedData(null, 'service_not_ready_performLoad', address);
          return { success: false, error: "Service not ready." };
      }

      const targetName = configName || "Default";
      setIsLoading(true); setLoadError(null);
      try {
        const loadedData = await service.loadConfiguration(address, configName, customKey);
        applyLoadedData(loadedData, reason, address, targetName);
        const loadSuccessful = !loadedData?.error;
        if (loadSuccessful && loadedData.config) {
            // Successfully loaded a specific config, refresh list
            loadSavedConfigList().catch(() => {}); // Fire and forget list refresh
        }
        return { success: loadSuccessful, error: loadedData?.error, config: loadedData?.config };
      } catch (error) {
        const errorMsg = error.message || "Unknown load error";
        applyLoadedData({ error: errorMsg }, reason, address, targetName); // Ensure error is passed to applyLoadedData
        return { success: false, error: errorMsg };
      }
    },
    [isUpProviderStableForRead, applyLoadedData, addToast, loadSavedConfigList, configServiceRef] // Added configServiceRef
  );

  // Effect for initial load or when profile address changes
  useEffect(() => {
    const addressToLoad = currentProfileAddress;
    const serviceReady = configServiceInstanceReady; // Use memoized ready state

    if (addressToLoad !== prevProfileAddressRef.current) {
        console.log(`[useConfigState] Profile address changed: ${prevProfileAddressRef.current?.slice(0,6) || 'none'} -> ${addressToLoad?.slice(0,6) || 'none'}. Resetting state.`);
        prevProfileAddressRef.current = addressToLoad;
        initialLoadCompletedForRef.current = undefined; // Reset completion flag for new address
        setIsInitiallyResolved(false); // New address means we are not initially resolved for it yet
        setSavedConfigList([]);
        setCurrentConfigName(null);
        setLoadedLayerConfigsFromPreset(null); // Reset loaded preset data
        setLoadedTokenAssignmentsFromPreset(null);
        setSavedReactions({});
        setMidiMap({});
        setIsLoading(true); // Start loading for the new address or lack thereof
        setLoadError(null);
        // configLoadNonce is reset in applyLoadedData if reason is 'address_cleared'
    }

    const hasLoadCompletedForThisAddress = initialLoadCompletedForRef.current === addressToLoad;

    if (isLoading) { // Only proceed if we are in a loading state
        if (serviceReady) {
            if (addressToLoad) {
                if (!hasLoadCompletedForThisAddress) {
                    console.log(`[useConfigState Initial Load] Address ${addressToLoad.slice(0,6)} present, service ready. Performing initial load.`);
                    performLoad(addressToLoad, null, null, "initial");
                } else {
                    // Load already completed for this address, but we are still in isLoading state.
                    // This might happen if an external factor set isLoading to true.
                    // For safety, ensure isLoading is false if resolved.
                    if (isInitiallyResolved) setIsLoading(false);
                }
            } else { // No address to load
                if (!isInitiallyResolved) { // And not yet resolved
                    console.log("[useConfigState Initial Load] Service ready, no address, not resolved. Applying initial display fallback.");
                    applyLoadedData(null, 'initial_no_address_display_fallback', null);
                } else {
                     // No address, but already resolved (e.g. user disconnected after initial load)
                     setIsLoading(false); // Ensure loading is false
                }
            }
        } else { // Service not ready
            if (!isInitiallyResolved) { // And not yet resolved
                console.log("[useConfigState Initial Load] Service not ready, not resolved. Applying initial display fallback.");
                applyLoadedData(null, 'initial_service_not_ready_display_fallback', null);
            } else {
                 // Service not ready, but already resolved (shouldn't happen often)
                 setIsLoading(false);
            }
        }
    }
  // Key dependencies for re-evaluating initial load logic
  }, [currentProfileAddress, configServiceInstanceReady, performLoad, applyLoadedData, addToast, isLoading, isInitiallyResolved]);


  /**
   * Saves the visual preset.
   * Now accepts layerConfigsToSave and tokenAssignmentsToSave as arguments.
   */
  const saveVisualPreset = useCallback(
    async (nameToSave, setAsDefault, includeReactions, includeMidi, layerConfigsToSave, tokenAssignmentsToSave) => {
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

      // Ensure layerConfigsToSave and tokenAssignmentsToSave are valid objects
      const validLayerConfigs = (typeof layerConfigsToSave === 'object' && layerConfigsToSave !== null) ? layerConfigsToSave : {};
      const validTokenAssignments = (typeof tokenAssignmentsToSave === 'object' && tokenAssignmentsToSave !== null) ? tokenAssignmentsToSave : {};
      
      const minimalLayerTemplate = getMinimalLayerConfigTemplate();
      const completeLayerConfigsForSave = {};
      for (const layerId of ['1', '2', '3']) {
          completeLayerConfigsForSave[layerId] = ensureCompleteLayerConfigStructure(validLayerConfigs[layerId] || {}, minimalLayerTemplate);
      }

      const dataToSave = {
        layers: completeLayerConfigsForSave,
        tokenAssignments: validTokenAssignments,
        // These come from this hook's state as they are "global" settings
        reactions: includeReactions ? savedReactions : undefined, 
        midi: includeMidi ? midiMap : undefined,
      };

      try {
        const result = await service.saveConfiguration( addressToSave, dataToSave, nameToSave, setAsDefault, true, includeReactions, includeMidi, null );
        if (result.success) {
            addToast(`Preset '${nameToSave}' saved successfully!`, 'success');
            setSaveSuccess(true); setHasPendingChanges(false); // Saving clears pending changes
            setCurrentConfigName(nameToSave); // Update current config name
            loadSavedConfigList().catch(() => {}); // Refresh list
        } else { throw new Error(result.error || "Save configuration failed."); }
        setIsSaving(false); return result;
      } catch (error) {
        const errorMsg = error.message || "Unknown save error."; setSaveError(errorMsg);
        addToast(`Error saving preset: ${errorMsg}`, 'error'); setIsSaving(false);
        setSaveSuccess(false); return { success: false, error: errorMsg };
      }
    },
    // Dependencies: currentProfileAddress and states managed by this hook (savedReactions, midiMap)
    // and functions (addToast, loadSavedConfigList, isUpProviderStableForRead, configServiceRef)
    [currentProfileAddress, savedReactions, midiMap, addToast, loadSavedConfigList, isUpProviderStableForRead, configServiceRef]
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
            setSaveSuccess(true); setHasPendingChanges(false); // Saving clears pending changes
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
            setSaveSuccess(true); setHasPendingChanges(false); // Saving clears pending changes
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
              setSaveSuccess(true); // Not strictly saveSuccess, but operation was successful
              await loadSavedConfigList(); // Refresh list
              if (currentConfigName === nameToDelete) {
                // If deleted preset was active, load default (which applies fallback if no default)
                await performLoad(addressToDeleteFrom, null, null, `delete_cleanup:${nameToDelete}`);
              }
          } else { throw new Error(result.error || "Delete operation failed."); }
          setIsSaving(false); // Reset saving flag
          return result;
      } catch (error) {
          const errorMsg = error.message || "Unknown delete error."; setSaveError(errorMsg);
          addToast(`Error deleting preset: ${errorMsg}`, 'error'); setIsSaving(false);
          return { success: false, error: errorMsg };
      }
    },
    [currentProfileAddress, performLoad, addToast, loadSavedConfigList, currentConfigName, isUpProviderStableForRead, configServiceRef], // Added configServiceRef
  );

  // --- State Update Callbacks for global settings managed here ---
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
      loadedLayerConfigsFromPreset, // Expose loaded preset data for VisualConfigProvider
      loadedTokenAssignmentsFromPreset, // Expose loaded preset data for VisualConfigProvider
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
      saveVisualPreset, // This function now expects layerConfigs and tokenAssignments
      saveGlobalReactions,
      saveGlobalMidiMap,
      loadNamedConfig,
      loadDefaultConfig,
      loadSavedConfigList,
      deleteNamedConfig,
      updateSavedReaction,
      deleteSavedReaction,
      updateMidiMap,
      setHasPendingChanges,
  }), [
      configServiceInstanceReady, configServiceRef, currentConfigName,
      loadedLayerConfigsFromPreset, loadedTokenAssignmentsFromPreset,
      savedReactions, midiMap, isLoading, loadError, isSaving,
      saveError, saveSuccess, hasPendingChanges, savedConfigList, isInitiallyResolved,
      configLoadNonce, saveVisualPreset, saveGlobalReactions, saveGlobalMidiMap,
      loadNamedConfig, loadDefaultConfig,
      loadSavedConfigList, deleteNamedConfig, updateSavedReaction,
      deleteSavedReaction, updateMidiMap, setHasPendingChanges
  ]);

  return contextState;
};

export default useConfigState;