// src/context/PresetManagementContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import PropTypes from "prop-types";
import { useUserSession } from "./UserSessionContext";
import { useConfig } from "./ConfigContext";
import { useToast } from "./ToastContext";
import fallbackConfig from "../config/fallback-config.js";

/**
 * Transforms a list of preset name strings into an array of objects,
 * each with a `name` property. Used for populating selection UI.
 * @param {string[]} list - An array of preset name strings.
 * @returns {Array<{name: string}>} An array of preset objects, or an empty array if input is invalid.
 */
const transformStringListToObjects = (list) => {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => typeof item === "string").map((name) => ({ name }));
};

/**
 * Returns a default template object for a single visual layer's configuration.
 * This ensures a consistent structure for all layers.
 * @returns {object} The default layer configuration template.
 */
const getMinimalLayerConfigTemplate = () => ({
  enabled: true,
  blendMode: "normal",
  opacity: 1.0,
  size: 1.0,
  speed: 0.01,
  drift: 0,
  driftSpeed: 0.1,
  angle: 0,
  xaxis: 0,
  yaxis: 0,
  direction: 1,
  driftState: { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false },
});

/**
 * Ensures that a given layer configuration object contains all necessary properties,
 * falling back to a default template for any missing ones. This guarantees
 * that downstream components always receive a consistently structured layer config.
 * @param {object | null | undefined} layerConfig - The partial or potentially incomplete layer configuration.
 * @param {object} defaultLayerConfigTemplate - The default template to use for missing properties.
 * @returns {object} A complete layer configuration object.
 */
const ensureCompleteLayerConfigStructure = (
  layerConfig,
  defaultLayerConfigTemplate,
) => {
  const completeConfig = { ...defaultLayerConfigTemplate };
  if (layerConfig && typeof layerConfig === "object") {
    for (const key in layerConfig) {
      if (
        Object.prototype.hasOwnProperty.call(layerConfig, key) &&
        layerConfig[key] !== null &&
        layerConfig[key] !== undefined
      ) {
        completeConfig[key] = layerConfig[key];
      }
      // Deep merge driftState if it exists and is an object
      if (
        key === "driftState" &&
        typeof layerConfig[key] === "object" &&
        defaultLayerConfigTemplate.driftState && // Ensure template has driftState
        typeof defaultLayerConfigTemplate.driftState === 'object'
      ) {
        completeConfig[key] = {
          ...defaultLayerConfigTemplate.driftState,
          ...(layerConfig[key] || {}), // Ensure layerConfig[key] is an object for spread
        };
      }
    }
  }
  // Final check for 'enabled' if it somehow got missed and is in the template
  if (
    typeof completeConfig.enabled !== "boolean" &&
    Object.prototype.hasOwnProperty.call(defaultLayerConfigTemplate, "enabled")
  ) {
    completeConfig.enabled = defaultLayerConfigTemplate.enabled;
  }
  return completeConfig;
};

/**
 * @typedef {object} PresetManagementContextValue
 * @property {string | null} currentConfigName - Name of the currently loaded visual preset. Null if no preset is active or during initial load.
 * @property {Array<{name: string}>} savedConfigList - An array of objects, each representing a saved visual preset with a `name` property.
 * @property {boolean} isLoading - True when loading a preset or the list of presets.
 * @property {Error | string | null} loadError - Contains an error object or message from the last preset load attempt, or null if successful.
 * @property {boolean} isSaving - True when a save or delete operation for a preset is in progress.
 * @property {Error | string | null} saveError - Contains an error object or message from the last preset save/delete attempt, or null if successful.
 * @property {boolean} saveSuccess - True if the last save/delete operation was successful.
 * @property {boolean} isInitiallyResolved - True once the initial attempt to load a preset (either default or fallback) has completed upon component mount or profile change.
 * @property {number} configLoadNonce - A number that increments each time a new configuration preset is successfully processed and applied. Used by consumers to detect new preset data.
 * @property {object | null} loadedLayerConfigsFromPreset - The layer configurations (e.g., for layers 1, 2, 3) loaded from the most recent preset or fallback.
 * @property {object | null} loadedTokenAssignmentsFromPreset - The token assignments (mapping layer IDs to token identifiers) loaded from the most recent preset or fallback.
 * @property {(name: string) => Promise<{success: boolean, error?: string, config?: object | null}>} loadNamedConfig - Loads a specific named configuration by its name.
 * @property {() => Promise<{success: boolean, error?: string, config?: object | null}>} loadDefaultConfig - Loads the configuration designated as the default for the current profile.
 * @property {() => Promise<{success: boolean, list?: Array<{name: string}>, error?: string}>} loadSavedConfigList - Reloads the list of saved configuration names from the current profile.
 * @property {(nameToSave: string, setAsDefault: boolean, includeReactions: boolean, includeMidi: boolean, layerConfigsToSave: object, tokenAssignmentsToSave: object) => Promise<{success: boolean, error?: string}>} saveVisualPreset - Saves the provided visual configuration (layers, tokens, and optionally global reactions/MIDI) as a named preset.
 * @property {(nameToDelete: string) => Promise<{success: boolean, error?: string}>} deleteNamedConfig - Deletes a named configuration from the current profile.
 */

