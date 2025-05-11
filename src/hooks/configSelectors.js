// src/hooks/configSelectors.js
import { useMemo } from 'react';
import { useConfig } from '../context/ConfigContext.jsx';
import { useUserSession } from '../context/UserSessionContext.jsx';
import { useVisualConfig } from '../context/VisualConfigContext.jsx';
import { usePresetManagement } from '../context/PresetManagementContext.jsx';
import { useUpProvider } from '../context/UpProvider.jsx'; // Import useUpProvider

/**
 * @typedef {object} VisualLayerState
 * @property {object} layerConfigs - Configuration for visual layers of the host profile. Sourced from `VisualConfigContext`.
 * @property {object} tokenAssignments - Mapping of layer IDs to token identifiers or image URLs for the host profile. Sourced from `VisualConfigContext`.
 * @property {(layerId: string | number, key: string, value: any) => void} updateLayerConfig - Updates a specific property of a layer's configuration for the host profile. From `VisualConfigContext`.
 * @property {(layerId: string | number, tokenId: string | object | null) => void} updateTokenAssignment - Updates the token assigned to a layer for the host profile. From `VisualConfigContext`.
 */

export const useVisualLayerState = () => {
  const visualCtx = useVisualConfig();
  return useMemo(() => ({
    layerConfigs: visualCtx.layerConfigs,
    tokenAssignments: visualCtx.tokenAssignments,
    updateLayerConfig: visualCtx.updateLayerConfig,
    updateTokenAssignment: visualCtx.updateTokenAssignment,
  }), [visualCtx.layerConfigs, visualCtx.tokenAssignments, visualCtx.updateLayerConfig, visualCtx.updateTokenAssignment]);
};

/**
 * @typedef {object} PresetManagementState
 * @property {string | null} currentConfigName - Name of the currently loaded visual preset for the host profile.
 * @property {Array<{name: string}>} savedConfigList - List of saved visual preset names for the host profile.
 * @property {boolean} isLoading - True when loading a preset or the list of presets.
 * @property {Error | string | null} loadError - Error from the last preset load attempt.
 * @property {boolean} isSaving - True when saving or deleting a preset.
 * @property {Error | string | null} saveError - Error from the last preset save/delete attempt.
 * @property {boolean} saveSuccess - True if the last save/delete operation was successful.
 * @property {(nameToSave: string, setAsDefault: boolean, includeReactions: boolean, includeMidi: boolean, layerConfigsToSave: object, tokenAssignmentsToSave: object) => Promise<{success: boolean, error?: string}>} saveVisualPreset - Saves the current visual configuration as a preset to the host profile.
 * @property {(name: string) => Promise<{success: boolean, error?: string, config?: object | null}>} loadNamedConfig - Loads a specific named configuration from the host profile.
 * @property {() => Promise<{success: boolean, error?: string, config?: object | null}>} loadDefaultConfig - Loads the default configuration for the host profile.
 * @property {() => Promise<{success: boolean, list?: Array<{name: string}>, error?: string}>} loadSavedConfigList - Reloads the list of saved configurations from the host profile.
 * @property {(nameToDelete: string) => Promise<{success: boolean, error?: string}>} deleteNamedConfig - Deletes a named configuration from the host profile.
 */

