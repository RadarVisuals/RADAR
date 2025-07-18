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
import { useToast } from "./ToastContext";
import { useVisualConfig } from "./VisualConfigContext";
import fallbackConfig from "../config/fallback-config.js";
import ConfigurationService from "../services/ConfigurationService";
import { useUpProvider } from "./UpProvider";

export const defaultWorkspaceManagementContextValue = {
  workspace: null, stagedWorkspace: null, currentConfigName: null, savedConfigList: [],
  isLoading: true, loadError: null, isSaving: false, saveError: null, saveSuccess: false, isInitiallyResolved: false,
  configLoadNonce: 0, loadedLayerConfigsFromPreset: null, loadedTokenAssignmentsFromPreset: null,
  personalCollectionLibrary: [], hasPendingChanges: false,
  configServiceRef: { current: null }, configServiceInstanceReady: false,
  activeMidiMap: {},
  // --- MODIFICATION: Added owned tokens state to default context ---
  ownedTokens: [],
  isFetchingTokens: false,
  refreshOwnedTokens: async () => {},
  // --- END MODIFICATION ---
  loadNamedConfig: async () => ({ success: false, error: "Provider not initialized" }),
  saveWorkspace: async () => ({ success: false, error: "Provider not initialized" }),
  addNewPresetToStagedWorkspace: () => {}, deletePresetFromStagedWorkspace: () => {},
  setDefaultPresetInStagedWorkspace: () => {}, discardStagedChanges: () => {},
  addCollectionToStagedLibrary: () => {}, removeCollectionFromStagedLibrary: () => {},
  updateGlobalMidiMap: () => {}, updateGlobalEventReactions: () => {}, deleteGlobalEventReaction: () => {},
  setHasPendingChanges: () => {},
};

const WorkspaceManagementContext = createContext(defaultWorkspaceManagementContextValue);

