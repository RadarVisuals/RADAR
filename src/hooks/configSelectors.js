// src/hooks/configSelectors.js
import { useMemo } from 'react';
import { useConfig } from '../context/ConfigContext.jsx';
import { useUserSession } from '../context/UserSessionContext.jsx';
import { useVisualConfig } from '../context/VisualConfigContext.jsx'; // Import the new hook

/**
 * @typedef {object} VisualLayerState
 * @property {object} layerConfigs - Configuration for visual layers of the host profile. Sourced from `VisualConfigContext`.
 * @property {object} tokenAssignments - Mapping of layer IDs to token identifiers or image URLs for the host profile. Sourced from `VisualConfigContext`.
 * @property {(layerId: string | number, key: string, value: any) => void} updateLayerConfig - Updates a specific property of a layer's configuration for the host profile. From `VisualConfigContext`.
 * @property {(layerId: string | number, tokenId: string | object | null) => void} updateTokenAssignment - Updates the token assigned to a layer for the host profile. From `VisualConfigContext`.
 */

/**
 * Hook to select visual layer configurations and related update functions for the host profile.
 * This now sources its data from `VisualConfigContext`.
 * @returns {VisualLayerState} The visual layer state and actions.
 */
export const useVisualLayerState = () => {
  const visualCtx = useVisualConfig(); // Consume the new VisualConfigContext
  return useMemo(() => ({
    layerConfigs: visualCtx.layerConfigs,
    tokenAssignments: visualCtx.tokenAssignments,
    updateLayerConfig: visualCtx.updateLayerConfig,
    updateTokenAssignment: visualCtx.updateTokenAssignment,
  }), [visualCtx.layerConfigs, visualCtx.tokenAssignments, visualCtx.updateLayerConfig, visualCtx.updateTokenAssignment]);
};

/**
 * @typedef {object} PresetManagementState
 * @property {string | null} currentConfigName - Name of the currently loaded visual preset for the host profile. Sourced from `ConfigContext`.
 * @property {Array<{name: string}>} savedConfigList - List of saved visual preset names for the host profile. Sourced from `ConfigContext`.
 * @property {boolean} isLoading - True if a configuration for the host profile is currently being loaded. Sourced from `ConfigContext`.
 * @property {Error | string | null} loadError - Error from the last configuration load attempt for the host profile. Sourced from `ConfigContext`.
 * @property {boolean} isSaving - True if a save operation to the host profile is in progress. Sourced from `ConfigContext`.
 * @property {Error | string | null} saveError - Error from the last configuration save attempt to the host profile. Sourced from `ConfigContext`.
 * @property {boolean} saveSuccess - True if the last save operation to the host profile was successful. Sourced from `ConfigContext`.
 * @property {(nameToSave: string, setAsDefault: boolean, includeReactions: boolean, includeMidi: boolean, layerConfigsToSave: object, tokenAssignmentsToSave: object) => Promise<{success: boolean, error?: string}>} saveVisualPreset - Saves the current visual configuration as a preset to the host profile. From `ConfigContext`.
 * @property {(name: string) => Promise<{success: boolean, error?: string, config?: object | null}>} loadNamedConfig - Loads a specific named configuration from the host profile. From `ConfigContext`.
 * @property {() => Promise<{success: boolean, error?: string, config?: object | null}>} loadDefaultConfig - Loads the default configuration for the host profile. From `ConfigContext`.
 * @property {() => Promise<{success: boolean, list?: Array<{name: string}>, error?: string}>} loadSavedConfigList - Reloads the list of saved configurations from the host profile. From `ConfigContext`.
 * @property {(nameToDelete: string) => Promise<{success: boolean, error?: string}>} deleteNamedConfig - Deletes a named configuration from the host profile. From `ConfigContext`.
 */

/**
 * Hook to select preset management state and related actions for the host profile.
 * Sourced from `ConfigContext`.
 * @returns {PresetManagementState} The preset management state and actions.
 */
