// src/hooks/configSelectors.js
import { useMemo } from 'react';

import { useUserSession } from '../context/UserSessionContext.jsx';
import { useAppContext } from '../context/AppContext.jsx';
import { useUpProvider } from '../context/UpProvider.jsx';

/**
 * @typedef {object} VisualLayerState
 * @property {object} layerConfigs - Configuration for visual layers of the host profile. Sourced from `AppContext`.
 * @property {object} tokenAssignments - Mapping of layer IDs to token identifiers or image URLs for the host profile. Sourced from `AppContext`.
 * @property {(layerId: string | number, key: string, value: any) => void} updateLayerConfig - Updates a specific property of a layer's configuration for the host profile. From `AppContext`.
 * @property {(layerId: string | number, tokenId: string | object | null) => void} updateTokenAssignment - Updates the token assigned to a layer for the host profile. From `AppContext`.
 */
export const useVisualLayerState = () => {
  const appCtx = useAppContext();
  return useMemo(() => ({
    layerConfigs: appCtx.layerConfigs,
    tokenAssignments: appCtx.tokenAssignments,
    updateLayerConfig: appCtx.updateLayerConfig,
    updateTokenAssignment: appCtx.updateTokenAssignment,
  }), [appCtx.layerConfigs, appCtx.tokenAssignments, appCtx.updateLayerConfig, appCtx.updateTokenAssignment]);
};

/**
 * @typedef {object} SetManagementState
 * This typedef mirrors useAppContext for documentation consistency.
 */
export const useSetManagementState = () => {
  // This hook now directly passes through useAppContext.
  return useAppContext();
};

/**
 * @typedef {object} InteractionSettingsState
 * @property {object} savedReactions - User-defined reactions to blockchain events for the active workspace.
 * @property {object} midiMap - User's global MIDI controller mappings for the active workspace.
 * @property {(eventType: string, reactionData: object) => void} updateSavedReaction - Adds or updates a specific event reaction configuration.
 * @property {(eventType: string) => void} deleteSavedReaction - Removes an event reaction configuration.
 * @property {(newMap: object) => void} updateMidiMap - Replaces the entire MIDI map configuration.
 */
export const useInteractionSettingsState = () => {
  const appCtx = useAppContext();
  return useMemo(() => ({
    savedReactions: appCtx.activeEventReactions || {},
    midiMap: appCtx.activeMidiMap || {},
    updateSavedReaction: appCtx.updateGlobalEventReactions,
    deleteSavedReaction: appCtx.deleteGlobalEventReaction,
    updateMidiMap: appCtx.updateGlobalMidiMap,
  }), [
    appCtx.activeEventReactions,
    appCtx.activeMidiMap,
    appCtx.updateGlobalEventReactions,
    appCtx.deleteGlobalEventReaction,
    appCtx.updateGlobalMidiMap,
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
  const appCtx = useAppContext();
  return useMemo(() => ({
    hasPendingChanges: appCtx.hasPendingChanges,
    setHasPendingChanges: appCtx.setHasPendingChanges,
  }), [appCtx.hasPendingChanges, appCtx.setHasPendingChanges]);
};

/**
 * @typedef {object} ConfigStatusState
 * @property {boolean} isLoading - True if a setlist or workspace for the host profile is currently being loaded.
 * @property {boolean} isInitiallyResolved - True once the very first attempt to load the host profile's data is done.
 * @property {boolean} configServiceInstanceReady - True if ConfigurationService is instantiated and ready.
 * @property {number} sceneLoadNonce - Increments each time a new scene for the host profile is applied.
 * @property {React.RefObject<import('../services/ConfigurationService.js').default | null>} configServiceRef - Ref to the ConfigurationService instance.
 * @property {Error | string | null} loadError - Error from the last load attempt.
 * @property {Error | null} upInitializationError - Error from UpProvider initialization.
 * @property {Error | null} upFetchStateError - Error from UpProvider client fetching.
 */
export const useConfigStatusState = () => {
  const appCtx = useAppContext();
  const upCtx = useUpProvider(); 

  return useMemo(() => ({
    isLoading: appCtx.isLoading,
    isInitiallyResolved: appCtx.isInitiallyResolved,
    configServiceInstanceReady: appCtx.configServiceInstanceReady,
    sceneLoadNonce: appCtx.sceneLoadNonce,
    configServiceRef: appCtx.configServiceRef,
    loadError: appCtx.loadError,
    upInitializationError: upCtx.initializationError, 
    upFetchStateError: upCtx.fetchStateError,       
  }), [
    appCtx.isLoading, appCtx.isInitiallyResolved, appCtx.sceneLoadNonce, appCtx.loadError,
    appCtx.configServiceInstanceReady, appCtx.configServiceRef,
    upCtx.initializationError, upCtx.fetchStateError, 
  ]);
};