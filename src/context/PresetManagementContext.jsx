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
import ConfigurationService, { hexToUtf8Safe } from "../services/ConfigurationService";
import { useUpProvider } from "./UpProvider";
import { RADAR_OFFICIAL_ADMIN_ADDRESS, IPFS_GATEWAY } from "../config/global-config";
import { keccak256, stringToBytes } from "viem";

const OFFICIAL_WHITELIST_KEY = keccak256(stringToBytes("RADAR.OfficialWhitelist"));

export const defaultWorkspaceManagementContextValue = {
  workspace: null, stagedWorkspace: null, currentConfigName: null, savedConfigList: [],
  isLoading: true, loadError: null, isSaving: false, saveError: null, saveSuccess: false, isInitiallyResolved: false,
  configLoadNonce: 0, loadedLayerConfigsFromPreset: null, loadedTokenAssignmentsFromPreset: null,
  officialWhitelist: [],
  refreshOfficialWhitelist: async () => {},
  hasPendingChanges: false,
  configServiceRef: { current: null }, configServiceInstanceReady: false,
  activeMidiMap: {},
  activeEventReactions: {},
  ownedTokens: [],
  isFetchingTokens: false,
  tokenFetchProgress: { loaded: 0, total: 0, loading: false },
  refreshOwnedTokens: async () => {},
  loadNamedConfig: async () => ({ success: false, error: "Provider not initialized" }),
  saveWorkspace: async () => ({ success: false, error: "Provider not initialized" }),
  addNewPresetToStagedWorkspace: () => {}, deletePresetFromStagedWorkspace: () => {},
  setDefaultPresetInStagedWorkspace: () => {}, discardStagedChanges: () => {},
  updateGlobalMidiMap: () => {},
  updateLayerMidiMappings: () => {}, // New function export
  updateGlobalEventReactions: () => {}, deleteGlobalEventReaction: () => {},
  setHasPendingChanges: () => {},
  addPalette: () => {},
  removePalette: () => {},
  addTokenToPalette: () => {},
  removeTokenFromPalette: () => {},
};

const WorkspaceManagementContext = createContext(defaultWorkspaceManagementContextValue);