/** @type {PresetManagementContextValue} */
export const defaultPresetManagementContext = {
  currentConfigName: null,
  savedConfigList: [],
  isLoading: true,
  loadError: null,
  isSaving: false,
  saveError: null,
  saveSuccess: false,
  isInitiallyResolved: false,
  configLoadNonce: 0,
  loadedLayerConfigsFromPreset: null,
  loadedTokenAssignmentsFromPreset: null,
  loadNamedConfig: async () => ({ success: false, error: "PresetManagementProvider not initialized" }),
  loadDefaultConfig: async () => ({ success: false, error: "PresetManagementProvider not initialized" }),
  loadSavedConfigList: async () => ({ success: false, error: "PresetManagementProvider not initialized" }),
  saveVisualPreset: async () => ({ success: false, error: "PresetManagementProvider not initialized" }),
  deleteNamedConfig: async () => ({ success: false, error: "PresetManagementProvider not initialized" }),
};

const PresetManagementContext = createContext(defaultPresetManagementContext);

/**
 * Provides context for managing visual presets (configurations).
 * This includes loading, saving, deleting, and listing presets,
 * as well as managing the state related to these operations (loading, errors, etc.).
 * It interacts with `ConfigurationService` (via `useConfig`) to persist and retrieve
 * preset data from the user's Universal Profile.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components that will consume this context.
 * @returns {JSX.Element} The PresetManagementProvider component.
 */
