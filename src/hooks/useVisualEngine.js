// src/hooks/useVisualEngine.js
import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../store/useProjectStore';
import { useEngineStore } from '../store/useEngineStore';
import { useVisualEffects } from './useVisualEffects'; 
import { getPixiEngine } from './usePixiOrchestrator';
import { syncBridge } from '../utils/SyncBridge';
import SignalBus from '../utils/SignalBus';

const AUTO_FADE_DURATION_MS = 1000;

export const useVisualEngine = () => {
    const { stagedWorkspace, activeSceneName, isLoading, activeWorkspaceName, setActiveSceneName, loadWorkspace, preloadWorkspace, setHasPendingChanges 
    } = useProjectStore(useShallow(s => ({ stagedWorkspace: s.stagedWorkspace, activeSceneName: s.activeSceneName, isLoading: s.isLoading, activeWorkspaceName: s.activeWorkspaceName, setActiveSceneName: s.setActiveSceneName, loadWorkspace: s.loadWorkspace, preloadWorkspace: s.preloadWorkspace, setHasPendingChanges: s.setHasPendingChanges })));

    const engineState = useEngineStore(useShallow(s => ({ sideA: s.sideA, sideB: s.sideB, isAutoFading: s.isAutoFading, crossfader: s.crossfader, transitionMode: s.transitionMode, baseValues: s.baseValues, patches: s.patches, lfoSettings: s.lfoSettings })));
    const storeActions = useEngineStore.getState();
    const isFullyLoaded = !isLoading && !!activeWorkspaceName;

    const updateLayerConfig = useCallback((layerId, key, value, isMidiUpdate = false, skipStoreUpdate = false) => {
        const engine = getPixiEngine();
        const activeDeck = engineState.crossfader < 0.5 ? 'A' : 'B';
        syncBridge.sendParamUpdate(layerId, key, value);
        if (engine) {
            if (isMidiUpdate) engine.updateConfig(layerId, key, value, activeDeck);
            else engine.snapConfig(layerId, { [key]: value }, activeDeck);
        }
        if (!skipStoreUpdate) { storeActions.updateActiveDeckConfig(layerId, key, value); setHasPendingChanges(true); }
    }, [engineState.crossfader, storeActions, setHasPendingChanges]);

    const { processEffect, createDefaultEffect } = useVisualEffects(updateLayerConfig);

    const handleSceneSelect = useCallback((sceneName, duration = AUTO_FADE_DURATION_MS) => {
        const engine = getPixiEngine();
        const { isAutoFading, crossfader, sideA, sideB } = useEngineStore.getState();
        const targetScene = stagedWorkspace?.presets?.[sceneName];
        if (!engine || isAutoFading || !targetScene) return;
        const activeDeckIsA = crossfader < 0.5;
        const currentConfig = activeDeckIsA ? sideA.config : sideB.config;
        if (currentConfig?.name === sceneName && activeSceneName === sceneName) return; 

        storeActions.setTargetSceneName(sceneName);

        if (activeDeckIsA) { 
            ['1','2','3'].forEach(id => engine.syncDeckPhysics(id, 'B'));
            storeActions.setDeckConfig('B', JSON.parse(JSON.stringify(targetScene)));
            storeActions.setIsAutoFading(true); 
            engine.fadeTo(1.0, duration, () => {
                storeActions.setIsAutoFading(false); storeActions.setCrossfader(1.0); storeActions.setRenderedCrossfader(1.0);
                setActiveSceneName(sceneName); storeActions.setTargetSceneName(null); SignalBus.emit('crossfader:set', 1.0);
            });
        } else { 
            ['1','2','3'].forEach(id => engine.syncDeckPhysics(id, 'A'));
            storeActions.setDeckConfig('A', JSON.parse(JSON.stringify(targetScene)));
            storeActions.setIsAutoFading(true); 
            engine.fadeTo(0.0, duration, () => {
                storeActions.setIsAutoFading(false); storeActions.setCrossfader(0.0); storeActions.setRenderedCrossfader(0.0);
                setActiveSceneName(sceneName); storeActions.setTargetSceneName(null); SignalBus.emit('crossfader:set', 0.0);
            });
        }
    }, [stagedWorkspace, setActiveSceneName, storeActions, activeSceneName]);

    return {
        ...engineState, stagedWorkspace, activeSceneName, isLoading, activeWorkspaceName, loadWorkspace, preloadWorkspace, renderedCrossfaderValue: engineState.crossfader, 
        uiControlConfig: (engineState.crossfader < 0.5) ? engineState.sideA.config : engineState.sideB.config,
        isFullyLoaded, processEffect, createDefaultEffect,
        setModulationValue: (paramId, value) => { const engine = getPixiEngine(); if (engine) engine.setModulationValue(paramId, value); storeActions.setEffectBaseValue(paramId, value); syncBridge.sendModValue(paramId, value); setHasPendingChanges(true); },
        addPatch: (source, target, amount) => { const engine = getPixiEngine(); if (engine) engine.addModulationPatch(source, target, amount); storeActions.addPatch(source, target, amount); syncBridge.sendPatchAdd(source, target, amount); setHasPendingChanges(true); },
        removePatch: (patchId) => { const engine = getPixiEngine(); if (engine) engine.removeModulationPatch(patchId); storeActions.removePatch(patchId); syncBridge.sendPatchRemove(patchId); setHasPendingChanges(true); },
        clearAllPatches: () => { const engine = getPixiEngine(); if (engine) engine.clearModulationPatches(); storeActions.clearAllPatches(); setHasPendingChanges(true); },
        resetBaseValues: () => { storeActions.resetBaseValues(); const engine = getPixiEngine(); if (engine) { const defaults = storeActions.baseValues; Object.entries(defaults).forEach(([id, val]) => { engine.setModulationValue(id, val); syncBridge.sendModValue(id, val); }); } setHasPendingChanges(true); },
        setLfoSetting: (lfoId, param, value) => { const engine = getPixiEngine(); if (engine) engine.lfo.setConfig(lfoId, param, value); storeActions.setLfoSetting(lfoId, param, value); syncBridge.sendLfoConfig(lfoId, param, value); setHasPendingChanges(true); },
        handleSceneSelect,
        handleCrossfaderChange: (val) => { const engine = getPixiEngine(); if(engine) engine.cancelFade(); syncBridge.sendCrossfader(val); storeActions.setCrossfader(val); storeActions.setRenderedCrossfader(val); SignalBus.emit('crossfader:set', val); storeActions.setEffectBaseValue('global.crossfader', val); },
        handleCrossfaderCommit: (val) => storeActions.setCrossfader(val),
        toggleTransitionMode: () => storeActions.setTransitionMode(engineState.transitionMode === 'crossfade' ? 'flythrough' : 'crossfade'),
        updateLayerConfig,
        updateTokenAssignment: async (token, layerId) => { const engine = getPixiEngine(); if (!engine) return; const activeSide = engineState.crossfader < 0.5 ? 'A' : 'B'; await engine.setTexture(String(layerId), activeSide, token.metadata?.image, token.id); const currentDeck = activeSide === 'A' ? engineState.sideA : engineState.sideB; if (currentDeck.config) { const newConfig = JSON.parse(JSON.stringify(currentDeck.config)); if (!newConfig.tokenAssignments) newConfig.tokenAssignments = {}; newConfig.tokenAssignments[String(layerId)] = { id: token.id, src: token.metadata?.image }; storeActions.setDeckConfig(activeSide, newConfig); } setHasPendingChanges(true); },
    };
};