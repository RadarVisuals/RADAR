// src/context/AppContext.jsx
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
// --- FIX: REMOVED a circular dependency ---
// import { useMIDI } from "./MIDIContext.jsx"; 
import { useNotifications } from "../hooks/useNotifications";
import fallbackConfig from "../config/fallback-config.js";
import ConfigurationService, { hexToUtf8Safe } from "../services/ConfigurationService";
import { useUpProvider } from "./UpProvider";
import { RADAR_OFFICIAL_ADMIN_ADDRESS, IPFS_GATEWAY } from "../config/global-config";
import { uploadJsonToPinata } from '../services/PinataService.js';
import { preloadImages, resolveImageUrl } from '../utils/imageDecoder.js';
import { lerp } from '../utils/helpers.js';
import { INTERPOLATED_MIDI_PARAMS } from '../config/midiConstants.js';

const OFFICIAL_WHITELIST_KEY = keccak256(stringToBytes("RADAR.OfficialWhitelist"));
const AUTO_FADE_DURATION_MS = 1000;
const CROSSFADER_LERP_FACTOR = 0.2;

const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

export const defaultAppContextValue = {
  // Visual Config Defaults
  layerConfigs: fallbackConfig.layers,
  tokenAssignments: fallbackConfig.tokenAssignments,
  updateLayerConfig: () => {},
  updateTokenAssignment: () => {},
  setLiveConfig: () => {},

  // Notification Defaults
  notifications: [],
  addNotification: () => {},
  onMarkNotificationRead: () => {},
  onClearAllNotifications: () => {},
  unreadCount: 0,

  // Set Management Defaults
  isLoading: true,
  isFullyLoaded: false,
  startLoadingProcess: () => {},
  setlist: null, stagedSetlist: null, activeWorkspace: null, stagedActiveWorkspace: null, activeWorkspaceName: null, activeSceneName: null,
  savedSceneList: [], loadError: null, isSaving: false, saveError: null, saveSuccess: false, isInitiallyResolved: false,
  sceneLoadNonce: 0, loadedLayerConfigsFromScene: null, loadedTokenAssignmentsFromScene: null,
  officialWhitelist: [],
  refreshOfficialWhitelist: async () => {},
  hasPendingChanges: false,
  configServiceRef: { current: null }, configServiceInstanceReady: false,
  activeMidiMap: {},
  activeEventReactions: {},
  ownedTokenIdentifiers: {},
  isFetchingTokens: false,
  tokenFetchProgress: { loaded: 0, total: 0, loading: false },
  refreshOwnedTokens: async () => {},
  loadWorkspace: async () => ({ success: false, error: "Provider not initialized" }),
  loadScene: async () => ({ success: false, error: "Provider not initialized" }),
  setActiveSceneSilently: () => {},
  saveChanges: async () => ({ success: false, error: "Provider not initialized" }),
  duplicateActiveWorkspace: async () => ({ success: false, error: "Provider not initialized" }),
  createNewWorkspace: () => {},
  deleteWorkspaceFromSet: () => {},
  renameWorkspaceInSet: () => {},
  setDefaultWorkspaceInSet: () => {},
  addNewSceneToStagedWorkspace: () => {}, deleteSceneFromStagedWorkspace: () => {},
  setDefaultSceneInStagedWorkspace: () => {}, discardStagedChanges: () => {},
  updateGlobalMidiMap: () => {},
  updateLayerMidiMappings: () => {}, 
  updateGlobalEventReactions: () => {}, deleteGlobalEventReaction: () => {},
  setHasPendingChanges: () => {},
  addPalette: () => {},
  removePalette: () => {},
  addTokenToPalette: () => {},
  removeTokenFromPalette: () => {},
  preloadWorkspace: () => {},
  isWorkspaceTransitioning: false,
  _executeLoadAfterFade: () => {},
  
  // Crossfader and Deck Defaults
  sideA: { config: null },
  sideB: { config: null },
  uiControlConfig: null,
  renderedCrossfaderValue: 0.0,
  isAutoFading: false,
  handleSceneSelect: () => {},
  handleCrossfaderChange: () => {},
  registerManagerInstancesRef: () => {},
  registerCanvasUpdateFns: () => {},
  // --- FIX: Add the shared ref to the default context value ---
  midiStateRef: { current: null },
};