export const PresetManagementProvider = ({ children }) => {
  const { hostProfileAddress } = useUserSession();
  const {
    configServiceRef,
    configServiceInstanceReady,
    savedReactions: globalSavedReactions,
    midiMap: globalMidiMap,
    setHasPendingChanges,
  } = useConfig();
  const { addToast } = useToast();

  /** @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]} Name of the currently loaded preset. */
  const [currentConfigName, setCurrentConfigName] = useState(null);
  /** @type {[Array<{name: string}>, React.Dispatch<React.SetStateAction<Array<{name: string}>>>]} List of saved preset names. */
  const [savedConfigList, setSavedConfigList] = useState([]);

  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} True when loading a preset or list. */
  const [isLoading, setIsLoading] = useState(true);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} True after initial preset/fallback load attempt. */
  const [isInitiallyResolved, setIsInitiallyResolved] = useState(false);
  /** @type {[number, React.Dispatch<React.SetStateAction<number>>]} Increments when new preset data is applied. */
  const [configLoadNonce, setConfigLoadNonce] = useState(0);

  /** @type {[Error | string | null, React.Dispatch<React.SetStateAction<Error | string | null>>]} Error from last load attempt. */
  const [loadError, setLoadError] = useState(null);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} True when saving/deleting. */
  const [isSaving, setIsSaving] = useState(false);
  /** @type {[Error | string | null, React.Dispatch<React.SetStateAction<Error | string | null>>]} Error from last save/delete. */
  const [saveError, setSaveError] = useState(null);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} True if last save/delete succeeded. */
  const [saveSuccess, setSaveSuccess] = useState(false);

  /** @type {[object | null, React.Dispatch<React.SetStateAction<object | null>>]} Layer configs from the last loaded preset/fallback. */
  const [loadedLayerConfigsFromPreset, setLoadedLayerConfigsFromPreset] = useState(null);
  /** @type {[object | null, React.Dispatch<React.SetStateAction<object | null>>]} Token assignments from the last loaded preset/fallback. */
  const [loadedTokenAssignmentsFromPreset, setLoadedTokenAssignmentsFromPreset] = useState(null);

  /** @type {React.RefObject<string | null>} Ref to track the previous profile address to detect changes. */
  const prevProfileAddressRef = useRef(hostProfileAddress);
  /** @type {React.RefObject<boolean>} Ref to track if an initial default load has been attempted for the current profile. */
  const initialDefaultLoadAttemptedForCurrentAddressRef = useRef(false);

  /**
   * Internal function to apply loaded preset data (or fallback/error state) to the context's state.
   * This updates `loadedLayerConfigsFromPreset`, `loadedTokenAssignmentsFromPreset`, `currentConfigName`,
   * `configLoadNonce`, and loading/error states.
   * @param {object | null} loadedData - The data returned from ConfigurationService's load, or null for fallback. Contains `config` and `error`.
   * @param {string | null} _loadedForAddress - The address for which the data was loaded (used for debugging, not in logic).
   * @param {string | null} [targetName=null] - The name of the preset that was intended to be loaded.
   */
  const applyLoadedPresetData = useCallback(
    (loadedData, _loadedForAddress, targetName = null) => {
      const minimalLayerTemplate = getMinimalLayerConfigTemplate();
      let finalName = null;
      let finalLayersForPreset = null;
      let finalTokensForPreset = null;

      if (loadedData?.error) {
        setLoadError(loadedData.error);
        if (loadedData.error && !String(loadedData.error).toLowerCase().includes("no default") && !String(loadedData.error).toLowerCase().includes("not found")) {
            addToast(`Error loading preset: ${loadedData.error}`, 'error');
        }
        finalName = targetName || "ErrorState"; // Name reflects attempted load or error
        const fallbackLayersData = fallbackConfig.layers || {};
        finalLayersForPreset = {};
        for (const layerId of ['1', '2', '3']) {
          finalLayersForPreset[layerId] = ensureCompleteLayerConfigStructure(fallbackLayersData[layerId], minimalLayerTemplate);
        }
        finalTokensForPreset = fallbackConfig.tokenAssignments || {};
      } else if (loadedData?.config) { // Successfully loaded a specific preset
        finalName = loadedData.config.name ?? targetName ?? "Unnamed Preset";
        finalLayersForPreset = {};
        for (const layerId of ['1', '2', '3']) {
          finalLayersForPreset[layerId] = ensureCompleteLayerConfigStructure(loadedData.config.layers?.[layerId], minimalLayerTemplate);
        }
        finalTokensForPreset = loadedData.config.tokenAssignments || {};
        setLoadError(null);
      } else { // Fallback to default application config (e.g., if no default preset found on profile)
        finalName = "Fallback";
        const fallbackLayersData = fallbackConfig.layers || {};
        finalLayersForPreset = {};
        for (const layerId of ['1', '2', '3']) {
          finalLayersForPreset[layerId] = ensureCompleteLayerConfigStructure(fallbackLayersData[layerId], minimalLayerTemplate);
        }
        finalTokensForPreset = fallbackConfig.tokenAssignments || {};
        setLoadError(null);
      }

      setLoadedLayerConfigsFromPreset(finalLayersForPreset);
      setLoadedTokenAssignmentsFromPreset(finalTokensForPreset);
      if (finalName !== currentConfigName) setCurrentConfigName(finalName);
      if (setHasPendingChanges) setHasPendingChanges(false); // Loading a preset clears pending changes

      setConfigLoadNonce(prevNonce => prevNonce + 1); // Signal that new config data is ready
      if (!isInitiallyResolved) {
        setIsInitiallyResolved(true);
      }
      setIsLoading(false);
    },
    [addToast, currentConfigName, isInitiallyResolved, setHasPendingChanges] // Removed setIsLoading, setLoadError, setLoadedLayerConfigsFromPreset etc., as they are stable setters
  );

  /**
   * Internal function to load the list of saved configuration names for the current host profile.
   * Updates `savedConfigList` state.
   * @returns {Promise<{success: boolean, list?: Array<{name: string}>, error?: string}>} Result of the load operation.
   */
  const loadSavedConfigListInternal = useCallback(async () => {
    const service = configServiceRef.current;
    const addressToLoad = hostProfileAddress;
    const isReady = !!service && configServiceInstanceReady;

    if (!isReady || !addressToLoad) {
      const errorMsg = !isReady ? "Service not ready for list." : "No profile address for list.";
      addToast(errorMsg, "warning"); setSavedConfigList([]);
      return { success: false, error: errorMsg };
    }
    try {
      const stringList = await service.loadSavedConfigurations(addressToLoad);
      const objectList = transformStringListToObjects(stringList);
      setSavedConfigList(objectList);
      return { success: true, list: objectList };
    } catch (error) {
      const errorMsg = error.message || "Failed to load list.";
      addToast(`Failed to load preset list: ${errorMsg}`, 'error');
      if (import.meta.env.DEV) console.error(`[PresetManagementContext] Failed to load preset list:`, error);
      setSavedConfigList([]);
      return { success: false, error: errorMsg };
    }
  }, [hostProfileAddress, addToast, configServiceInstanceReady, configServiceRef]); // Removed setSavedConfigList (stable setter)

  /**
   * Internal core function to load a preset (named or default) using ConfigurationService.
   * It handles setting loading states and applying the loaded data via `applyLoadedPresetData`.
   * @param {string} address - The profile address to load from.
   * @param {string | null} [configName=null] - The name of the config to load. If null, attempts to load default.
   * @param {string | null} [customKey=null] - A specific ERC725Y key to load from (overrides name/default).
   * @param {string} [reason="manual"] - A descriptive reason for the load, for debugging.
   * @returns {Promise<{success: boolean, error?: string, config?: object | null}>} Result of the load operation.
   */
  const performPresetLoadInternal = useCallback(
    async (address, configName = null, customKey = null, reason = "manual") => {
      const service = configServiceRef.current;
      const isReady = !!service && configServiceInstanceReady;

      setIsLoading(true);
      setLoadError(null);

      if (!address) {
        applyLoadedPresetData(null, `no_target_address_in_performLoad_${reason}`, null);
        return { success: true, config: fallbackConfig }; // Successfully applied fallback
      }
      if (!isReady) {
        addToast("Preset service not ready. Applying client fallback.", "warning");
        applyLoadedPresetData(null, `service_not_ready_in_performLoad_${reason}`, address);
        return { success: false, error: "Service not ready." };
      }

      try {
        const loadedData = await service.loadConfiguration(address, configName, customKey);
        // `applyLoadedPresetData` handles setting isLoading to false
        applyLoadedPresetData({ config: loadedData.config, error: loadedData.error }, address, configName || "Default");

        const loadSuccessful = !loadedData?.error && !!loadedData?.config;
        if (loadSuccessful) {
          loadSavedConfigListInternal().catch((listError) => {
            if (import.meta.env.DEV) {
              console.error(`[PresetManagementContext performPresetLoadInternal] Error from loadSavedConfigListInternal after successful preset load:`, listError);
            }
          });
        }
        return { success: loadSuccessful, error: loadedData?.error, config: loadedData?.config };
      } catch (error) {
        const errorMsg = error.message || "Unknown load error";
        applyLoadedPresetData({ error: errorMsg }, address, configName || "Default");
        return { success: false, error: errorMsg };
      }
    },
    [configServiceInstanceReady, applyLoadedPresetData, addToast, loadSavedConfigListInternal, configServiceRef] // Removed setIsLoading, setLoadError (stable setters)
  );

  /** Effect for initial load or when hostProfileAddress changes. */
  useEffect(() => {
    const currentAddress = hostProfileAddress;
    const serviceIsReady = configServiceInstanceReady;

    if (currentAddress !== prevProfileAddressRef.current) {
        prevProfileAddressRef.current = currentAddress;
        initialDefaultLoadAttemptedForCurrentAddressRef.current = false; // Reset attempt flag for new profile

        // Reset states for the new profile
        setIsLoading(true);
        setIsInitiallyResolved(false);
        setConfigLoadNonce(0); // Reset nonce for a new profile context
        setCurrentConfigName(null);
        setLoadedLayerConfigsFromPreset(null);
        setLoadedTokenAssignmentsFromPreset(null);
        setLoadError(null);
        if (setHasPendingChanges) setHasPendingChanges(false);

        if (!currentAddress) { // If new address is null (e.g., disconnected)
            // Apply fallback immediately as there's no profile to load from
            applyLoadedPresetData(null, "profile_disconnected", "Fallback");
            setSavedConfigList([]); // Clear preset list
            return; // Stop further processing
        }
    }

    // Attempt initial default load if conditions are met
    if (currentAddress && serviceIsReady && !initialDefaultLoadAttemptedForCurrentAddressRef.current && !isInitiallyResolved) {
        initialDefaultLoadAttemptedForCurrentAddressRef.current = true;
        setIsLoading(true); // Ensure loading state is true before async operation

        performPresetLoadInternal(currentAddress, null, null, "initial_default_load_for_profile")
            .catch(error => {
                if (import.meta.env.DEV) {
                    console.error(`[PresetManagementContext] Critical error during initial performPresetLoadInternal for ${currentAddress.slice(0,6)}:`, error);
                }
                // Ensure applyLoadedPresetData is called even on critical failure to resolve states
                applyLoadedPresetData({ error: "Critical initial load error" }, currentAddress); 
            });
    }
  }, [hostProfileAddress, configServiceInstanceReady, isInitiallyResolved, performPresetLoadInternal, applyLoadedPresetData, setHasPendingChanges]); // Dependencies are correct

  /**
   * Saves the provided visual configuration as a named preset.
   * @param {string} nameToSave - The name for the new preset.
   * @param {boolean} setAsDefault - Whether to set this preset as the default for the profile.
   * @param {boolean} includeReactions - Whether to include global reactions in this preset save (overwrites if they exist in preset).
   * @param {boolean} includeMidi - Whether to include global MIDI map in this preset save (overwrites if they exist in preset).
   * @param {object} layerConfigsToSave - The layer configurations to save.
   * @param {object} tokenAssignmentsToSave - The token assignments to save.
   * @returns {Promise<{success: boolean, error?: string}>} Result of the save operation.
   */
  const saveVisualPreset = useCallback(
    async (nameToSave, setAsDefault, includeReactions, includeMidi, layerConfigsToSave, tokenAssignmentsToSave) => {
      const service = configServiceRef.current;
      const addressToSave = hostProfileAddress;
      const isReady = !!service && configServiceInstanceReady && service.checkReadyForWrite();

      if (!isReady || !addressToSave) {
        const errorMsg = !isReady ? "Write service not ready." : "No profile address.";
        addToast(errorMsg, "error"); return { success: false, error: errorMsg };
      }
      if (!nameToSave?.trim()) {
        addToast("Preset name cannot be empty.", "warning"); return { success: false, error: "Preset name required." };
      }
      setIsSaving(true); setSaveError(null); setSaveSuccess(false);

      const minimalLayerTemplate = getMinimalLayerConfigTemplate();
      const completeLayerConfigsForSave = {};
      for (const layerId of ['1', '2', '3']) {
        completeLayerConfigsForSave[layerId] = ensureCompleteLayerConfigStructure(layerConfigsToSave[layerId] || {}, minimalLayerTemplate);
      }

      const dataToSave = {
        layers: completeLayerConfigsForSave,
        tokenAssignments: tokenAssignmentsToSave || {},
        // Only include reactions/midi in the saved preset data if requested
        reactions: includeReactions ? globalSavedReactions : undefined,
        midi: includeMidi ? globalMidiMap : undefined,
      };

      try {
        // The ConfigurationService.saveConfiguration handles saving visual, and conditionally global reactions/midi based on flags
        const result = await service.saveConfiguration(addressToSave, dataToSave, nameToSave, setAsDefault, true, includeReactions, includeMidi, null);
        if (result.success) {
          addToast(`Preset '${nameToSave}' saved successfully!`, 'success');
          setSaveSuccess(true);
          if (setHasPendingChanges) setHasPendingChanges(false);
          // If saved successfully, update currentConfigName and reload list
          if (currentConfigName !== nameToSave || setAsDefault) { // Or if it became default
             setCurrentConfigName(nameToSave);
          }
          await loadSavedConfigListInternal(); // Refresh the list of presets
        } else { throw new Error(result.error || "Save configuration failed."); }
        return result;
      } catch (error) {
        const errorMsg = error.message || "Unknown save error."; setSaveError(errorMsg);
        addToast(`Error saving preset: ${errorMsg}`, 'error');
        if (import.meta.env.DEV) console.error(`[PresetManagementContext] Error saving preset:`, error);
        setSaveSuccess(false); return { success: false, error: errorMsg };
      } finally {
        setIsSaving(false);
      }
    },
    [hostProfileAddress, globalSavedReactions, globalMidiMap, addToast, loadSavedConfigListInternal, configServiceInstanceReady, configServiceRef, setHasPendingChanges, currentConfigName] // setCurrentConfigName is stable
  );

  /**
   * Deletes a named configuration.
   * @param {string} nameToDelete - The name of the preset to delete.
   * @returns {Promise<{success: boolean, error?: string}>} Result of the delete operation.
   */
  const deleteNamedConfig = useCallback(
    async (nameToDelete) => {
      const service = configServiceRef.current;
      const addressToDeleteFrom = hostProfileAddress;
      const isReady = !!service && configServiceInstanceReady && service.checkReadyForWrite();
      if (!isReady || !addressToDeleteFrom) {
        const errorMsg = !isReady ? "Write service not ready." : "No profile address.";
        addToast(errorMsg, "error"); return { success: false, error: errorMsg };
      }
      if (!nameToDelete) {
        addToast("No preset name provided to delete.", "warning"); return { success: false, error: "No name provided." };
      }
      setIsSaving(true); setSaveError(null); // Use isSaving for delete operation as well
      try {
        const result = await service.deleteConfiguration(addressToDeleteFrom, nameToDelete);
        if (result.success) {
          addToast(`Preset '${nameToDelete}' deleted.`, 'success');
          setSaveSuccess(true);
          await loadSavedConfigListInternal(); // Refresh list
          // If the deleted preset was the current one, load the default (or fallback)
          if (currentConfigName === nameToDelete) {
            // performPresetLoadInternal will set isLoading and ultimately call applyLoadedPresetData
            await performPresetLoadInternal(addressToDeleteFrom, null, null, `delete_cleanup_for_${nameToDelete}`);
          }
        } else { throw new Error(result.error || "Delete operation failed."); }
        return result;
      } catch (error) {
        const errorMsg = error.message || "Unknown delete error."; setSaveError(errorMsg);
        addToast(`Error deleting preset: ${errorMsg}`, 'error');
        if (import.meta.env.DEV) console.error(`[PresetManagementContext] Error deleting preset:`, error);
        return { success: false, error: errorMsg };
      } finally {
        setIsSaving(false);
      }
    },
    [hostProfileAddress, performPresetLoadInternal, addToast, loadSavedConfigListInternal, currentConfigName, configServiceInstanceReady, configServiceRef] // Removed setSaveSuccess, setSaveError, setIsSaving (stable setters)
  );

  /** Loads a specific named configuration. */
  const loadNamedConfig = useCallback((name) =>
    performPresetLoadInternal(hostProfileAddress, name, null, `load_named:${name}`),
    [performPresetLoadInternal, hostProfileAddress]
  );

  /** Loads the default configuration for the profile. */
  const loadDefaultConfig = useCallback(() =>
    performPresetLoadInternal(hostProfileAddress, null, null, "load_profile_default"),
    [performPresetLoadInternal, hostProfileAddress]
  );

  const contextValue = useMemo(() => ({
    currentConfigName,
    savedConfigList,
    isLoading,
    loadError,
    isSaving,
    saveError,
    saveSuccess,
    isInitiallyResolved,
    configLoadNonce,
    loadedLayerConfigsFromPreset,
    loadedTokenAssignmentsFromPreset,
    loadNamedConfig,
    loadDefaultConfig,
    loadSavedConfigList: loadSavedConfigListInternal, // Expose the memoized internal version
    saveVisualPreset,
    deleteNamedConfig,
  }), [
    currentConfigName, savedConfigList, isLoading, loadError, isSaving, saveError, saveSuccess,
    isInitiallyResolved, configLoadNonce, loadedLayerConfigsFromPreset, loadedTokenAssignmentsFromPreset,
    loadNamedConfig, loadDefaultConfig, loadSavedConfigListInternal, saveVisualPreset, deleteNamedConfig
  ]);

  return (
    <PresetManagementContext.Provider value={contextValue}>
      {children}
    </PresetManagementContext.Provider>
  );
};

PresetManagementProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Custom hook to consume the PresetManagementContext.
 * Provides access to the current preset's state (name, loaded data),
 * the list of saved presets, loading/saving states, and functions to manage presets.
 *
 * @returns {PresetManagementContextValue} The preset management context value.
 * @throws {Error} If used outside of a PresetManagementProvider.
 */
export const usePresetManagement = () => {
  const context = useContext(PresetManagementContext);
  if (context === undefined) {
    throw new Error("usePresetManagement must be used within a PresetManagementProvider");
  }
  return context;
};