export const PresetManagementProvider = ({ children }) => {
  const { hostProfileAddress, visitorProfileAddress, isHostProfileOwner } = useUserSession();
  const { provider, walletClient, publicClient } = useUpProvider();
  const { setLiveConfig } = useVisualConfig();
  const { addToast } = useToast();

  const configServiceRef = useRef(null);
  const [configServiceInstanceReady, setConfigServiceInstanceReady] = useState(false);
  
  const [officialWhitelist, setOfficialWhitelist] = useState([]);

  const [workspace, setWorkspace] = useState(null);
  const [stagedWorkspace, setStagedWorkspace] = useState(null);
  const [visitorMidiMap, setVisitorMidiMap] = useState({});
  const [visitorEventReactions, setVisitorEventReactions] = useState({});
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

  const [ownedTokens, setOwnedTokens] = useState([]);
  const [isFetchingTokens, setIsFetchingTokens] = useState(false);
  const [tokenFetchProgress, setTokenFetchProgress] = useState({ loaded: 0, total: 0, loading: false });

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

  const fetchOfficialWhitelist = useCallback(async () => {
    const service = configServiceRef.current;
    if (!service || !service.checkReadyForRead()) return;

    try {
        const pointerHex = await service.loadDataFromKey(RADAR_OFFICIAL_ADMIN_ADDRESS, OFFICIAL_WHITELIST_KEY);
        if (!pointerHex || pointerHex === '0x') {
            setOfficialWhitelist([]);
            return;
        }
        const ipfsUri = hexToUtf8Safe(pointerHex);
        if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) {
            setOfficialWhitelist([]);
            return;
        }
        const cid = ipfsUri.substring(7);
        const response = await fetch(`${IPFS_GATEWAY}${cid}`);
        if (!response.ok) throw new Error(`Failed to fetch whitelist from IPFS: ${response.statusText}`);
        const list = await response.json();
        setOfficialWhitelist(Array.isArray(list) ? list : []);
    } catch (error) {
        console.error("Error fetching official collection whitelist:", error);
        setOfficialWhitelist([]);
    }
  }, []);

  useEffect(() => {
    if (configServiceInstanceReady) {
      fetchOfficialWhitelist();
    }
  }, [configServiceInstanceReady, fetchOfficialWhitelist]);

  const savedConfigList = useMemo(() => {
    if (!stagedWorkspace || !stagedWorkspace.presets) return [];
    return Object.values(stagedWorkspace.presets)
      .sort((a, b) => (a.ts || 0) - (b.ts || 0))
      .map(preset => ({ name: preset.name }));
  }, [stagedWorkspace]);
  
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

  const refreshOwnedTokens = useCallback(async (isSilent = false) => {
    const service = configServiceRef.current;
    if (!hostProfileAddress || officialWhitelist.length === 0 || !service) {
      setOwnedTokens([]);
      setTokenFetchProgress({ loaded: 0, total: 0, loading: false });
      return;
    }

    setIsFetchingTokens(true);
    setTokenFetchProgress({ loaded: 0, total: 0, loading: true });
    if (!isSilent) addToast("Refreshing token library...", "info", 2000);

    try {
      const shouldShowcaseAllTokens = hostProfileAddress.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();

      const collectionPromises = officialWhitelist.map(async (collection) => {
        const standard = await service.detectCollectionStandard(collection.address);
        if (standard === 'LSP8') {
          const tokenIds = shouldShowcaseAllTokens
            ? await service.getAllLSP8TokenIdsForCollection(collection.address)
            : await service.getOwnedLSP8TokenIdsForCollection(hostProfileAddress, collection.address);
            
          return tokenIds.map(tokenId => ({ collectionAddress: collection.address, tokenId }));
        } else if (standard === 'LSP7') {
          const balance = await service.getLSP7Balance(hostProfileAddress, collection.address);
          if (balance > 0n) {
            return [{ collectionAddress: collection.address, tokenId: null }];
          }
        }
        return [];
      });

      const tokenIdentifierArrays = await Promise.all(collectionPromises);
      const tokensToFetch = tokenIdentifierArrays.flat();

      setTokenFetchProgress({ loaded: 0, total: tokensToFetch.length, loading: true });

      if (tokensToFetch.length > 0) {
        const allTokens = await service.getTokensMetadataBatch(tokensToFetch);
        setOwnedTokens(allTokens);
        if (!isSilent) addToast(`Token library updated: ${allTokens.length} assets found.`, "success", 3000);
      } else {
        setOwnedTokens([]);
        if (!isSilent) addToast(`Token library updated: 0 assets found.`, "info", 3000);
      }

    } catch (error) {
      console.error("Failed to refresh owned tokens:", error);
      if (!isSilent) addToast("Could not refresh token library.", "error");
    } finally {
      setIsFetchingTokens(false);
      setTokenFetchProgress(prev => ({ ...prev, loaded: prev.total, loading: false }));
    }
  }, [hostProfileAddress, officialWhitelist, addToast]);

  useEffect(() => {
    const currentAddress = hostProfileAddress;
    const service = configServiceRef.current;
    const profileChanged = currentAddress !== prevProfileAddressRef.current;
    
    const emptyWorkspace = { 
        presets: {}, 
        defaultPresetName: null, 
        globalMidiMap: {}, 
        globalEventReactions: {}, 
        personalCollectionLibrary: [],
        userPalettes: {} 
    };

    if (profileChanged) {
      prevProfileAddressRef.current = currentAddress;
      setIsLoading(true); setIsInitiallyResolved(false); setWorkspace(null); setStagedWorkspace(null);
      setCurrentConfigName(null); setLoadError(null); setHasPendingChanges(false);
      setVisitorMidiMap({});
      setVisitorEventReactions({});
      setOwnedTokens([]);
    }

    const loadInitialData = async (address) => {
      setIsLoading(true);
      try {
        const loadedWorkspace = await service.loadWorkspace(address);
        if (prevProfileAddressRef.current === address) {
          if (!loadedWorkspace.personalCollectionLibrary) {
              loadedWorkspace.personalCollectionLibrary = [];
          }
          setWorkspace(loadedWorkspace);
          setStagedWorkspace(loadedWorkspace);
          const initialPresetName = loadedWorkspace.defaultPresetName || null;
          setCurrentConfigName(initialPresetName);
          setLoadError(null);
          setHasPendingChanges(false);
          const initialPreset = initialPresetName ? loadedWorkspace.presets[initialPresetName] : null;
          setLiveConfig(initialPreset?.layers || fallbackConfig.layers, initialPreset?.tokenAssignments || fallbackConfig.tokenAssignments);

          if (!isHostProfileOwner && visitorProfileAddress) {
            const visitorWorkspace = await service.loadWorkspace(visitorProfileAddress);
            setVisitorMidiMap(visitorWorkspace?.globalMidiMap || {});
            setVisitorEventReactions(visitorWorkspace?.globalEventReactions || {});
          } else {
            setVisitorMidiMap({});
            setVisitorEventReactions({});
          }
        }
      } catch (error) {
        if (prevProfileAddressRef.current === address) {
          setLoadError(error.message || "Failed to load workspace.");
          addToast("Could not load your workspace.", "error");
          setWorkspace(emptyWorkspace);
          setStagedWorkspace(emptyWorkspace);
          setVisitorMidiMap({});
          setVisitorEventReactions({});
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
      setVisitorMidiMap({});
      setVisitorEventReactions({});
      setLiveConfig(fallbackConfig.layers, fallbackConfig.tokenAssignments);
      setIsLoading(false);
      setIsInitiallyResolved(true);
      setConfigLoadNonce(prev => prev + 1);
    }
  }, [hostProfileAddress, visitorProfileAddress, configServiceInstanceReady, isInitiallyResolved, isHostProfileOwner, addToast, setLiveConfig]);

  useEffect(() => {
    refreshOwnedTokens(true);
  }, [refreshOwnedTokens, officialWhitelist]);
  
  const activeMidiMap = useMemo(() => {
    if (!isHostProfileOwner && visitorProfileAddress) {
      return visitorMidiMap;
    }
    // Correctly merge layer selects into the active map for the UI to read
    const baseMap = stagedWorkspace?.globalMidiMap || {};
    return baseMap;
  }, [isHostProfileOwner, visitorProfileAddress, visitorMidiMap, stagedWorkspace]);

  const activeEventReactions = useMemo(() => {
    if (!isHostProfileOwner && visitorProfileAddress) {
      return visitorEventReactions;
    }
    return stagedWorkspace?.globalEventReactions || {};
  }, [isHostProfileOwner, visitorProfileAddress, visitorEventReactions, stagedWorkspace]);

  const addNewPresetToStagedWorkspace = useCallback((newPresetName, newPresetData) => {
    setStagedWorkspace(prev => {
      const newWorkspace = prev ? JSON.parse(JSON.stringify(prev)) : { presets: {}, defaultPresetName: null, globalMidiMap: {}, globalEventReactions: {}, personalCollectionLibrary: [], userPalettes: {} };
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
    if (isHostProfileOwner) {
        setStagedWorkspace(prev => ({ ...prev, globalMidiMap: newMap || {} }));
        setHasPendingChanges(true);
    } else if (import.meta.env.DEV) {
        console.warn("Attempted to update host MIDI map as a visitor. Action blocked.");
    }
  }, [isHostProfileOwner]);

  // --- NEW FUNCTION TO HANDLE LAYER-SPECIFIC MAPPINGS ---
  const updateLayerMidiMappings = useCallback((layerId, mappingData) => {
    if (isHostProfileOwner) {
      setStagedWorkspace(prev => {
        const newGlobalMidiMap = { ...(prev?.globalMidiMap || {}) };
        const layerSelects = { ...(newGlobalMidiMap.layerSelects || {}) };
        layerSelects[layerId] = mappingData;
        newGlobalMidiMap.layerSelects = layerSelects;
        return { ...prev, globalMidiMap: newGlobalMidiMap };
      });
      setHasPendingChanges(true);
    }
  }, [isHostProfileOwner]);

  const updateGlobalEventReactions = useCallback((eventType, reactionData) => {
    if (!eventType || !reactionData) return;
    setStagedWorkspace(prev => ({
      ...prev,
      globalEventReactions: {
        ...(prev?.globalEventReactions || {}),
        [eventType]: reactionData
      }
    }));
    setHasPendingChanges(true);
  }, []);

  const deleteGlobalEventReaction = useCallback((eventType) => {
    if (!eventType) return;
    setStagedWorkspace(prev => {
      const newReactions = { ...(prev?.globalEventReactions || {}) };
      if (Object.prototype.hasOwnProperty.call(newReactions, eventType)) {
        delete newReactions[eventType];
        setHasPendingChanges(true);
        return { ...prev, globalEventReactions: newReactions };
      }
      return prev;
    });
  }, []);

  const addPalette = useCallback((paletteName) => {
    setStagedWorkspace(prev => {
      const newWorkspace = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
      if (newWorkspace.userPalettes[paletteName]) {
        addToast(`Palette "${paletteName}" already exists.`, "warning");
        return prev;
      }
      newWorkspace.userPalettes[paletteName] = [];
      addToast(`Palette "${paletteName}" created.`, "success");
      setHasPendingChanges(true);
      return newWorkspace;
    });
  }, [addToast]);

  const removePalette = useCallback((paletteName) => {
    setStagedWorkspace(prev => {
      const newWorkspace = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
      if (!newWorkspace.userPalettes[paletteName]) return prev;
      delete newWorkspace.userPalettes[paletteName];
      addToast(`Palette "${paletteName}" removed.`, "info");
      setHasPendingChanges(true);
      return newWorkspace;
    });
  }, [addToast]);

  const addTokenToPalette = useCallback((paletteName, tokenId) => {
    setStagedWorkspace(prev => {
      const newWorkspace = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
      const palette = newWorkspace.userPalettes[paletteName];
      if (!palette) {
        addToast(`Palette "${paletteName}" not found.`, "error");
        return prev;
      }
      if (palette.includes(tokenId)) {
        addToast("Token is already in this palette.", "info");
        return prev;
      }
      newWorkspace.userPalettes[paletteName] = [...palette, tokenId];
      addToast(`Token added to "${paletteName}".`, "success");
      setHasPendingChanges(true);
      return newWorkspace;
    });
  }, [addToast]);

  const removeTokenFromPalette = useCallback((paletteName, tokenId) => {
    setStagedWorkspace(prev => {
      const newWorkspace = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
      const palette = newWorkspace.userPalettes[paletteName];
      if (!palette) return prev;
      newWorkspace.userPalettes[paletteName] = palette.filter(id => id !== tokenId);
      setHasPendingChanges(true);
      return newWorkspace;
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
      setHasPendingChanges(false);
      setSaveSuccess(true);
      addToast("Workspace saved successfully!", "success");
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
  }, [stagedWorkspace, hostProfileAddress, addToast]);
  
  const contextValue = useMemo(() => ({
    workspace, stagedWorkspace, currentConfigName, savedConfigList, isLoading, loadError, isSaving, saveError, saveSuccess,
    isInitiallyResolved, configLoadNonce, loadedLayerConfigsFromPreset, loadedTokenAssignmentsFromPreset,
    officialWhitelist,
    refreshOfficialWhitelist: fetchOfficialWhitelist,
    hasPendingChanges, setHasPendingChanges,
    configServiceRef, configServiceInstanceReady,
    activeMidiMap,
    activeEventReactions,
    ownedTokens,
    isFetchingTokens,
    tokenFetchProgress,
    refreshOwnedTokens,
    loadNamedConfig, saveWorkspace, addNewPresetToStagedWorkspace, deletePresetFromStagedWorkspace,
    setDefaultPresetInStagedWorkspace, discardStagedChanges,
    updateGlobalMidiMap,
    updateLayerMidiMappings, // Export the new function
    updateGlobalEventReactions, deleteGlobalEventReaction,
    addPalette, removePalette, addTokenToPalette, removeTokenFromPalette,
  }), [
    workspace, stagedWorkspace, currentConfigName, savedConfigList, isLoading, loadError, isSaving, saveError, saveSuccess,
    isInitiallyResolved, configLoadNonce, loadedLayerConfigsFromPreset, loadedTokenAssignmentsFromPreset,
    officialWhitelist, fetchOfficialWhitelist,
    hasPendingChanges,
    configServiceRef, configServiceInstanceReady,
    activeMidiMap,
    activeEventReactions,
    ownedTokens, isFetchingTokens, tokenFetchProgress, refreshOwnedTokens,
    loadNamedConfig, saveWorkspace, addNewPresetToStagedWorkspace, deletePresetFromStagedWorkspace,
    setDefaultPresetInStagedWorkspace, discardStagedChanges,
    updateGlobalMidiMap,
    updateLayerMidiMappings, // Add to dependency array
    updateGlobalEventReactions, deleteGlobalEventReaction,
    addPalette, removePalette, addTokenToPalette, removeTokenFromPalette,
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