export const usePresetManagementState = () => {
  const ctx = useConfig(); // Consumes ConfigContext
  return useMemo(() => ({
    currentConfigName: ctx.currentConfigName,
    savedConfigList: ctx.savedConfigList,
    isLoading: ctx.isConfigLoading, // Use isConfigLoading from ConfigContext
    loadError: ctx.loadError,
    isSaving: ctx.isSaving,
    saveError: ctx.saveError,
    saveSuccess: ctx.saveSuccess,
    saveVisualPreset: ctx.saveVisualPreset,
    loadNamedConfig: ctx.loadNamedConfig,
    loadDefaultConfig: ctx.loadDefaultConfig,
    loadSavedConfigList: ctx.loadSavedConfigList,
    deleteNamedConfig: ctx.deleteNamedConfig,
  }), [
    ctx.currentConfigName, ctx.savedConfigList, ctx.isConfigLoading, ctx.loadError,
    ctx.isSaving, ctx.saveError, ctx.saveSuccess, ctx.saveVisualPreset,
    ctx.loadNamedConfig, ctx.loadDefaultConfig, ctx.loadSavedConfigList, ctx.deleteNamedConfig,
  ]);
};

/**
 * @typedef {object} InteractionSettingsState
 * @property {object} savedReactions - User-defined reactions to blockchain events for the host profile. Sourced from `ConfigContext`.
 * @property {object} midiMap - User's global MIDI controller mappings stored on the host profile. Sourced from `ConfigContext`.
 * @property {(eventType: string, reactionData: object) => void} updateSavedReaction - Adds or updates a specific event reaction configuration for the host profile. From `ConfigContext`.
 * @property {(eventType: string) => void} deleteSavedReaction - Removes an event reaction configuration for the host profile. From `ConfigContext`.
 * @property {(newMap: object) => void} updateMidiMap - Replaces the entire MIDI map configuration for the host profile. From `ConfigContext`.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalReactions - Saves only the global event reactions to the host profile. From `ConfigContext`.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalMidiMap - Saves only the global MIDI map to the host profile. From `ConfigContext`.
 */

/**
 * Hook to select interaction settings (reactions, MIDI) state and related actions for the host profile.
 * Sourced from `ConfigContext`.
 * @returns {InteractionSettingsState} The interaction settings state and actions.
 */
export const useInteractionSettingsState = () => {
  const ctx = useConfig(); // Consumes ConfigContext
  return useMemo(() => ({
    savedReactions: ctx.savedReactions,
    midiMap: ctx.midiMap,
    updateSavedReaction: ctx.updateSavedReaction,
    deleteSavedReaction: ctx.deleteSavedReaction,
    updateMidiMap: ctx.updateMidiMap,
    saveGlobalReactions: ctx.saveGlobalReactions,
    saveGlobalMidiMap: ctx.saveGlobalMidiMap,
  }), [
    ctx.savedReactions, ctx.midiMap, ctx.updateSavedReaction, ctx.deleteSavedReaction,
    ctx.updateMidiMap, ctx.saveGlobalReactions, ctx.saveGlobalMidiMap,
  ]);
};

/**
 * @typedef {object} ProfileSessionState
 * @property {string | null} currentProfileAddress - Address of the Universal Profile being viewed (host). Sourced from `UserSessionContext`.
 * @property {string | null} visitorUPAddress - Address of the visitor's Universal Profile. Sourced from `UserSessionContext`.
 * @property {boolean} isProfileOwner - True if visitorUPAddress matches currentProfileAddress (i.e., visitor is owner of host profile). Sourced from `UserSessionContext`.
 * @property {boolean} isVisitor - True if visitor is not the owner of the host profile. Derived.
 * @property {boolean} canSave - True if the current user has permissions to save changes to the host profile. Sourced from `UserSessionContext`.
 * @property {boolean} canInteract - True if the current user can interact with controls (not read-only due to preview or not being owner/admin). Derived.
 * @property {boolean} isPreviewMode - True if the app is in a special preview/demo mode. Sourced from `UserSessionContext`.
 * @property {() => void} togglePreviewMode - Toggles the preview mode. From `UserSessionContext`.
 * @property {boolean} isParentAdmin - True if the current visitor is the RADAR project admin. Sourced from `UserSessionContext`.
 */

/**
 * Hook to select profile and session-related state.
 * This hook consumes `useUserSession` to get session information.
 * @returns {ProfileSessionState} The profile and session state.
 */