export const PresetManagementProvider = ({ children }) => {
  const { hostProfileAddress, visitorProfileAddress } = useUserSession();
  const { provider, walletClient, publicClient } = useUpProvider();
  const { setLiveConfig } = useVisualConfig();
  const { addToast } = useToast();

  const configServiceRef = useRef(null);
  const [configServiceInstanceReady, setConfigServiceInstanceReady] = useState(false);

  const [workspace, setWorkspace] = useState(null);
  const [stagedWorkspace, setStagedWorkspace] = useState(null);
  const [activeMidiMap, setActiveMidiMap] = useState({});
  const [currentConfigName, setCurrentConfigName] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitiallyResolved, setIsInitiallyResolved] = useState(false);
  const [configLoadNonce, setConfigLoadNonce] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const prevProfileAddressRef = useRef(null);

  // --- MODIFICATION: New state for managing owned tokens ---
  const [ownedTokens, setOwnedTokens] = useState([]);
  const [isFetchingTokens, setIsFetchingTokens] = useState(false);
  // --- END MODIFICATION ---

  useEffect(() => {
    if (provider && !configServiceRef.current) {
        configServiceRef.current = new ConfigurationService(provider, walletClient, publicClient);
    }
    if (configServiceRef.current) {
        if (configServiceRef.current.publicClient !== publicClient) {
            configServiceRef.current.publicClient = publicClient;
        }
        if (configServiceRef.current.walletClient !== walletClient) {
            configServiceRef.current.walletClient = walletClient;
        }
        const isReady = configServiceRef.current.checkReadyForRead();
        setConfigServiceInstanceReady(isReady);
    }
  }, [provider, publicClient, walletClient]);

  const savedConfigList = useMemo(() => {
    if (!stagedWorkspace || !stagedWorkspace.presets) return [];
    return Object.values(stagedWorkspace.presets)
      .sort((a, b) => (a.ts || 0) - (b.ts || 0))
      .map(preset => ({ name: preset.name }));
  }, [stagedWorkspace]);

  const personalCollectionLibrary = useMemo(() => stagedWorkspace?.personalCollectionLibrary || [], [stagedWorkspace]);

  const { loadedLayerConfigsFromPreset, loadedTokenAssignmentsFromPreset } = useMemo(() => {
    if (!stagedWorkspace || !currentConfigName || !stagedWorkspace.presets[currentConfigName]) {
      return { loadedLayerConfigsFromPreset: fallbackConfig.layers, loadedTokenAssignmentsFromPreset: fallbackConfig.tokenAssignments };
    }
    const preset = stagedWorkspace.presets[currentConfigName];
    return {
      loadedLayerConfigsFromPreset: preset.layers,
      loadedTokenAssignmentsFromPreset: preset.tokenAssignments,
    };
  }, [stagedWorkspace, currentConfigName]);

  // --- MODIFICATION: Centralized token fetching logic ---
  const refreshOwnedTokens = useCallback(async (isSilent = false) => {
    const service = configServiceRef.current;
    if (!visitorProfileAddress || personalCollectionLibrary.length === 0 || !service) {
      setOwnedTokens([]);
      return;
    }
    setIsFetchingTokens(true);
    if (!isSilent) {
        addToast("Refreshing your token library...", "info", 2000);
    }
    try {
      const allTokens = [];
      for (const collection of personalCollectionLibrary) {
        const standard = await service.detectCollectionStandard(collection.address);
        if (standard === 'LSP8') {
          const tokenIds = await service.getOwnedLSP8TokenIdsForCollection(visitorProfileAddress, collection.address);
          for (const tokenId of tokenIds) {
            const metadata = await service.getTokenMetadata(collection.address, tokenId);
            if (metadata?.image) {
              allTokens.push({ id: `${collection.address}-${tokenId}`, type: 'owned', address: collection.address, metadata });
            }
          }
        } else if (standard === 'LSP7') {
          const balance = await service.getLSP7Balance(visitorProfileAddress, collection.address);
          if (balance > 0n) {
            const metadata = await service.getLSP4CollectionMetadata(collection.address);
            if (metadata?.image) {
              allTokens.push({ id: collection.address, type: 'owned', address: collection.address, metadata });
            }
          }
        }
      }
      setOwnedTokens(allTokens);
      if (!isSilent) {
        addToast("Token library updated!", "success", 2000);
      }
    } catch (error) {
      console.error("Failed to refresh owned tokens:", error);
      if (!isSilent) {
        addToast("Could not refresh token library.", "error");
      }
    } finally {
      setIsFetchingTokens(false);
    }
  }, [visitorProfileAddress, personalCollectionLibrary, addToast]);

  // Effect to fetch tokens when library or user changes
  useEffect(() => {
    // This is the background fetch. We call it "silently" so it doesn't show a toast every time.
    refreshOwnedTokens(true);
  }, [refreshOwnedTokens]);
  // --- END MODIFICATION ---

  useEffect(() => {
    const currentAddress = hostProfileAddress;
    const service = configServiceRef.current;
    const profileChanged = currentAddress !== prevProfileAddressRef.current;
    const emptyWorkspace = { presets: {}, defaultPresetName: null, globalMidiMap: {}, globalEventReactions: {}, personalCollectionLibrary: [] };

    if (profileChanged) {
      prevProfileAddressRef.current = currentAddress;
      setIsLoading(true); setIsInitiallyResolved(false); setWorkspace(null); setStagedWorkspace(null);
      setCurrentConfigName(null); setLoadError(null); setHasPendingChanges(false);
      setActiveMidiMap({});
      setOwnedTokens([]); // Clear tokens on profile change
    }

    const loadInitialData = async (address) => {
      setIsLoading(true);
      try {
        const loadedWorkspace = await service.loadWorkspace(address);
        if (prevProfileAddressRef.current === address) {
          setWorkspace(loadedWorkspace);
          setStagedWorkspace(loadedWorkspace);
          const initialPresetName = loadedWorkspace.defaultPresetName || null;
          setCurrentConfigName(initialPresetName);
          setLoadError(null);
          setHasPendingChanges(false);
          const initialPreset = initialPresetName ? loadedWorkspace.presets[initialPresetName] : null;
          setLiveConfig(initialPreset?.layers || fallbackConfig.layers, initialPreset?.tokenAssignments || fallbackConfig.tokenAssignments);

          const isVisitor = visitorProfileAddress && visitorProfileAddress.toLowerCase() !== address.toLowerCase();
          if (isVisitor) {
            const visitorMidiMap = await service.loadMidiMapForProfile(visitorProfileAddress);
            setActiveMidiMap(visitorMidiMap || {});
          } else {
            setActiveMidiMap(loadedWorkspace.globalMidiMap || {});
          }
        }
      } catch (error) {
        if (prevProfileAddressRef.current === address) {
          setLoadError(error.message || "Failed to load workspace.");
          addToast("Could not load your workspace.", "error");
          setWorkspace(emptyWorkspace);
          setStagedWorkspace(emptyWorkspace);
          setActiveMidiMap({});
          setLiveConfig(fallbackConfig.layers, fallbackConfig.tokenAssignments);
        }
      } finally {
        if (prevProfileAddressRef.current === address) {
          setIsLoading(false);
          setIsInitiallyResolved(true);
          setConfigLoadNonce(prev => prev + 1);
        }
      }
    };
    
    if (currentAddress && configServiceInstanceReady && !isInitiallyResolved) {
      loadInitialData(currentAddress);
    } else if (!currentAddress && !isInitiallyResolved) {
      setWorkspace(emptyWorkspace);
      setStagedWorkspace(emptyWorkspace);
      setActiveMidiMap({});
      setLiveConfig(fallbackConfig.layers, fallbackConfig.tokenAssignments);
      setIsLoading(false);
      setIsInitiallyResolved(true);
      setConfigLoadNonce(prev => prev + 1);
    }
  }, [hostProfileAddress, visitorProfileAddress, configServiceInstanceReady, isInitiallyResolved, addToast, setLiveConfig]);

  const addCollectionToStagedLibrary = useCallback((collectionData) => {
    setStagedWorkspace(prev => {
      const currentLibrary = prev.personalCollectionLibrary || [];
      if (currentLibrary.some(c => c.address.toLowerCase() === collectionData.address.toLowerCase())) {
        addToast("Collection is already in the library.", "warning");
        return prev;
      }
      addToast(`Collection "${collectionData.name}" added to library. Save workspace to confirm.`, "info");
      setHasPendingChanges(true);
      return { ...prev, personalCollectionLibrary: [...currentLibrary, collectionData] };
    });
  }, [addToast]);

  const removeCollectionFromStagedLibrary = useCallback((addressToRemove) => {
    setStagedWorkspace(prev => {
      const newLibrary = (prev.personalCollectionLibrary || []).filter(c => c.address.toLowerCase() !== addressToRemove.toLowerCase());
      setHasPendingChanges(true);
      addToast("Collection removed from library. Save workspace to confirm.", "info");
      return { ...prev, personalCollectionLibrary: newLibrary };
    });
  }, [addToast]);
  
  const addNewPresetToStagedWorkspace = useCallback((newPresetName, newPresetData) => {
    setStagedWorkspace(prev => {
      const newWorkspace = prev ? JSON.parse(JSON.stringify(prev)) : { presets: {}, defaultPresetName: null, globalMidiMap: {}, globalEventReactions: {}, personalCollectionLibrary: [] };
      newWorkspace.presets[newPresetName] = newPresetData;
      return newWorkspace;
    });
    setHasPendingChanges(true);
  }, []);

  const deletePresetFromStagedWorkspace = useCallback((nameToDelete) => {
    setStagedWorkspace(prev => {
      if (!prev || !prev.presets || !prev.presets[nameToDelete]) return prev;
      const newWorkspace = JSON.parse(JSON.stringify(prev));
      delete newWorkspace.presets[nameToDelete];
      if (newWorkspace.defaultPresetName === nameToDelete) newWorkspace.defaultPresetName = null;
      return newWorkspace;
    });
    setHasPendingChanges(true);
  }, []);

  const setDefaultPresetInStagedWorkspace = useCallback((nameToSet) => {
    setStagedWorkspace(prev => {
      if (!prev || !prev.presets || !prev.presets[nameToSet]) return prev;
      return { ...prev, defaultPresetName: nameToSet };
    });
    setHasPendingChanges(true);
  }, []);

  const discardStagedChanges = useCallback(() => {
    setStagedWorkspace(workspace);
    const presetNameToReload = currentConfigName || workspace?.defaultPresetName || null;
    const preset = presetNameToReload ? workspace.presets[presetNameToReload] : null;
    setLiveConfig(preset?.layers || fallbackConfig.layers, preset?.tokenAssignments || fallbackConfig.tokenAssignments);
    setActiveMidiMap(workspace?.globalMidiMap || {});
    setHasPendingChanges(false);
    addToast("Changes discarded.", "info");
  }, [workspace, currentConfigName, addToast, setLiveConfig]);

  const loadNamedConfig = useCallback(async (name) => {
    if (!stagedWorkspace || !stagedWorkspace.presets[name]) {
      const errorMsg = `Preset '${name}' not found.`;
      addToast(errorMsg, 'warning');
      return { success: false, error: errorMsg };
    }
    if (currentConfigName !== name) {
      const preset = stagedWorkspace.presets[name];
      setLiveConfig(preset.layers, preset.tokenAssignments);
      setCurrentConfigName(name);
      setConfigLoadNonce(prev => prev + 1);
    }
    return { success: true };
  }, [stagedWorkspace, currentConfigName, addToast, setLiveConfig]);

  const updateGlobalMidiMap = useCallback((newMap) => {
    setStagedWorkspace(prev => ({ ...prev, globalMidiMap: newMap || {} }));
    setActiveMidiMap(newMap || {});
    setHasPendingChanges(true);
  }, []);

  const updateGlobalEventReactions = useCallback((eventType, reactionData) => {
    if (!eventType || !reactionData) return;
    setStagedWorkspace(prev => ({
      ...prev,
      globalEventReactions: {
        ...(prev.globalEventReactions || {}),
        [eventType]: reactionData
      }
    }));
    setHasPendingChanges(true);
  }, []);

  const deleteGlobalEventReaction = useCallback((eventType) => {
    if (!eventType) return;
    setStagedWorkspace(prev => {
      const newReactions = { ...(prev.globalEventReactions || {}) };
      if (Object.prototype.hasOwnProperty.call(newReactions, eventType)) {
        delete newReactions[eventType];
        setHasPendingChanges(true);
        return { ...prev, globalEventReactions: newReactions };
      }
      return prev;
    });
  }, []);

  const saveWorkspace = useCallback(async () => {
    const service = configServiceRef.current;
    const addressToSave = hostProfileAddress;
    if (!service || !addressToSave || !service.checkReadyForWrite()) {
      const errorMsg = "Save service not ready or no profile connected.";
      addToast(errorMsg, "error");
      return { success: false, error: errorMsg };
    }
    if (!stagedWorkspace) {
      addToast("Workspace not loaded, cannot save.", "error");
      return { success: false, error: "Workspace not loaded" };
    }
    setIsSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      const workspaceToSave = JSON.parse(JSON.stringify(stagedWorkspace));
      await service.saveWorkspace(addressToSave, workspaceToSave);
      setWorkspace(workspaceToSave);
      setStagedWorkspace(workspaceToSave);
      setActiveMidiMap(workspaceToSave.globalMidiMap || {});
      setHasPendingChanges(false);
      setSaveSuccess(true);
      addToast("Workspace saved successfully!", "success");
      // --- MODIFICATION: Trigger a silent token refresh after saving the library ---
      if (stagedWorkspace.personalCollectionLibrary.length !== workspace?.personalCollectionLibrary?.length) {
        refreshOwnedTokens(true);
      }
      // --- END MODIFICATION ---
      return { success: true };
    } catch (error) {
      const errorMsg = error.message || "Unknown save error.";
      addToast(`Error saving workspace: ${errorMsg}`, 'error');
      setSaveError(errorMsg);
      setSaveSuccess(false);
      return { success: false, error: errorMsg };
    } finally {
      setIsSaving(false);
    }
  }, [stagedWorkspace, hostProfileAddress, addToast, workspace, refreshOwnedTokens]);
  
  const contextValue = useMemo(() => ({
    workspace, stagedWorkspace, currentConfigName, savedConfigList, isLoading, loadError, isSaving, saveError, saveSuccess,
    isInitiallyResolved, configLoadNonce, loadedLayerConfigsFromPreset, loadedTokenAssignmentsFromPreset,
    personalCollectionLibrary, hasPendingChanges, setHasPendingChanges,
    configServiceRef, configServiceInstanceReady,
    activeMidiMap,
    // --- MODIFICATION: Export new token state and refresh function ---
    ownedTokens,
    isFetchingTokens,
    refreshOwnedTokens,
    // --- END MODIFICATION ---
    loadNamedConfig, saveWorkspace, addNewPresetToStagedWorkspace, deletePresetFromStagedWorkspace,
    setDefaultPresetInStagedWorkspace, discardStagedChanges,
    addCollectionToStagedLibrary, removeCollectionFromStagedLibrary,
    updateGlobalMidiMap, updateGlobalEventReactions, deleteGlobalEventReaction,
  }), [
    workspace, stagedWorkspace, currentConfigName, savedConfigList, isLoading, loadError, isSaving, saveError, saveSuccess,
    isInitiallyResolved, configLoadNonce, loadedLayerConfigsFromPreset, loadedTokenAssignmentsFromPreset,
    personalCollectionLibrary, hasPendingChanges,
    configServiceRef, configServiceInstanceReady,
    activeMidiMap,
    // --- MODIFICATION: Add new values to dependency array ---
    ownedTokens, isFetchingTokens, refreshOwnedTokens,
    // --- END MODIFICATION ---
    loadNamedConfig, saveWorkspace, addNewPresetToStagedWorkspace, deletePresetFromStagedWorkspace,
    setDefaultPresetInStagedWorkspace, discardStagedChanges,
    addCollectionToStagedLibrary, removeCollectionFromStagedLibrary,
    updateGlobalMidiMap, updateGlobalEventReactions, deleteGlobalEventReaction
  ]);
  
  return (
    <WorkspaceManagementContext.Provider value={contextValue}>
      {children}
    </WorkspaceManagementContext.Provider>
  );
};

PresetManagementProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const usePresetManagement = () => {
  const context = useContext(WorkspaceManagementContext);
  if (context === undefined) {
    throw new Error("usePresetManagement must be used within a PresetManagementProvider");
  }
  return context;
};