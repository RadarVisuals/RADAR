// src/hooks/configSelectors.js
import { useMemo } from 'react';

import { useUserSession } from '../context/UserSessionContext.jsx';
import { useWorkspaceContext } from '../context/WorkspaceContext.jsx';
import { useVisualEngineContext } from '../context/VisualEngineContext.jsx';
import { useUpProvider } from '../context/UpProvider.jsx';
import { useSceneContext } from '../context/SceneContext.jsx'; // --- NEW IMPORT ---

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
 * Merges Workspace and Scene contexts to provide a unified API for 
 * components like SetsPanel or EnhancedSavePanel.
 */
export const useSetManagementState = () => {
  const workspaceCtx = useWorkspaceContext();
  const sceneCtx = useSceneContext();
  
  return {
      ...workspaceCtx,
      ...sceneCtx, // Overwrite any potential duplicates with Scene-level specifics
  };
};

export const useInteractionSettingsState = () => {
  const workspaceCtx = useWorkspaceContext();
  return useMemo(() => ({
    savedReactions: workspaceCtx.stagedSetlist?.globalEventReactions || {},
    midiMap: workspaceCtx.stagedSetlist?.globalUserMidiMap || {},
    updateSavedReaction: workspaceCtx.updateGlobalEventReactions,
    deleteSavedReaction: workspaceCtx.deleteGlobalEventReaction,
    updateMidiMap: workspaceCtx.updateGlobalMidiMap,
  }), [
    workspaceCtx.stagedSetlist, 
    workspaceCtx.updateGlobalEventReactions,
    workspaceCtx.deleteGlobalEventReaction,
    workspaceCtx.updateGlobalMidiMap,
  ]);
};

export const useProfileSessionState = () => {
  const sessionCtx = useUserSession();

  return useMemo(() => {
    const {
      hostProfileAddress,
      loggedInUserUPAddress,
      isHostProfileOwner,
      isRadarProjectAdmin,
      isPreviewMode,
      canSaveToHostProfile,
      togglePreviewMode,
    } = sessionCtx;

    const canInteract = !!hostProfileAddress && !isPreviewMode;
    
    return {
      currentProfileAddress: hostProfileAddress, 
      loggedInUserUPAddress: loggedInUserUPAddress,
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

export const usePendingChangesState = () => {
  const sceneCtx = useSceneContext(); // --- UPDATED: Sourced from SceneContext ---
  return useMemo(() => ({
    hasPendingChanges: sceneCtx.hasPendingChanges,
    setHasPendingChanges: sceneCtx.setHasPendingChanges,
  }), [sceneCtx.hasPendingChanges, sceneCtx.setHasPendingChanges]);
};

export const useConfigStatusState = () => {
  const workspaceCtx = useWorkspaceContext();
  const upCtx = useUpProvider(); 

  return useMemo(() => ({
    isLoading: workspaceCtx.isLoading,
    isInitiallyResolved: workspaceCtx.isInitiallyResolved,
    configServiceInstanceReady: workspaceCtx.configServiceInstanceReady,
    sceneLoadNonce: 0,
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