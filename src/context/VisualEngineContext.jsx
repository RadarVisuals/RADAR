// src/context/VisualEngineContext.jsx
import React, { createContext, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../store/useProjectStore';
import { useEngineStore } from '../store/useEngineStore';
import fallbackConfig from '../config/fallback-config.js';
import SignalBus from '../utils/SignalBus';
import debounce from '../utils/debounce'; 

const VisualEngineContext = createContext(null);
const AUTO_FADE_DURATION_MS = 1000;

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; });
  return ref.current;
}

export const VisualEngineProvider = ({ children }) => {
    const { 
        stagedWorkspace: stagedActiveWorkspace, 
        activeSceneName, 
        isLoading,
        activeWorkspaceName
    } = useProjectStore(useShallow(s => ({
        stagedWorkspace: s.stagedWorkspace,
        activeSceneName: s.activeSceneName,
        isLoading: s.isLoading,
        activeWorkspaceName: s.activeWorkspaceName
    })));

    const setActiveSceneName = useProjectStore(s => s.setActiveSceneName);
    const setHasPendingChanges = (val) => useProjectStore.setState({ hasPendingChanges: val });
    
    const isFullyLoaded = !isLoading && !!activeWorkspaceName;
    const fullSceneList = useMemo(() => 
        Object.values(stagedActiveWorkspace?.presets || {})
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })), 
    [stagedActiveWorkspace]);
    
    const prevIsFullyLoaded = usePrevious(isFullyLoaded);
    const prevActiveSceneName = usePrevious(activeSceneName);
    const prevFullSceneList = usePrevious(fullSceneList);

    const renderedValueRef = useRef(0.0);
    const managerInstancesRef = useRef(null);
    const canvasUpdateFnsRef = useRef({});
    
    const registerManagerInstancesRef = useCallback((ref) => { managerInstancesRef.current = ref; }, []);
    const registerCanvasUpdateFns = useCallback((fns) => { canvasUpdateFnsRef.current = fns; }, []);

    // Listener to keep local ref updated for UI logic that needs instantaneous values
    useEffect(() => {
        const handleUpdate = (val) => { renderedValueRef.current = val; };
        const unsub = SignalBus.on('crossfader:update', handleUpdate);
        return () => unsub();
    }, []);

    // --- SYNC MODULATION LOAD (HOT SWAP) ---
    // This connects the ProjectStore's load action to the PixiEngine's internals
    useEffect(() => {
        const unsub = useEngineStore.subscribe(
            (state) => state.modulationLoadNonce,
            (nonce) => {
                const engine = managerInstancesRef.current?.current?.engine;
                const store = useEngineStore.getState();
                
                if (engine) {
                    // 1. Wipe existing wires in the Engine
                    engine.clearModulationPatches();
                    
                    // 2. Apply Base Values (The positions of the sliders)
                    if (store.baseValues) {
                        Object.entries(store.baseValues).forEach(([key, val]) => {
                            engine.setModulationValue(key, val);
                        });
                    }
                    
                    // 3. Re-connect wires (The Patches)
                    if (store.patches) {
                        store.patches.forEach(p => {
                            engine.addModulationPatch(p.source, p.target, p.amount);
                        });
                    }
                }
            }
        );
        return () => unsub();
    }, []);

    // --- LISTEN FOR DOCKING EVENTS (The DJ Logic) ---
    useEffect(() => {
        const handleDock = (side) => {
            const store = useEngineStore.getState();
            
            // Ignore if auto-fading (sequencer handles this)
            if (store.isAutoFading) return;

            const visibleDeckKey = side === 'A' ? 'sideA' : 'sideB';
            const visibleConfig = store[visibleDeckKey]?.config;
            
            if (visibleConfig?.name) {
                // Update React State to reflect visibility
                if (useProjectStore.getState().activeSceneName !== visibleConfig.name) {
                    setActiveSceneName(visibleConfig.name);
                }
            }
        };

        const unsub = SignalBus.on('crossfader:docked', handleDock);
        return () => unsub();
    }, [setActiveSceneName]);


    // --- MAIN LOGIC: INITIALIZATION & SCENE SYNC ---
    useEffect(() => {
        const initialLoadJustFinished = !prevIsFullyLoaded && isFullyLoaded;
        const sceneNameChanged = activeSceneName !== prevActiveSceneName;
        const sceneListChanged = prevFullSceneList !== fullSceneList;
        
        const store = useEngineStore.getState();
        const isStoreEmpty = !store.sideA.config && !store.sideB.config;

        // 1. Initial Load Fallback
        if (initialLoadJustFinished || (isFullyLoaded && isStoreEmpty)) {
            if (!isLoading && (!fullSceneList || fullSceneList.length === 0)) {
                const baseScene = { 
                    name: "Fallback", 
                    ts: Date.now(), 
                    layers: JSON.parse(JSON.stringify(fallbackConfig.layers)), 
                    tokenAssignments: JSON.parse(JSON.stringify(fallbackConfig.tokenAssignments)) 
                };
                store.setDeckConfig('A', baseScene);
                store.setDeckConfig('B', baseScene);
                store.setCrossfader(0.0);
                store.setRenderedCrossfader(0.0);
                SignalBus.emit('crossfader:set', 0.0);
                if (activeSceneName) setActiveSceneName(null);
                return;
            }

            if (!isLoading && fullSceneList && fullSceneList.length > 0) {
                const initialSceneName = stagedActiveWorkspace.defaultPresetName || fullSceneList[0]?.name;
                let startIndex = fullSceneList.findIndex(p => p.name === initialSceneName);
                if (startIndex === -1) startIndex = 0;
                
                const nextIndex = fullSceneList.length > 1 ? (startIndex + 1) % fullSceneList.length : startIndex;
                
                const startSceneConfig = JSON.parse(JSON.stringify(fullSceneList[startIndex]));
                const nextSceneConfig = JSON.parse(JSON.stringify(fullSceneList[nextIndex]));
                
                store.setDeckConfig('A', startSceneConfig);
                store.setDeckConfig('B', nextSceneConfig);
                store.setCrossfader(0.0);
                store.setRenderedCrossfader(0.0);
                SignalBus.emit('crossfader:set', 0.0);

                if (activeSceneName !== startSceneConfig.name) {
                    setActiveSceneName(startSceneConfig.name);
                }
            }
        } 
        // 2. Active Scene Changed (Clicked in list OR Arrived via Crossfader)
        else if ((sceneNameChanged || sceneListChanged) && isFullyLoaded && !store.isAutoFading) {
            if (!activeSceneName || !fullSceneList || fullSceneList.length === 0) return;
            
            const currentSideA = store.sideA.config;
            const currentSideB = store.sideB.config;

            // Determine where the active scene currently lives
            const isOnDeckA = currentSideA?.name === activeSceneName;
            const isOnDeckB = currentSideB?.name === activeSceneName;

            // Scenario A: User clicked a scene that is NOT on either deck.
            if (!isOnDeckA && !isOnDeckB) {
                const newActiveSceneData = fullSceneList.find(scene => scene.name === activeSceneName);
                if (!newActiveSceneData) return;

                // Load onto the INACTIVE deck (the one hidden by crossfader)
                const activeDeckIsA = renderedValueRef.current < 0.5;
                const deckToSet = activeDeckIsA ? 'B' : 'A'; // Load on inactive
                store.setDeckConfig(deckToSet, JSON.parse(JSON.stringify(newActiveSceneData)));
                return;
            }

            // Scenario B: Progressive Loading (Pre-load the NEXT scene)
            let targetDeckForNext = null;
            
            // Prioritize A if both match, otherwise pick the one that matches
            if (isOnDeckA) targetDeckForNext = 'B';
            else if (isOnDeckB) targetDeckForNext = 'A';

            if (targetDeckForNext) {
                const currentIndex = fullSceneList.findIndex(s => s.name === activeSceneName);
                if (currentIndex === -1) return;
                
                const nextIndex = (currentIndex + 1) % fullSceneList.length;
                const nextSceneData = fullSceneList[nextIndex];
                
                const currentTargetConfig = targetDeckForNext === 'A' ? currentSideA : currentSideB;
                
                // Only load if not already there
                if (currentTargetConfig?.name !== nextSceneData.name) {
                    const engine = managerInstancesRef.current?.current?.engine;
                    if (engine) {
                        ['1','2','3'].forEach(layerId => engine.syncDeckPhysics(layerId, targetDeckForNext));
                    }
                    store.setDeckConfig(targetDeckForNext, JSON.parse(JSON.stringify(nextSceneData)));
                }
            }
        }
    }, [
        isFullyLoaded, stagedActiveWorkspace, fullSceneList, 
        prevIsFullyLoaded, activeSceneName, prevActiveSceneName, 
        prevFullSceneList, setActiveSceneName, isLoading
    ]);

    // --- ENGINE-DRIVEN TRANSITION ---
    const handleSceneSelect = useCallback((sceneName, duration = AUTO_FADE_DURATION_MS) => {
        const state = useEngineStore.getState();
        const { isAutoFading, sideA, sideB, setDeckConfig, setIsAutoFading, setTargetSceneName, setCrossfader, setRenderedCrossfader } = state;
        const engine = managerInstancesRef.current?.current?.engine;

        if (isAutoFading || !fullSceneList || fullSceneList.length === 0 || !engine) return;
        
        setTargetSceneName(sceneName);
        const targetScene = fullSceneList.find(s => s.name === sceneName);
        if (!targetScene) return;
        
        const activeDeckIsA = renderedValueRef.current < 0.5;
        const currentConfig = activeDeckIsA ? sideA.config : sideB.config;
        
        if (currentConfig?.name === sceneName) return; 

        if (activeDeckIsA) { 
            ['1','2','3'].forEach(id => engine.syncDeckPhysics(id, 'B'));
            
            setDeckConfig('B', JSON.parse(JSON.stringify(targetScene)));
            setIsAutoFading(true); 
            
            engine.fadeTo(1.0, duration, () => {
                setIsAutoFading(false);
                setCrossfader(1.0);
                setRenderedCrossfader(1.0);
                setActiveSceneName(sceneName);
                setTargetSceneName(null);
            });

        } else { 
            ['1','2','3'].forEach(id => engine.syncDeckPhysics(id, 'A'));
            
            setDeckConfig('A', JSON.parse(JSON.stringify(targetScene)));
            setIsAutoFading(true); 
            
            engine.fadeTo(0.0, duration, () => {
                setIsAutoFading(false);
                setCrossfader(0.0);
                setRenderedCrossfader(0.0);
                setActiveSceneName(sceneName);
                setTargetSceneName(null);
            });
        }
    }, [fullSceneList, setActiveSceneName]);

    const updateLayerConfig = useCallback((layerId, key, value, isMidiUpdate = false, skipStoreUpdate = false) => {
        const managers = managerInstancesRef.current?.current;
        if (managers) {
            const manager = managers[String(layerId)];
            if (manager) {
                const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
                if (isMidiUpdate && ['xaxis', 'yaxis', 'angle', 'speed', 'size', 'opacity', 'drift', 'driftSpeed'].includes(key)) {
                  if (activeDeck === 'A') manager.setTargetValue(key, value); else manager.setTargetValueB(key, value);
                } else {
                  if (activeDeck === 'A') {
                      if(manager.setProperty) manager.setProperty(key, value); else manager.snapProperty(key, value);
                  } else {
                      if(manager.setPropertyB) manager.setPropertyB(key, value); else manager.snapPropertyB(key, value);
                  }
                }
            }
        }

        if (!skipStoreUpdate) {
            const currentState = useEngineStore.getState();
            const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
            const deckKey = activeDeck === 'A' ? 'sideA' : 'sideB';
            const currentDeckConfig = currentState[deckKey].config;
            
            if (currentDeckConfig) {
                const newConfig = JSON.parse(JSON.stringify(currentDeckConfig));
                if (!newConfig.layers[layerId]) newConfig.layers[layerId] = {};
                newConfig.layers[layerId][key] = value;
                currentState.setDeckConfig(activeDeck, newConfig);
            }
            setHasPendingChanges(true);
        } else {
            SignalBus.emit('param:update', { layerId: String(layerId), param: key, value: value });
        }
    }, [setHasPendingChanges]);

    const updateTokenAssignment = useCallback(async (token, layerId) => {
        const { setCanvasLayerImage } = canvasUpdateFnsRef.current;
        if (!setCanvasLayerImage) return;
        const idToSave = token.id;
        const srcToLoad = token.metadata?.image;
        if (!idToSave || !srcToLoad) return;
        
        const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
        const currentState = useEngineStore.getState();
        const deckKey = activeDeck === 'A' ? 'sideA' : 'sideB';
        const currentDeckConfig = currentState[deckKey].config;

        if (currentDeckConfig) {
            const newConfig = JSON.parse(JSON.stringify(currentDeckConfig));
            if (!newConfig.tokenAssignments) newConfig.tokenAssignments = {};
            newConfig.tokenAssignments[String(layerId)] = { id: idToSave, src: srcToLoad };
            currentState.setDeckConfig(activeDeck, newConfig);
        }

        try { await setCanvasLayerImage(String(layerId), srcToLoad, idToSave); } catch (e) { console.error(e); }
        setHasPendingChanges(true);
    }, [setHasPendingChanges]);

    const setLiveConfig = useCallback((config) => {
        const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
        useEngineStore.getState().setDeckConfig(activeDeck, config);
        if (config?.name) setActiveSceneName(config.name);
    }, [setActiveSceneName]);

    const reloadSceneOntoInactiveDeck = useCallback((sceneName) => {
        if (!fullSceneList) return;
        const scene = fullSceneList.find(s => s.name === sceneName);
        if (!scene) return;
        const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
        useEngineStore.getState().setDeckConfig(activeDeck === 'A' ? 'B' : 'A', JSON.parse(JSON.stringify(scene)));
    }, [fullSceneList]);

    const contextValue = useMemo(() => ({
        handleSceneSelect,
        updateLayerConfig,
        updateTokenAssignment,
        registerManagerInstancesRef,
        registerCanvasUpdateFns,
        managerInstancesRef,
        setLiveConfig,
        reloadSceneOntoInactiveDeck,
        handleCrossfaderChange: (val) => {
            const engine = managerInstancesRef.current?.current?.engine;
            if(engine) engine.cancelFade();
            
            const state = useEngineStore.getState();
            state.setCrossfader(val);
            state.setRenderedCrossfader(val); 
            SignalBus.emit('crossfader:set', val);
            state.setEffectBaseValue('global.crossfader', val); 
        }
    }), [
        handleSceneSelect,
        updateLayerConfig,
        updateTokenAssignment,
        registerManagerInstancesRef,
        registerCanvasUpdateFns,
        managerInstancesRef,
        setLiveConfig,
        reloadSceneOntoInactiveDeck
    ]);

    return (
        <VisualEngineContext.Provider value={contextValue}>
            {children}
        </VisualEngineContext.Provider>
    );
};

