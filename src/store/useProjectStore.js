// src/store/useProjectStore.js
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import ConfigurationService, { hexToUtf8Safe } from '../services/ConfigurationService'; 
import { uploadJsonToPinata } from '../services/PinataService';
import { resolveImageUrl, preloadImages } from '../utils/imageDecoder';
import fallbackConfig from '../config/fallback-config';
import { RADAR_OFFICIAL_ADMIN_ADDRESS, IPFS_GATEWAY } from "../config/global-config";
import { keccak256, stringToBytes } from "viem";
import { useEngineStore } from './useEngineStore'; // Import Engine Store

// Initial Empty States
const EMPTY_SETLIST = {
  defaultWorkspaceName: null,
  workspaces: {},
  globalUserMidiMap: {},
  personalCollectionLibrary: [],
  userPalettes: {},
  globalEventReactions: {}
};

const EMPTY_WORKSPACE = {
  presets: {},
  defaultPresetName: null,
  modulation: { baseValues: {}, patches: [] } // Standard Structure
};

const OFFICIAL_WHITELIST_KEY = keccak256(stringToBytes("RADAR.OfficialWhitelist"));
const TOKEN_CACHE_DURATION_MS = 5 * 60 * 1000;

export const useProjectStore = create(devtools((set, get) => ({
  // =========================================
  // 1. STATE
  // =========================================
  configService: null,
  isConfigReady: false,
  isLoading: false,
  loadingMessage: "Initializing...",
  isSaving: false,
  hasPendingChanges: false,
  error: null,      
  saveError: null,  
  setlist: EMPTY_SETLIST, 
  stagedSetlist: EMPTY_SETLIST, 
  activeWorkspaceName: null,
  stagedWorkspace: EMPTY_WORKSPACE, 
  activeSceneName: null, 
  workspaceCache: new Map(),
  officialWhitelist: [],
  ownedTokenIdentifiers: {},
  isFetchingTokens: false,
  tokenFetchProgress: { loaded: 0, total: 0, loading: false },
  lastTokenFetchTimestamp: 0,

  // =========================================
  // 2. INITIALIZATION ACTIONS
  // =========================================
  initService: (provider, walletClient, publicClient) => {
    const service = new ConfigurationService(provider, walletClient, publicClient);
    const isReady = service.checkReadyForRead();
    set({ configService: service, isConfigReady: isReady });
    if(isReady) get().refreshOfficialWhitelist();
  },

  resetProject: () => {
    set({
      setlist: EMPTY_SETLIST,
      stagedSetlist: EMPTY_SETLIST,
      stagedWorkspace: EMPTY_WORKSPACE,
      activeWorkspaceName: null,
      activeSceneName: null,
      hasPendingChanges: false,
      error: null,
      saveError: null,
      ownedTokenIdentifiers: {},
      lastTokenFetchTimestamp: 0,
      tokenFetchProgress: { loaded: 0, total: 0, loading: false }
    });
  },

  // =========================================
  // 3. ASSET ACTIONS
  // =========================================
  refreshOfficialWhitelist: async () => {
    const { configService } = get();
    if (!configService || !configService.checkReadyForRead()) return;
    try {
        const pointerHex = await configService.loadDataFromKey(RADAR_OFFICIAL_ADMIN_ADDRESS, OFFICIAL_WHITELIST_KEY);
        if (!pointerHex || pointerHex === '0x') { set({ officialWhitelist: [] }); return; }
        const ipfsUri = hexToUtf8Safe(pointerHex);
        if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) { set({ officialWhitelist: [] }); return; }
        const cid = ipfsUri.substring(7);
        const response = await fetch(`${IPFS_GATEWAY}${cid}`);
        if (!response.ok) throw new Error(`Failed to fetch whitelist from IPFS: ${response.statusText}`);
        const list = await response.json();
        set({ officialWhitelist: Array.isArray(list) ? list : [] });
    } catch (error) {
        console.error("Error fetching official collection whitelist:", error);
        set({ officialWhitelist: [] });
    }
  },

  refreshOwnedTokens: async (hostProfileAddress, force = false, isSilent = false) => {
    const state = get();
    const { configService, officialWhitelist, stagedSetlist, lastTokenFetchTimestamp, isFetchingTokens } = state;
    if (!configService || !configService.checkReadyForRead()) return;
    if (isFetchingTokens) return; 

    const userLibrary = stagedSetlist?.personalCollectionLibrary || [];
    const combinedCollectionsMap = new Map();
    officialWhitelist.forEach(c => {
        if (c && c.address) combinedCollectionsMap.set(c.address.toLowerCase(), { ...c, _isOfficial: true });
    });
    userLibrary.forEach(c => {
        if (c && c.address && !combinedCollectionsMap.has(c.address.toLowerCase())) {
            combinedCollectionsMap.set(c.address.toLowerCase(), { ...c, _isOfficial: false });
        }
    });
    const allCollections = Array.from(combinedCollectionsMap.values());

    if (!force && lastTokenFetchTimestamp > 0 && (Date.now() - lastTokenFetchTimestamp < TOKEN_CACHE_DURATION_MS)) {
        return;
    }

    if (!hostProfileAddress || allCollections.length === 0) {
      set({ ownedTokenIdentifiers: {} });
      return;
    }

    set({ isFetchingTokens: true, tokenFetchProgress: { loaded: 0, total: allCollections.length, loading: true } });

    try {
      const isAdminShowcase = hostProfileAddress?.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
      let newIdentifierMap = {};

      if (isAdminShowcase) {
        for (const collection of allCollections) {
            const standard = await configService.detectCollectionStandard(collection.address);
            let identifiers = [];
            if (standard === 'LSP8') {
                if (collection._isOfficial) {
                    identifiers = await configService.getAllLSP8TokenIdsForCollection(collection.address);
                    if (identifiers.length === 0) identifiers = await configService.getOwnedLSP8TokenIdsForCollection(hostProfileAddress, collection.address);
                } else {
                    identifiers = await configService.getOwnedLSP8TokenIdsForCollection(hostProfileAddress, collection.address);
                }
            } else if (standard === 'LSP7') {
                const balance = await configService.getLSP7Balance(hostProfileAddress, collection.address);
                if (balance > 0) identifiers.push('LSP7_TOKEN');
            }
            if (identifiers.length > 0) newIdentifierMap[collection.address] = identifiers;
            set(s => ({ tokenFetchProgress: { ...s.tokenFetchProgress, loaded: s.tokenFetchProgress.loaded + 1 } }));
        }
      } else {
        newIdentifierMap = await configService.getBatchCollectionData(hostProfileAddress, allCollections);
      }
      set({ ownedTokenIdentifiers: newIdentifierMap, lastTokenFetchTimestamp: Date.now() });
    } catch (error) {
      console.error("Failed to refresh owned token identifiers:", error);
    } finally {
      set({ isFetchingTokens: false, tokenFetchProgress: { ...get().tokenFetchProgress, loading: false } });
    }
  },

  // =========================================
  // 4. ASYNC LOADING ACTIONS
  // =========================================

  loadSetlist: async (profileAddress, visitorContext = null) => {
    const { configService } = get();
    if (!configService) return;

    set({ isLoading: true, loadingMessage: "Fetching Setlist...", error: null });

    try {
      let loadedSetlist = await configService.loadWorkspace(profileAddress);

      if (visitorContext?.isVisitor && visitorContext?.loggedInUserUPAddress) {
        try {
          const visitorSetlist = await configService.loadWorkspace(visitorContext.loggedInUserUPAddress);
          if (visitorSetlist) {
            loadedSetlist = {
              ...loadedSetlist,
              globalUserMidiMap: visitorSetlist.globalUserMidiMap || loadedSetlist.globalUserMidiMap,
              globalEventReactions: visitorSetlist.globalEventReactions || loadedSetlist.globalEventReactions
            };
          }
        } catch (e) {
          console.warn("Failed to load visitor overlay data", e);
        }
      }

      set({ 
        setlist: loadedSetlist, 
        stagedSetlist: JSON.parse(JSON.stringify(loadedSetlist)), 
        isLoading: false,
        loadingMessage: ""
      });

      get().refreshOwnedTokens(profileAddress); 

      const defaultName = loadedSetlist.defaultWorkspaceName || Object.keys(loadedSetlist.workspaces)[0];
      if (defaultName) {
        await get().loadWorkspace(defaultName);
      } else {
        set({ stagedWorkspace: EMPTY_WORKSPACE, activeWorkspaceName: null, activeSceneName: null });
      }

    } catch (err) {
      console.error("Load Setlist Error:", err);
      set({ isLoading: false, error: err.message || "Failed to load setlist." });
    }
  },

  loadWorkspace: async (workspaceName) => {
    const { stagedSetlist, configService, workspaceCache } = get();
    
    if (!stagedSetlist?.workspaces?.[workspaceName]) {
      set({ error: `Workspace '${workspaceName}' not found.` });
      return { success: false };
    }

    set({ isLoading: true, loadingMessage: `Loading ${workspaceName}...`, error: null });

    try {
      let workspaceData;

      if (workspaceCache.has(workspaceName)) {
        workspaceData = workspaceCache.get(workspaceName);
      } else {
        const cid = stagedSetlist.workspaces[workspaceName].cid;
        if (cid) {
          workspaceData = await configService._loadWorkspaceFromCID(cid);
          workspaceCache.set(workspaceName, workspaceData); 
        } else {
          workspaceData = JSON.parse(JSON.stringify(fallbackConfig)); 
        }
      }

      if (!workspaceData) throw new Error("Failed to resolve workspace data.");

      set({ loadingMessage: "Decoding Assets..." });
      const imageUrls = new Set();
      Object.values(workspaceData.presets || {}).forEach(preset => {
        Object.values(preset.tokenAssignments || {}).forEach(assignment => {
          const src = resolveImageUrl(assignment);
          if (src) imageUrls.add(src);
        });
      });
      if (imageUrls.size > 0) await preloadImages(Array.from(imageUrls));

      // --- HYDRATE MODULATION ENGINE ---
      const engineStore = useEngineStore.getState();
      if (workspaceData.modulation) {
          // console.log("[ProjectStore] Loading Modulation Data:", workspaceData.modulation);
          engineStore.loadModulationState(workspaceData.modulation.baseValues, workspaceData.modulation.patches);
      } else {
          // console.log("[ProjectStore] No Modulation Data found, resetting to defaults.");
          engineStore.loadModulationState(null, null); 
      }

      const initialScene = workspaceData.defaultPresetName || Object.keys(workspaceData.presets || {})[0] || null;
      
      set({
        stagedWorkspace: workspaceData,
        activeWorkspaceName: workspaceName,
        activeSceneName: initialScene,
        isLoading: false,
        loadingMessage: ""
      });

      return { success: true };

    } catch (err) {
      console.error("Load Workspace Error:", err);
      set({ isLoading: false, error: err.message });
      return { success: false };
    }
  },

  // 5. SYNCHRONOUS ACTIONS
  setActiveSceneName: (name) => set({ activeSceneName: name }),
  addScene: (sceneName, sceneData) => set((state) => {
    const newWorkspace = JSON.parse(JSON.stringify(state.stagedWorkspace));
    if (!newWorkspace.presets) newWorkspace.presets = {};
    newWorkspace.presets[sceneName] = sceneData;
    return { stagedWorkspace: newWorkspace, hasPendingChanges: true, activeSceneName: sceneName };
  }),
  deleteScene: (sceneName) => set((state) => {
    const newWorkspace = JSON.parse(JSON.stringify(state.stagedWorkspace));
    delete newWorkspace.presets[sceneName];
    if (newWorkspace.defaultPresetName === sceneName) newWorkspace.defaultPresetName = null;
    return { stagedWorkspace: newWorkspace, hasPendingChanges: true };
  }),
  setDefaultScene: (sceneName) => set((state) => {
    const newWorkspace = { ...state.stagedWorkspace, defaultPresetName: sceneName };
    return { stagedWorkspace: newWorkspace, hasPendingChanges: true };
  }),
  updateGlobalMidiMap: (newMap) => set((state) => ({ stagedSetlist: { ...state.stagedSetlist, globalUserMidiMap: newMap }, hasPendingChanges: true })),
  updateGlobalEventReactions: (eventType, reactionData) => set((state) => {
    const newReactions = { ...state.stagedSetlist.globalEventReactions, [eventType]: reactionData };
    return { stagedSetlist: { ...state.stagedSetlist, globalEventReactions: newReactions }, hasPendingChanges: true };
  }),
  deleteGlobalEventReaction: (eventType) => set((state) => {
    const newReactions = { ...state.stagedSetlist.globalEventReactions };
    delete newReactions[eventType];
    return { stagedSetlist: { ...state.stagedSetlist, globalEventReactions: newReactions }, hasPendingChanges: true };
  }),
  addPalette: (name) => set((state) => {
    const newPalettes = { ...state.stagedSetlist.userPalettes, [name]: [] };
    return { stagedSetlist: { ...state.stagedSetlist, userPalettes: newPalettes }, hasPendingChanges: true };
  }),
  removePalette: (name) => set((state) => {
    const newPalettes = { ...state.stagedSetlist.userPalettes };
    delete newPalettes[name];
    return { stagedSetlist: { ...state.stagedSetlist, userPalettes: newPalettes }, hasPendingChanges: true };
  }),
  addTokenToPalette: (paletteName, tokenId) => set((state) => {
    const current = state.stagedSetlist.userPalettes[paletteName] || [];
    if (current.includes(tokenId)) return {};
    const newPalettes = { ...state.stagedSetlist.userPalettes, [paletteName]: [...current, tokenId] };
    return { stagedSetlist: { ...state.stagedSetlist, userPalettes: newPalettes }, hasPendingChanges: true };
  }),
  removeTokenFromPalette: (paletteName, tokenId) => set((state) => {
    const current = state.stagedSetlist.userPalettes[paletteName] || [];
    const newPalettes = { ...state.stagedSetlist.userPalettes, [paletteName]: current.filter(id => id !== tokenId) };
    return { stagedSetlist: { ...state.stagedSetlist, userPalettes: newPalettes }, hasPendingChanges: true };
  }),
  addCollectionToLibrary: (collection) => set((state) => {
    const currentLib = state.stagedSetlist.personalCollectionLibrary || [];
    if (currentLib.some(c => c.address.toLowerCase() === collection.address.toLowerCase())) return {};
    return { stagedSetlist: { ...state.stagedSetlist, personalCollectionLibrary: [...currentLib, collection] }, hasPendingChanges: true };
  }),
  removeCollectionFromLibrary: (address) => set((state) => {
    const currentLib = state.stagedSetlist.personalCollectionLibrary || [];
    return { stagedSetlist: { ...state.stagedSetlist, personalCollectionLibrary: currentLib.filter(c => c.address.toLowerCase() !== address.toLowerCase()) }, hasPendingChanges: true };
  }),
  createNewWorkspace: async (name) => {
    const state = get();
    if (state.stagedSetlist.workspaces[name]) throw new Error("Workspace name exists");
    set({ isLoading: true, loadingMessage: "Creating Workspace...", error: null });
    
    const newWorkspaceData = JSON.parse(JSON.stringify(fallbackConfig));
    // Initialize modulation structure for new workspaces
    newWorkspaceData.modulation = { baseValues: {}, patches: [] };
    
    const imageUrls = new Set();
    Object.values(newWorkspaceData.presets?.Default?.tokenAssignments || {}).forEach(t => {
       const src = resolveImageUrl(t);
       if(src) imageUrls.add(src);
    });
    if (imageUrls.size > 0) await preloadImages(Array.from(imageUrls));

    try {
        const cid = await uploadJsonToPinata(newWorkspaceData, `RADAR_Workspace_${name}`);
        const newSetlist = JSON.parse(JSON.stringify(state.stagedSetlist));
        newSetlist.workspaces[name] = { cid, lastModified: Date.now() };
        state.workspaceCache.set(name, newWorkspaceData);
        set({ stagedSetlist: newSetlist, hasPendingChanges: true, isLoading: false });
        await get().loadWorkspace(name);
    } catch (err) {
        set({ isLoading: false, error: err.message });
    }
  },
  deleteWorkspaceFromSet: (name) => set((state) => {
    const newSetlist = JSON.parse(JSON.stringify(state.stagedSetlist));
    delete newSetlist.workspaces[name];
    if (newSetlist.defaultWorkspaceName === name) newSetlist.defaultWorkspaceName = null;
    return { stagedSetlist: newSetlist, hasPendingChanges: true };
  }),
  renameWorkspaceInSet: (oldName, newName) => set((state) => {
    const newSetlist = JSON.parse(JSON.stringify(state.stagedSetlist));
    newSetlist.workspaces[newName] = newSetlist.workspaces[oldName];
    delete newSetlist.workspaces[oldName];
    if (newSetlist.defaultWorkspaceName === oldName) newSetlist.defaultWorkspaceName = newName;
    const activeName = state.activeWorkspaceName === oldName ? newName : state.activeWorkspaceName;
    if (state.workspaceCache.has(oldName)) {
      const data = state.workspaceCache.get(oldName);
      state.workspaceCache.set(newName, data);
      state.workspaceCache.delete(oldName);
    }
    return { stagedSetlist: newSetlist, activeWorkspaceName: activeName, hasPendingChanges: true };
  }),
  setDefaultWorkspaceInSet: (name) => set((state) => ({ stagedSetlist: { ...state.stagedSetlist, defaultWorkspaceName: name }, hasPendingChanges: true })),
  
  duplicateActiveWorkspace: async (newName) => {
    const state = get();
    if (state.stagedSetlist.workspaces[newName]) { alert("A workspace with this name already exists."); return { success: false }; }
    set({ activeWorkspaceName: newName, hasPendingChanges: true });
    const newSetlist = JSON.parse(JSON.stringify(state.stagedSetlist));
    newSetlist.workspaces[newName] = { cid: null, lastModified: Date.now() }; 
    if (state.workspaceCache.has(state.activeWorkspaceName)) {
        const data = JSON.parse(JSON.stringify(state.workspaceCache.get(state.activeWorkspaceName)));
        state.workspaceCache.set(newName, data);
    } else {
        state.workspaceCache.set(newName, JSON.parse(JSON.stringify(state.stagedWorkspace)));
    }
    set({ activeWorkspaceName: newName, stagedSetlist: newSetlist, hasPendingChanges: true });
    return { success: true };
  },

  // 6. SAVE CHANGES
  saveChanges: async (targetProfileAddress) => {
    const state = get();
    if (!state.configService) return { success: false, error: "Service not ready" };
    if (!targetProfileAddress) return { success: false, error: "Target address missing" }; 

    set({ isSaving: true, saveError: null });

    try {
      const workspaceToUpload = JSON.parse(JSON.stringify(state.stagedWorkspace));
      
      // --- CAPTURE CURRENT ENGINE STATE ---
      // Merge live matrix data into the workspace snapshot
      const engineState = useEngineStore.getState();
      workspaceToUpload.modulation = {
          baseValues: engineState.baseValues,
          patches: engineState.patches
      };
      
      const wsName = state.activeWorkspaceName || `Workspace_${Date.now()}`;
      const wsCid = await uploadJsonToPinata(workspaceToUpload, `RADAR_WS_${wsName}`);

      const newSetlist = JSON.parse(JSON.stringify(state.stagedSetlist));
      if (!newSetlist.workspaces[wsName]) newSetlist.workspaces[wsName] = {};
      newSetlist.workspaces[wsName].cid = wsCid;
      newSetlist.workspaces[wsName].lastModified = Date.now();

      await state.configService.saveSetlist(targetProfileAddress, newSetlist);

      set({ 
        setlist: newSetlist,
        stagedSetlist: newSetlist,
        stagedWorkspace: workspaceToUpload,
        hasPendingChanges: false,
        isSaving: false,
        saveError: null 
      });
      
      return { success: true };

    } catch (error) {
      console.error("Save Failed:", error);
      set({ isSaving: false, saveError: error.message });
      return { success: false, error: error.message };
    }
  },

  preloadWorkspace: async (workspaceName) => {
    const { stagedSetlist, configService, workspaceCache } = get();
    if (workspaceCache.has(workspaceName)) return;
    const cid = stagedSetlist?.workspaces?.[workspaceName]?.cid;
    if (cid) {
      try {
        const data = await configService._loadWorkspaceFromCID(cid);
        const imageUrls = new Set();
        Object.values(data.presets || {}).forEach(p => {
            Object.values(p.tokenAssignments || {}).forEach(t => {
                const src = resolveImageUrl(t);
                if(src) imageUrls.add(src);
            });
        });
        if(imageUrls.size > 0) preloadImages(Array.from(imageUrls)); 
        workspaceCache.set(workspaceName, data);
      } catch (e) {
        console.warn("Preload failed", e);
      }
    }
  }

})));