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

import { useUserSession } from "./UserSessionContext"; // Local context
import { useConfig } from "./ConfigContext"; // Local context
import { useToast } from "./ToastContext"; // Local context

import fallbackConfig from "../config/fallback-config.js"; // Local config

/**
 * Transforms a list of preset name strings into an array of objects,
 * each with a `name` property. Used for populating selection UI.
 * @param {string[]} list - An array of preset name strings.
 * @returns {Array<{name: string}>} An array of preset objects, or an empty array if input is invalid.
 */
const transformStringListToObjects = (list) => {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => typeof item === "string" && item.trim() !== "").map((name) => ({ name }));
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
    for (const key in defaultLayerConfigTemplate) { // Iterate over template keys to ensure all are considered
      if (
        Object.prototype.hasOwnProperty.call(layerConfig, key) &&
        layerConfig[key] !== null &&
        layerConfig[key] !== undefined
      ) {
        if (key === "driftState" && typeof layerConfig[key] === 'object' && defaultLayerConfigTemplate.driftState && typeof defaultLayerConfigTemplate.driftState === 'object') {
          completeConfig[key] = {
            ...defaultLayerConfigTemplate.driftState,
            ...(layerConfig[key] || {}),
          };
        } else {
          completeConfig[key] = layerConfig[key];
        }
      }
      // If key is in template but not in layerConfig (or is null/undefined), it keeps the default template value.
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
 * @property {object | null} loadedLayerConfigsFromPreset - The layer configurations (e.g., for layers 1, 2, 3) loaded from the most recent preset or fallback. Structure: `{ "1": LayerConfig, "2": LayerConfig, ... }`.
 * @property {object | null} loadedTokenAssignmentsFromPreset - The token assignments (mapping layer IDs to token identifiers) loaded from the most recent preset or fallback. Structure: `{ "1": Assignment, "2": Assignment, ... }`.
 * @property {(name: string) => Promise<{success: boolean, error?: string, config?: object | null}>} loadNamedConfig - Loads a specific named configuration by its name.
 * @property {() => Promise<{success: boolean, error?: string, config?: object | null}>} loadDefaultConfig - Loads the configuration designated as the default for the current profile.
 * @property {() => Promise<{success: boolean, list?: Array<{name: string}>, error?: string}>} loadSavedConfigList - Reloads the list of saved configuration names from the current profile.
 * @property {(nameToSave: string, setAsDefault: boolean, includeReactions: boolean, includeMidi: boolean, layerConfigsToSave: object, tokenAssignmentsToSave: object) => Promise<{success: boolean, error?: string}>} saveVisualPreset - Saves the provided visual configuration (layers, tokens, and optionally global reactions/MIDI) as a named preset.
 * @property {(nameToDelete: string) => Promise<{success: boolean, error?: string}>} deleteNamedConfig - Deletes a named configuration from the current profile.
 */

/** @type {PresetManagementContextValue} */
export const defaultPresetManagementContextValue = { // Renamed for clarity
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
  loadNamedConfig: async () => {
    if (import.meta.env.DEV) console.warn("loadNamedConfig called on default PresetManagementContext");
    return { success: false, error: "PresetManagementProvider not initialized" };
  },
  loadDefaultConfig: async () => {
    if (import.meta.env.DEV) console.warn("loadDefaultConfig called on default PresetManagementContext");
    return { success: false, error: "PresetManagementProvider not initialized" };
  },
  loadSavedConfigList: async () => {
    if (import.meta.env.DEV) console.warn("loadSavedConfigList called on default PresetManagementContext");
    return { success: false, error: "PresetManagementProvider not initialized" };
  },
  saveVisualPreset: async () => {
    if (import.meta.env.DEV) console.warn("saveVisualPreset called on default PresetManagementContext");
    return { success: false, error: "PresetManagementProvider not initialized" };
  },
  deleteNamedConfig: async () => {
    if (import.meta.env.DEV) console.warn("deleteNamedConfig called on default PresetManagementContext");
    return { success: false, error: "PresetManagementProvider not initialized" };
  },
};

const PresetManagementContext = createContext(defaultPresetManagementContextValue);

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
    savedReactions: globalSavedReactions, // From ConfigContext
    midiMap: globalMidiMap,             // From ConfigContext
    setHasPendingChanges,
  } = useConfig();
  const { addToast } = useToast();

  const [currentConfigName, setCurrentConfigName] = useState(null);
  const [savedConfigList, setSavedConfigList] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // True initially
  const [isInitiallyResolved, setIsInitiallyResolved] = useState(false);
  const [configLoadNonce, setConfigLoadNonce] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadedLayerConfigsFromPreset, setLoadedLayerConfigsFromPreset] = useState(null);
  const [loadedTokenAssignmentsFromPreset, setLoadedTokenAssignmentsFromPreset] = useState(null);

  /** @type {React.RefObject<string | null>} */
  const prevProfileAddressRef = useRef(hostProfileAddress);
  /** @type {React.RefObject<boolean>} */
  const initialDefaultLoadAttemptedForCurrentAddressRef = useRef(false);

  const applyLoadedPresetData = useCallback(
    (loadedData, _loadedForAddress, targetName = null) => {
      const minimalLayerTemplate = getMinimalLayerConfigTemplate();
      let finalName = null;
      let finalLayersForPreset = {}; // Initialize as object
      let finalTokensForPreset = {}; // Initialize as object

      if (loadedData?.error) {
        setLoadError(loadedData.error);
        // Avoid toast for "no default" or "not found" as these are handled by fallback
        if (loadedData.error && !String(loadedData.error).toLowerCase().includes("no default") && !String(loadedData.error).toLowerCase().includes("not found")) {
            addToast(`Error loading preset: ${loadedData.error}`, 'error');
        }
        finalName = targetName || "ErrorState";
        const fallbackLayersData = fallbackConfig.layers || {};
        for (const layerId of ['1', '2', '3']) { // Ensure all layers have a structure
          finalLayersForPreset[layerId] = ensureCompleteLayerConfigStructure(fallbackLayersData[layerId], minimalLayerTemplate);
        }
        finalTokensForPreset = fallbackConfig.tokenAssignments || {};
      } else if (loadedData?.config) {
        finalName = loadedData.config.name ?? targetName ?? "Unnamed Preset";
        const loadedLayers = loadedData.config.layers || {}; // Use 'layers' as per mapping in ConfigService
        for (const layerId of ['1', '2', '3']) {
          finalLayersForPreset[layerId] = ensureCompleteLayerConfigStructure(loadedLayers[layerId], minimalLayerTemplate);
        }
        finalTokensForPreset = loadedData.config.tokenAssignments || {}; // Use 'tokenAssignments'
        setLoadError(null);
      } else { // Fallback to default application config
        finalName = "Fallback";
        const fallbackLayersData = fallbackConfig.layers || {};
        for (const layerId of ['1', '2', '3']) {
          finalLayersForPreset[layerId] = ensureCompleteLayerConfigStructure(fallbackLayersData[layerId], minimalLayerTemplate);
        }
        finalTokensForPreset = fallbackConfig.tokenAssignments || {};
        setLoadError(null);
      }

      setLoadedLayerConfigsFromPreset(finalLayersForPreset);
      setLoadedTokenAssignmentsFromPreset(finalTokensForPreset);
      if (finalName !== currentConfigName) setCurrentConfigName(finalName);
      if (setHasPendingChanges) setHasPendingChanges(false);

      setConfigLoadNonce(prevNonce => prevNonce + 1);
      if (!isInitiallyResolved) {
        setIsInitiallyResolved(true);
      }
      setIsLoading(false);
    },
    [addToast, currentConfigName, isInitiallyResolved, setHasPendingChanges]
  );

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
  }, [hostProfileAddress, addToast, configServiceInstanceReady, configServiceRef]);

  const performPresetLoadInternal = useCallback(
    async (address, configName = null, customKey = null, reason = "manual") => {
      const service = configServiceRef.current;
      const isReady = !!service && configServiceInstanceReady;

      setIsLoading(true);
      setLoadError(null);

      if (!address) {
        applyLoadedPresetData(null, `no_target_address_in_performLoad_${reason}`, null);
        return { success: true, config: fallbackConfig };
      }
      if (!isReady) {
        addToast("Preset service not ready. Applying client fallback.", "warning");
        applyLoadedPresetData(null, `service_not_ready_in_performLoad_${reason}`, address); // Pass address for context
        return { success: false, error: "Service not ready." };
      }

      try {
        const loadedData = await service.loadConfiguration(address, configName, customKey);
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
    [configServiceInstanceReady, applyLoadedPresetData, addToast, loadSavedConfigListInternal, configServiceRef]
  );

  useEffect(() => {
    const currentAddress = hostProfileAddress;
    const serviceIsReady = configServiceInstanceReady;

    if (currentAddress !== prevProfileAddressRef.current) {
        prevProfileAddressRef.current = currentAddress;
        initialDefaultLoadAttemptedForCurrentAddressRef.current = false;

        setIsLoading(true);
        setIsInitiallyResolved(false);
        setConfigLoadNonce(0);
        setCurrentConfigName(null);
        setLoadedLayerConfigsFromPreset(null);
        setLoadedTokenAssignmentsFromPreset(null);
        setLoadError(null);
        if (setHasPendingChanges) setHasPendingChanges(false);

        if (!currentAddress) {
            applyLoadedPresetData(null, "profile_disconnected", "Fallback");
            setSavedConfigList([]);
            return;
        }
    }

    if (currentAddress && serviceIsReady && !initialDefaultLoadAttemptedForCurrentAddressRef.current && !isInitiallyResolved) {
        initialDefaultLoadAttemptedForCurrentAddressRef.current = true;
        setIsLoading(true);

        performPresetLoadInternal(currentAddress, null, null, "initial_default_load_for_profile")
            .catch(error => {
                if (import.meta.env.DEV) {
                    console.error(`[PresetManagementContext] Critical error during initial performPresetLoadInternal for ${currentAddress.slice(0,6)}:`, error);
                }
                applyLoadedPresetData({ error: "Critical initial load error" }, currentAddress);
            });
    }
  }, [hostProfileAddress, configServiceInstanceReady, isInitiallyResolved, performPresetLoadInternal, applyLoadedPresetData, setHasPendingChanges]);

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
        layers: completeLayerConfigsForSave, // This will be stored as 'l' by ConfigService
        tokenAssignments: tokenAssignmentsToSave || {}, // This will be stored as 'tA'
        reactions: includeReactions ? globalSavedReactions : undefined,
        midi: includeMidi ? globalMidiMap : undefined,
      };

      try {
        const result = await service.saveConfiguration(addressToSave, dataToSave, nameToSave, setAsDefault, true, includeReactions, includeMidi, null);
        if (result.success) {
          addToast(`Preset '${nameToSave}' saved successfully!`, 'success');
          setSaveSuccess(true);
          if (setHasPendingChanges) setHasPendingChanges(false);
          if (currentConfigName !== nameToSave || setAsDefault) {
             setCurrentConfigName(nameToSave);
          }
          await loadSavedConfigListInternal();
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
    [hostProfileAddress, globalSavedReactions, globalMidiMap, addToast, loadSavedConfigListInternal, configServiceInstanceReady, configServiceRef, setHasPendingChanges, currentConfigName]
  );

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
      setIsSaving(true); setSaveError(null); setSaveSuccess(false);
      try {
        const result = await service.deleteConfiguration(addressToDeleteFrom, nameToDelete);
        if (result.success) {
          addToast(`Preset '${nameToDelete}' deleted.`, 'success');
          setSaveSuccess(true);
          await loadSavedConfigListInternal();
          if (currentConfigName === nameToDelete) {
            await performPresetLoadInternal(addressToDeleteFrom, null, null, `delete_cleanup_for_${nameToDelete}`);
          }
        } else { throw new Error(result.error || "Delete operation failed."); }
        return result;
      } catch (error) {
        const errorMsg = error.message || "Unknown delete error."; setSaveError(errorMsg);
        addToast(`Error deleting preset: ${errorMsg}`, 'error');
        if (import.meta.env.DEV) console.error(`[PresetManagementContext] Error deleting preset:`, error);
        setSaveSuccess(false); return { success: false, error: errorMsg };
      } finally {
        setIsSaving(false);
      }
    },
    [hostProfileAddress, performPresetLoadInternal, addToast, loadSavedConfigListInternal, currentConfigName, configServiceInstanceReady, configServiceRef]
  );

  const loadNamedConfig = useCallback((name) =>
    performPresetLoadInternal(hostProfileAddress, name, null, `load_named:${name}`),
    [performPresetLoadInternal, hostProfileAddress]
  );

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
    loadSavedConfigList: loadSavedConfigListInternal,
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
  if (context === undefined) { // Standard check for missing provider
    const err = new Error("usePresetManagement must be used within a PresetManagementProvider");
    if (import.meta.env.DEV) {
        console.error("usePresetManagement context details: Attempted to use context but found undefined. This usually means PresetManagementProvider is missing as an ancestor.", err.stack);
    }
    throw err;
  }
  return context;
};