const AppContext = createContext(defaultAppContextValue);

export const AppProvider = ({ children }) => {
  const { hostProfileAddress, visitorProfileAddress, isHostProfileOwner } = useUserSession();
  const { provider, walletClient, publicClient } = useUpProvider();
  const { addToast } = useToast();
  // --- FIX: REMOVED useMIDI() call ---
  const notificationData = useNotifications();

  const [shouldStartLoading, setShouldStartLoading] = useState(false);
  
  const [sideA, setSideA] = useState({ config: null });
  const [sideB, setSideB] = useState({ config: null });
  const [uiControlConfig, setUiControlConfig] = useState(null);
  const [targetCrossfaderValue, setTargetCrossfaderValue] = useState(0.0);
  const [renderedCrossfaderValue, setRenderedCrossfaderValue] = useState(0.0);
  const renderedValueRef = useRef(0.0);
  const [isAutoFading, setIsAutoFading] = useState(false);
  
  const faderAnimationRef = useRef();
  const autoFadeRef = useRef(null);
  const prevFaderValueRef = useRef(0.0);

  const managerInstancesRef = useRef(null);
  const canvasUpdateFnsRef = useRef({});

  // --- FIX: This ref will be shared with MIDIContext ---
  const midiStateRef = useRef({ liveCrossfaderValue: null });

  const registerManagerInstancesRef = useCallback((ref) => {
    managerInstancesRef.current = ref;
  }, []);

  const registerCanvasUpdateFns = useCallback((fns) => {
    canvasUpdateFnsRef.current = fns;
  }, []);

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

  const fullSceneList = useMemo(() => {
    if (!stagedActiveWorkspace?.presets) return [];
    const validScenes = Object.values(stagedActiveWorkspace.presets).filter(
        (item) => item && typeof item.name === 'string'
    );
    return [...validScenes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [stagedActiveWorkspace]);
  
  useEffect(() => {
    const animateFader = () => {
      const current = renderedValueRef.current;
      const target = targetCrossfaderValue;
      if (Math.abs(target - current) > 0.0001) {
        const newRendered = lerp(current, target, CROSSFADER_LERP_FACTOR);
        renderedValueRef.current = newRendered;
        setRenderedCrossfaderValue(newRendered);
      } else if (current !== target) {
        renderedValueRef.current = target;
        setRenderedCrossfaderValue(target);
      }
      faderAnimationRef.current = requestAnimationFrame(animateFader);
    };
    faderAnimationRef.current = requestAnimationFrame(animateFader);
    return () => { if (faderAnimationRef.current) cancelAnimationFrame(faderAnimationRef.current); };
  }, [targetCrossfaderValue]);

  useEffect(() => {
    const activeConfig = renderedValueRef.current < 0.5 ? sideA.config : sideB.config;
    setUiControlConfig(activeConfig);
  }, [renderedCrossfaderValue, sideA, sideB]);

  const animateCrossfade = useCallback((startTime, startValue, endValue, duration) => {
    const now = performance.now();
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const newCrossfaderValue = startValue + (endValue - startValue) * progress;
    setTargetCrossfaderValue(newCrossfaderValue);
    if (progress < 1) autoFadeRef.current = requestAnimationFrame(() => animateCrossfade(startTime, startValue, endValue, duration));
    else { setIsAutoFading(false); autoFadeRef.current = null; }
  }, [setIsAutoFading, setTargetCrossfaderValue]);

  const prevIsWorkspaceTransitioning = usePrevious(isWorkspaceTransitioning);
  const prevIsFullyLoaded = usePrevious(isFullyLoaded);

  useEffect(() => {
    const initialLoadJustFinished = !prevIsFullyLoaded && isFullyLoaded;
    const transitionJustFinished = prevIsWorkspaceTransitioning && !isWorkspaceTransitioning;

    if (initialLoadJustFinished || transitionJustFinished) {
      // --- THIS IS THE FIX ---
      // Read the initial fader value from the shared ref.
      const initialFaderValue = midiStateRef.current.liveCrossfaderValue !== null ? midiStateRef.current.liveCrossfaderValue : 0.0;
      // --- END FIX ---
      
      if (!fullSceneList || fullSceneList.length === 0) {
        const baseScene = {
          name: "Fallback",
          ts: Date.now(),
          layers: JSON.parse(JSON.stringify(fallbackConfig.layers)),
          tokenAssignments: JSON.parse(JSON.stringify(fallbackConfig.tokenAssignments)),
        };
        setSideA({ config: baseScene });
        setSideB({ config: baseScene });
        setActiveSceneName(null);
        // --- THIS IS THE FIX ---
        setTargetCrossfaderValue(initialFaderValue);
        setRenderedCrossfaderValue(initialFaderValue); // Snap rendered value immediately
        renderedValueRef.current = initialFaderValue;
        // --- END FIX ---
        return;
      }
      
      const initialSceneName = stagedActiveWorkspace.defaultSceneName || fullSceneList[0]?.name;
      let startIndex = fullSceneList.findIndex(p => p.name === initialSceneName);
      if (startIndex === -1) startIndex = 0;
      
      const nextIndex = fullSceneList.length > 1 ? (startIndex + 1) % fullSceneList.length : startIndex;
  
      const startSceneConfig = JSON.parse(JSON.stringify(fullSceneList[startIndex]));
      const nextSceneConfig = JSON.parse(JSON.stringify(fullSceneList[nextIndex]));
      
      // --- THIS IS THE FIX ---
      // Logic to decide which scene goes on which deck based on the fader's position
      const activeSideIsA = initialFaderValue < 0.5;

      if (activeSideIsA) {
        setSideA({ config: startSceneConfig });
        setSideB({ config: nextSceneConfig });
        setActiveSceneName(startSceneConfig.name);
      } else {
        setSideB({ config: startSceneConfig });
        setSideA({ config: nextSceneConfig });
        setActiveSceneName(startSceneConfig.name);
      }
      
      setTargetCrossfaderValue(initialFaderValue);
      setRenderedCrossfaderValue(initialFaderValue); // Snap rendered value
      renderedValueRef.current = initialFaderValue;
      // --- END FIX ---
    }
  }, [isWorkspaceTransitioning, isFullyLoaded, stagedActiveWorkspace, activeWorkspaceName, fullSceneList, prevIsFullyLoaded, prevIsWorkspaceTransitioning]);

  useEffect(() => {
    if (!fullSceneList || fullSceneList.length < 2) return;

    const prevValue = prevFaderValueRef.current;
    const newValue = renderedCrossfaderValue;
    
    if (prevValue < 1.0 && newValue >= 0.999) {
      const currentBIndex = fullSceneList.findIndex(p => p.ts === sideB.config?.ts);
      if (currentBIndex !== -1) {
        const nextAIndex = (currentBIndex + 1) % fullSceneList.length;
        if (fullSceneList[nextAIndex]?.ts !== sideA.config?.ts) {
          setSideA({ config: JSON.parse(JSON.stringify(fullSceneList[nextAIndex])) });
        }
      }
    } 
    else if (prevValue > 0.0 && newValue <= 0.001) {
      const currentAIndex = fullSceneList.findIndex(p => p.ts === sideA.config?.ts);
      if (currentAIndex !== -1) {
        const nextBIndex = (currentAIndex + 1) % fullSceneList.length;
        if (fullSceneList[nextBIndex]?.ts !== sideB.config?.ts) {
          setSideB({ config: JSON.parse(JSON.stringify(fullSceneList[nextBIndex])) });
        }
      }
    }
    
    prevFaderValueRef.current = newValue;
  }, [renderedCrossfaderValue, fullSceneList, sideA, sideB]);

  useEffect(() => {
      if (!isFullyLoaded) return; 
      
      if (!fullSceneList || fullSceneList.length === 0) {
          const baseScene = {
            name: "Fallback",
            ts: Date.now(),
            layers: JSON.parse(JSON.stringify(fallbackConfig.layers)),
            tokenAssignments: JSON.parse(JSON.stringify(fallbackConfig.tokenAssignments)),
          };
          setSideA({ config: baseScene });
          setSideB({ config: baseScene });
          setActiveSceneName(null);
          setTargetCrossfaderValue(0.0);
          return;
      }
  
      const activeSideIsA = renderedValueRef.current < 0.5;
      const activeDeckScene = activeSideIsA ? sideA.config : sideB.config;
  
      let currentIndex = fullSceneList.findIndex(p => p.ts === activeDeckScene?.ts);
      if (currentIndex === -1) {
          currentIndex = 0;
      }
      
      const nextIndex = fullSceneList.length > 1 ? (currentIndex + 1) % fullSceneList.length : currentIndex;
  
      const currentSceneData = JSON.parse(JSON.stringify(fullSceneList[currentIndex]));
      const nextSceneData = JSON.parse(JSON.stringify(fullSceneList[nextIndex]));

      if (activeSideIsA) {
          if (sideA.config?.ts !== currentSceneData.ts) setSideA({ config: currentSceneData });
          if (sideB.config?.ts !== nextSceneData.ts) setSideB({ config: nextSceneData });
      } else {
          if (sideB.config?.ts !== currentSceneData.ts) setSideB({ config: currentSceneData });
          if (sideA.config?.ts !== nextSceneData.ts) setSideA({ config: nextSceneData });
      }
  }, [fullSceneList, isFullyLoaded]);
  
  const setActiveSceneSilently = useCallback((name) => {
    if (!stagedActiveWorkspace || !stagedActiveWorkspace.presets[name]) {
      if (import.meta.env.DEV) console.warn(`[AppContext] setActiveSceneSilently called with non-existent scene: ${name}`);
      return;
    }
    if (activeSceneName !== name) {
      setActiveSceneName(name);
    }
  }, [stagedActiveWorkspace, activeSceneName]);

  useEffect(() => {
    if (!fullSceneList || fullSceneList.length === 0) return;
    const target = targetCrossfaderValue;
  
    if (target >= 0.999) {
      const sceneNameB = sideB.config?.name;
      if (sceneNameB && fullSceneList.some(s => s.name === sceneNameB)) {
        setActiveSceneSilently(sceneNameB);
      }
    } else if (target <= 0.001) {
      const sceneNameA = sideA.config?.name;
      if (sceneNameA && fullSceneList.some(s => s.name === sceneNameA)) {
        setActiveSceneSilently(sceneNameA);
      }
    }
  }, [targetCrossfaderValue, sideA.config, sideB.config, fullSceneList, setActiveSceneSilently]);

  const handleSceneSelect = useCallback((sceneName, duration = AUTO_FADE_DURATION_MS) => {
    if (isAutoFading || !fullSceneList || fullSceneList.length === 0) return;
    
    const targetScene = fullSceneList.find(s => s.name === sceneName);
    if (!targetScene) return;

    if (sideA.config?.name === sceneName || sideB.config?.name === sceneName) {
        const targetValue = sideA.config?.name === sceneName ? 0.0 : 1.0;
        if (Math.abs(targetCrossfaderValue - targetValue) < 0.001) return;
        setIsAutoFading(true);
        if (autoFadeRef.current) cancelAnimationFrame(autoFadeRef.current);
        animateCrossfade(performance.now(), targetCrossfaderValue, targetValue, duration);
        return;
    }

    const currentActiveSide = renderedCrossfaderValue < 0.5 ? 'A' : 'B';

    if (currentActiveSide === 'A') {
      setSideB({ config: JSON.parse(JSON.stringify(targetScene)) });
      setIsAutoFading(true);
      if (autoFadeRef.current) cancelAnimationFrame(autoFadeRef.current);
      animateCrossfade(performance.now(), targetCrossfaderValue, 1.0, duration);
    } else {
      setSideA({ config: JSON.parse(JSON.stringify(targetScene)) });
      setIsAutoFading(true);
      if (autoFadeRef.current) cancelAnimationFrame(autoFadeRef.current);
      animateCrossfade(performance.now(), targetCrossfaderValue, 0.0, duration);
    }
  }, [isAutoFading, fullSceneList, sideA.config, sideB.config, targetCrossfaderValue, renderedCrossfaderValue, animateCrossfade]);

  const handleCrossfaderChange = useCallback((newValue) => {
    setTargetCrossfaderValue(newValue);
  }, []);

  const updateLayerConfig = useCallback((layerId, key, value, isMidiUpdate = false) => {
    const managers = managerInstancesRef.current?.current;
    if (!managers) return;
    const manager = managers[String(layerId)];
    if (!manager) return;
    
    const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';

    if (isMidiUpdate && INTERPOLATED_MIDI_PARAMS.includes(key)) {
      if (activeDeck === 'A') manager.setTargetValue(key, value);
      else manager.setTargetValueB(key, value);
    } else {
      if (activeDeck === 'A') manager.updateConfigProperty(key, value);
      else manager.updateConfigBProperty(key, value);
    }
    
    const stateSetter = activeDeck === 'A' ? setSideA : setSideB;
    stateSetter(prev => {
      if (!prev.config) return prev;
      const newConfig = JSON.parse(JSON.stringify(prev.config));
      if (!newConfig.layers[layerId]) newConfig.layers[layerId] = {};
      newConfig.layers[layerId][key] = value;
      return { ...prev, config: newConfig };
    });
    
    setHasPendingChanges(true);
  }, []);

  const updateTokenAssignment = useCallback(async (token, layerId) => {
    const managers = managerInstancesRef.current?.current;
    const { setCanvasLayerImage } = canvasUpdateFnsRef.current;
    if (!managers || !setCanvasLayerImage) return;

    const idToSave = token.id;
    const srcToLoad = token.metadata?.image;
    if (!idToSave || !srcToLoad) return;
  
    const assignmentObject = { id: idToSave, src: srcToLoad };
    
    const targetDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
    const stateSetter = targetDeck === 'A' ? setSideA : setSideB;

    stateSetter(prev => {
      if (!prev.config) return prev;
      const newConfig = JSON.parse(JSON.stringify(prev.config));
      if (!newConfig.tokenAssignments) newConfig.tokenAssignments = {};
      newConfig.tokenAssignments[String(layerId)] = assignmentObject;
      return { ...prev, config: newConfig };
    });

    try {
      await setCanvasLayerImage(String(layerId), srcToLoad);
    } catch (e) {
      console.error(`[AppContext] Error setting canvas image for layer ${layerId}:`, e);
    }

    setHasPendingChanges(true);
  }, []);

  const setLiveConfig = useCallback(
    (newLayerConfigs, newTokenAssignments) => {
      const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
      const stateSetter = activeDeck === 'A' ? setSideA : setSideB;

      stateSetter(prev => {
        if (!prev.config) return prev;
        const newConfig = JSON.parse(JSON.stringify(prev.config));
        newConfig.layers = newLayerConfigs || fallbackConfig.layers;
        newConfig.tokenAssignments = newTokenAssignments || fallbackConfig.tokenAssignments;
        return { ...prev, config: newConfig };
      });
      setHasPendingChanges(false);
    },
    []
  );

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
        console.error(`[AppContext] Failed to load workspace from CID ${cid}:`, error);
        addToast(`Could not load workspace data.`, "error");
        return null;
    }
  }, [addToast]);

  useEffect(() => {
    if (!shouldStartLoading) {
      if(import.meta.env.DEV) console.log('%c[AppContext] Waiting for user interaction to start loading.', 'color: #e67e22;');
      return;
    }

    const currentAddress = hostProfileAddress;
    const service = configServiceRef.current;
    const profileChanged = currentAddress !== prevProfileAddressRef.current;
    
    const emptySetlist = { defaultWorkspaceName: null, workspaces: {}, globalUserMidiMap: {} };
    const emptyWorkspace = { presets: {}, defaultPresetName: null, globalEventReactions: {}, personalCollectionLibrary: [], userPalettes: {} };

    if (profileChanged) {
      if (import.meta.env.DEV) console.log(`%c[AppContext] Profile changed from ${prevProfileAddressRef.current?.slice(0,6)} to ${currentAddress?.slice(0,6)}. Resetting state.`, 'color: #f39c12;');
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
        }
      } finally {
        if (prevProfileAddressRef.current === address) {
          setIsLoading(false);
          setLoadingMessage("");
          if(import.meta.env.DEV) console.log(`%c[AppContext] Load sequence finished for ${address?.slice(0,6)}. Setting isFullyLoaded = true.`, 'color: #2ecc71; font-weight: bold;');
          setIsFullyLoaded(true);
        }
      }
    };
    
    if (configServiceInstanceReady && !isInitiallyResolved) {
      if (currentAddress) {
        if (import.meta.env.DEV) console.log(`%c[AppContext] Initializing for connected profile: ${currentAddress.slice(0,6)}...`, 'color: #f39c12;');
        loadInitialData(currentAddress);
      } else {
        if (import.meta.env.DEV) console.log(`%c[AppContext] Initializing for DISCONNECTED state.`, 'color: #f39c12;');
        setSetlist(emptySetlist); setStagedSetlist(emptySetlist);
        setActiveWorkspace(emptyWorkspace); setStagedActiveWorkspace(emptyWorkspace);
        setIsLoading(false);
        setIsInitiallyResolved(true);
      }
    }
  }, [shouldStartLoading, hostProfileAddress, visitorProfileAddress, configServiceInstanceReady, isInitiallyResolved, isHostProfileOwner, addToast, _loadWorkspaceFromCid]);

  useEffect(() => {
    if (isInitiallyResolved && !hostProfileAddress && !isFullyLoaded) {
      if (import.meta.env.DEV) console.log(`%c[AppContext] Resolved as DISCONNECTED. Setting isFullyLoaded = true.`, 'color: #2ecc71; font-weight: bold;');
      setIsFullyLoaded(true);
    }
  }, [isInitiallyResolved, hostProfileAddress, isFullyLoaded]);
  
  const savedSceneList = useMemo(() => {
    if (!stagedActiveWorkspace || !stagedActiveWorkspace.presets) return [];
    const validScenes = Object.values(stagedActiveWorkspace.presets).filter(p => p && typeof p.name === 'string');
    return validScenes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(scene => ({ name: scene.name, ts: scene.ts }));
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
      setIsWorkspaceTransitioning(false);
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
    if (isWorkspaceTransitioning) return;

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
      handleSceneSelect(name);
      setSceneLoadNonce(prev => prev + 1);
    }
    return { success: true };
  }, [stagedActiveWorkspace, activeSceneName, addToast, handleSceneSelect]);
  
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
    setActiveSceneName(newSceneName);
    setHasPendingChanges(true);
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
    layerConfigs: uiControlConfig?.layers || fallbackConfig.layers,
    tokenAssignments: uiControlConfig?.tokenAssignments || fallbackConfig.tokenAssignments,
    updateLayerConfig,
    updateTokenAssignment,
    setLiveConfig,

    notifications: notificationData.notifications,
    addNotification: notificationData.addNotification,
    onMarkNotificationRead: notificationData.markAsRead,
    onClearAllNotifications: notificationData.clearAll,
    unreadCount: notificationData.unreadCount,
    
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

    sideA,
    sideB,
    uiControlConfig,
    renderedCrossfaderValue,
    isAutoFading,
    handleSceneSelect,
    handleCrossfaderChange,
    registerManagerInstancesRef,
    registerCanvasUpdateFns,
    // --- FIX: Pass the ref down in the context value ---
    midiStateRef,
  }), [
    uiControlConfig,
    updateLayerConfig,
    updateTokenAssignment,
    setLiveConfig,
    notificationData,
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
    sideA, sideB, renderedCrossfaderValue, isAutoFading,
    handleSceneSelect, handleCrossfaderChange,
    registerManagerInstancesRef, registerCanvasUpdateFns,
    // --- FIX: Add ref to dependency array ---
    midiStateRef,
  ]);
  
  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

AppProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within a AppProvider");
  }
  return context;
};