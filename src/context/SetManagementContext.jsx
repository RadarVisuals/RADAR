// src/context/SetManagementContext.jsx
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
import { keccak256, stringToBytes } from "viem";

import { useUserSession } from "./UserSessionContext";
import { useToast } from "./ToastContext";
import { useVisualConfig } from "./VisualConfigContext";
import fallbackConfig from "../config/fallback-config.js";
import ConfigurationService, { hexToUtf8Safe } from "../services/ConfigurationService";
import { useUpProvider } from "./UpProvider";
import { RADAR_OFFICIAL_ADMIN_ADDRESS, IPFS_GATEWAY } from "../config/global-config";
import { uploadJsonToPinata } from '../services/PinataService.js';
import { preloadImages, resolveImageUrl } from '../utils/imageDecoder.js';

const OFFICIAL_WHITELIST_KEY = keccak256(stringToBytes("RADAR.OfficialWhitelist"));

export const defaultSetManagementContextValue = {
  isLoading: true,
  isFullyLoaded: false,
  startLoadingProcess: () => {},
  // Add other defaults as needed for better IntelliSense
};

const SetManagementContext = createContext(defaultSetManagementContextValue);

export const SetManagementProvider = ({ children }) => {
  const { hostProfileAddress, visitorProfileAddress, isHostProfileOwner } = useUserSession();
  const { provider, walletClient, publicClient } = useUpProvider();
  const { setLiveConfig } = useVisualConfig();
  const { addToast } = useToast();

  const [shouldStartLoading, setShouldStartLoading] = useState(false);

  const preloadedWorkspacesRef = useRef(new Map());
  const preloadingInProgressRef = useRef(new Set());

  const configServiceRef = useRef(null);
  const [configServiceInstanceReady, setConfigServiceInstanceReady] = useState(false);
  
  const [setlist, setSetlist] = useState(null);
  const [stagedSetlist, setStagedSetlist] = useState(null);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [stagedActiveWorkspace, setStagedActiveWorkspace] = useState(null);
  const [activeWorkspaceName, setActiveWorkspaceName] = useState(null);
  const [activeSceneName, setActiveSceneName] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);

  const [isWorkspaceTransitioning, setIsWorkspaceTransitioning] = useState(false);
  const workspaceToLoadRef = useRef(null);

  const [newlyCreatedWorkspace, setNewlyCreatedWorkspace] = useState(null);

  const [isInitiallyResolved, setIsInitiallyResolved] = useState(false);
  const [sceneLoadNonce, setSceneLoadNonce] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  
  const [officialWhitelist, setOfficialWhitelist] = useState([]);
  const [visitorMidiMap, setVisitorMidiMap] = useState({});
  const [visitorEventReactions, setVisitorEventReactions] = useState({});
  const [ownedTokenIdentifiers, setOwnedTokenIdentifiers] = useState({});
  const [isFetchingTokens, setIsFetchingTokens] = useState(false);
  const [tokenFetchProgress, setTokenFetchProgress] = useState({ loaded: 0, total: 0, loading: false });
  const prevProfileAddressRef = useRef(null);
  
  const startLoadingProcess = useCallback(() => {
    if(import.meta.env.DEV) console.log('%c[SetMgmt] User initiated loading process.', 'color: #1abc9c; font-weight: bold;');
    setShouldStartLoading(true);
  }, []);

  useEffect(() => {
    if (provider) {
        configServiceRef.current = new ConfigurationService(provider, walletClient, publicClient);
        configServiceRef.current.publicClient = publicClient;
        configServiceRef.current.walletClient = walletClient;
        const isReady = configServiceRef.current.checkReadyForRead();
        setConfigServiceInstanceReady(isReady);
    }
  }, [provider, publicClient, walletClient]);

  const fetchOfficialWhitelist = useCallback(async () => {
    const service = configServiceRef.current;
    if (!service || !service.checkReadyForRead()) return;
    try {
        const pointerHex = await service.loadDataFromKey(RADAR_OFFICIAL_ADMIN_ADDRESS, OFFICIAL_WHITELIST_KEY);
        if (!pointerHex || pointerHex === '0x') { setOfficialWhitelist([]); return; }
        const ipfsUri = hexToUtf8Safe(pointerHex);
        if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) { setOfficialWhitelist([]); return; }
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

  const _loadWorkspaceFromCid = useCallback(async (cid) => {
    const service = configServiceRef.current;
    if (!service || !cid) return null;
    try {
        const workspaceData = await service._loadWorkspaceFromCID(cid);
        return workspaceData;
    } catch (error) {
        console.error(`[SetManagementContext] Failed to load workspace from CID ${cid}:`, error);
        addToast(`Could not load workspace data.`, "error");
        return null;
    }
  }, [addToast]);

  useEffect(() => {
    if (!shouldStartLoading) {
      if(import.meta.env.DEV) console.log('%c[SetMgmt] Waiting for user interaction to start loading.', 'color: #e67e22;');
      return;
    }

    const currentAddress = hostProfileAddress;
    const service = configServiceRef.current;
    const profileChanged = currentAddress !== prevProfileAddressRef.current;
    
    const emptySetlist = { defaultWorkspaceName: null, workspaces: {}, globalUserMidiMap: {} };
    const emptyWorkspace = { presets: {}, defaultPresetName: null, globalEventReactions: {}, personalCollectionLibrary: [], userPalettes: {} };

    if (profileChanged) {
      if (import.meta.env.DEV) console.log(`%c[SetMgmt] Profile changed from ${prevProfileAddressRef.current?.slice(0,6)} to ${currentAddress?.slice(0,6)}. Resetting state.`, 'color: #f39c12;');
      prevProfileAddressRef.current = currentAddress;
      setIsLoading(true);
      setLoadingMessage("Initializing...");
      setIsFullyLoaded(false);
      setIsInitiallyResolved(false); setLoadError(null); setHasPendingChanges(false);
      setSetlist(null); setStagedSetlist(null); setActiveWorkspace(null); setStagedActiveWorkspace(null);
      setActiveWorkspaceName(null); setActiveSceneName(null);
      setVisitorMidiMap({}); setVisitorEventReactions({}); setOwnedTokenIdentifiers({});
    }

    const loadInitialData = async (address) => {
      setIsLoading(true);
      try {
        setLoadingMessage("Fetching Setlist...");
        const loadedSetlist = await service.loadWorkspace(address);
        if (prevProfileAddressRef.current !== address) return;

        setSetlist(loadedSetlist);
        setStagedSetlist(loadedSetlist);
        setIsInitiallyResolved(true);

        const defaultWorkspaceName = loadedSetlist.defaultWorkspaceName || Object.keys(loadedSetlist.workspaces)[0];
        const workspaceInfo = defaultWorkspaceName ? loadedSetlist.workspaces[defaultWorkspaceName] : null;
        let loadedWorkspace;

        if (workspaceInfo && workspaceInfo.cid) {
            setLoadingMessage(`Loading Workspace: ${defaultWorkspaceName}...`);
            loadedWorkspace = await _loadWorkspaceFromCid(workspaceInfo.cid);
        }
        
        if (!loadedWorkspace) {
            loadedWorkspace = emptyWorkspace;
            if (defaultWorkspaceName) addToast(`Default workspace "${defaultWorkspaceName}" could not be loaded.`, 'warning');
        }
        
        if (prevProfileAddressRef.current !== address) return;

        setLoadingMessage("Preloading Assets...");
        const imageUrlsToPreload = new Set();
        Object.values(loadedWorkspace.presets || {}).forEach(preset => {
            Object.values(preset.tokenAssignments || {}).forEach(assignment => {
                const src = resolveImageUrl(assignment);
                if (src) imageUrlsToPreload.add(src);
            });
        });

        if (imageUrlsToPreload.size > 0) {
            await preloadImages(Array.from(imageUrlsToPreload));
        }

        if (prevProfileAddressRef.current !== address) return;

        setActiveWorkspace(loadedWorkspace);
        setStagedActiveWorkspace(loadedWorkspace);
        setActiveWorkspaceName(defaultWorkspaceName);

        const initialSceneName = loadedWorkspace.defaultPresetName || Object.keys(loadedWorkspace.presets || {})[0] || null;
        setActiveSceneName(initialSceneName);
        
        const initialScene = initialSceneName ? loadedWorkspace.presets[initialSceneName] : null;
        
        setLiveConfig(initialScene?.layers || null, initialScene?.tokenAssignments || null);

        setLoadError(null);
        setHasPendingChanges(false);

        if (!isHostProfileOwner && visitorProfileAddress) {
          const visitorData = await service.loadWorkspace(visitorProfileAddress);
          setVisitorMidiMap(visitorData?.globalUserMidiMap || {});
          
          const visitorDefaultWkspName = visitorData.defaultWorkspaceName || Object.keys(visitorData.workspaces)[0];
          const visitorWkspInfo = visitorDefaultWkspName ? visitorData.workspaces[visitorDefaultWkspName] : null;
          if(visitorWkspInfo?.cid) {
            const visitorWorkspace = await _loadWorkspaceFromCid(visitorWkspInfo.cid);
            setVisitorEventReactions(visitorWorkspace?.globalEventReactions || {});
          }
        } else {
          setVisitorMidiMap({});
          setVisitorEventReactions({});
        }

      } catch (error) {
        if (prevProfileAddressRef.current === address) {
          setLoadError(error.message || "Failed to load setlist.");
          addToast("Could not load your setlist.", "error");
          setSetlist(emptySetlist); setStagedSetlist(emptySetlist);
          setActiveWorkspace(emptyWorkspace); setStagedActiveWorkspace(emptyWorkspace);
          setLiveConfig(null, null);
        }
      } finally {
        if (prevProfileAddressRef.current === address) {
          setIsLoading(false);
          setLoadingMessage("");
          if(import.meta.env.DEV) console.log(`%c[SetMgmt] Load sequence finished for ${address?.slice(0,6)}. Setting isFullyLoaded = true.`, 'color: #2ecc71; font-weight: bold;');
          setIsFullyLoaded(true);
        }
      }
    };
    
    if (configServiceInstanceReady && !isInitiallyResolved) {
      if (currentAddress) {
        if (import.meta.env.DEV) console.log(`%c[SetMgmt] Initializing for connected profile: ${currentAddress.slice(0,6)}...`, 'color: #f39c12;');
        loadInitialData(currentAddress);
      } else {
        if (import.meta.env.DEV) console.log(`%c[SetMgmt] Initializing for DISCONNECTED state.`, 'color: #f39c12;');
        setSetlist(emptySetlist); setStagedSetlist(emptySetlist);
        setActiveWorkspace(emptyWorkspace); setStagedActiveWorkspace(emptyWorkspace);
        setLiveConfig(null, null);
        setIsLoading(false);
        setIsInitiallyResolved(true);
      }
    }
  }, [shouldStartLoading, hostProfileAddress, visitorProfileAddress, configServiceInstanceReady, isInitiallyResolved, isHostProfileOwner, addToast, setLiveConfig, _loadWorkspaceFromCid]);

  useEffect(() => {
    if (isInitiallyResolved && !hostProfileAddress && !isFullyLoaded) {
      if (import.meta.env.DEV) console.log(`%c[SetMgmt] Resolved as DISCONNECTED. Setting isFullyLoaded = true.`, 'color: #2ecc71; font-weight: bold;');
      setIsFullyLoaded(true);
    }
  }, [isInitiallyResolved, hostProfileAddress, isFullyLoaded]);
  
  const savedSceneList = useMemo(() => {
    if (!stagedActiveWorkspace || !stagedActiveWorkspace.presets) return [];
    const validScenes = Object.values(stagedActiveWorkspace.presets).filter(p => p && typeof p.name === 'string');
    return validScenes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(scene => ({ name: scene.name }));
  }, [stagedActiveWorkspace]);
  
  const { loadedLayerConfigsFromScene, loadedTokenAssignmentsFromScene } = useMemo(() => {
    if (!stagedActiveWorkspace || !activeSceneName || !stagedActiveWorkspace.presets[activeSceneName]) {
      return { loadedLayerConfigsFromScene: null, loadedTokenAssignmentsFromScene: null };
    }
    const scene = stagedActiveWorkspace.presets[activeSceneName];
    return {
      loadedLayerConfigsFromScene: scene.layers,
      loadedTokenAssignmentsFromScene: scene.tokenAssignments,
    };
  }, [stagedActiveWorkspace, activeSceneName]);

  const activeMidiMap = useMemo(() => {
    if (!isHostProfileOwner && visitorProfileAddress) return visitorMidiMap;
    return stagedSetlist?.globalUserMidiMap || {};
  }, [isHostProfileOwner, visitorProfileAddress, visitorMidiMap, stagedSetlist]);

  const activeEventReactions = useMemo(() => {
    if (!isHostProfileOwner && visitorProfileAddress) return visitorEventReactions;
    return stagedActiveWorkspace?.globalEventReactions || {};
  }, [isHostProfileOwner, visitorProfileAddress, visitorEventReactions, stagedActiveWorkspace]);

  const refreshOwnedTokens = useCallback(async (isSilent = false) => {
    const service = configServiceRef.current;
    const effectiveAddress = hostProfileAddress || visitorProfileAddress;
    if (!effectiveAddress || officialWhitelist.length === 0 || !service) {
      setOwnedTokenIdentifiers({});
      setTokenFetchProgress({ loaded: 0, total: 0, loading: false });
      return;
    }

    setIsFetchingTokens(true);
    setTokenFetchProgress({ loaded: 0, total: officialWhitelist.length, loading: true });
    if (!isSilent) addToast("Fetching token libraries...", "info", 2000);

    try {
      const isAdminShowcase = effectiveAddress.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
      
      const identifierPromises = officialWhitelist.map(async (collection) => {
        const standard = await service.detectCollectionStandard(collection.address);
        let identifiers = [];
        if (standard === 'LSP8') {
          if (isAdminShowcase) {
            identifiers = await service.getAllLSP8TokenIdsForCollection(collection.address);
          } else {
            identifiers = await service.getOwnedLSP8TokenIdsForCollection(effectiveAddress, collection.address);
          }
        }
        setTokenFetchProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
        return { address: collection.address, identifiers };
      });

      const results = await Promise.all(identifierPromises);
      
      const newIdentifierMap = results.reduce((acc, result) => {
        if (result.identifiers.length > 0) {
          acc[result.address] = result.identifiers;
        }
        return acc;
      }, {});

      setOwnedTokenIdentifiers(newIdentifierMap);

      if (!isSilent) {
        const totalIds = Object.values(newIdentifierMap).reduce((sum, ids) => sum + ids.length, 0);
        addToast(`Token libraries loaded: ${totalIds} assets available.`, "success", 3000);
      }
    } catch (error) {
      console.error("Failed to refresh owned token identifiers:", error);
      if (!isSilent) addToast("Could not load token libraries.", "error");
    } finally {
      setIsFetchingTokens(false);
      setTokenFetchProgress(prev => ({ ...prev, loading: false }));
    }
  }, [hostProfileAddress, visitorProfileAddress, officialWhitelist, addToast]);

  const preloadWorkspace = useCallback(async (workspaceName) => {
    const service = configServiceRef.current;
    if (!service || !stagedSetlist?.workspaces[workspaceName]) return;
    if (preloadedWorkspacesRef.current.has(workspaceName) || preloadingInProgressRef.current.has(workspaceName)) {
      return;
    }
    try {
      preloadingInProgressRef.current.add(workspaceName);
      if (import.meta.env.DEV) console.log(`[Preloader] Hover detected. Starting preload for workspace: "${workspaceName}"`);
      const workspaceInfo = stagedSetlist.workspaces[workspaceName];
      const workspaceData = await _loadWorkspaceFromCid(workspaceInfo.cid);
      if (workspaceData) {
        preloadedWorkspacesRef.current.set(workspaceName, workspaceData);
        if (import.meta.env.DEV) console.log(`[Preloader] Cached workspace data for "${workspaceName}".`);
        const imageUrlsToPreload = new Set();
        Object.values(workspaceData.presets || {}).forEach(preset => {
          Object.values(preset.tokenAssignments || {}).forEach(assignment => {
            const src = resolveImageUrl(assignment);
            if (src) imageUrlsToPreload.add(src);
          });
        });
        if (imageUrlsToPreload.size > 0) {
          if (import.meta.env.DEV) console.log(`[Preloader] Preloading ${imageUrlsToPreload.size} images for "${workspaceName}".`);
          preloadImages(Array.from(imageUrlsToPreload));
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`[Preloader] Failed to preload workspace "${workspaceName}":`, error);
    } finally {
      preloadingInProgressRef.current.delete(workspaceName);
    }
  }, [stagedSetlist, _loadWorkspaceFromCid]);

  const _executeLoadAfterFade = useCallback(async () => {
    const workspaceName = workspaceToLoadRef.current;
    if (!workspaceName || !stagedSetlist || !stagedSetlist.workspaces[workspaceName]) {
      const errorMsg = `Target workspace '${workspaceName}' not found for loading.`;
      addToast(errorMsg, 'error');
      setIsLoading(false);
      setLoadingMessage("");
      setIsWorkspaceTransitioning(false); // Reset transition state on error
      return;
    }

    try {
      let newWorkspace;
      if (preloadedWorkspacesRef.current.has(workspaceName)) {
        newWorkspace = preloadedWorkspacesRef.current.get(workspaceName);
      } else {
        const workspaceInfo = stagedSetlist.workspaces[workspaceName];
        newWorkspace = await _loadWorkspaceFromCid(workspaceInfo.cid);
        if (!newWorkspace) throw new Error("Failed to fetch workspace data from IPFS.");

        const imageUrlsToPreload = new Set();
        Object.values(newWorkspace.presets || {}).forEach(preset => {
          Object.values(preset.tokenAssignments || {}).forEach(assignment => {
            const src = resolveImageUrl(assignment);
            if (src) imageUrlsToPreload.add(src);
          });
        });
        if (imageUrlsToPreload.size > 0) {
          await preloadImages(Array.from(imageUrlsToPreload));
        }
        preloadedWorkspacesRef.current.set(workspaceName, newWorkspace);
      }

      setActiveWorkspace(newWorkspace);
      setStagedActiveWorkspace(newWorkspace);
      setActiveWorkspaceName(workspaceName);
      addToast(`Workspace "${workspaceName}" loaded.`, 'success');

    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
      setIsWorkspaceTransitioning(false);
      workspaceToLoadRef.current = null;
    }
  }, [stagedSetlist, addToast, _loadWorkspaceFromCid]);

  const loadWorkspace = useCallback(async (workspaceName) => {
    // --- START MODIFICATION: Remove isLoading guard ---
    if (isWorkspaceTransitioning) return;
    // --- END MODIFICATION ---

    if (!stagedSetlist || !stagedSetlist.workspaces[workspaceName]) {
        const errorMsg = `Workspace '${workspaceName}' not found.`;
        addToast(errorMsg, 'error');
        return { success: false, error: errorMsg };
    }

    setLoadingMessage(`Switching to ${workspaceName}...`);
    setIsLoading(true);
    setIsWorkspaceTransitioning(true);
    workspaceToLoadRef.current = workspaceName;

    return { success: true };
  }, [isWorkspaceTransitioning, stagedSetlist, addToast]);
  
  useEffect(() => {
    if (newlyCreatedWorkspace && stagedSetlist?.workspaces[newlyCreatedWorkspace]) {
      loadWorkspace(newlyCreatedWorkspace);
      setNewlyCreatedWorkspace(null); 
    }
  }, [newlyCreatedWorkspace, stagedSetlist, loadWorkspace]);

  const loadScene = useCallback(async (name) => {
    if (!stagedActiveWorkspace || !stagedActiveWorkspace.presets[name]) {
      const errorMsg = `Scene '${name}' not found.`;
      addToast(errorMsg, 'warning');
      return { success: false, error: errorMsg };
    }
    if (activeSceneName !== name) {
      const scene = stagedActiveWorkspace.presets[name];
      setLiveConfig(scene.layers, scene.tokenAssignments);
      setActiveSceneName(name);
      setSceneLoadNonce(prev => prev + 1);
    }
    return { success: true };
  }, [stagedActiveWorkspace, activeSceneName, addToast, setLiveConfig]);

  const setActiveSceneSilently = useCallback((name) => {
    if (!stagedActiveWorkspace || !stagedActiveWorkspace.presets[name]) {
      if (import.meta.env.DEV) console.warn(`[SetManagement] setActiveSceneSilently called with non-existent scene: ${name}`);
      return;
    }
    if (activeSceneName !== name) {
      const scene = stagedActiveWorkspace.presets[name];
      setLiveConfig(scene.layers, scene.tokenAssignments);
      setActiveSceneName(name);
    }
  }, [stagedActiveWorkspace, activeSceneName, setLiveConfig]);
  
  const discardStagedChanges = useCallback(() => {
    setStagedSetlist(setlist);
    setStagedActiveWorkspace(activeWorkspace);
    const sceneNameToReload = activeSceneName || activeWorkspace?.defaultPresetName || null;
    const scene = sceneNameToReload ? activeWorkspace.presets[sceneNameToReload] : null;
    setLiveConfig(scene?.layers || null, scene?.tokenAssignments || null);
    setHasPendingChanges(false);
    addToast("Changes discarded.", "info");
  }, [setlist, activeWorkspace, activeSceneName, addToast, setLiveConfig]);

  const addNewSceneToStagedWorkspace = useCallback((newSceneName, newSceneData) => {
    setStagedActiveWorkspace(prev => {
      const newWorkspace = prev ? JSON.parse(JSON.stringify(prev)) : { presets: {}, defaultPresetName: null, globalMidiMap: {}, globalEventReactions: {}, personalCollectionLibrary: [], userPalettes: {} };
      newWorkspace.presets[newSceneName] = newSceneData;
      return newWorkspace;
    });
    setLiveConfig(newSceneData.layers, newSceneData.tokenAssignments);
    setActiveSceneName(newSceneName);
    setHasPendingChanges(true);
  }, [setLiveConfig]);

  const deleteSceneFromStagedWorkspace = useCallback((nameToDelete) => {
    setStagedActiveWorkspace(prev => {
      if (!prev || !prev.presets || !prev.presets[nameToDelete]) return prev;
      const newWorkspace = JSON.parse(JSON.stringify(prev));
      delete newWorkspace.presets[nameToDelete];
      if (newWorkspace.defaultPresetName === nameToDelete) newWorkspace.defaultPresetName = null;
      return newWorkspace;
    });
    setHasPendingChanges(true);
  }, []);

  const setDefaultSceneInStagedWorkspace = useCallback((nameToSet) => {
    setStagedActiveWorkspace(prev => {
      if (!prev || !prev.presets || !prev.presets[nameToSet]) return prev;
      return { ...prev, defaultPresetName: nameToSet };
    });
    setHasPendingChanges(true);
  }, []);

  const updateGlobalMidiMap = useCallback((newMap) => {
    if (isHostProfileOwner) {
        setStagedSetlist(prev => ({ ...prev, globalUserMidiMap: newMap || {} }));
        setHasPendingChanges(true);
    }
  }, [isHostProfileOwner]);

  const updateLayerMidiMappings = useCallback((layerId, mappingData) => {
    if (isHostProfileOwner) {
      setStagedSetlist(prev => {
        const newGlobalMidiMap = { ...(prev?.globalUserMidiMap || {}) };
        newGlobalMidiMap.layerSelects = { ...(newGlobalMidiMap.layerSelects || {}), [layerId]: mappingData };
        return { ...prev, globalUserMidiMap: newGlobalMidiMap };
      });
      setHasPendingChanges(true);
    }
  }, [isHostProfileOwner]);

  const updateGlobalEventReactions = useCallback((eventType, reactionData) => {
    if (!eventType || !reactionData) return;
    setStagedActiveWorkspace(prev => ({
      ...prev, globalEventReactions: { ...(prev?.globalEventReactions || {}), [eventType]: reactionData }
    }));
    setHasPendingChanges(true);
  }, []);

  const deleteGlobalEventReaction = useCallback((eventType) => {
    if (!eventType) return;
    setStagedActiveWorkspace(prev => {
      const newReactions = { ...(prev?.globalEventReactions || {}) };
      if (newReactions[eventType]) {
        delete newReactions[eventType];
        setHasPendingChanges(true);
        return { ...prev, globalEventReactions: newReactions };
      }
      return prev;
    });
  }, []);

  const addPalette = useCallback((paletteName) => {
    setStagedActiveWorkspace(prev => {
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
    setStagedActiveWorkspace(prev => {
      const newWorkspace = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
      if (!newWorkspace.userPalettes[paletteName]) return prev;
      delete newWorkspace.userPalettes[paletteName];
      addToast(`Palette "${paletteName}" removed.`, "info");
      setHasPendingChanges(true);
      return newWorkspace;
    });
  }, [addToast]);

  const addTokenToPalette = useCallback((paletteName, tokenId) => {
    setStagedActiveWorkspace(prev => {
      const newWorkspace = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
      const palette = newWorkspace.userPalettes[paletteName];
      if (!palette) {
        addToast(`Palette "${paletteName}" not found.`, "error"); return prev;
      }
      if (palette.includes(tokenId)) {
        addToast("Token is already in this palette.", "info"); return prev;
      }
      newWorkspace.userPalettes[paletteName] = [...palette, tokenId];
      addToast(`Token added to "${paletteName}".`, "success");
      setHasPendingChanges(true);
      return newWorkspace;
    });
  }, [addToast]);

  const removeTokenFromPalette = useCallback((paletteName, tokenId) => {
    setStagedActiveWorkspace(prev => {
      const newWorkspace = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
      const palette = newWorkspace.userPalettes[paletteName];
      if (!palette) return prev;
      newWorkspace.userPalettes[paletteName] = palette.filter(id => id !== tokenId);
      setHasPendingChanges(true);
      return newWorkspace;
    });
  }, []);

  const saveChanges = useCallback(async (workspaceNameToSave = activeWorkspaceName, setlistToSave = stagedSetlist) => {
    const service = configServiceRef.current;
    const addressToSave = hostProfileAddress;
    if (!service || !addressToSave || !service.checkReadyForWrite()) {
        const errorMsg = "Save service not ready or no profile connected.";
        addToast(errorMsg, "error");
        return { success: false, error: errorMsg };
    }
    if (!setlistToSave || !stagedActiveWorkspace || !workspaceNameToSave) {
        addToast("Data not fully loaded, cannot save.", "error");
        return { success: false, error: "Data not loaded" };
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
        const workspaceToUpload = JSON.parse(JSON.stringify(stagedActiveWorkspace));
        delete workspaceToUpload.globalMidiMap;
        
        addToast("Uploading workspace data...", "info", 2000);
        const newWorkspaceCid = await uploadJsonToPinata(workspaceToUpload, `RADAR_Workspace_${workspaceNameToSave}`);
        if (!newWorkspaceCid) throw new Error("Failed to upload workspace to IPFS.");

        const newSetlist = JSON.parse(JSON.stringify(setlistToSave));
        if (!newSetlist.workspaces[workspaceNameToSave]) {
          newSetlist.workspaces[workspaceNameToSave] = {};
        }
        newSetlist.workspaces[workspaceNameToSave].cid = newWorkspaceCid;

        addToast("Saving setlist to your profile...", "info", 2000);
        await service.saveSetlist(addressToSave, newSetlist);

        setSetlist(newSetlist);
        setStagedSetlist(newSetlist);
        if (workspaceNameToSave === activeWorkspaceName) {
            setActiveWorkspace(stagedActiveWorkspace);
        }
        setHasPendingChanges(false);
        setSaveSuccess(true);
        addToast("Changes saved successfully!", "success");
        return { success: true, newSetlist };
    } catch (error) {
        const errorMsg = error.message || "Unknown save error.";
        addToast(`Error saving changes: ${errorMsg}`, 'error');
        setSaveError(errorMsg);
        setSaveSuccess(false);
        return { success: false, error: errorMsg };
    } finally {
        setIsSaving(false);
    }
  }, [stagedSetlist, activeWorkspaceName, stagedActiveWorkspace, hostProfileAddress, addToast]);
  
  const duplicateActiveWorkspace = useCallback(async (newName) => {
    if (!newName || typeof newName !== 'string') {
        addToast("Invalid workspace name provided.", "error");
        return { success: false, error: "Invalid name" };
    }
    if (stagedSetlist?.workspaces[newName]) {
        addToast(`Workspace "${newName}" already exists.`, "error");
        return { success: false, error: "Name exists" };
    }

    const newSetlist = JSON.parse(JSON.stringify(stagedSetlist));
    newSetlist.workspaces[newName] = { cid: '' };

    const result = await saveChanges(newName, newSetlist);
    
    if (result.success) {
        setActiveWorkspaceName(newName);
        addToast(`Workspace "${newName}" created and loaded.`, 'success');
    }
    return result;

  }, [stagedSetlist, saveChanges, addToast]);

  const createNewWorkspace = useCallback(async (newName) => {
    if (isLoading) return;
    if (!newName || typeof newName !== 'string') {
        addToast("Invalid workspace name provided.", "error");
        return;
    }
    if (stagedSetlist?.workspaces[newName]) {
        addToast(`Workspace name "${newName}" is already taken.`, "error");
        return;
    }
  
    setIsLoading(true);
    setLoadingMessage(`Creating "${newName}"...`);
  
    try {
        const newWorkspace = {
            presets: {
                "Default": { name: "Default", ts: Date.now(), layers: fallbackConfig.layers, tokenAssignments: fallbackConfig.tokenAssignments }
            },
            defaultPresetName: "Default",
            globalEventReactions: {},
            personalCollectionLibrary: [],
            userPalettes: {}
        };
  
        const defaultAssignments = fallbackConfig.tokenAssignments || {};
        const imageUrlsToPreload = new Set();
        Object.values(defaultAssignments).forEach(assignment => {
            const src = resolveImageUrl(assignment);
            if (src) {
                imageUrlsToPreload.add(src);
            }
        });
  
        if (imageUrlsToPreload.size > 0) {
            await preloadImages(Array.from(imageUrlsToPreload));
        }
  
        const newWorkspaceCID = await uploadJsonToPinata(newWorkspace, `RADAR_Workspace_${newName}`);
        if (!newWorkspaceCID) throw new Error("Failed to upload new workspace.");
  
        preloadedWorkspacesRef.current.set(newName, newWorkspace);
  
        setStagedSetlist(prev => {
            const newSetlist = prev ? JSON.parse(JSON.stringify(prev)) : { workspaces: {}, defaultWorkspaceName: null };
            newSetlist.workspaces[newName] = { cid: newWorkspaceCID, lastModified: Date.now() };
            return newSetlist;
        });
  
        setHasPendingChanges(true);
        addToast(`Workspace "${newName}" created. Save your setlist to persist it.`, "success");
        
        setNewlyCreatedWorkspace(newName);
  
    } catch (error) {
        addToast(`Error creating workspace: ${error.message}`, "error");
        setIsLoading(false);
        setLoadingMessage("");
    }
  }, [stagedSetlist, addToast, isLoading]);

  const deleteWorkspaceFromSet = useCallback((workspaceName) => {
    setStagedSetlist(prev => {
      if (!prev || !prev.workspaces[workspaceName]) return prev;
      const newSetlist = JSON.parse(JSON.stringify(prev));
      delete newSetlist.workspaces[workspaceName];
      if (newSetlist.defaultWorkspaceName === workspaceName) {
        newSetlist.defaultWorkspaceName = Object.keys(newSetlist.workspaces)[0] || null;
      }
      setHasPendingChanges(true);
      addToast(`Workspace "${workspaceName}" deleted. Save changes to confirm.`, 'info');
      return newSetlist;
    });
  }, [addToast]);

  const renameWorkspaceInSet = useCallback((oldName, newName) => {
    setStagedSetlist(prev => {
      if (!prev || !prev.workspaces[oldName] || prev.workspaces[newName]) {
        if (prev.workspaces[newName]) addToast(`Name "${newName}" is already taken.`, 'error');
        return prev;
      }
      const newSetlist = JSON.parse(JSON.stringify(prev));
      newSetlist.workspaces[newName] = newSetlist.workspaces[oldName];
      delete newSetlist.workspaces[oldName];

      if (newSetlist.defaultWorkspaceName === oldName) {
        newSetlist.defaultWorkspaceName = newName;
      }
      if (activeWorkspaceName === oldName) {
        setActiveWorkspaceName(newName);
      }

      setHasPendingChanges(true);
      addToast(`Workspace renamed to "${newName}".`, 'success');
      return newSetlist;
    });
  }, [addToast, activeWorkspaceName]);

  const setDefaultWorkspaceInSet = useCallback((workspaceName) => {
    setStagedSetlist(prev => {
      if (!prev || !prev.workspaces[workspaceName]) return prev;
      const newSetlist = { ...prev, defaultWorkspaceName: workspaceName };
      setHasPendingChanges(true);
      addToast(`"${workspaceName}" is now the default workspace.`, 'success');
      return newSetlist;
    });
  }, [addToast]);
  
  const contextValue = useMemo(() => ({
    isLoading,
    loadingMessage,
    isFullyLoaded,
    setlist, stagedSetlist, activeWorkspace, stagedActiveWorkspace, activeWorkspaceName, activeSceneName,
    savedSceneList, loadError, isSaving, saveError, saveSuccess, isInitiallyResolved,
    sceneLoadNonce, loadedLayerConfigsFromScene, loadedTokenAssignmentsFromScene,
    officialWhitelist, refreshOfficialWhitelist: fetchOfficialWhitelist,
    hasPendingChanges, setHasPendingChanges,
    configServiceRef, configServiceInstanceReady,
    activeMidiMap, activeEventReactions,
    ownedTokenIdentifiers, isFetchingTokens, tokenFetchProgress, refreshOwnedTokens,
    loadWorkspace, loadScene, setActiveSceneSilently, saveChanges, duplicateActiveWorkspace,
    createNewWorkspace, deleteWorkspaceFromSet, renameWorkspaceInSet, setDefaultWorkspaceInSet,
    addNewSceneToStagedWorkspace, deleteSceneFromStagedWorkspace,
    setDefaultSceneInStagedWorkspace, discardStagedChanges,
    updateGlobalMidiMap, updateLayerMidiMappings,
    updateGlobalEventReactions, deleteGlobalEventReaction,
    addPalette, removePalette, addTokenToPalette, removeTokenFromPalette,
    preloadWorkspace,
    startLoadingProcess,
    isWorkspaceTransitioning,
    _executeLoadAfterFade,
  }), [
    isLoading, loadingMessage, isFullyLoaded,
    setlist, stagedSetlist, activeWorkspace, stagedActiveWorkspace, activeWorkspaceName, activeSceneName,
    savedSceneList, loadError, isSaving, saveError, saveSuccess, isInitiallyResolved,
    sceneLoadNonce, loadedLayerConfigsFromScene, loadedTokenAssignmentsFromScene,
    officialWhitelist, fetchOfficialWhitelist,
    hasPendingChanges,
    configServiceInstanceReady,
    activeMidiMap, activeEventReactions,
    ownedTokenIdentifiers, isFetchingTokens, tokenFetchProgress, refreshOwnedTokens,
    loadWorkspace, loadScene, setActiveSceneSilently, saveChanges, duplicateActiveWorkspace,
    createNewWorkspace, deleteWorkspaceFromSet, renameWorkspaceInSet, setDefaultWorkspaceInSet,
    addNewSceneToStagedWorkspace, deleteSceneFromStagedWorkspace,
    setDefaultSceneInStagedWorkspace, discardStagedChanges,
    updateGlobalMidiMap, updateLayerMidiMappings,
    updateGlobalEventReactions, deleteGlobalEventReaction,
    addPalette, removePalette, addTokenToPalette, removeTokenFromPalette,
    preloadWorkspace,
    startLoadingProcess,
    isWorkspaceTransitioning,
    _executeLoadAfterFade,
  ]);
  
  return (
    <SetManagementContext.Provider value={contextValue}>
      {children}
    </SetManagementContext.Provider>
  );
};

SetManagementProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useSetManagement = () => {
  const context = useContext(SetManagementContext);
  if (context === undefined) {
    throw new Error("useSetManagement must be used within a SetManagementProvider");
  }
  return context;
};