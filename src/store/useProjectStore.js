// src/store/useProjectStore.js
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import ConfigurationService from '../services/ConfigurationService';
import { uploadJsonToPinata } from '../services/PinataService';
import { resolveImageUrl, preloadImages } from '../utils/imageDecoder';
import fallbackConfig from '../config/fallback-config';

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
  defaultPresetName: null
};

export const useProjectStore = create(devtools((set, get) => ({
  // =========================================
  // 1. STATE
  // =========================================
  
  // Infrastructure
  configService: null, // Instance of ConfigurationService
  isConfigReady: false,
  
  // Loading / Status
  isLoading: false,
  loadingMessage: "Initializing...",
  
  // Saving Status
  isSaving: false,
  hasPendingChanges: false,
  
  // Errors
  error: null,      // Critical Application Errors (stops rendering)
  saveError: null,  // Save/Transaction Errors (shows toast, keeps rendering)
  
  // Data: Setlist (The Container / Index)
  setlist: EMPTY_SETLIST, // Committed state
  stagedSetlist: EMPTY_SETLIST, // Editable state
  
  // Data: Active Workspace (The Content)
  activeWorkspaceName: null,
  stagedWorkspace: EMPTY_WORKSPACE, // Replaces 'stagedActiveWorkspace'
  
  // Data: Active Scene
  activeSceneName: null, // The currently selected scene ID
  
  // Cache for preloaded workspaces to avoid re-fetching IPFS
  workspaceCache: new Map(),

  // =========================================
  // 2. INITIALIZATION ACTIONS
  // =========================================

  initService: (provider, walletClient, publicClient) => {
    const service = new ConfigurationService(provider, walletClient, publicClient);
    const isReady = service.checkReadyForRead();
    set({ configService: service, isConfigReady: isReady });
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
      saveError: null
    });
  },

  // =========================================
  // 3. ASYNC LOADING ACTIONS
  // =========================================

  loadSetlist: async (profileAddress, visitorContext = null) => {
    const { configService } = get();
    if (!configService) return;

    set({ isLoading: true, loadingMessage: "Fetching Setlist...", error: null });

    try {
      let loadedSetlist = await configService.loadWorkspace(profileAddress);

      // Handle Visitor Logic (Merge visitor MIDI/Events with Host Setlist)
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
        stagedSetlist: JSON.parse(JSON.stringify(loadedSetlist)), // Deep copy for editing
        isLoading: false,
        loadingMessage: ""
      });

      // Auto-load default workspace
      const defaultName = loadedSetlist.defaultWorkspaceName || Object.keys(loadedSetlist.workspaces)[0];
      if (defaultName) {
        await get().loadWorkspace(defaultName);
      } else {
        // Fallback if no workspaces exist
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

      // 1. Check Cache
      if (workspaceCache.has(workspaceName)) {
        workspaceData = workspaceCache.get(workspaceName);
      } else {
        // 2. Fetch from IPFS
        const cid = stagedSetlist.workspaces[workspaceName].cid;
        if (cid) {
          workspaceData = await configService._loadWorkspaceFromCID(cid);
          workspaceCache.set(workspaceName, workspaceData); // Cache it
        } else {
          // New/Empty workspace
          workspaceData = JSON.parse(JSON.stringify(fallbackConfig)); 
        }
      }

      if (!workspaceData) throw new Error("Failed to resolve workspace data.");

      // 3. Preload Assets
      set({ loadingMessage: "Decoding Assets..." });
      const imageUrls = new Set();
      Object.values(workspaceData.presets || {}).forEach(preset => {
        Object.values(preset.tokenAssignments || {}).forEach(assignment => {
          const src = resolveImageUrl(assignment);
          if (src) imageUrls.add(src);
        });
      });
      if (imageUrls.size > 0) await preloadImages(Array.from(imageUrls));

      // 4. Update State
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

  // =========================================
  // 4. SCENE MANAGEMENT ACTIONS
  // =========================================

  setActiveSceneName: (name) => set({ activeSceneName: name }),

  addScene: (sceneName, sceneData) => set((state) => {
    const newWorkspace = JSON.parse(JSON.stringify(state.stagedWorkspace));
    if (!newWorkspace.presets) newWorkspace.presets = {};
    newWorkspace.presets[sceneName] = sceneData;
    
    return { 
      stagedWorkspace: newWorkspace,
      hasPendingChanges: true,
      activeSceneName: sceneName 
    };
  }),

  deleteScene: (sceneName) => set((state) => {
    const newWorkspace = JSON.parse(JSON.stringify(state.stagedWorkspace));
    delete newWorkspace.presets[sceneName];
    
    // Reset default if we deleted it
    if (newWorkspace.defaultPresetName === sceneName) {
      newWorkspace.defaultPresetName = null;
    }

    return { 
      stagedWorkspace: newWorkspace,
      hasPendingChanges: true 
    };
  }),

  setDefaultScene: (sceneName) => set((state) => {
    const newWorkspace = { ...state.stagedWorkspace, defaultPresetName: sceneName };
    return { stagedWorkspace: newWorkspace, hasPendingChanges: true };
  }),

  // =========================================
  // 5. GLOBAL METADATA ACTIONS
  // =========================================

  updateGlobalMidiMap: (newMap) => set((state) => ({
    stagedSetlist: { ...state.stagedSetlist, globalUserMidiMap: newMap },
    hasPendingChanges: true
  })),

  updateGlobalEventReactions: (eventType, reactionData) => set((state) => {
    const newReactions = { ...state.stagedSetlist.globalEventReactions, [eventType]: reactionData };
    return {
      stagedSetlist: { ...state.stagedSetlist, globalEventReactions: newReactions },
      hasPendingChanges: true
    };
  }),

  deleteGlobalEventReaction: (eventType) => set((state) => {
    const newReactions = { ...state.stagedSetlist.globalEventReactions };
    delete newReactions[eventType];
    return {
      stagedSetlist: { ...state.stagedSetlist, globalEventReactions: newReactions },
      hasPendingChanges: true
    };
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
    const newPalettes = { 
      ...state.stagedSetlist.userPalettes, 
      [paletteName]: [...current, tokenId] 
    };
    return { stagedSetlist: { ...state.stagedSetlist, userPalettes: newPalettes }, hasPendingChanges: true };
  }),

  removeTokenFromPalette: (paletteName, tokenId) => set((state) => {
    const current = state.stagedSetlist.userPalettes[paletteName] || [];
    const newPalettes = {
      ...state.stagedSetlist.userPalettes,
      [paletteName]: current.filter(id => id !== tokenId)
    };
    return { stagedSetlist: { ...state.stagedSetlist, userPalettes: newPalettes }, hasPendingChanges: true };
  }),

  addCollectionToLibrary: (collection) => set((state) => {
    const currentLib = state.stagedSetlist.personalCollectionLibrary || [];
    if (currentLib.some(c => c.address.toLowerCase() === collection.address.toLowerCase())) return {};
    return {
      stagedSetlist: { ...state.stagedSetlist, personalCollectionLibrary: [...currentLib, collection] },
      hasPendingChanges: true
    };
  }),

  removeCollectionFromLibrary: (address) => set((state) => {
    const currentLib = state.stagedSetlist.personalCollectionLibrary || [];
    return {
      stagedSetlist: { ...state.stagedSetlist, personalCollectionLibrary: currentLib.filter(c => c.address.toLowerCase() !== address.toLowerCase()) },
      hasPendingChanges: true
    };
  }),

  // =========================================
  // 6. WORKSPACE CRUD & SAVING
  // =========================================

  createNewWorkspace: async (name) => {
    const state = get();
    if (state.stagedSetlist.workspaces[name]) throw new Error("Workspace name exists");

    set({ isLoading: true, loadingMessage: "Creating Workspace...", error: null });

    const newWorkspaceData = JSON.parse(JSON.stringify(fallbackConfig));
    // Default fallback config usually has some assets, preload them
    const imageUrls = new Set();
    Object.values(newWorkspaceData.presets?.Default?.tokenAssignments || {}).forEach(t => {
       const src = resolveImageUrl(t);
       if(src) imageUrls.add(src);
    });
    if (imageUrls.size > 0) await preloadImages(Array.from(imageUrls));

    try {
        // Upload immediately to get a CID (Concept: Workspaces are IPFS objects)
        const cid = await uploadJsonToPinata(newWorkspaceData, `RADAR_Workspace_${name}`);

        // Update Setlist
        const newSetlist = JSON.parse(JSON.stringify(state.stagedSetlist));
        newSetlist.workspaces[name] = { cid, lastModified: Date.now() };

        // Update Cache
        state.workspaceCache.set(name, newWorkspaceData);

        set({ 
          stagedSetlist: newSetlist,
          hasPendingChanges: true,
          isLoading: false 
        });

        // Switch to it
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
    
    // Migrate Cache key
    if (state.workspaceCache.has(oldName)) {
      const data = state.workspaceCache.get(oldName);
      state.workspaceCache.set(newName, data);
      state.workspaceCache.delete(oldName);
    }

    return { stagedSetlist: newSetlist, activeWorkspaceName: activeName, hasPendingChanges: true };
  }),

  setDefaultWorkspaceInSet: (name) => set((state) => ({
    stagedSetlist: { ...state.stagedSetlist, defaultWorkspaceName: name },
    hasPendingChanges: true
  })),

  // THE BIG SAVE
  saveChanges: async (targetProfileAddress) => {
    const state = get();
    if (!state.configService) return { success: false, error: "Service not ready" };
    
    // Explicitly clear any previous save errors so the UI doesn't show old toasts
    set({ isSaving: true, saveError: null });

    try {
      // 1. Upload Current Workspace to IPFS
      const workspaceToUpload = JSON.parse(JSON.stringify(state.stagedWorkspace));
      
      const wsName = state.activeWorkspaceName || `Workspace_${Date.now()}`;
      const wsCid = await uploadJsonToPinata(workspaceToUpload, `RADAR_WS_${wsName}`);

      // 2. Update Setlist with new Workspace CID
      const newSetlist = JSON.parse(JSON.stringify(state.stagedSetlist));
      if (!newSetlist.workspaces[wsName]) newSetlist.workspaces[wsName] = {};
      newSetlist.workspaces[wsName].cid = wsCid;
      newSetlist.workspaces[wsName].lastModified = Date.now();

      // 3. Save Setlist On-Chain (via ConfigService)
      await state.configService.saveSetlist(targetProfileAddress, newSetlist);

      set({ 
        setlist: newSetlist,
        stagedSetlist: newSetlist,
        hasPendingChanges: false,
        isSaving: false,
        saveError: null // Ensure error is null on success
      });
      
      return { success: true };

    } catch (error) {
      console.error("Save Failed:", error);
      
      // FIX: Use specific saveError state instead of general 'error'
      set({ 
        isSaving: false, 
        saveError: error.message 
      });
      
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
        // Preload images silently
        const imageUrls = new Set();
        Object.values(data.presets || {}).forEach(p => {
            Object.values(p.tokenAssignments || {}).forEach(t => {
                const src = resolveImageUrl(t);
                if(src) imageUrls.add(src);
            });
        });
        if(imageUrls.size > 0) preloadImages(Array.from(imageUrls)); // Async, don't await
        
        workspaceCache.set(workspaceName, data);
      } catch (e) {
        console.warn("Preload failed", e);
      }
    }
  }

})));