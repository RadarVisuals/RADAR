// src/context/WorkspaceContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useUserSession } from './UserSessionContext';
import { useToast } from './ToastContext';
import { useUpProvider } from './UpProvider';
import ConfigurationService from '../services/ConfigurationService';
import { uploadJsonToPinata } from '../services/PinataService.js';
import { preloadImages, resolveImageUrl } from '../utils/imageDecoder.js';
import fallbackConfig from '../config/fallback-config.js';
import { useAsyncErrorHandler } from '../hooks/useAsyncErrorHandler';

const WorkspaceContext = createContext();

export const WorkspaceProvider = ({ children }) => {
    const { hostProfileAddress, isHostProfileOwner } = useUserSession();
    const { provider, walletClient, publicClient } = useUpProvider();
    const { addToast } = useToast();
    const { handleAsyncError } = useAsyncErrorHandler();

    const [shouldStartLoading, setShouldStartLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Initializing...");
    const [isFullyLoaded, setIsFullyLoaded] = useState(false);
    const [isInitiallyResolved, setIsInitiallyResolved] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);

    // --- THIS IS THE FIX (Part 1) ---
    const [sceneUpdateTrigger, setSceneUpdateTrigger] = useState(0);
    // --- END FIX ---

    const configServiceRef = useRef(null);
    const [configServiceInstanceReady, setConfigServiceInstanceReady] = useState(false);
    
    const [setlist, setSetlist] = useState(null);
    const [stagedSetlist, setStagedSetlist] = useState(null);
    const [activeWorkspace, setActiveWorkspace] = useState(null);
    const [stagedActiveWorkspace, setStagedActiveWorkspace] = useState(null);
    const [activeWorkspaceName, setActiveWorkspaceName] = useState(null);
    const [activeSceneName, setActiveSceneName] = useState(null);
    
    const [isWorkspaceTransitioning, setIsWorkspaceTransitioning] = useState(false);
    const workspaceToLoadRef = useRef(null);
    const [newlyCreatedWorkspace, setNewlyCreatedWorkspace] = useState(null);
    const preloadedWorkspacesRef = useRef(new Map());
    const preloadingInProgressRef = useRef(new Set());
    const prevProfileAddressRef = useRef(null);

    const startLoadingProcess = useCallback(() => {
        if(import.meta.env.DEV) console.log('%c[WorkspaceContext] User initiated loading process.', 'color: #1abc9c; font-weight: bold;');
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

    const _loadWorkspaceFromCid = useCallback(async (cid) => {
        const service = configServiceRef.current;
        if (!service || !cid) return null;
        const workspaceData = await service._loadWorkspaceFromCID(cid);
        return workspaceData;
    }, []);

    useEffect(() => {
        if (!shouldStartLoading) {
          if(import.meta.env.DEV) console.log('%c[WorkspaceContext] Waiting for user interaction to start loading.', 'color: #e67e22;');
          return;
        }
    
        const currentAddress = hostProfileAddress;
        const service = configServiceRef.current;
        const profileChanged = currentAddress !== prevProfileAddressRef.current;
        
        const emptySetlist = { defaultWorkspaceName: null, workspaces: {}, globalUserMidiMap: {} };
        const emptyWorkspace = { presets: {}, defaultPresetName: null, globalEventReactions: {}, personalCollectionLibrary: [], userPalettes: {} };
    
        if (profileChanged) {
          if (import.meta.env.DEV) console.log(`%c[WorkspaceContext] Profile changed from ${prevProfileAddressRef.current?.slice(0,6)} to ${currentAddress?.slice(0,6)}. Resetting state.`, 'color: #f39c12;');
          prevProfileAddressRef.current = currentAddress;
          setIsLoading(true);
          setLoadingMessage("Initializing...");
          setIsFullyLoaded(false);
          setIsInitiallyResolved(false); setLoadError(null); setHasPendingChanges(false);
          setSetlist(null); setStagedSetlist(null); setActiveWorkspace(null); setStagedActiveWorkspace(null);
          setActiveWorkspaceName(null); setActiveSceneName(null);
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
                const result = await handleAsyncError(_loadWorkspaceFromCid(workspaceInfo.cid));
                if (result.success) {
                    loadedWorkspace = result.data;
                } else {
                    loadedWorkspace = null; // Ensure it's null on failure
                }
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
            
            setLoadError(null);
            setHasPendingChanges(false);
    
          } catch (error) {
            if (prevProfileAddressRef.current === address) {
              setLoadError(error.message || "Failed to load setlist.");
              addToast("Could not load your setlist.", "error");
              setSetlist(emptySetlist); setStagedSetlist(emptySetlist);
              setActiveWorkspace(emptyWorkspace); setStagedActiveWorkspace(emptyWorkspace);
            }
          } finally {
            if (prevProfileAddressRef.current === address) {
              setIsLoading(false);
              setLoadingMessage("");
              if(import.meta.env.DEV) console.log(`%c[WorkspaceContext] Load sequence finished for ${address?.slice(0,6)}. Setting isFullyLoaded = true.`, 'color: #2ecc71; font-weight: bold;');
              setIsFullyLoaded(true);
            }
          }
        };
        
        if (configServiceInstanceReady && !isInitiallyResolved) {
          if (currentAddress) {
            if (import.meta.env.DEV) console.log(`%c[WorkspaceContext] Initializing for connected profile: ${currentAddress.slice(0,6)}...`, 'color: #f39c12;');
            loadInitialData(currentAddress);
          } else {
            if (import.meta.env.DEV) console.log(`%c[WorkspaceContext] Initializing for DISCONNECTED state.`, 'color: #f39c12;');
            setSetlist(emptySetlist); setStagedSetlist(emptySetlist);
            setActiveWorkspace(emptyWorkspace); setStagedActiveWorkspace(emptyWorkspace);
            setIsLoading(false);
            setIsInitiallyResolved(true);
          }
        }
    }, [shouldStartLoading, hostProfileAddress, configServiceInstanceReady, isInitiallyResolved, addToast, _loadWorkspaceFromCid, handleAsyncError]);

    useEffect(() => {
        if (isInitiallyResolved && !hostProfileAddress && !isFullyLoaded) {
          if (import.meta.env.DEV) console.log(`%c[WorkspaceContext] Resolved as DISCONNECTED. Setting isFullyLoaded = true.`, 'color: #2ecc71; font-weight: bold;');
          setIsFullyLoaded(true);
        }
    }, [isInitiallyResolved, hostProfileAddress, isFullyLoaded]);

    const fullSceneList = useMemo(() => {
        if (!stagedActiveWorkspace?.presets) return [];
        const validScenes = Object.values(stagedActiveWorkspace.presets).filter(
            (item) => item && typeof item.name === 'string'
        );
        return [...validScenes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }, [stagedActiveWorkspace]);

    const _executeLoadAfterFade = useCallback(async () => {
        const workspaceName = workspaceToLoadRef.current;
        if (!workspaceName || !stagedSetlist || !stagedSetlist.workspaces[workspaceName]) {
          const errorMsg = `Target workspace '${workspaceName}' not found for loading.`;
          addToast(errorMsg, 'error');
          setIsLoading(false);
          setLoadingMessage("");
          setIsWorkspaceTransitioning(false);
          return;
        }
    
        try {
          let newWorkspace;
          if (preloadedWorkspacesRef.current.has(workspaceName)) {
            newWorkspace = preloadedWorkspacesRef.current.get(workspaceName);
          } else {
            const workspaceInfo = stagedSetlist.workspaces[workspaceName];
            const result = await handleAsyncError(_loadWorkspaceFromCid(workspaceInfo.cid));
            if (result.success) {
                newWorkspace = result.data;
            } else {
                newWorkspace = null; // Ensure it's null on failure
            }

            if (newWorkspace) {
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
          }
    
          if (newWorkspace) {
            setActiveWorkspace(newWorkspace);
            setStagedActiveWorkspace(newWorkspace);
            setActiveWorkspaceName(workspaceName);
            addToast(`Workspace "${workspaceName}" loaded.`, 'success');
          }
    
        } catch (error) {
          addToast(error.message, 'error');
        } finally {
          setIsLoading(false);
          setLoadingMessage("");
          setIsWorkspaceTransitioning(false);
          workspaceToLoadRef.current = null;
        }
    }, [stagedSetlist, addToast, _loadWorkspaceFromCid, handleAsyncError]);

    const loadWorkspace = useCallback(async (workspaceName) => {
        if (isWorkspaceTransitioning) return;
    
        if (!stagedSetlist || !stagedSetlist.workspaces[workspaceName]) {
            const errorMsg = `Workspace '${workspaceName}' not found.`;
            addToast(errorMsg, 'error');
            return { success: false, error: errorMsg };
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

    const addNewSceneToStagedWorkspace = useCallback((newSceneName, newSceneData) => {
        setStagedActiveWorkspace(prev => {
          const newWorkspace = prev ? JSON.parse(JSON.stringify(prev)) : { presets: {}, defaultPresetName: null, globalMidiMap: {}, globalEventReactions: {}, personalCollectionLibrary: [], userPalettes: {} };
          newWorkspace.presets[newSceneName] = newSceneData;
          return newWorkspace;
        });
        setActiveSceneName(newSceneName);
        setHasPendingChanges(true);
        // --- THIS IS THE FIX (Part 1) ---
        setSceneUpdateTrigger(prev => prev + 1);
        // --- END FIX ---
    }, []);
    
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

    const contextValue = useMemo(() => ({
        isLoading, loadingMessage, isFullyLoaded, isInitiallyResolved, loadError, isSaving, saveError, saveSuccess, hasPendingChanges,
        configServiceRef, configServiceInstanceReady,
        setlist, stagedSetlist, activeWorkspace, stagedActiveWorkspace, activeWorkspaceName, activeSceneName,
        fullSceneList,
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
        addNewSceneToStagedWorkspace,
        deleteSceneFromStagedWorkspace,
        setDefaultSceneInStagedWorkspace,
        updateGlobalMidiMap,
        updateLayerMidiMappings,
        updateGlobalEventReactions,
        deleteGlobalEventReaction,
        addPalette,
        removePalette,
        addTokenToPalette,
        removeTokenFromPalette,
        preloadWorkspace,
        setHasPendingChanges,
        setActiveSceneName,
        // --- THIS IS THE FIX (Part 1) ---
        sceneUpdateTrigger,
        // --- END FIX ---
    }), [
        isLoading, loadingMessage, isFullyLoaded, isInitiallyResolved, loadError, isSaving, saveError, saveSuccess, hasPendingChanges,
        configServiceRef, configServiceInstanceReady,
        setlist, stagedSetlist, activeWorkspace, stagedActiveWorkspace, activeWorkspaceName, activeSceneName,
        fullSceneList,
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
        addNewSceneToStagedWorkspace,
        deleteSceneFromStagedWorkspace,
        setDefaultSceneInStagedWorkspace,
        updateGlobalMidiMap,
        updateLayerMidiMappings,
        updateGlobalEventReactions,
        deleteGlobalEventReaction,
        addPalette,
        removePalette,
        addTokenToPalette,
        removeTokenFromPalette,
        preloadWorkspace,
        setActiveSceneName,
        // --- THIS IS THE FIX (Part 1) ---
        sceneUpdateTrigger,
        // --- END FIX ---
    ]);

    return (
        <WorkspaceContext.Provider value={contextValue}>
            {children}
        </WorkspaceContext.Provider>
    );
};

WorkspaceProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useWorkspaceContext = () => {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error("useWorkspaceContext must be used within a WorkspaceProvider");
    }
    return context;
};