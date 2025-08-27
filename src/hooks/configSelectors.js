// src/hooks/configSelectors.js
import { useMemo } from 'react';

// REMOVED: No longer importing from the deleted ConfigContext
import { useUserSession } from '../context/UserSessionContext.jsx';
import { useVisualConfig } from '../context/VisualConfigContext.jsx';
import { usePresetManagement } from '../context/PresetManagementContext.jsx';
import { useUpProvider } from '../context/UpProvider.jsx';

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
 * This typedef is now slightly redundant as it mirrors usePresetManagement, but kept for documentation consistency.
 */
export const usePresetManagementState = () => {
  // This hook now directly passes through usePresetManagement as it's the core state manager.
  return usePresetManagement();
};

/**
 * @typedef {object} InteractionSettingsState
 * @property {object} savedReactions - User-defined reactions to blockchain events for the host profile.
 * @property {object} midiMap - User's global MIDI controller mappings stored on the host profile.
 * @property {(eventType: string, reactionData: object) => void} updateSavedReaction - Adds or updates a specific event reaction configuration.
 * @property {(eventType: string) => void} deleteSavedReaction - Removes an event reaction configuration.
 * @property {(newMap: object) => void} updateMidiMap - Replaces the entire MIDI map configuration.
 */
export const useInteractionSettingsState = () => {
  // UPDATED: Now uses usePresetManagement as the source of truth.
  const presetCtx = usePresetManagement();
  return useMemo(() => ({
    savedReactions: presetCtx.activeEventReactions || {},
    midiMap: presetCtx.activeMidiMap || {},
    updateSavedReaction: presetCtx.updateGlobalEventReactions,
    deleteSavedReaction: presetCtx.deleteGlobalEventReaction,
    updateMidiMap: presetCtx.updateGlobalMidiMap,
  }), [
    presetCtx.activeEventReactions,
    presetCtx.activeMidiMap,
    presetCtx.updateGlobalEventReactions,
    presetCtx.deleteGlobalEventReaction,
    presetCtx.updateGlobalMidiMap,
  ]);
};

/**
 * @typedef {object} ProfileSessionState
 * @property {string | null} currentProfileAddress - Address of the Universal Profile being viewed (host).
 * @property {string | null} visitorUPAddress - Address of the visitor's Universal Profile.
 * @property {boolean} isProfileOwner - True if visitor is owner of host profile.
 * @property {boolean} isVisitor - True if visitor is not the owner of the host profile.
 * @property {boolean} canSave - True if the current user has permissions to save changes to the host profile.
 * @property {boolean} canInteract - True if the current user can interact with controls (not read-only).
 * @property {boolean} isPreviewMode - True if the app is in a special preview/demo mode.
 * @property {() => void} togglePreviewMode - Toggles the preview mode.
 * @property {boolean} isParentAdmin - True if the current visitor is the RADAR project admin.
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

    const canInteract = !!hostProfileAddress && !isPreviewMode;
    
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
 * @property {boolean} hasPendingChanges - True if local configuration of the host profile differs from its last saved state.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setHasPendingChanges - Manually sets the pending changes flag.
 */
export const usePendingChangesState = () => {
  // UPDATED: Now uses usePresetManagement.
  const presetCtx = usePresetManagement();
  return useMemo(() => ({
    hasPendingChanges: presetCtx.hasPendingChanges,
    setHasPendingChanges: presetCtx.setHasPendingChanges,
  }), [presetCtx.hasPendingChanges, presetCtx.setHasPendingChanges]);
};

/**
 * @typedef {object} ConfigStatusState
 * @property {boolean} isLoading - True if a preset for the host profile is currently being loaded.
 * @property {boolean} isInitiallyResolved - True once the very first attempt to load the host profile's data is done.
 * @property {boolean} configServiceInstanceReady - True if ConfigurationService is instantiated and ready.
 * @property {number} configLoadNonce - Increments each time a new configuration preset for the host profile is applied.
 * @property {React.RefObject<import('../services/ConfigurationService.js').default | null>} configServiceRef - Ref to the ConfigurationService instance.
 * @property {Error | string | null} loadError - Error from the last preset load attempt.
 * @property {Error | null} upInitializationError - Error from UpProvider initialization.
 * @property {Error | null} upFetchStateError - Error from UpProvider client fetching.
 */
export const useConfigStatusState = () => {
  // UPDATED: Now uses usePresetManagement for service ref and readiness.
  const presetCtx = usePresetManagement();
  const upCtx = useUpProvider(); 

  return useMemo(() => ({
    isLoading: presetCtx.isLoading,
    isInitiallyResolved: presetCtx.isInitiallyResolved,
    configServiceInstanceReady: presetCtx.configServiceInstanceReady,
    configLoadNonce: presetCtx.configLoadNonce,
    configServiceRef: presetCtx.configServiceRef,
    loadError: presetCtx.loadError,
    upInitializationError: upCtx.initializationError, 
    upFetchStateError: upCtx.fetchStateError,       
  }), [
    presetCtx.isLoading, presetCtx.isInitiallyResolved, presetCtx.configLoadNonce, presetCtx.loadError,
    presetCtx.configServiceInstanceReady, presetCtx.configServiceRef,
    upCtx.initializationError, upCtx.fetchStateError, 
  ]);
};