export const usePresetManagementState = () => {
  const presetCtx = usePresetManagement();
  return useMemo(() => ({
    currentConfigName: presetCtx.currentConfigName,
    savedConfigList: presetCtx.savedConfigList,
    isLoading: presetCtx.isLoading,
    loadError: presetCtx.loadError,
    isSaving: presetCtx.isSaving,
    saveError: presetCtx.saveError,
    saveSuccess: presetCtx.saveSuccess,
    saveVisualPreset: presetCtx.saveVisualPreset,
    loadNamedConfig: presetCtx.loadNamedConfig,
    loadDefaultConfig: presetCtx.loadDefaultConfig,
    loadSavedConfigList: presetCtx.loadSavedConfigList,
    deleteNamedConfig: presetCtx.deleteNamedConfig,
  }), [
    presetCtx.currentConfigName, presetCtx.savedConfigList, presetCtx.isLoading, presetCtx.loadError,
    presetCtx.isSaving, presetCtx.saveError, presetCtx.saveSuccess, presetCtx.saveVisualPreset,
    presetCtx.loadNamedConfig, presetCtx.loadDefaultConfig, presetCtx.loadSavedConfigList, presetCtx.deleteNamedConfig,
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

export const useInteractionSettingsState = () => {
  const ctx = useConfig();
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

export const useProfileSessionState = () => {
  const sessionCtx = useUserSession();
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
      isParentAdmin: isRadarProjectAdmin,
    };
  }, [sessionCtx]);
};

/**
 * @typedef {object} PendingChangesState
 * @property {boolean} hasPendingChanges - True if local configuration of the host profile differs from its last saved state. Sourced from `ConfigContext`.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setHasPendingChanges - Manually sets the pending changes flag. From `ConfigContext`.
 */

export const usePendingChangesState = () => {
  const ctx = useConfig();
  return useMemo(() => ({
    hasPendingChanges: ctx.hasPendingChanges,
    setHasPendingChanges: ctx.setHasPendingChanges,
  }), [ctx.hasPendingChanges, ctx.setHasPendingChanges]);
};

/**
 * @typedef {object} ConfigStatusState
 * @property {boolean} isLoading - True if a preset for the host profile is currently being loaded or list is being fetched. Sourced from `PresetManagementContext`.
 * @property {boolean} isInitiallyResolved - True once the very first attempt to load the host profile's preset (or fallback) is done. Sourced from `PresetManagementContext`.
 * @property {boolean} configServiceInstanceReady - True if ConfigurationService is instantiated and has its clients. Sourced from `ConfigContext`.
 * @property {number} configLoadNonce - Increments each time a new configuration preset for the host profile is successfully applied. Sourced from `PresetManagementContext`.
 * @property {React.RefObject<import('../services/ConfigurationService.js').default | null>} configServiceRef - Ref to the ConfigurationService instance. Sourced from `ConfigContext`.
 * @property {Error | string | null} loadError - Error from the last preset load attempt for the host profile. Sourced from `PresetManagementContext`.
 * @property {Error | null} upInitializationError - Error from UpProvider initialization. Sourced from `UpProvider`.
 * @property {Error | null} upFetchStateError - Error from UpProvider client fetching. Sourced from `UpProvider`.
 */

export const useConfigStatusState = () => {
  const configCtx = useConfig();
  const presetCtx = usePresetManagement();
  const upCtx = useUpProvider(); // Get UpProvider context

  const memoizedValue = useMemo(() => {
    const val = {
      isLoading: presetCtx.isLoading,
      isInitiallyResolved: presetCtx.isInitiallyResolved,
      configServiceInstanceReady: configCtx.configServiceInstanceReady,
      configLoadNonce: presetCtx.configLoadNonce,
      configServiceRef: configCtx.configServiceRef,
      loadError: presetCtx.loadError,
      upInitializationError: upCtx.initializationError, // Source from upCtx
      upFetchStateError: upCtx.fetchStateError,       // Source from upCtx
    };
    // console.log(`[DEBUG useConfigStatusState] Values from presetCtx -> isLoading: ${presetCtx.isLoading}, isInitiallyResolved: ${presetCtx.isInitiallyResolved}, configLoadNonce: ${presetCtx.configLoadNonce}. Returning: isLoading: ${val.isLoading}, isInitiallyResolved: ${val.isInitiallyResolved}`);
    return val;
  }, [
    presetCtx.isLoading, presetCtx.isInitiallyResolved, presetCtx.configLoadNonce, presetCtx.loadError,
    configCtx.configServiceInstanceReady, configCtx.configServiceRef,
    upCtx.initializationError, upCtx.fetchStateError, // Add to dependencies
  ]);

  return memoizedValue;
};