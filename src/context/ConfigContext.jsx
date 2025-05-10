// src/context/ConfigContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useCallback, // Keep useCallback if used by configStateHook
  useMemo,
} from "react";
import PropTypes from "prop-types";
import useConfigState from "../hooks/useConfigState";
import { useUserSession } from "./UserSessionContext";
// REMOVE: import { useVisualConfig } from "./VisualConfigContext"; // No longer needed here

// JSDoc for the default context value shape
/**
 * @typedef {object} ConfigContextValue
 * @property {boolean} isConfigLoading - True if any configuration aspect for the host profile is currently being fetched/processed.
 * @property {boolean} isInitiallyResolved - True once the very first attempt to load the host profile's config (or fallback) is done.
 * @property {boolean} configServiceInstanceReady - True if ConfigurationService is instantiated and has its clients.
 * @property {object | null} loadedLayerConfigsFromPreset - Layer configurations from the most recently loaded preset (or fallback). Provided for `VisualConfigProvider` to consume.
 * @property {object | null} loadedTokenAssignmentsFromPreset - Token assignments from the most recently loaded preset (or fallback). Provided for `VisualConfigProvider` to consume.
 * @property {object} savedReactions - User-defined reactions to blockchain events for the host profile.
 * @property {object} midiMap - User's global MIDI controller mappings stored on the host profile.
 * @property {string | null} currentConfigName - Name of the currently loaded visual preset for the host profile.
 * @property {Array<{name: string}>} savedConfigList - List of saved visual preset names for the host profile.
 * @property {number} configLoadNonce - Increments each time a new configuration for the host profile is successfully applied. `VisualConfigProvider` listens to this.
 * @property {Error | string | null} loadError - Error from the last configuration load attempt for the host profile.
 * @property {Error | string | null} saveError - Error from the last configuration save attempt to the host profile.
 * @property {boolean} isSaving - True if a save operation to the host profile is in progress.
 * @property {boolean} saveSuccess - True if the last save operation to the host profile was successful.
 * @property {boolean} hasPendingChanges - True if local configuration of the host profile differs from its last saved state. This flag is set by `VisualConfigProvider` or other parts of `ConfigContext` when changes occur.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setHasPendingChanges - Manually sets the pending changes flag.
 * @property {(newMap: object) => void} updateMidiMap - Replaces the entire MIDI map configuration for the host profile.
 * @property {(nameToSave: string, setAsDefault: boolean, includeReactions: boolean, includeMidi: boolean, layerConfigsToSave: object, tokenAssignmentsToSave: object) => Promise<{success: boolean, error?: string}>} saveVisualPreset - Saves the visual configuration (layers and tokens) along with optional global settings as a preset to the host profile. Layer configurations and token assignments must be passed as arguments.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalReactions - Saves only the global event reactions to the host profile.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalMidiMap - Saves only the global MIDI map to the host profile.
 * @property {(name: string) => Promise<{success: boolean, error?: string, config?: object | null}>} loadNamedConfig - Loads a specific named configuration from the host profile.
 * @property {() => Promise<{success: boolean, error?: string, config?: object | null}>} loadDefaultConfig - Loads the default configuration for the host profile.
 * @property {() => Promise<{success: boolean, list?: Array<{name: string}>, error?: string}>} loadSavedConfigList - Reloads the list of saved configurations from the host profile.
 * @property {(nameToDelete: string) => Promise<{success: boolean, error?: string}>} deleteNamedConfig - Deletes a named configuration from the host profile.
 * @property {(eventType: string, reactionData: object) => void} updateSavedReaction - Adds or updates a specific event reaction configuration for the host profile.
 * @property {(eventType: string) => void} deleteSavedReaction - Removes an event reaction configuration for the host profile.
 * @property {React.RefObject<import('../services/ConfigurationService.js').default | null>} configServiceRef - Ref to the ConfigurationService instance.
 */

