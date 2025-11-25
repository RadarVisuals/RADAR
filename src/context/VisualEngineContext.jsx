// src/context/VisualEngineContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useWorkspaceContext } from './WorkspaceContext';
import { useMIDI } from './MIDIContext';
import fallbackConfig from '../config/fallback-config.js';
import { lerp } from '../utils/helpers.js';
import { INTERPOLATED_MIDI_PARAMS } from '../config/midiConstants.js';

const AUTO_FADE_DURATION_MS = 1000;
const CROSSFADER_LERP_FACTOR = 0.2;

const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => { ref.current = value; });
  return ref.current;
};

const VisualEngineContext = createContext();

export const VisualEngineProvider = ({ children }) => {
    const { 
        isWorkspaceTransitioning, isFullyLoaded, stagedActiveWorkspace, 
        fullSceneList, setActiveSceneName, setHasPendingChanges,
        activeSceneName, isLoading,
    } = useWorkspaceContext();

    const { midiStateRef } = useMIDI();

    const [sideA, setSideA] = useState({ config: null });
    const [sideB, setSideB] = useState({ config: null });
    const [targetCrossfaderValue, setTargetCrossfaderValue] = useState(0.0);
    const [renderedCrossfaderValue, setRenderedCrossfaderValue] = useState(0.0);
    const renderedValueRef = useRef(0.0);
    const [isAutoFading, setIsAutoFading] = useState(false);
    const [targetSceneName, setTargetSceneName] = useState(null);
    
    // --- NEW STATE FOR PROJECTION MAPPING ---
    const [isMappingMode, setIsMappingMode] = useState(false);
    // ----------------------------------------

    // --- Effects State ---
    const [effectsConfig, setEffectsConfig] = useState({
        bloom: { enabled: false, intensity: 1.0, blur: 8, threshold: 0.5 },
        rgb: { enabled: false, amount: 2 },
        pixelate: { enabled: false, size: 10 },
        twist: { enabled: false, radius: 400, angle: 4, offset: { x: 0, y: 0 } },
        zoomBlur: { enabled: false, strength: 0.1, innerRadius: 50 },
        crt: { enabled: false, curvature: 1, lineWidth: 1, noise: 0.1 },
        kaleidoscope: { enabled: false, sides: 6, angle: 0 },
        
        liquid: { enabled: false, intensity: 0.02, scale: 3.0, speed: 0.5 },
        volumetric: { enabled: false, exposure: 0.3, decay: 0.95, density: 0.8, weight: 0.4, threshold: 0.5, x: 0.5, y: 0.5 },
        waveDistort: { enabled: false, intensity: 0.5 },
        oldFilm: { enabled: false, noise: 0.3, scratch: 0.1, vignetting: 0.3 }
    });

    const faderAnimationRef = useRef();
    const autoFadeRef = useRef(null);
    const managerInstancesRef = useRef(null);
    const canvasUpdateFnsRef = useRef({});
  
    const registerManagerInstancesRef = useCallback((ref) => { managerInstancesRef.current = ref; }, []);
    const registerCanvasUpdateFns = useCallback((fns) => { canvasUpdateFnsRef.current = fns; }, []);

    const prevIsWorkspaceTransitioning = usePrevious(isWorkspaceTransitioning);
    const prevIsFullyLoaded = usePrevious(isFullyLoaded);
    const prevActiveSceneName = usePrevious(activeSceneName);
    const prevFullSceneList = usePrevious(fullSceneList);

    const uiControlConfig = useMemo(() => renderedValueRef.current < 0.5 ? sideA.config : sideB.config, [renderedCrossfaderValue, sideA.config, sideB.config]);

    // --- NEW TOGGLE FUNCTION ---
    const toggleMappingMode = useCallback(() => {
        setIsMappingMode(prev => {
            const newState = !prev;
            // Access Pixi Engine via ref and update mode
            const engine = managerInstancesRef.current?.engineRef?.current;
            if (engine) {
                engine.setMappingMode(newState);
            }
            return newState;
        });
    }, []);
    // ---------------------------

    useEffect(() => {
        return () => {
            if (faderAnimationRef.current) cancelAnimationFrame(faderAnimationRef.current);
            if (autoFadeRef.current) cancelAnimationFrame(autoFadeRef.current);
        };
    }, []);

    // ... (Existing useEffects for Crossfader Animation and Scene Loading remain unchanged) ...
    // [Omitted for brevity, keep existing code here]
    
    // Crossfader Animation Loop
    useEffect(() => {
        const animateFader = () => {
            const current = renderedValueRef.current;
            const target = targetCrossfaderValue;
            let newRendered;

            if (!isAutoFading) {
                if (Math.abs(target - current) > 0.0001) {
                    newRendered = lerp(current, target, CROSSFADER_LERP_FACTOR);
                } else {
                    newRendered = target; 
                }
                renderedValueRef.current = newRendered;
                setRenderedCrossfaderValue(newRendered);

                const isSettled = Math.abs(target - newRendered) < 0.0001;
                if (isSettled) {
                    if (target === 1.0) {
                        const sceneNameB = sideB.config?.name;
                        if (sceneNameB && activeSceneName !== sceneNameB) setActiveSceneName(sceneNameB);
                    } else if (target === 0.0) {
                        const sceneNameA = sideA.config?.name;
                        if (sceneNameA && activeSceneName !== sceneNameA) setActiveSceneName(sceneNameA);
                    }
                }
            }
            faderAnimationRef.current = requestAnimationFrame(animateFader);
        };
        faderAnimationRef.current = requestAnimationFrame(animateFader);
        return () => { if (faderAnimationRef.current) cancelAnimationFrame(faderAnimationRef.current); };
    }, [targetCrossfaderValue, isAutoFading, sideA.config, sideB.config, activeSceneName, setActiveSceneName]);

    const animateCrossfade = useCallback((startTime, startValue, endValue, duration, targetSceneNameParam) => {
        const now = performance.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const newCrossfaderValue = startValue + (endValue - startValue) * progress;
        setRenderedCrossfaderValue(newCrossfaderValue);
        renderedValueRef.current = newCrossfaderValue;
        if (progress < 1) {
            autoFadeRef.current = requestAnimationFrame(() => animateCrossfade(startTime, startValue, endValue, duration, targetSceneNameParam));
        } else {
            setIsAutoFading(false);
            setTargetCrossfaderValue(endValue);
            setActiveSceneName(targetSceneNameParam);
            setTargetSceneName(null);
            autoFadeRef.current = null;
        }
    }, [setIsAutoFading, setTargetCrossfaderValue, setActiveSceneName]);
    
    // Logic to handle scene loading, fallbacks, and deck assignments
    useEffect(() => {
        const initialLoadJustFinished = !prevIsFullyLoaded && isFullyLoaded;
        const transitionJustFinished = prevIsWorkspaceTransitioning && !isWorkspaceTransitioning;
        const sceneNameChanged = activeSceneName !== prevActiveSceneName;
        const sceneListChanged = prevFullSceneList !== fullSceneList;

        if (initialLoadJustFinished || transitionJustFinished) {
            const initialFaderValue = midiStateRef.current.liveCrossfaderValue !== null ? midiStateRef.current.liveCrossfaderValue : 0.0;
            if (!isLoading && (!fullSceneList || fullSceneList.length === 0)) {
                const baseScene = { name: "Fallback", ts: Date.now(), layers: JSON.parse(JSON.stringify(fallbackConfig.layers)), tokenAssignments: JSON.parse(JSON.stringify(fallbackConfig.tokenAssignments)) };
                setSideA({ config: baseScene }); setSideB({ config: baseScene });
                setActiveSceneName(null); setTargetCrossfaderValue(initialFaderValue); setRenderedCrossfaderValue(initialFaderValue); renderedValueRef.current = initialFaderValue;
                return;
            }
            if (!isLoading && fullSceneList && fullSceneList.length > 0) {
                const initialSceneName = stagedActiveWorkspace.defaultPresetName || fullSceneList[0]?.name;
                let startIndex = fullSceneList.findIndex(p => p.name === initialSceneName);
                if (startIndex === -1) startIndex = 0;
                const nextIndex = fullSceneList.length > 1 ? (startIndex + 1) % fullSceneList.length : startIndex;
                const startSceneConfig = JSON.parse(JSON.stringify(fullSceneList[startIndex]));
                const nextSceneConfig = JSON.parse(JSON.stringify(fullSceneList[nextIndex]));
                const activeSideIsA = initialFaderValue < 0.5;
                if (activeSideIsA) { setSideA({ config: startSceneConfig }); setSideB({ config: nextSceneConfig }); } else { setSideB({ config: startSceneConfig }); setSideA({ config: nextSceneConfig }); }
                setActiveSceneName(startSceneConfig.name); setTargetCrossfaderValue(initialFaderValue); setRenderedCrossfaderValue(initialFaderValue); renderedValueRef.current = initialFaderValue;
            }
        } else if ((sceneNameChanged || sceneListChanged) && isFullyLoaded && !isAutoFading) {
            if (!activeSceneName || !fullSceneList || fullSceneList.length === 0) return;
            const newActiveSceneData = fullSceneList.find(scene => scene.name === activeSceneName);
            if (!newActiveSceneData) return;
            const isOnDeckA = sideA.config?.name === activeSceneName;
            const isOnDeckB = sideB.config?.name === activeSceneName;
            if (!isOnDeckA && !isOnDeckB) {
                const activeDeckIsA = renderedValueRef.current < 0.5;
                if (activeDeckIsA) setSideA({ config: JSON.parse(JSON.stringify(newActiveSceneData)) });
                else setSideB({ config: JSON.parse(JSON.stringify(newActiveSceneData)) });
            }
            const currentIndex = fullSceneList.findIndex(scene => scene.name === activeSceneName);
            if (currentIndex === -1) return;
            const nextIndex = (currentIndex + 1) % fullSceneList.length;
            const nextSceneData = JSON.parse(JSON.stringify(fullSceneList[nextIndex]));
            const activeDeckIsNowA = renderedValueRef.current < 0.5;
            if (activeDeckIsNowA) { if (sideB.config?.name !== nextSceneData.name) setSideB({ config: nextSceneData }); } else { if (sideA.config?.name !== nextSceneData.name) setSideA({ config: nextSceneData }); }
        }
    }, [isWorkspaceTransitioning, isFullyLoaded, stagedActiveWorkspace, fullSceneList, prevIsFullyLoaded, prevIsWorkspaceTransitioning, activeSceneName, prevActiveSceneName, isAutoFading, midiStateRef, setActiveSceneName, isLoading, prevFullSceneList]);

    const handleSceneSelect = useCallback((sceneName, duration = AUTO_FADE_DURATION_MS) => {
        if (isAutoFading || !fullSceneList || fullSceneList.length === 0) return;
        setTargetSceneName(sceneName);
        const targetScene = fullSceneList.find(s => s.name === sceneName);
        if (!targetScene) return;
        const activeDeckIsA = renderedValueRef.current < 0.5;
        const activeSceneNameOnDeck = activeDeckIsA ? sideA.config?.name : sideB.config?.name;
        if (activeSceneNameOnDeck === sceneName) return;
        
        if (!activeDeckIsA && sideA.config?.name === sceneName) { setIsAutoFading(true); animateCrossfade(performance.now(), renderedValueRef.current, 0.0, duration, sceneName); return; }
        if (activeDeckIsA && sideB.config?.name === sceneName) { setIsAutoFading(true); animateCrossfade(performance.now(), renderedValueRef.current, 1.0, duration, sceneName); return; }
        if (activeDeckIsA) { setSideB({ config: JSON.parse(JSON.stringify(targetScene)) }); setIsAutoFading(true); animateCrossfade(performance.now(), renderedValueRef.current, 1.0, duration, sceneName); } else { setSideA({ config: JSON.parse(JSON.stringify(targetScene)) }); setIsAutoFading(true); animateCrossfade(performance.now(), renderedValueRef.current, 0.0, duration, sceneName); }
    }, [isAutoFading, fullSceneList, sideA.config, sideB.config, animateCrossfade]);

    const handleCrossfaderChange = useCallback((newValue) => { setTargetCrossfaderValue(newValue); }, []);
    const handleCrossfaderCommit = useCallback((finalValue) => { setTargetCrossfaderValue(finalValue); }, []);
    
    const updateLayerConfig = useCallback((layerId, key, value, isMidiUpdate = false) => {
        const managers = managerInstancesRef.current?.current;
        if (!managers) return;
        const manager = managers[String(layerId)];
        if (!manager) return;
        const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
        
        if (isMidiUpdate && INTERPOLATED_MIDI_PARAMS.includes(key)) {
          if (activeDeck === 'A') manager.setTargetValue(key, value); else manager.setTargetValueB(key, value);
        } else {
          if (activeDeck === 'A') manager.updateConfigProperty(key, value); else manager.updateConfigBProperty(key, value);
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
    }, [setHasPendingChanges]);

    const updateTokenAssignment = useCallback(async (token, layerId) => {
        const { setCanvasLayerImage } = canvasUpdateFnsRef.current;
        if (!setCanvasLayerImage) return;
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

        try { await setCanvasLayerImage(String(layerId), srcToLoad, idToSave); } catch (e) { console.error(e); }
        setHasPendingChanges(true);
    }, [setHasPendingChanges]);

    const setLiveConfig = useCallback((newSceneData) => {
          const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
          const stateSetter = activeDeck === 'A' ? setSideA : setSideB;
          stateSetter({ config: newSceneData });
          if (newSceneData?.name && activeSceneName !== newSceneData.name) setActiveSceneName(newSceneData.name);
        }, [activeSceneName, setActiveSceneName] 
    );

    const reloadSceneOntoInactiveDeck = useCallback((sceneName) => {
        if (!fullSceneList || fullSceneList.length === 0) return;
        const cleanSceneData = fullSceneList.find(s => s.name === sceneName);
        if (!cleanSceneData) return;
        const activeDeckIsA = renderedValueRef.current < 0.5;
        const stateSetter = activeDeckIsA ? setSideB : setSideA; // Set inactive
        stateSetter({ config: JSON.parse(JSON.stringify(cleanSceneData)) });
    }, [fullSceneList]);

    const updateEffectConfig = useCallback((effectName, param, value) => {
        setEffectsConfig(prev => ({
            ...prev,
            [effectName]: {
                ...prev[effectName],
                [param]: value
            }
        }));

        const managers = managerInstancesRef.current?.current;
        if (managers && managers['1'] && managers['1'].updateEffectConfig) {
            managers['1'].updateEffectConfig(effectName, param, value);
        }
    }, []);

    const contextValue = useMemo(() => ({
        sideA, sideB, uiControlConfig, renderedCrossfaderValue, isAutoFading, targetSceneName,
        effectsConfig,
        handleSceneSelect, handleCrossfaderChange, handleCrossfaderCommit,
        updateLayerConfig, updateTokenAssignment, updateEffectConfig,
        setLiveConfig, registerManagerInstancesRef, registerCanvasUpdateFns,
        managerInstancesRef, reloadSceneOntoInactiveDeck,
        // --- NEW EXPORTS ---
        isMappingMode,
        toggleMappingMode,
    }), [
        sideA, sideB, uiControlConfig, renderedCrossfaderValue, isAutoFading, targetSceneName,
        effectsConfig,
        handleSceneSelect, handleCrossfaderChange, handleCrossfaderCommit, 
        updateLayerConfig, updateTokenAssignment, updateEffectConfig,
        setLiveConfig, registerManagerInstancesRef, registerCanvasUpdateFns, 
        managerInstancesRef, reloadSceneOntoInactiveDeck,
        // --- NEW DEPS ---
        isMappingMode,
        toggleMappingMode
    ]);

    return (
        <VisualEngineContext.Provider value={contextValue}>
            {children}
        </VisualEngineContext.Provider>
    );
};

VisualEngineProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useVisualEngineContext = () => {
    const context = useContext(VisualEngineContext);
    if (context === undefined) {
        throw new Error("useVisualEngineContext must be used within a VisualEngineProvider");
    }
    return context;
};