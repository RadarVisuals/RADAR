// src/context/VisualEngineContext.jsx
import React, { createContext, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../store/useProjectStore';
import { lerp } from '../utils/helpers';
import { useEngineStore } from '../store/useEngineStore';
import fallbackConfig from '../config/fallback-config.js';
import SignalBus from '../utils/SignalBus';

const VisualEngineContext = createContext(null);
const AUTO_FADE_DURATION_MS = 1000;
const CROSSFADER_LERP_FACTOR = 0.2;

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export const VisualEngineProvider = ({ children }) => {
    const { 
        stagedWorkspace: stagedActiveWorkspace, 
        activeSceneName, 
        isLoading,
        isConfigReady,
        activeWorkspaceName
    } = useProjectStore(useShallow(s => ({
        stagedWorkspace: s.stagedWorkspace,
        activeSceneName: s.activeSceneName,
        isLoading: s.isLoading,
        isConfigReady: s.isConfigReady,
        activeWorkspaceName: s.activeWorkspaceName
    })));

    const setActiveSceneName = useProjectStore(s => s.setActiveSceneName);
    const setHasPendingChanges = (val) => useProjectStore.setState({ hasPendingChanges: val });
    
    const isFullyLoaded = !isLoading && !!activeWorkspaceName;
    const fullSceneList = useMemo(() => 
        Object.values(stagedActiveWorkspace?.presets || {})
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })), 
    [stagedActiveWorkspace]);
    
    const isWorkspaceTransitioning = false; 

    const prevIsFullyLoaded = usePrevious(isFullyLoaded);
    const prevIsWorkspaceTransitioning = usePrevious(isWorkspaceTransitioning);
    const prevActiveSceneName = usePrevious(activeSceneName);
    const prevFullSceneList = usePrevious(fullSceneList);

    const faderAnimationRef = useRef();
    const autoFadeRef = useRef(null);
    const renderedValueRef = useRef(0.0);
    const managerInstancesRef = useRef(null);
    const canvasUpdateFnsRef = useRef({});
    
    const engineRef = useRef(null); 

    const registerManagerInstancesRef = useCallback((ref) => { managerInstancesRef.current = ref; }, []);
    const registerCanvasUpdateFns = useCallback((fns) => { canvasUpdateFnsRef.current = fns; }, []);

    const pushCrossfaderUpdate = useCallback((value) => {
        renderedValueRef.current = value;
        SignalBus.emit('crossfader:update', value);
    }, []);

    // --- INITIALIZATION & SCENE LOADING LOGIC ---
    useEffect(() => {
        const initialLoadJustFinished = !prevIsFullyLoaded && isFullyLoaded;
        const transitionJustFinished = prevIsWorkspaceTransitioning && !isWorkspaceTransitioning;
        const sceneNameChanged = activeSceneName !== prevActiveSceneName;
        const sceneListChanged = prevFullSceneList !== fullSceneList;
        
        const store = useEngineStore.getState();
        const isStoreEmpty = !store.sideA.config && !store.sideB.config;

        if (initialLoadJustFinished || transitionJustFinished || (isFullyLoaded && isStoreEmpty)) {
            // Case 1: No scenes found -> Fallback
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
                pushCrossfaderUpdate(0.0);
                if (activeSceneName) setActiveSceneName(null);
                return;
            }

            // Case 2: Scenes exist -> Load Default
            if (!isLoading && fullSceneList && fullSceneList.length > 0) {
                const initialSceneName = stagedActiveWorkspace.defaultPresetName || fullSceneList[0]?.name;
                let startIndex = fullSceneList.findIndex(p => p.name === initialSceneName);
                if (startIndex === -1) startIndex = 0;
                
                const nextIndex = fullSceneList.length > 1 ? (startIndex + 1) % fullSceneList.length : startIndex;
                
                const startSceneConfig = JSON.parse(JSON.stringify(fullSceneList[startIndex]));
                const nextSceneConfig = JSON.parse(JSON.stringify(fullSceneList[nextIndex]));
                
                const initialFaderValue = 0.0;

                store.setDeckConfig('A', startSceneConfig);
                store.setDeckConfig('B', nextSceneConfig);
                store.setCrossfader(initialFaderValue);
                store.setRenderedCrossfader(initialFaderValue);
                pushCrossfaderUpdate(initialFaderValue);

                if (activeSceneName !== startSceneConfig.name) {
                    setActiveSceneName(startSceneConfig.name);
                }
            }
        } 
        // Case 3: Scene Switched via UI
        else if ((sceneNameChanged || sceneListChanged) && isFullyLoaded && !store.isAutoFading) {
            if (!activeSceneName || !fullSceneList || fullSceneList.length === 0) return;
            const newActiveSceneData = fullSceneList.find(scene => scene.name === activeSceneName);
            if (!newActiveSceneData) return;

            const currentSideA = store.sideA.config;
            const currentSideB = store.sideB.config;
            const isOnDeckA = currentSideA?.name === activeSceneName;
            const isOnDeckB = currentSideB?.name === activeSceneName;

            if (!isOnDeckA && !isOnDeckB) {
                const activeDeckIsA = renderedValueRef.current < 0.5;
                const deckToSet = activeDeckIsA ? 'A' : 'B';
                store.setDeckConfig(deckToSet, JSON.parse(JSON.stringify(newActiveSceneData)));
            }

            const currentIndex = fullSceneList.findIndex(scene => scene.name === activeSceneName);
            if (currentIndex === -1) return;
            
            const nextIndex = (currentIndex + 1) % fullSceneList.length;
            const nextSceneData = JSON.parse(JSON.stringify(fullSceneList[nextIndex]));
            const activeDeckIsNowA = renderedValueRef.current < 0.5;
            
            if (activeDeckIsNowA) {
                if (currentSideB?.name !== nextSceneData.name) store.setDeckConfig('B', nextSceneData);
            } else {
                if (currentSideA?.name !== nextSceneData.name) store.setDeckConfig('A', nextSceneData);
            }
        }
    }, [
        isWorkspaceTransitioning, isFullyLoaded, stagedActiveWorkspace, fullSceneList, 
        prevIsFullyLoaded, prevIsWorkspaceTransitioning, activeSceneName, prevActiveSceneName, 
        prevFullSceneList, setActiveSceneName, isLoading, pushCrossfaderUpdate
    ]);

    useEffect(() => {
        const animateFader = () => {
            const state = useEngineStore.getState();
            const current = renderedValueRef.current;
            const target = state.crossfader;
            const isAuto = state.isAutoFading;
            let newRendered;

            if (!isAuto) {
                if (Math.abs(target - current) > 0.0001) {
                    newRendered = lerp(current, target, CROSSFADER_LERP_FACTOR);
                } else {
                    newRendered = target; 
                }
                
                pushCrossfaderUpdate(newRendered);

                const isSettled = Math.abs(target - newRendered) < 0.0001;
                if (isSettled) {
                    const currentSideA = state.sideA.config;
                    const currentSideB = state.sideB.config;
                    
                    if (target === 1.0) {
                        const sceneNameB = currentSideB?.name;
                        if (sceneNameB && activeSceneName !== sceneNameB) setActiveSceneName(sceneNameB);
                    } else if (target === 0.0) {
                        const sceneNameA = currentSideA?.name;
                        if (sceneNameA && activeSceneName !== sceneNameA) setActiveSceneName(sceneNameA);
                    }
                    
                    if (state.renderedCrossfader !== newRendered) {
                        state.setRenderedCrossfader(newRendered);
                    }
                }
            }
            faderAnimationRef.current = requestAnimationFrame(animateFader);
        };
        faderAnimationRef.current = requestAnimationFrame(animateFader);
        return () => { if (faderAnimationRef.current) cancelAnimationFrame(faderAnimationRef.current); };
    }, [activeSceneName, setActiveSceneName, pushCrossfaderUpdate]);

    const animateCrossfade = useCallback((startTime, startValue, endValue, duration, targetSceneNameParam) => {
        const now = performance.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const newCrossfaderValue = startValue + (endValue - startValue) * progress;
        
        pushCrossfaderUpdate(newCrossfaderValue);
        
        if (progress < 1) {
            autoFadeRef.current = requestAnimationFrame(() => animateCrossfade(startTime, startValue, endValue, duration, targetSceneNameParam));
        } else {
            const { setIsAutoFading, setCrossfader, setTargetSceneName, setRenderedCrossfader } = useEngineStore.getState();
            
            setIsAutoFading(false);
            setCrossfader(endValue);
            setRenderedCrossfader(endValue);
            
            setActiveSceneName(targetSceneNameParam);
            setTargetSceneName(null);
            autoFadeRef.current = null;
        }
    }, [setActiveSceneName, pushCrossfaderUpdate]);

    const handleSceneSelect = useCallback((sceneName, duration = AUTO_FADE_DURATION_MS) => {
        const state = useEngineStore.getState();
        const { isAutoFading, sideA, sideB, setDeckConfig, setIsAutoFading, setTargetSceneName } = state;

        if (isAutoFading || !fullSceneList || fullSceneList.length === 0) return;
        
        setTargetSceneName(sceneName);
        const targetScene = fullSceneList.find(s => s.name === sceneName);
        if (!targetScene) return;
        
        const activeDeckIsA = renderedValueRef.current < 0.5;
        const currentConfig = activeDeckIsA ? sideA.config : sideB.config;
        
        if (currentConfig?.name === sceneName) return; 

        const syncIncomingDeck = (targetDeck) => {
            const managers = managerInstancesRef.current?.current;
            if (managers) {
                Object.values(managers).forEach(manager => {
                    if (manager.syncPhysics) manager.syncPhysics(targetDeck);
                });
            }
        };

        if (activeDeckIsA) { 
            syncIncomingDeck('B'); 
            setDeckConfig('B', JSON.parse(JSON.stringify(targetScene)));
            setIsAutoFading(true); 
            animateCrossfade(performance.now(), renderedValueRef.current, 1.0, duration, sceneName); 
        } else { 
            syncIncomingDeck('A'); 
            setDeckConfig('A', JSON.parse(JSON.stringify(targetScene)));
            setIsAutoFading(true); 
            animateCrossfade(performance.now(), renderedValueRef.current, 0.0, duration, sceneName); 
        }
    }, [fullSceneList, animateCrossfade]);

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
            const state = useEngineStore.getState();
            state.setCrossfader(val);
            pushCrossfaderUpdate(val);
            // --- SYNC WITH MODULATION ENGINE ---
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
        reloadSceneOntoInactiveDeck,
        pushCrossfaderUpdate
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
    
    // --- UPDATED SELECTOR ---
    const storeState = useEngineStore(useShallow(state => ({
        sideA: state.sideA,
        sideB: state.sideB,
        isAutoFading: state.isAutoFading,
        targetSceneName: state.targetSceneName,
        transitionMode: state.transitionMode,
        baseValues: state.baseValues,
        patches: state.patches
    })));
    
    const storeActions = useEngineStore.getState();

    // 1. WRAPPER FOR BASE VALUES (Sliders)
    const updateEffectConfigWrapper = useCallback((name, param, value) => {
        const fullId = `${name}.${param}`;
        
        // Update Store (UI)
        storeActions.setEffectBaseValue(fullId, value);
        
        // Update Engine (Physics)
        const engine = context.managerInstancesRef.current?.current?.engine;
        if (engine) engine.updateEffectConfig(name, param, value);
    }, [context.managerInstancesRef, storeActions]);

    // 2. WRAPPER FOR ADDING PATCHES (Wires)
    const addPatchWrapper = useCallback((source, target, amount) => {
        // Update Store (UI)
        storeActions.addPatch(source, target, amount);
        
        // Update Engine (Physics)
        const engine = context.managerInstancesRef.current?.current?.engine;
        if (engine) engine.addModulationPatch(source, target, amount);
    }, [context.managerInstancesRef, storeActions]);

    // 3. WRAPPER FOR REMOVING PATCHES
    const removePatchWrapper = useCallback((patchId) => {
        storeActions.removePatch(patchId);
        const engine = context.managerInstancesRef.current?.current?.engine;
        if (engine) engine.removeModulationPatch(patchId);
    }, [context.managerInstancesRef, storeActions]);

    // 4. WRAPPER FOR CLEARING ALL
    const clearPatchesWrapper = useCallback(() => {
        storeActions.clearAllPatches();
        const engine = context.managerInstancesRef.current?.current?.engine;
        if (engine) engine.clearModulationPatches();
    }, [context.managerInstancesRef, storeActions]);

    return {
        ...context,
        sideA: storeState.sideA,
        sideB: storeState.sideB,
        renderedCrossfaderValue: storeActions.renderedCrossfader || 0.0, 
        uiControlConfig: (storeActions.renderedCrossfader < 0.5) ? storeState.sideA.config : storeState.sideB.config,
        isAutoFading: storeState.isAutoFading,
        targetSceneName: storeState.targetSceneName,
        
        // New State Exports
        baseValues: storeState.baseValues,
        patches: storeState.patches,
        transitionMode: storeState.transitionMode,
        
        handleCrossfaderChange: context.handleCrossfaderChange, 
        handleCrossfaderCommit: storeActions.setCrossfader,
        updateEffectConfig: updateEffectConfigWrapper, 
        toggleTransitionMode: () => storeActions.setTransitionMode(storeState.transitionMode === 'crossfade' ? 'flythrough' : 'crossfade'),
        
        // --- EXPORT THE WRAPPERS, NOT THE RAW ACTIONS ---
        addPatch: addPatchWrapper,
        removePatch: removePatchWrapper,
        clearAllPatches: clearPatchesWrapper
    };
};