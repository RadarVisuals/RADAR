// src/context/WorkspaceContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useUpProvider } from './UpProvider';
import { useUserSession } from './UserSessionContext';
import { useToast } from './ToastContext';

const WorkspaceContext = createContext();

export const WorkspaceProvider = ({ children }) => {
  const { provider, walletClient, publicClient } = useUpProvider();
  const { hostProfileAddress, loggedInUserUPAddress, isHostProfileOwner } = useUserSession();
  const { addToast } = useToast();

  // Access Store Hooks (Actions are stable)
  const initService = useProjectStore(state => state.initService);
  const loadSetlist = useProjectStore(state => state.loadSetlist);
  const resetProject = useProjectStore(state => state.resetProject);
  
  // State Selectors
  // We subscribe to the whole store to proxy values, BUT we must be careful with refs
  const storeState = useProjectStore();

  // --- CRITICAL FIX START ---
  // We use a React ref to hold the service. The ref OBJECT ITSELF ({ current: ... }) 
  // must remain referentially stable across renders.
  const configServiceRef = useRef(null);

  // We sync the value inside a useEffect. This updates the .current property 
  // without creating a new Ref object.
  useEffect(() => {
    configServiceRef.current = storeState.configService;
  }, [storeState.configService]);
  // --- CRITICAL FIX END ---

  // 1. Initialize Service when Provider is ready
  useEffect(() => {
    if (provider && publicClient) {
      initService(provider, walletClient, publicClient);
    }
  }, [provider, walletClient, publicClient, initService]);

  // 2. Load Data when Profile Changes
  useEffect(() => {
    // Only load if we have a profile AND the service is ready
    if (hostProfileAddress && storeState.isConfigReady) {
      const visitorContext = !isHostProfileOwner && loggedInUserUPAddress 
        ? { isVisitor: true, loggedInUserUPAddress } 
        : null;
      
      loadSetlist(hostProfileAddress, visitorContext);
    } else if (!hostProfileAddress) {
      resetProject();
    }
    // Dependencies must be precise to avoid loops
  }, [hostProfileAddress, storeState.isConfigReady, loadSetlist, resetProject, isHostProfileOwner, loggedInUserUPAddress]);

  // 3. Construct Compatibility API
  const contextValue = useMemo(() => {
    return {
      // Data
      isLoading: storeState.isLoading,
      loadingMessage: storeState.loadingMessage,
      isFullyLoaded: !storeState.isLoading && !!storeState.activeWorkspaceName,
      isInitiallyResolved: !!storeState.setlist,
      isSaving: storeState.isSaving,
      loadError: storeState.error,
      
      setlist: storeState.setlist,
      stagedSetlist: storeState.stagedSetlist,
      activeWorkspaceName: storeState.activeWorkspaceName,
      stagedActiveWorkspace: storeState.stagedWorkspace,
      activeSceneName: storeState.activeSceneName,
      
      // Flags
      hasPendingChanges: storeState.hasPendingChanges,
      configServiceInstanceReady: storeState.isConfigReady,
      
      // --- PASS THE STABLE REF ---
      // Do NOT create a new object here like { current: ... }
      configServiceRef: configServiceRef, 
      // ---------------------------

      // Setters (Mapped to Store Actions)
      setActiveSceneName: storeState.setActiveSceneName,
      setHasPendingChanges: (val) => useProjectStore.setState({ hasPendingChanges: val }),
      
      // Actions
      startLoadingProcess: () => { /* No-op, auto-handled now */ },
      loadWorkspace: storeState.loadWorkspace,
      saveChanges: async (target) => {
        const res = await storeState.saveChanges(target || hostProfileAddress);
        if (res.success) addToast("Saved successfully!", "success");
        else addToast(res.error, "error");
        return res;
      },
      duplicateActiveWorkspace: async (newName) => {
        const res = await storeState.saveChanges(newName);
        if (res.success) {
            storeState.loadWorkspace(newName);
            addToast(`Duplicated to ${newName}`, "success");
        }
        return res;
      },
      createNewWorkspace: storeState.createNewWorkspace,
      deleteWorkspaceFromSet: storeState.deleteWorkspaceFromSet,
      renameWorkspaceInSet: storeState.renameWorkspaceInSet,
      setDefaultWorkspaceInSet: storeState.setDefaultWorkspaceInSet,
      
      updateGlobalMidiMap: storeState.updateGlobalMidiMap,
      updateLayerMidiMappings: (layerId, mapping) => {
         const currentMap = storeState.stagedSetlist.globalUserMidiMap || {};
         const newLayerSelects = { ...(currentMap.layerSelects || {}), [layerId]: mapping };
         storeState.updateGlobalMidiMap({ ...currentMap, layerSelects: newLayerSelects });
      },
      updateGlobalEventReactions: storeState.updateGlobalEventReactions,
      deleteGlobalEventReaction: storeState.deleteGlobalEventReaction,
      
      addPalette: storeState.addPalette,
      removePalette: storeState.removePalette,
      addTokenToPalette: storeState.addTokenToPalette,
      removeTokenFromPalette: storeState.removeTokenFromPalette,
      
      addCollectionToPersonalLibrary: storeState.addCollectionToLibrary,
      removeCollectionFromPersonalLibrary: storeState.removeCollectionFromLibrary,
      
      preloadWorkspace: storeState.preloadWorkspace,
      
      // Scene CRUD
      addNewSceneToStagedWorkspace: storeState.addScene,
      deleteSceneFromStagedWorkspace: storeState.deleteScene,
      setDefaultSceneInStagedWorkspace: storeState.setDefaultScene,
      
      // Derived getters
      fullSceneList: Object.values(storeState.stagedWorkspace?.presets || {})
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    };
  }, [storeState, hostProfileAddress, addToast]); // configServiceRef is stable and doesn't need to be in deps

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspaceContext = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspaceContext must be used within WorkspaceProvider");
  return context;
};