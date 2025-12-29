// src/hooks/useVisualEngine.js
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../store/useProjectStore';
import { useEngineStore } from '../store/useEngineStore';
import { getPixiEngine } from './usePixiOrchestrator';
import SignalBus from '../utils/SignalBus';

const AUTO_FADE_DURATION_MS = 1000;

/**
 * useVisualEngine
 * 
 * Provides access to the Visual Engine's state and actions (Scene selection, Layer updates, Crossfader).
 */
export const useVisualEngine = () => {
    // 1. PROJECT STORE SELECTORS (Workspace & Scene management)
    const stagedWorkspace = useProjectStore(s => s.stagedWorkspace);
    const activeSceneName = useProjectStore(s => s.activeSceneName);
    const isLoading = useProjectStore(s => s.isLoading);
    const activeWorkspaceName = useProjectStore(s => s.activeWorkspaceName);
    const setActiveSceneName = useProjectStore(s => s.setActiveSceneName);
    const loadWorkspace = useProjectStore(s => s.loadWorkspace);
    const preloadWorkspace = useProjectStore(s => s.preloadWorkspace);

    // 2. ENGINE STORE SELECTORS (Live visual state & Modulation)
    const engineState = useEngineStore(useShallow(s => ({
        sideA: s.sideA,
        sideB: s.sideB,
        isAutoFading: s.isAutoFading,
        crossfader: s.crossfader, 
        transitionMode: s.transitionMode,
        baseValues: s.baseValues,
        patches: s.patches,
        lfoSettings: s.lfoSettings,
    })));

    const storeActions = useEngineStore.getState();
    const isFullyLoaded = !isLoading && !!activeWorkspaceName;

    /**
     * SCENE SELECTION (Transition Logic)
     */
    const handleSceneSelect = useCallback((sceneName, duration = AUTO_FADE_DURATION_MS) => {
        const engine = getPixiEngine();
        const { isAutoFading, crossfader, sideA, sideB } = useEngineStore.getState();
        const targetScene = stagedWorkspace?.presets?.[sceneName];

        if (!engine || isAutoFading || !targetScene) return;
        
        const activeDeckIsA = crossfader < 0.5;
        const currentConfig = activeDeckIsA ? sideA.config : sideB.config;
        
        // --- UPDATED LOGIC: Allow scene re-selection if UI activeSceneName is null (fresh workspace) ---
        // We only block if both the Engine config AND the UI state agree we are already on this scene.
        if (currentConfig?.name === sceneName && activeSceneName === sceneName) return; 

        storeActions.setTargetSceneName(sceneName);

        if (activeDeckIsA) { 
            ['1','2','3'].forEach(id => engine.syncDeckPhysics(id, 'B'));
            storeActions.setDeckConfig('B', JSON.parse(JSON.stringify(targetScene)));
            storeActions.setIsAutoFading(true); 
            engine.fadeTo(1.0, duration, () => {
                storeActions.setIsAutoFading(false);
                storeActions.setCrossfader(1.0);
                storeActions.setRenderedCrossfader(1.0);
                setActiveSceneName(sceneName);
                storeActions.setTargetSceneName(null);
                SignalBus.emit('crossfader:set', 1.0);
            });
        } else { 
            ['1','2','3'].forEach(id => engine.syncDeckPhysics(id, 'A'));
            storeActions.setDeckConfig('A', JSON.parse(JSON.stringify(targetScene)));
            storeActions.setIsAutoFading(true); 
            engine.fadeTo(0.0, duration, () => {
                storeActions.setIsAutoFading(false);
                storeActions.setCrossfader(0.0);
                storeActions.setRenderedCrossfader(0.0);
                setActiveSceneName(sceneName);
                storeActions.setTargetSceneName(null);
                SignalBus.emit('crossfader:set', 0.0);
            });
        }
    }, [stagedWorkspace, setActiveSceneName, storeActions, activeSceneName]);

    return {
        // --- LIVE VISUAL STATE ---
        ...engineState,
        stagedWorkspace, 
        activeSceneName, 
        isLoading, 
        activeWorkspaceName,
        loadWorkspace, 
        preloadWorkspace,
        renderedCrossfaderValue: engineState.crossfader, 
        // Derived active config for UI binding
        uiControlConfig: (engineState.crossfader < 0.5) ? engineState.sideA.config : engineState.sideB.config,
        
        isFullyLoaded, // Exposed for lifecycle hook

        // --- MODULATION ENGINE INTERFACE ---
        setModulationValue: (paramId, value) => {
            const engine = getPixiEngine();
            if (engine) engine.setModulationValue(paramId, value);
            storeActions.setEffectBaseValue(paramId, value);
        },
        addPatch: (source, target, amount) => {
            const engine = getPixiEngine();
            if (engine) engine.addModulationPatch(source, target, amount);
            storeActions.addPatch(source, target, amount);
        },
        removePatch: (patchId) => {
            const engine = getPixiEngine();
            if (engine) engine.removeModulationPatch(patchId);
            storeActions.removePatch(patchId);
        },
        clearAllPatches: () => {
            const engine = getPixiEngine();
            if (engine) engine.clearModulationPatches();
            storeActions.clearAllPatches();
        },
        resetBaseValues: () => {
            storeActions.resetBaseValues();
            const engine = getPixiEngine();
            if (engine) {
                // Get fresh defaults from store after reset and push to Pixi
                const defaults = storeActions.baseValues;
                Object.entries(defaults).forEach(([id, val]) => engine.setModulationValue(id, val));
            }
        },
        setLfoSetting: (lfoId, param, value) => {
            const engine = getPixiEngine();
            if (engine) engine.lfo.setConfig(lfoId, param, value);
            storeActions.setLfoSetting(lfoId, param, value);
        },

        // --- UI ACTIONS ---
        handleSceneSelect,
        handleCrossfaderChange: (val) => {
            const engine = getPixiEngine();
            if(engine) engine.cancelFade();
            storeActions.setCrossfader(val);
            storeActions.setRenderedCrossfader(val); 
            SignalBus.emit('crossfader:set', val);
            // Link crossfader to the modulation matrix global source
            storeActions.setEffectBaseValue('global.crossfader', val); 
        },
        handleCrossfaderCommit: (val) => storeActions.setCrossfader(val),
        toggleTransitionMode: () => storeActions.setTransitionMode(
            engineState.transitionMode === 'crossfade' ? 'flythrough' : 'crossfade'
        ),

        /**
         * Update Layer Parameter
         * Bridges: React Slider -> Engine Store -> imperative Pixi Engine
         */
        updateLayerConfig: (layerId, key, value, isMidiUpdate = false, skipStoreUpdate = false) => {
            const engine = getPixiEngine();
            const activeDeck = engineState.crossfader < 0.5 ? 'A' : 'B';
            if (engine) {
                // MIDI updates are interpolated, manual slider updates are snapped
                if (isMidiUpdate) engine.updateConfig(layerId, key, value, activeDeck);
                else engine.snapConfig(layerId, { [key]: value }, activeDeck);
            }
            if (!skipStoreUpdate) {
                storeActions.updateActiveDeckConfig(layerId, key, value);
                useProjectStore.setState({ hasPendingChanges: true });
            }
        },

        /**
         * Update Layer Texture (Token)
         */
        updateTokenAssignment: async (token, layerId) => {
            const engine = getPixiEngine();
            if (!engine) return;
            const activeSide = engineState.crossfader < 0.5 ? 'A' : 'B';
            
            // Push to GPU
            await engine.setTexture(String(layerId), activeSide, token.metadata?.image, token.id);
            
            // Persist to Store
            const currentDeck = activeSide === 'A' ? engineState.sideA : engineState.sideB;
            if (currentDeck.config) {
                const newConfig = JSON.parse(JSON.stringify(currentDeck.config));
                if (!newConfig.tokenAssignments) newConfig.tokenAssignments = {};
                newConfig.tokenAssignments[String(layerId)] = { id: token.id, src: token.metadata?.image };
                storeActions.setDeckConfig(activeSide, newConfig);
            }
            useProjectStore.setState({ hasPendingChanges: true });
        }
    };
};