/** @type {ConfigContextValue} */
const defaultConfigContext = {
  isConfigLoading: true,
  isInitiallyResolved: false,
  configServiceInstanceReady: false,
  loadedLayerConfigsFromPreset: null,
  loadedTokenAssignmentsFromPreset: null,
  savedReactions: {},
  midiMap: {},
  currentConfigName: null,
  savedConfigList: [],
  configLoadNonce: 0,
  loadError: null,
  saveError: null,
  isSaving: false,
  saveSuccess: false,
  hasPendingChanges: false,
  setHasPendingChanges: () => {},
  updateMidiMap: () => {},
  // Stub for saveVisualPreset, expecting 6 args matching the updated JSDoc
  saveVisualPreset: async (_name, _default, _reactions, _midi, _layers, _tokens) => ({ success: false, error: "Provider not initialized" }),
  saveGlobalReactions: async () => ({ success: false, error: "Provider not initialized" }),
  saveGlobalMidiMap: async () => ({ success: false, error: "Provider not initialized" }),
  loadNamedConfig: async () => ({ success: false, error: "Provider not initialized" }),
  loadDefaultConfig: async () => ({ success: false, error: "Provider not initialized" }),
  loadSavedConfigList: async () => ({ success: false, error: "Provider not initialized" }),
  deleteNamedConfig: async () => ({ success: false, error: "Provider not initialized" }),
  updateSavedReaction: () => {},
  deleteSavedReaction: () => {},
  configServiceRef: { current: null },
};

const ConfigContext = createContext(defaultConfigContext);

/**
 * Provider for general application configuration, preset management,
 * global interaction settings (MIDI, Reactions), and service readiness.
 * It no longer directly manages visual layer configurations (layerConfigs, tokenAssignments)
 * but provides data from loaded presets for `VisualConfigProvider` to consume.
 * When saving visual presets, it now relies on the caller (UI component) to pass
 * the current visual state (`layerConfigs`, `tokenAssignments`) to its `saveVisualPreset` function.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components.
 */
export const ConfigProvider = ({ children }) => {
  const { hostProfileAddress, isPreviewMode } = useUserSession();
  // REMOVE: The incorrect useVisualConfig() call.
  // const { layerConfigs: currentLayerConfigs, tokenAssignments: currentTokenAssignments } = useVisualConfig();

  const configStateHook = useConfigState(hostProfileAddress);
  const { loadDefaultConfig } = configStateHook;

  useEffect(() => {
    if (isPreviewMode) {
      if (loadDefaultConfig && typeof loadDefaultConfig === 'function') {
        loadDefaultConfig().catch((err) => console.error("Error loading default config on preview enter:", err));
      } else {
        console.warn("loadDefaultConfig not available when trying to load on preview enter (inside effect). This might happen if configState is not fully ready.");
      }
    }
  }, [isPreviewMode, loadDefaultConfig]);

  // REMOVE: The saveVisualPresetWithVisuals wrapper.
  // The saveVisualPreset function from configStateHook already expects layerConfigs and tokenAssignments as arguments.

  const contextValue = useMemo(
    () => ({
      // Spread all properties from the configStateHook
      ...configStateHook,
      // configStateHook.saveVisualPreset is now directly exposed.
      // It expects layerConfigs and tokenAssignments as its 5th and 6th arguments.
      isConfigLoading: configStateHook.isLoading, // Ensure consistent naming if needed
    }),
    [configStateHook] // Dependency is now just the configStateHook itself
  );

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
};

ConfigProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

/**
 * Custom hook to consume the `ConfigContext`.
 * Provides access to general configuration state, preset management functions,
 * global interaction settings, service status, and data from loaded presets
 * intended for `VisualConfigProvider`.
 * @returns {ConfigContextValue} The configuration context value.
 * @throws {Error} If used outside of a `ConfigProvider`.
 */
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    const err = new Error("useConfig must be used within a ConfigProvider component.");
    console.error("useConfig context details: Attempted to use context but found undefined.", err.stack);
    throw err;
  }
  return context;
};