export const useProfileSessionState = () => {
  const sessionCtx = useUserSession(); // Consumes UserSessionContext
  return useMemo(() => {
    const {
      hostProfileAddress,
      visitorProfileAddress,
      isHostProfileOwner,
      isRadarProjectAdmin,
      isPreviewMode,
      canSaveToHostProfile,
      togglePreviewMode,
    } = sessionCtx;

    const canInteract = !isPreviewMode && (isHostProfileOwner || isRadarProjectAdmin);

    return {
      currentProfileAddress: hostProfileAddress,
      visitorUPAddress: visitorProfileAddress,
      isProfileOwner: isHostProfileOwner,
      isVisitor: !isHostProfileOwner,
      canSave: canSaveToHostProfile,
      canInteract,
      isPreviewMode: isPreviewMode,
      togglePreviewMode: togglePreviewMode,
      isParentAdmin: isRadarProjectAdmin, // Map isRadarProjectAdmin to isParentAdmin for consumers
    };
  }, [sessionCtx]);
};

/**
 * @typedef {object} PendingChangesState
 * @property {boolean} hasPendingChanges - True if local configuration of the host profile differs from its last saved state. Sourced from `ConfigContext`.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setHasPendingChanges - Manually sets the pending changes flag. From `ConfigContext`.
 */

/**
 * Hook to select pending changes state and its setter for the host profile's configuration.
 * Sourced from `ConfigContext`.
 * @returns {PendingChangesState} The pending changes state.
 */
export const usePendingChangesState = () => {
  const ctx = useConfig(); // Consumes ConfigContext
  return useMemo(() => ({
    hasPendingChanges: ctx.hasPendingChanges,
    setHasPendingChanges: ctx.setHasPendingChanges,
  }), [ctx.hasPendingChanges, ctx.setHasPendingChanges]);
};

/**
 * @typedef {object} ConfigStatusState
 * @property {boolean} isLoading - True if any configuration aspect for the host profile is currently being fetched/processed. Sourced from `ConfigContext`.
 * @property {boolean} isInitiallyResolved - True once the very first attempt to load the host profile's config (or fallback) is done. Sourced from `ConfigContext`.
 * @property {boolean} configServiceInstanceReady - True if ConfigurationService is instantiated and has its clients. Sourced from `ConfigContext`.
 * @property {number} configLoadNonce - Increments each time a new configuration for the host profile is successfully applied. Sourced from `ConfigContext`.
 * @property {React.RefObject<import('../services/ConfigurationService.js').default | null>} configServiceRef - Ref to the ConfigurationService instance. Sourced from `ConfigContext`.
 * @property {Error | string | null} loadError - Error from the last configuration load attempt for the host profile. Sourced from `ConfigContext`.
 * @property {Error | null} upInitializationError - Error from UpProvider initialization (Note: This is not directly in ConfigContext, typically consumed where UpProvider is used).
 * @property {Error | null} upFetchStateError - Error from UpProvider client fetching (Note: Same as above).
 */

/**
 * Hook to select configuration loading status and related error states for the host profile.
 * Sourced from `ConfigContext`.
 * Note: `upInitializationError` and `upFetchStateError` are typically consumed directly from `useUpProvider`
 * where needed, rather than being passed through multiple contexts.
 * @returns {ConfigStatusState} The configuration status state.
 */
export const useConfigStatusState = () => {
  const ctx = useConfig(); // Consumes ConfigContext
  // UpProvider errors are not directly part of ConfigContext's value.
  // They are available via useUpProvider() in components/hooks that need them (like ConfigProvider itself).
  // For this selector, we reflect what's available from ConfigContext.
  return useMemo(() => ({
    isLoading: ctx.isConfigLoading,
    isInitiallyResolved: ctx.isInitiallyResolved,
    configServiceInstanceReady: ctx.configServiceInstanceReady,
    configLoadNonce: ctx.configLoadNonce,
    configServiceRef: ctx.configServiceRef,
    loadError: ctx.loadError,
    // These are not directly passed through ConfigContext in the current refactor,
    // as ConfigProvider consumes them from useUpProvider but doesn't re-expose them.
    // If a component needs these, it should consume useUpProvider directly or
    // ConfigContext would need to be explicitly designed to pass them through.
    // For now, returning null as they are not part of ConfigContext's direct value.
    upInitializationError: null,
    upFetchStateError: null,
  }), [
    ctx.isConfigLoading, ctx.isInitiallyResolved, ctx.configServiceInstanceReady,
    ctx.configLoadNonce, ctx.configServiceRef, ctx.loadError,
  ]);
};