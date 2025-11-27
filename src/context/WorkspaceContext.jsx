// src/context/WorkspaceContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useUserSession } from './UserSessionContext';
import { useToast } from './ToastContext';
import { useUpProvider } from './UpProvider';
import { useSceneContext } from './SceneContext';
import ConfigurationService from '../services/ConfigurationService';
import { uploadJsonToPinata } from '../services/PinataService.js';
import { preloadImages, resolveImageUrl } from '../utils/imageDecoder.js';
import fallbackConfig from '../config/fallback-config.js';
import { useAsyncErrorHandler } from '../hooks/useAsyncErrorHandler';

const WorkspaceContext = createContext();

export const WorkspaceProvider = ({ children }) => {
    // --- Context Consumption ---
    const { 
        setStagedActiveWorkspace, 
        setActiveSceneName, 
        activeSceneName,
        stagedActiveWorkspace, 
        setHasPendingChanges,
        hasPendingChanges,
        fullSceneList,
        addNewSceneToStagedWorkspace,
        deleteSceneFromStagedWorkspace,
        setDefaultSceneInStagedWorkspace
    } = useSceneContext();

    const { hostProfileAddress, isHostProfileOwner, loggedInUserUPAddress } = useUserSession();
    const { provider, walletClient, publicClient } = useUpProvider();
    const { addToast } = useToast();
    const { handleAsyncError } = useAsyncErrorHandler();

    // --- State: Infrastructure & Loading ---
    const [shouldStartLoading, setShouldStartLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Initializing...");
    const [isFullyLoaded, setIsFullyLoaded] = useState(false);
    const [isInitiallyResolved, setIsInitiallyResolved] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // --- State: Setlist (The Container of Workspaces) ---
    const [setlist, setSetlist] = useState(null);
    const [stagedSetlist, setStagedSetlist] = useState(null);
    const [activeWorkspaceName, setActiveWorkspaceName] = useState(null);
    
    // --- Refs ---
    const configServiceRef = useRef(null);
    const [configServiceInstanceReady, setConfigServiceInstanceReady] = useState(false);
    const [isWorkspaceTransitioning, setIsWorkspaceTransitioning] = useState(false);
    const workspaceToLoadRef = useRef(null);
    const [newlyCreatedWorkspace, setNewlyCreatedWorkspace] = useState(null);
    const preloadedWorkspacesRef = useRef(new Map());
    const preloadingInProgressRef = useRef(new Set());
    const prevProfileAddressRef = useRef(null);

    const startLoadingProcess = useCallback(() => {
        if(import.meta.env.DEV) console.log('%c[WorkspaceContext] Loading initiated.', 'color: #1abc9c;');
        setShouldStartLoading(true);
    }, []);

    useEffect(() => {
        if (provider) {
            configServiceRef.current = new ConfigurationService(provider, walletClient, publicClient);
            configServiceRef.current.publicClient = publicClient;
            configServiceRef.current.walletClient = walletClient;
            setConfigServiceInstanceReady(configServiceRef.current.checkReadyForRead());
        }
    }, [provider, publicClient, walletClient]);

    const _loadWorkspaceFromCid = useCallback(async (cid) => {
        const service = configServiceRef.current;
        if (!service || !cid) return null;
        return await service._loadWorkspaceFromCID(cid);
    }, []);

    // --- Main Load Logic ---
    useEffect(() => {
        if (!shouldStartLoading) return;
    
        const currentAddress = hostProfileAddress;
        const service = configServiceRef.current;
        const profileChanged = currentAddress !== prevProfileAddressRef.current;
        
        const emptySetlist = { 
            defaultWorkspaceName: null, workspaces: {}, globalUserMidiMap: {}, 
            personalCollectionLibrary: [], userPalettes: {}, globalEventReactions: {} 
        };
        const emptyWorkspace = { presets: {}, defaultPresetName: null };
    
        if (profileChanged) {
          prevProfileAddressRef.current = currentAddress;
          setIsLoading(true); setLoadingMessage("Initializing...");
          setIsFullyLoaded(false); setIsInitiallyResolved(false); setLoadError(null); setHasPendingChanges(false);
          setSetlist(null); setStagedSetlist(null); 
          setStagedActiveWorkspace(null); // Clear SceneContext
          setActiveWorkspaceName(null); setActiveSceneName(null);
        }
    
        const loadInitialData = async (address) => {
          setIsLoading(true);
          try {
            setLoadingMessage("Fetching Setlist...");
            let loadedSetlist = await service.loadWorkspace(address);

            // Visitor Merge Logic
            if (!isHostProfileOwner && loggedInUserUPAddress) {
                const visitorSetlist = await service.loadWorkspace(loggedInUserUPAddress);
                if (visitorSetlist) {
                    const mergedSetlist = { ...loadedSetlist };
                    if (visitorSetlist.globalUserMidiMap) mergedSetlist.globalUserMidiMap = visitorSetlist.globalUserMidiMap;
                    if (visitorSetlist.globalEventReactions) mergedSetlist.globalEventReactions = visitorSetlist.globalEventReactions;
                    loadedSetlist = mergedSetlist;
                }
            }

            if (prevProfileAddressRef.current !== address) return;
    
            setSetlist(loadedSetlist);
            setStagedSetlist(loadedSetlist);
            setIsInitiallyResolved(true);
    
            const defaultWorkspaceName = loadedSetlist.defaultWorkspaceName || Object.keys(loadedSetlist.workspaces)[0];
            const workspaceInfo = defaultWorkspaceName ? loadedSetlist.workspaces[defaultWorkspaceName] : null;
            let loadedWorkspace;
    
            if (workspaceInfo && workspaceInfo.cid) {
                setLoadingMessage(`Loading Workspace: ${defaultWorkspaceName}...`);
                const result = await handleAsyncError(_loadWorkspaceFromCid(workspaceInfo.cid));
                loadedWorkspace = result.success ? result.data : null;
            }
            
            if (!loadedWorkspace) {
                loadedWorkspace = emptyWorkspace;
                if (defaultWorkspaceName) addToast(`Default workspace "${defaultWorkspaceName}" could not be loaded.`, 'warning');
            }
            
            if (prevProfileAddressRef.current !== address) return;
    
            setLoadingMessage("Decoding Assets...");
            const imageUrlsToPreload = new Set();
            Object.values(loadedWorkspace.presets || {}).forEach(preset => {
                Object.values(preset.tokenAssignments || {}).forEach(assignment => {
                    const src = resolveImageUrl(assignment);
                    if (src) imageUrlsToPreload.add(src);
                });
            });
    
            if (imageUrlsToPreload.size > 0) await preloadImages(Array.from(imageUrlsToPreload));
    
            if (prevProfileAddressRef.current !== address) return;
    
            // --- Handover to SceneContext ---
            setStagedActiveWorkspace(loadedWorkspace);
            setActiveWorkspaceName(defaultWorkspaceName);
            const initialSceneName = loadedWorkspace.defaultPresetName || Object.keys(loadedWorkspace.presets || {})[0] || null;
            setActiveSceneName(initialSceneName);
            
            setLoadError(null);
            setHasPendingChanges(false);
    
          } catch (error) {
            if (prevProfileAddressRef.current === address) {
              setLoadError(error.message || "Failed to load setlist.");
              addToast("Could not load your setlist.", "error");
              setSetlist(emptySetlist); setStagedSetlist(emptySetlist);
              setStagedActiveWorkspace(emptyWorkspace);
            }
          } finally {
            if (prevProfileAddressRef.current === address) {
              setIsLoading(false); setLoadingMessage("");
              setIsFullyLoaded(true);
            }
          }
        };
        
        if (configServiceInstanceReady && !isInitiallyResolved) {
          if (currentAddress) loadInitialData(currentAddress);
          else {
            setSetlist(emptySetlist); setStagedSetlist(emptySetlist);
            setStagedActiveWorkspace(emptyWorkspace);
            setIsLoading(false); setIsInitiallyResolved(true);
          }
        }
    }, [shouldStartLoading, hostProfileAddress, configServiceInstanceReady, isInitiallyResolved, addToast, _loadWorkspaceFromCid, handleAsyncError, isHostProfileOwner, loggedInUserUPAddress, setStagedActiveWorkspace, setActiveSceneName, setHasPendingChanges]);

    const _executeLoadAfterFade = useCallback(async () => {
        const workspaceName = workspaceToLoadRef.current;
        if (!workspaceName || !stagedSetlist || !stagedSetlist.workspaces[workspaceName]) {
          setIsLoading(false); setLoadingMessage(""); setIsWorkspaceTransitioning(false);
          return;
        }
    
        try {
          let newWorkspace;
          if (preloadedWorkspacesRef.current.has(workspaceName)) {
            newWorkspace = preloadedWorkspacesRef.current.get(workspaceName);
          } else {
            const workspaceInfo = stagedSetlist.workspaces[workspaceName];
            const result = await handleAsyncError(_loadWorkspaceFromCid(workspaceInfo.cid));
            newWorkspace = result.success ? result.data : null;
          }
    
          if (newWorkspace) {
            setLoadingMessage("Decoding assets...");
            const imageUrlsToPreload = new Set();
            Object.values(newWorkspace.presets || {}).forEach(preset => {
              Object.values(preset.tokenAssignments || {}).forEach(assignment => {
                const src = resolveImageUrl(assignment);
                if (src) imageUrlsToPreload.add(src);
              });
            });

            if (imageUrlsToPreload.size > 0) await preloadImages(Array.from(imageUrlsToPreload));

            preloadedWorkspacesRef.current.set(workspaceName, newWorkspace);
            
            setStagedActiveWorkspace(newWorkspace);
            setActiveWorkspaceName(workspaceName);
            
            addToast(`Workspace "${workspaceName}" loaded.`, 'success');
          }
        } catch (error) {
          addToast(error.message, 'error');
        } finally {
          setIsLoading(false); setLoadingMessage(""); setIsWorkspaceTransitioning(false);
          workspaceToLoadRef.current = null; setIsFullyLoaded(true);
        }
    }, [stagedSetlist, addToast, _loadWorkspaceFromCid, handleAsyncError, setStagedActiveWorkspace, setActiveWorkspaceName]);

    const loadWorkspace = useCallback(async (workspaceName) => {
        if (isWorkspaceTransitioning) return;
        if (!stagedSetlist || !stagedSetlist.workspaces[workspaceName]) {
            addToast(`Workspace '${workspaceName}' not found.`, 'error');
            return { success: false };
        }
        setIsFullyLoaded(false); 
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

    const saveChanges = useCallback(async (workspaceNameToSave = activeWorkspaceName) => {
        const service = configServiceRef.current;
        const addressToSave = hostProfileAddress;
        if (!service || !addressToSave || !service.checkReadyForWrite()) {
            addToast("Save service not ready.", "error");
            return { success: false };
        }
        setIsSaving(true); setSaveError(null); setSaveSuccess(false);
        try {
            const workspaceToUpload = JSON.parse(JSON.stringify(stagedActiveWorkspace));
            
            delete workspaceToUpload.globalMidiMap;
            delete workspaceToUpload.globalEventReactions;
            
            addToast("Uploading workspace...", "info", 2000);
            const newWorkspaceCid = await uploadJsonToPinata(workspaceToUpload, `RADAR_Workspace_${workspaceNameToSave}`);
            if (!newWorkspaceCid) throw new Error("Failed to upload workspace.");
    
            const newSetlist = JSON.parse(JSON.stringify(stagedSetlist));
            if (!newSetlist.workspaces[workspaceNameToSave]) {
              newSetlist.workspaces[workspaceNameToSave] = {};
            }
            newSetlist.workspaces[workspaceNameToSave].cid = newWorkspaceCid;
            newSetlist.workspaces[workspaceNameToSave].lastModified = Date.now();
    
            addToast("Saving setlist...", "info", 2000);
            await service.saveSetlist(addressToSave, newSetlist);
    
            setSetlist(newSetlist);
            setStagedSetlist(newSetlist);
            
            setHasPendingChanges(false);
            setSaveSuccess(true);
            addToast("Saved successfully!", "success");
            return { success: true, newSetlist };
        } catch (error) {
            const errorMsg = error.message || "Unknown save error.";
            addToast(`Error saving: ${errorMsg}`, 'error');
            setSaveError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setIsSaving(false);
        }
    }, [stagedSetlist, activeWorkspaceName, stagedActiveWorkspace, hostProfileAddress, addToast, setHasPendingChanges]);

    const createNewWorkspace = useCallback(async (newName) => {
        if (isLoading) return;
        if (stagedSetlist?.workspaces[newName]) { addToast("Name exists.", "error"); return; }
      
        setIsLoading(true); setLoadingMessage(`Creating "${newName}"...`);
        try {
            const newWorkspace = {
                presets: { "Default": { name: "Default", ts: Date.now(), layers: fallbackConfig.layers, tokenAssignments: fallbackConfig.tokenAssignments } },
                defaultPresetName: "Default",
            };
      
            const imageUrlsToPreload = new Set();
            Object.values(newWorkspace.presets.Default.tokenAssignments).forEach(assignment => {
                const src = resolveImageUrl(assignment);
                if (src) imageUrlsToPreload.add(src);
            });
            if (imageUrlsToPreload.size > 0) await preloadImages(Array.from(imageUrlsToPreload));
      
            const newWorkspaceCID = await uploadJsonToPinata(newWorkspace, `RADAR_Workspace_${newName}`);
            if (!newWorkspaceCID) throw new Error("Upload failed.");
      
            preloadedWorkspacesRef.current.set(newName, newWorkspace);
      
            setStagedSetlist(prev => {
                const newSetlist = prev ? JSON.parse(JSON.stringify(prev)) : { workspaces: {}, defaultWorkspaceName: null };
                newSetlist.workspaces[newName] = { cid: newWorkspaceCID, lastModified: Date.now() };
                return newSetlist;
            });
      
            setHasPendingChanges(true);
            addToast(`Workspace "${newName}" created.`, "success");
            setNewlyCreatedWorkspace(newName);
        } catch (error) {
            addToast(`Error: ${error.message}`, "error");
        } finally {
            setIsLoading(false); setLoadingMessage("");
        }
    }, [stagedSetlist, addToast, isLoading, setHasPendingChanges]);

    const duplicateActiveWorkspace = useCallback(async (newName) => {
        if (stagedSetlist?.workspaces[newName]) { addToast("Name exists.", "error"); return { success: false }; }
        const newSetlist = JSON.parse(JSON.stringify(stagedSetlist));
        newSetlist.workspaces[newName] = { cid: '' }; 
        
        const result = await saveChanges(newName);
        if (result.success) {
            setActiveWorkspaceName(newName);
            addToast(`Duplicated to "${newName}".`, 'success');
        }
        return result;
    }, [stagedSetlist, saveChanges, addToast, setActiveWorkspaceName]);

    const deleteWorkspaceFromSet = useCallback((workspaceName) => {
        setStagedSetlist(prev => {
          if (!prev || !prev.workspaces[workspaceName]) return prev;
          const newSetlist = JSON.parse(JSON.stringify(prev));
          delete newSetlist.workspaces[workspaceName];
          if (newSetlist.defaultWorkspaceName === workspaceName) {
            newSetlist.defaultWorkspaceName = Object.keys(newSetlist.workspaces)[0] || null;
          }
          setHasPendingChanges(true);
          addToast(`Deleted "${workspaceName}".`, 'info');
          return newSetlist;
        });
    }, [addToast, setHasPendingChanges]);
    
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
    }, [addToast, activeWorkspaceName, setHasPendingChanges]);
    
    const setDefaultWorkspaceInSet = useCallback((workspaceName) => {
        setStagedSetlist(prev => {
          if (!prev || !prev.workspaces[workspaceName]) return prev;
          setHasPendingChanges(true);
          addToast(`Default: "${workspaceName}"`, 'success');
          return { ...prev, defaultWorkspaceName: workspaceName };
        });
    }, [addToast, setHasPendingChanges]);

    const updateGlobalMidiMap = useCallback((newMap) => {
        if (isHostProfileOwner) {
            setStagedSetlist(prev => ({ ...prev, globalUserMidiMap: newMap || {} }));
            setHasPendingChanges(true);
        }
    }, [isHostProfileOwner, setHasPendingChanges]);
    
    const updateLayerMidiMappings = useCallback((layerId, mappingData) => {
        if (isHostProfileOwner) {
          setStagedSetlist(prev => {
            const newGlobalMidiMap = { ...(prev?.globalUserMidiMap || {}) };
            newGlobalMidiMap.layerSelects = { ...(newGlobalMidiMap.layerSelects || {}), [layerId]: mappingData };
            return { ...prev, globalUserMidiMap: newGlobalMidiMap };
          });
          setHasPendingChanges(true);
        }
    }, [isHostProfileOwner, setHasPendingChanges]);

    const updateGlobalEventReactions = useCallback((eventType, reactionData) => {
        if (!isHostProfileOwner) return;
        setStagedSetlist(prev => ({
          ...prev, 
          globalEventReactions: { ...(prev?.globalEventReactions || {}), [eventType]: reactionData }
        }));
        setHasPendingChanges(true);
    }, [isHostProfileOwner, setHasPendingChanges]);
    
    const deleteGlobalEventReaction = useCallback((eventType) => {
        if (!isHostProfileOwner) return;
        setStagedSetlist(prev => {
          const newReactions = { ...(prev?.globalEventReactions || {}) };
          if (newReactions[eventType]) {
            delete newReactions[eventType];
            setHasPendingChanges(true);
            return { ...prev, globalEventReactions: newReactions };
          }
          return prev;
        });
    }, [isHostProfileOwner, setHasPendingChanges]);

    const addPalette = useCallback((paletteName) => {
        setStagedSetlist(prev => {
            const newSetlist = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
            if (newSetlist.userPalettes[paletteName]) {
                addToast(`Palette "${paletteName}" already exists.`, "warning");
                return prev;
            }
            newSetlist.userPalettes[paletteName] = [];
            addToast(`Palette "${paletteName}" created.`, "success");
            setHasPendingChanges(true);
            return newSetlist;
        });
    }, [setHasPendingChanges, addToast]);
    
    const removePalette = useCallback((paletteName) => {
        setStagedSetlist(prev => {
            const newSetlist = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
            delete newSetlist.userPalettes[paletteName];
            addToast(`Palette "${paletteName}" removed.`, "info");
            setHasPendingChanges(true);
            return newSetlist;
        });
    }, [setHasPendingChanges, addToast]);
    
    const addTokenToPalette = useCallback((paletteName, tokenId) => {
        setStagedSetlist(prev => {
            const newSetlist = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
            const palette = newSetlist.userPalettes[paletteName];
            if (!palette || palette.includes(tokenId)) return prev;
            newSetlist.userPalettes[paletteName] = [...palette, tokenId];
            addToast("Added to palette.", "success");
            setHasPendingChanges(true);
            return newSetlist;
        });
    }, [setHasPendingChanges, addToast]);
    
    const removeTokenFromPalette = useCallback((paletteName, tokenId) => {
        setStagedSetlist(prev => {
            const newSetlist = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
            const palette = newSetlist.userPalettes[paletteName];
            if (!palette) return prev;
            newSetlist.userPalettes[paletteName] = palette.filter(id => id !== tokenId);
            setHasPendingChanges(true);
            return newSetlist;
        });
    }, [setHasPendingChanges]);

    const addCollectionToPersonalLibrary = useCallback((collection) => {
        if (!isHostProfileOwner) return;
        setStagedSetlist(prev => {
            const currentLibrary = prev?.personalCollectionLibrary || [];
            if (currentLibrary.some(c => c.address.toLowerCase() === collection.address.toLowerCase())) {
                addToast("This collection is already in your library.", "warning");
                return prev;
            }
            setHasPendingChanges(true);
            addToast(`Collection "${collection.name}" added to your library.`, "success");
            return { ...prev, personalCollectionLibrary: [...currentLibrary, collection] };
        });
    }, [isHostProfileOwner, setHasPendingChanges, addToast]);
    
    const removeCollectionFromPersonalLibrary = useCallback((addressToRemove) => {
        if (!isHostProfileOwner) return;
        setStagedSetlist(prev => {
            const currentLibrary = prev?.personalCollectionLibrary || [];
            const newLibrary = currentLibrary.filter(c => c.address.toLowerCase() !== addressToRemove.toLowerCase());
            if (newLibrary.length === currentLibrary.length) return prev;
            setHasPendingChanges(true);
            addToast(`Collection removed from your library.`, "info");
            return { ...prev, personalCollectionLibrary: newLibrary };
        });
    }, [isHostProfileOwner, setHasPendingChanges, addToast]);

    const preloadWorkspace = useCallback(async (workspaceName) => {
        const service = configServiceRef.current;
        if (!service || !stagedSetlist?.workspaces[workspaceName]) return;
        if (preloadedWorkspacesRef.current.has(workspaceName) || preloadingInProgressRef.current.has(workspaceName)) return;
        
        try {
          preloadingInProgressRef.current.add(workspaceName);
          const workspaceInfo = stagedSetlist.workspaces[workspaceName];
          const workspaceData = await _loadWorkspaceFromCid(workspaceInfo.cid);
          if (workspaceData) {
            preloadedWorkspacesRef.current.set(workspaceName, workspaceData);
            const imageUrlsToPreload = new Set();
            Object.values(workspaceData.presets || {}).forEach(preset => {
              Object.values(preset.tokenAssignments || {}).forEach(assignment => {
                const src = resolveImageUrl(assignment);
                if (src) imageUrlsToPreload.add(src);
              });
            });
            if (imageUrlsToPreload.size > 0) preloadImages(Array.from(imageUrlsToPreload));
          }
        } catch (error) {
          // Silent catch for preload
        } finally {
          preloadingInProgressRef.current.delete(workspaceName);
        }
    }, [stagedSetlist, _loadWorkspaceFromCid]);

    const contextValue = useMemo(() => ({
        isLoading, loadingMessage, isFullyLoaded, isInitiallyResolved, loadError, isSaving, saveError, saveSuccess,
        configServiceRef, configServiceInstanceReady,
        setlist, stagedSetlist, 
        activeWorkspaceName,
        
        // --- Exposing SceneContext Values ---
        activeSceneName,
        setActiveSceneName,
        stagedActiveWorkspace,
        setStagedActiveWorkspace,
        fullSceneList,
        hasPendingChanges,
        setHasPendingChanges,
        addNewSceneToStagedWorkspace,
        deleteSceneFromStagedWorkspace,
        setDefaultSceneInStagedWorkspace,
        
        startLoadingProcess,
        isWorkspaceTransitioning,
        _executeLoadAfterFade,
        loadWorkspace,
        saveChanges,
        duplicateActiveWorkspace,
        createNewWorkspace,
        deleteWorkspaceFromSet,
        renameWorkspaceInSet,
        setDefaultWorkspaceInSet,
        
        updateGlobalMidiMap,
        updateLayerMidiMappings,
        updateGlobalEventReactions,
        deleteGlobalEventReaction,
        addPalette,
        removePalette,
        addTokenToPalette,
        removeTokenFromPalette,
        addCollectionToPersonalLibrary,
        removeCollectionFromPersonalLibrary,
        preloadWorkspace,
    }), [
        isLoading, loadingMessage, isFullyLoaded, isInitiallyResolved, loadError, isSaving, saveError, saveSuccess,
        configServiceRef, configServiceInstanceReady,
        setlist, stagedSetlist, 
        activeWorkspaceName,
        
        activeSceneName,
        setActiveSceneName,
        stagedActiveWorkspace,
        setStagedActiveWorkspace,
        fullSceneList,
        hasPendingChanges,
        setHasPendingChanges,
        addNewSceneToStagedWorkspace,
        deleteSceneFromStagedWorkspace,
        setDefaultSceneInStagedWorkspace,

        startLoadingProcess,
        isWorkspaceTransitioning,
        _executeLoadAfterFade,
        loadWorkspace,
        saveChanges,
        duplicateActiveWorkspace,
        createNewWorkspace,
        deleteWorkspaceFromSet,
        renameWorkspaceInSet,
        setDefaultWorkspaceInSet,
        updateGlobalMidiMap,
        updateLayerMidiMappings,
        updateGlobalEventReactions,
        deleteGlobalEventReaction,
        addPalette,
        removePalette,
        addTokenToPalette,
        removeTokenFromPalette,
        addCollectionToPersonalLibrary,
        removeCollectionFromPersonalLibrary,
        preloadWorkspace
    ]);

    return (
        <WorkspaceContext.Provider value={contextValue}>
            {children}
        </WorkspaceContext.Provider>
    );
};

WorkspaceProvider.propTypes = { children: PropTypes.node.isRequired };

export const useWorkspaceContext = () => {
    const context = useContext(WorkspaceContext);
    if (context === undefined) throw new Error("useWorkspaceContext must be used within a WorkspaceProvider");
    return context;
};