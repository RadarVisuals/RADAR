// src/context/VisualEngineContext.jsx
import React, { createContext, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceContext } from './WorkspaceContext';
import { lerp } from '../utils/helpers';
import { useEngineStore } from '../store/useEngineStore';
import fallbackConfig from '../config/fallback-config.js';

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
        isWorkspaceTransitioning, isFullyLoaded, stagedActiveWorkspace, 
        fullSceneList, setActiveSceneName, setHasPendingChanges,
        activeSceneName, isLoading,
    } = useWorkspaceContext();

    const prevIsFullyLoaded = usePrevious(isFullyLoaded);
    const prevIsWorkspaceTransitioning = usePrevious(isWorkspaceTransitioning);
    const prevActiveSceneName = usePrevious(activeSceneName);
    const prevFullSceneList = usePrevious(fullSceneList);

    const faderAnimationRef = useRef();
    const autoFadeRef = useRef(null);
    const renderedValueRef = useRef(0.0);
    const managerInstancesRef = useRef(null);
    const canvasUpdateFnsRef = useRef({});
    
    // --- NEW: Access Full Industrial Config ---
    const industrialConfig = useEngineStore(state => state.industrialConfig);
    
    const engineRef = useRef(null); 

    const registerManagerInstancesRef = useCallback((ref) => { managerInstancesRef.current = ref; }, []);
    const registerCanvasUpdateFns = useCallback((fns) => { canvasUpdateFnsRef.current = fns; }, []);

    // --- NEW: SYNC INDUSTRIAL CONFIG ---
    useEffect(() => {
        if (managerInstancesRef.current?.current?.engine) {
             // Pass the whole config object to the engine
             managerInstancesRef.current.current.engine.setIndustrialConfig(industrialConfig);
        }
    }, [industrialConfig]);

    useEffect(() => {
        const handleAudioUpdate = (event) => {
            if (managerInstancesRef.current?.current?.engine) {
                managerInstancesRef.current.current.engine.setAudioData(event.detail);
            }
        };

        window.addEventListener('radar-audio-analysis', handleAudioUpdate);
        return () => window.removeEventListener('radar-audio-analysis', handleAudioUpdate);
    }, []);

    const pushCrossfaderUpdate = useCallback((value) => {
        renderedValueRef.current = value;
        if (managerInstancesRef.current?.current?.updateCrossfade) {
            managerInstancesRef.current.current.updateCrossfade(value);
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('radar-crossfader-update', { detail: value }));
        }
    }, []);

    useEffect(() => {
        const initialLoadJustFinished = !prevIsFullyLoaded && isFullyLoaded;
        const transitionJustFinished = prevIsWorkspaceTransitioning && !isWorkspaceTransitioning;
        const sceneNameChanged = activeSceneName !== prevActiveSceneName;
        const sceneListChanged = prevFullSceneList !== fullSceneList;
        const store = useEngineStore.getState();

        if (initialLoadJustFinished || transitionJustFinished) {
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
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('radar-param-update', { 
                    detail: { layerId: String(layerId), param: key, value: value } 
                }));
            }
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
    
    const storeState = useEngineStore(useShallow(state => ({
        sideA: state.sideA,
        sideB: state.sideB,
        isAutoFading: state.isAutoFading,
        targetSceneName: state.targetSceneName,
        effectsConfig: state.effectsConfig,
        transitionMode: state.transitionMode,
        // --- Added industrial config ---
        industrialConfig: state.industrialConfig
    })));
    
    const storeActions = useEngineStore.getState();

    const updateEffectConfigWrapper = useCallback((name, param, value) => {
        storeActions.updateEffectConfig(name, param, value);
        const managers = context.managerInstancesRef.current?.current;
        if (managers && managers['1']) {
             managers['1'].updateEffectConfig(name, param, value);
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
        effectsConfig: storeState.effectsConfig,
        transitionMode: storeState.transitionMode,
        industrialConfig: storeState.industrialConfig,
        
        handleCrossfaderChange: context.handleCrossfaderChange, 
        handleCrossfaderCommit: storeActions.setCrossfader,
        
        updateEffectConfig: updateEffectConfigWrapper, 
        toggleTransitionMode: () => storeActions.setTransitionMode(storeState.transitionMode === 'crossfade' ? 'flythrough' : 'crossfade'),
    };
};