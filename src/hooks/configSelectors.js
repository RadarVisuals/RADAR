// src/hooks/configSelectors.js
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../store/useProjectStore';
import { useWalletStore } from '../store/useWalletStore';
import { useVisualEngineContext } from '../context/VisualEngineContext';
import { useUpProvider } from '../context/UpProvider';

// --- Session Selectors ---
export const useProfileSessionState = () => {
  return useWalletStore(useShallow(state => ({
    hostProfileAddress: state.hostProfileAddress,
    currentProfileAddress: state.hostProfileAddress,
    loggedInUserUPAddress: state.loggedInUserUPAddress,
    isProfileOwner: state.isHostProfileOwner,
    isHostProfileOwner: state.isHostProfileOwner,
    isVisitor: !state.isHostProfileOwner,
    isRadarProjectAdmin: state.isRadarProjectAdmin,
    isParentAdmin: state.isRadarProjectAdmin,
    canSave: state.isHostProfileOwner && !state.isPreviewMode,
    canSaveToHostProfile: state.isHostProfileOwner && !state.isPreviewMode,
    canInteract: !!state.hostProfileAddress && !state.isPreviewMode,
    isPreviewMode: state.isPreviewMode,
    togglePreviewMode: state.togglePreviewMode,
  })));
};

// --- Visual Layer State ---
export const useVisualLayerState = () => {
  const visualEngineCtx = useVisualEngineContext();
  return {
    layerConfigs: visualEngineCtx.uiControlConfig?.layers,
    tokenAssignments: visualEngineCtx.uiControlConfig?.tokenAssignments,
    updateLayerConfig: visualEngineCtx.updateLayerConfig,
    updateTokenAssignment: visualEngineCtx.updateTokenAssignment,
  };
};

// --- Set Management (PERFORMANCE FIX: Explicit Selection) ---
export const useSetManagementState = () => {
  // 1. Select only specific fields/actions from the Store
  const projectData = useProjectStore(useShallow(s => ({
    // Data
    stagedWorkspace: s.stagedWorkspace,
    activeWorkspaceName: s.activeWorkspaceName,
    isLoading: s.isLoading,
    isSaving: s.isSaving,
    hasPendingChanges: s.hasPendingChanges,
    stagedSetlist: s.stagedSetlist,
    activeSceneName: s.activeSceneName,
    configService: s.configService,
    
    // Actions (Workspace)
    loadWorkspace: s.loadWorkspace,
    createNewWorkspace: s.createNewWorkspace,
    deleteWorkspaceFromSet: s.deleteWorkspaceFromSet,
    renameWorkspaceInSet: s.renameWorkspaceInSet,
    setDefaultWorkspaceInSet: s.setDefaultWorkspaceInSet,
    saveChanges: s.saveChanges,
    duplicateActiveWorkspace: s.duplicateActiveWorkspace,
    preloadWorkspace: s.preloadWorkspace,
    
    // Actions (Scene)
    addScene: s.addScene,
    deleteScene: s.deleteScene,
    setDefaultScene: s.setDefaultScene,
    
    // Actions (Library)
    addCollectionToLibrary: s.addCollectionToLibrary,
    removeCollectionFromLibrary: s.removeCollectionFromLibrary,
  })));

  const session = useProfileSessionState();
  
  // 2. Memoize derived list
  const fullSceneList = useMemo(() => {
    const presets = projectData.stagedWorkspace?.presets || {};
    return Object.values(presets).sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
  }, [projectData.stagedWorkspace]);

  return {
    ...projectData,
    
    // Aliases for compatibility
    stagedActiveWorkspace: projectData.stagedWorkspace,
    addNewSceneToStagedWorkspace: projectData.addScene,
    deleteSceneFromStagedWorkspace: projectData.deleteScene,
    setDefaultSceneInStagedWorkspace: projectData.setDefaultScene,
    addCollectionToPersonalLibrary: projectData.addCollectionToLibrary,
    removeCollectionFromPersonalLibrary: projectData.removeCollectionFromLibrary,

    fullSceneList,
    
    // Session Mix-ins
    canSaveToHostProfile: session.canSaveToHostProfile,
    hostProfileAddress: session.hostProfileAddress,
    isHostProfileOwner: session.isHostProfileOwner,
  };
};

// --- Interaction Settings ---
export const useInteractionSettingsState = () => {
  // These selectors are already quite specific, but let's wrap them just in case
  const { stagedSetlist, updateGlobalEventReactions, deleteGlobalEventReaction, updateGlobalMidiMap } = useProjectStore(useShallow(s => ({
      stagedSetlist: s.stagedSetlist,
      updateGlobalEventReactions: s.updateGlobalEventReactions,
      deleteGlobalEventReaction: s.deleteGlobalEventReaction,
      updateGlobalMidiMap: s.updateGlobalMidiMap
  })));

  return {
    savedReactions: stagedSetlist?.globalEventReactions || {},
    midiMap: stagedSetlist?.globalUserMidiMap || {},
    updateSavedReaction: updateGlobalEventReactions,
    deleteSavedReaction: deleteGlobalEventReaction,
    updateMidiMap: updateGlobalMidiMap,
  };
};

// --- Pending Changes ---
export const usePendingChangesState = () => {
  return useProjectStore(useShallow(s => ({
    hasPendingChanges: s.hasPendingChanges,
    setHasPendingChanges: (val) => useProjectStore.setState({ hasPendingChanges: val }),
  })));
};

// --- Config/Loading Status ---
export const useConfigStatusState = () => {
  const projectState = useProjectStore(useShallow(s => ({
    isLoading: s.isLoading,
    isInitiallyResolved: !!s.setlist,
    configServiceInstanceReady: s.isConfigReady,
    loadError: s.error,
  })));
  
  const { initializationError, fetchStateError } = useUpProvider();

  return {
    ...projectState,
    sceneLoadNonce: 0,
    upInitializationError: initializationError,
    upFetchStateError: fetchStateError,
  };
};