export const useVisualEngineContext = () => {
    const context = useContext(VisualEngineContext);
    if (context === undefined) throw new Error("useVisualEngineContext must be used within a VisualEngineProvider");
    
    const storeState = useEngineStore(useShallow(state => ({
        sideA: state.sideA,
        sideB: state.sideB,
        isAutoFading: state.isAutoFading,
        targetSceneName: state.targetSceneName,
        transitionMode: state.transitionMode,
        baseValues: state.baseValues,
        patches: state.patches,
        lfoSettings: state.lfoSettings // Added here
    })));
    
    const storeActions = useEngineStore.getState();

    // --- DEBOUNCED UPDATERS FOR STORE ---
    // These functions update the Zustand store (and thus React) but are debounced
    // to prevent thrashing during high-frequency slider dragging.
    
    const markAsDirty = () => useProjectStore.setState({ hasPendingChanges: true });

    // Memoize the debounced functions so they persist across renders
    const debouncedSetEffectBaseValue = useMemo(
        () => debounce((paramId, value) => {
            storeActions.setEffectBaseValue(paramId, value);
            markAsDirty();
        }, 300), // 300ms debounce
        [storeActions]
    );

    const debouncedAddPatch = useMemo(
        () => debounce((source, target, amount) => {
            storeActions.addPatch(source, target, amount);
            markAsDirty();
        }, 300),
        [storeActions]
    );

    // --- WRAPPERS ---
    
    const setModulationValueWrapper = useCallback((paramId, value) => {
        // 1. FAST PATH: Update Engine Immediately
        const engine = context.managerInstancesRef.current?.current?.engine;
        if (engine) engine.setModulationValue(paramId, value);
        
        // 2. SLOW PATH: Debounced Store Update
        debouncedSetEffectBaseValue(paramId, value);
    }, [context.managerInstancesRef, debouncedSetEffectBaseValue]);

    const addPatchWrapper = useCallback((source, target, amount) => {
        // 1. FAST PATH: Update Engine Immediately
        const engine = context.managerInstancesRef.current?.current?.engine;
        if (engine) engine.addModulationPatch(source, target, amount);
        
        // 2. SLOW PATH: Debounced Store Update
        debouncedAddPatch(source, target, amount);
    }, [context.managerInstancesRef, debouncedAddPatch]);

    const removePatchWrapper = useCallback((patchId) => {
        // Immediate update for removal (user click)
        storeActions.removePatch(patchId);
        const engine = context.managerInstancesRef.current?.current?.engine;
        if (engine) engine.removeModulationPatch(patchId);
        markAsDirty();
    }, [context.managerInstancesRef, storeActions]);

    const clearPatchesWrapper = useCallback(() => {
        // Immediate update for clear (user click)
        storeActions.clearAllPatches();
        const engine = context.managerInstancesRef.current?.current?.engine;
        if (engine) engine.clearModulationPatches();
        markAsDirty();
    }, [context.managerInstancesRef, storeActions]);

    // --- NEW: Reset Knobs Wrapper ---
    const resetBaseValuesWrapper = useCallback(() => {
        storeActions.resetBaseValues();
        const engine = context.managerInstancesRef.current?.current?.engine;
        if (engine) engine.modulationEngine.resetToDefaults();
        markAsDirty();
    }, [context.managerInstancesRef, storeActions]);

    const setLfoSettingWrapper = useCallback((lfoId, param, value) => {
        // LFO settings are usually sliders too, but less frequent. 
        // For consistency, we could debounce, but direct is okay for now 
        // as they aren't as heavy as the matrix patches.
        storeActions.setLfoSetting(lfoId, param, value);
        const engine = context.managerInstancesRef.current?.current?.engine;
        if (engine && engine.lfo) {
            engine.lfo.setConfig(lfoId, param, value);
        }
    }, [context.managerInstancesRef, storeActions]);

    return {
        ...context,
        sideA: storeState.sideA,
        sideB: storeState.sideB,
        renderedCrossfaderValue: storeActions.renderedCrossfader || 0.0, 
        uiControlConfig: (storeActions.renderedCrossfader < 0.5) ? storeState.sideA.config : storeState.sideB.config,
        isAutoFading: storeState.isAutoFading,
        targetSceneName: storeState.targetSceneName,
        baseValues: storeState.baseValues,
        patches: storeState.patches,
        transitionMode: storeState.transitionMode,
        lfoSettings: storeState.lfoSettings, 
        
        handleCrossfaderChange: context.handleCrossfaderChange, 
        handleCrossfaderCommit: storeActions.setCrossfader,
        
        setModulationValue: setModulationValueWrapper, // Debounced
        addPatch: addPatchWrapper, // Debounced
        
        toggleTransitionMode: () => storeActions.setTransitionMode(storeState.transitionMode === 'crossfade' ? 'flythrough' : 'crossfade'),
        
        removePatch: removePatchWrapper,
        clearAllPatches: clearPatchesWrapper,
        resetBaseValues: resetBaseValuesWrapper, // New export
        setLfoSetting: setLfoSettingWrapper
    };
};