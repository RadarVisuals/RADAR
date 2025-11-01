// src/hooks/configSelectors.js
import { useMemo } from 'react';

import { useUserSession } from '../context/UserSessionContext.jsx';
import { useWorkspaceContext } from '../context/WorkspaceContext.jsx';
import { useVisualEngineContext } from '../context/VisualEngineContext.jsx';
import { useUpProvider } from '../context/UpProvider.jsx';

/**
 * @typedef {object} VisualLayerState
 * @property {object} layerConfigs - Configuration for visual layers of the host profile. Sourced from `VisualEngineContext`.
 * @property {object} tokenAssignments - Mapping of layer IDs to token identifiers or image URLs for the host profile. Sourced from `VisualEngineContext`.
 * @property {(layerId: string | number, key: string, value: any) => void} updateLayerConfig - Updates a specific property of a layer's configuration for the host profile. From `VisualEngineContext`.
 * @property {(layerId: string | number, tokenId: string | object | null) => void} updateTokenAssignment - Updates the token assigned to a layer for the host profile. From `VisualEngineContext`.
 */
export const useVisualLayerState = () => {
  const visualEngineCtx = useVisualEngineContext();
  return useMemo(() => ({
    layerConfigs: visualEngineCtx.uiControlConfig?.layers,
    tokenAssignments: visualEngineCtx.uiControlConfig?.tokenAssignments,
    updateLayerConfig: visualEngineCtx.updateLayerConfig,
    updateTokenAssignment: visualEngineCtx.updateTokenAssignment,
  }), [visualEngineCtx.uiControlConfig, visualEngineCtx.updateLayerConfig, visualEngineCtx.updateTokenAssignment]);
};

/**
 * @typedef {object} SetManagementState
 * This typedef mirrors useWorkspaceContext for documentation consistency.
 */
export const useSetManagementState = () => {
  // This hook now directly passes through useWorkspaceContext.
  return useWorkspaceContext();
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
  const workspaceCtx = useWorkspaceContext();
  return useMemo(() => ({
    savedReactions: workspaceCtx.stagedActiveWorkspace?.globalEventReactions || {},
    midiMap: workspaceCtx.stagedSetlist?.globalUserMidiMap || {},
    updateSavedReaction: workspaceCtx.updateGlobalEventReactions,
    deleteSavedReaction: workspaceCtx.deleteGlobalEventReaction,
    updateMidiMap: workspaceCtx.updateGlobalMidiMap,
  }), [
    workspaceCtx.stagedActiveWorkspace,
    workspaceCtx.stagedSetlist,
    workspaceCtx.updateGlobalEventReactions,
    workspaceCtx.deleteGlobalEventReaction,
    workspaceCtx.updateGlobalMidiMap,
  ]);
};

/**
 * @typedef {object} ProfileSessionState
 * @property {string | null} currentProfileAddress - Address of the Universal Profile being viewed (host).
 * @property {string | null} loggedInUserUPAddress - Address of the logged-in user's Universal Profile.
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
      loggedInUserUPAddress, // Updated from visitorProfileAddress
      isHostProfileOwner,
      isRadarProjectAdmin,
      isPreviewMode,
      canSaveToHostProfile,
      togglePreviewMode,
    } = sessionCtx;

    const canInteract = !!hostProfileAddress && !isPreviewMode;
    
    return {
      currentProfileAddress: hostProfileAddress, 
      loggedInUserUPAddress: loggedInUserUPAddress, // Updated
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
  const workspaceCtx = useWorkspaceContext();
  return useMemo(() => ({
    hasPendingChanges: workspaceCtx.hasPendingChanges,
    setHasPendingChanges: workspaceCtx.setHasPendingChanges,
  }), [workspaceCtx.hasPendingChanges, workspaceCtx.setHasPendingChanges]);
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
  const workspaceCtx = useWorkspaceContext();
  const upCtx = useUpProvider(); 

  return useMemo(() => ({
    isLoading: workspaceCtx.isLoading,
    isInitiallyResolved: workspaceCtx.isInitiallyResolved,
    configServiceInstanceReady: workspaceCtx.configServiceInstanceReady,
    sceneLoadNonce: 0, // This value is now managed internally by VisualEngineContext
    configServiceRef: workspaceCtx.configServiceRef,
    loadError: workspaceCtx.loadError,
    upInitializationError: upCtx.initializationError, 
    upFetchStateError: upCtx.fetchStateError,       
  }), [
    workspaceCtx.isLoading, workspaceCtx.isInitiallyResolved, workspaceCtx.loadError,
    workspaceCtx.configServiceInstanceReady, workspaceCtx.configServiceRef,
    upCtx.initializationError, upCtx.fetchStateError, 
  ]);
};