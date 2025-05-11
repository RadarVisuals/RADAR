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
 * each with a `name` property.
 * @param {string[]} list - An array of preset name strings.
 * @returns {Array<{name: string}>} An array of preset objects.
 */
const transformStringListToObjects = (list) => {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => typeof item === "string").map((name) => ({ name }));
};

/**
 * Returns a default template for a layer's configuration.
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
 * Ensures that a given layer configuration object has all necessary properties,
 * falling back to a default template for any missing ones.
 * @param {object} layerConfig - The partial layer configuration.
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
      if (
        key === "driftState" &&
        typeof layerConfig[key] === "object" &&
        defaultLayerConfigTemplate.driftState
      ) {
        completeConfig[key] = {
          ...defaultLayerConfigTemplate.driftState,
          ...layerConfig[key],
        };
      }
    }
  }
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
 * @property {string | null} currentConfigName - Name of the currently loaded visual preset.
 * @property {Array<{name: string}>} savedConfigList - List of saved visual preset names.
 * @property {boolean} isLoading - True when loading a preset or the list of presets.
 * @property {Error | string | null} loadError - Error from the last preset load attempt.
 * @property {boolean} isSaving - True when saving or deleting a preset.
 * @property {Error | string | null} saveError - Error from the last preset save/delete attempt.
 * @property {boolean} saveSuccess - True if the last save/delete operation was successful.
 * @property {boolean} isInitiallyResolved - True once the initial attempt to load a preset (or fallback) is done.
 * @property {number} configLoadNonce - Increments each time a new configuration preset is successfully applied, used to trigger downstream effects.
 * @property {object | null} loadedLayerConfigsFromPreset - The layer configurations loaded from the most recent preset.
 * @property {object | null} loadedTokenAssignmentsFromPreset - The token assignments loaded from the most recent preset.
 * @property {(name: string) => Promise<{success: boolean, error?: string, config?: object | null}>} loadNamedConfig - Loads a specific named configuration.
 * @property {() => Promise<{success: boolean, error?: string, config?: object | null}>} loadDefaultConfig - Loads the default configuration.
 * @property {() => Promise<{success: boolean, list?: Array<{name: string}>, error?: string}>} loadSavedConfigList - Reloads the list of saved configurations.
 * @property {(nameToSave: string, setAsDefault: boolean, includeReactions: boolean, includeMidi: boolean, layerConfigsToSave: object, tokenAssignmentsToSave: object) => Promise<{success: boolean, error?: string}>} saveVisualPreset - Saves the current visual configuration as a preset.
 * @property {(nameToDelete: string) => Promise<{success: boolean, error?: string}>} deleteNamedConfig - Deletes a named configuration.
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
  loadNamedConfig: async () => ({ success: false, error: "Provider not initialized" }),
  loadDefaultConfig: async () => ({ success: false, error: "Provider not initialized" }),
  loadSavedConfigList: async () => ({ success: false, error: "Provider not initialized" }),
  saveVisualPreset: async () => ({ success: false, error: "Provider not initialized" }),
  deleteNamedConfig: async () => ({ success: false, error: "Provider not initialized" }),
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

  const [currentConfigName, setCurrentConfigName] = useState(null);
  const [savedConfigList, setSavedConfigList] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isInitiallyResolved, setIsInitiallyResolved] = useState(false);
  const [configLoadNonce, setConfigLoadNonce] = useState(0);

  const [loadError, setLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [loadedLayerConfigsFromPreset, setLoadedLayerConfigsFromPreset] = useState(null);
  const [loadedTokenAssignmentsFromPreset, setLoadedTokenAssignmentsFromPreset] = useState(null);

  const prevProfileAddressRef = useRef(hostProfileAddress);
  const initialDefaultLoadAttemptedForCurrentAddressRef = useRef(false);

  const applyLoadedPresetData = useCallback(
    // Removed unused 'reason' parameter
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
        finalName = targetName || "ErrorState";
        const fallbackLayersData = fallbackConfig.layers || {};
        finalLayersForPreset = {};
        for (const layerId of ['1', '2', '3']) {
          finalLayersForPreset[layerId] = ensureCompleteLayerConfigStructure(fallbackLayersData[layerId], minimalLayerTemplate);
        }
        finalTokensForPreset = fallbackConfig.tokenAssignments || {};
      } else if (loadedData?.config) {
        finalName = loadedData.config.name ?? targetName ?? "Unnamed Preset";
        finalLayersForPreset = {};
        for (const layerId of ['1', '2', '3']) {
          finalLayersForPreset[layerId] = ensureCompleteLayerConfigStructure(loadedData.config.layers?.[layerId], minimalLayerTemplate);
        }
        finalTokensForPreset = loadedData.config.tokenAssignments || {};
        setLoadError(null);
      } else {
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
      addToast(`Failed to load preset list: ${error.message}`, 'error');
      setSavedConfigList([]);
      return { success: false, error: error.message || "Failed to load list." };
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
        applyLoadedPresetData(null, `service_not_ready_in_performLoad_${reason}`, address);
        return { success: false, error: "Service not ready." };
      }

      try {
        const loadedData = await service.loadConfiguration(address, configName, customKey);
        applyLoadedPresetData({ config: loadedData.config, error: loadedData.error }, address, configName || "Default"); // Removed reason from here

        const loadSuccessful = !loadedData?.error && !!loadedData?.config;
        if (loadSuccessful) {
          loadSavedConfigListInternal().catch((listError) => {
            console.error(`[PresetManagementContext performPresetLoadInternal] Error from loadSavedConfigListInternal after successful preset load:`, listError);
          });
        }
        return { success: loadSuccessful, error: loadedData?.error, config: loadedData?.config };
      } catch (error) {
        const errorMsg = error.message || "Unknown load error";
        applyLoadedPresetData({ error: errorMsg }, address, configName || "Default"); // Removed reason from here
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
            return;
        }
    }

    if (currentAddress && serviceIsReady && !initialDefaultLoadAttemptedForCurrentAddressRef.current && !isInitiallyResolved) {
        initialDefaultLoadAttemptedForCurrentAddressRef.current = true;
        setIsLoading(true);

        performPresetLoadInternal(currentAddress, null, null, "initial_default_load_for_profile")
            .catch(error => {
                console.error(`[PresetManagementContext] Critical error during initial performPresetLoadInternal for ${currentAddress.slice(0,6)}:`, error);
                applyLoadedPresetData({ error: "Critical load error" }, currentAddress); // Removed reason
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
        layers: completeLayerConfigsForSave,
        tokenAssignments: tokenAssignmentsToSave || {},
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
      setIsSaving(true); setSaveError(null);
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
        return { success: false, error: errorMsg };
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
  if (context === undefined) {
    throw new Error("usePresetManagement must be used within a PresetManagementProvider");
  }
  return context;
};