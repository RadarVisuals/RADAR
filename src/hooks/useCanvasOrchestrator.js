// src/hooks/useCanvasOrchestrator.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCanvasManagers } from './useCanvasManagers';
import debounce from '../utils/debounce';
import { INTERPOLATED_MIDI_PARAMS } from '../config/midiConstants';
import CanvasManager from '../utils/CanvasManager';
import { resolveImageUrl } from '../utils/imageDecoder';

const RESIZE_DEBOUNCE_DELAY = 250;

export function useCanvasOrchestrator({ canvasRefs, isTransitioning, isInitiallyResolved, pLockState, sideA, sideB, crossfaderValue, currentActiveLayerConfigs, currentActiveTokenAssignments, activeWorkspaceName }) {
    const isMountedRef = useRef(false);
    const [managersReady, setManagersReady] = useState(false);
    
    // --- FIX: Store the entire side object to compare scene timestamps ---
    const prevSideARef = useRef(null);
    const prevSideBRef = useRef(null);
    // -----------------------------------------------------------------
    
    const prevTokenAssignmentsRef = useRef(null);

    const activeWorkspaceNameRef = useRef(activeWorkspaceName);
    useEffect(() => {
        activeWorkspaceNameRef.current = activeWorkspaceName;
    }, [activeWorkspaceName]);

    const {
        managerInstancesRef,
        isInitialized: managersInitialized,
        applyConfigurations: applyConfigsToManagersInternal,
        stopAllAnimations: stopAllAnimationsInternal,
        restartAllAnimations: restartAllAnimationsInternal,
        forceRedrawAll: forceRedrawAllInternal,
        handleResize: handleResizeInternal,
    } = useCanvasManagers(canvasRefs);

    const rawHandleResize = useRef(handleResizeInternal);
    const debouncedResizeHandler = useMemo(
        () => debounce(() => { if (rawHandleResize.current) rawHandleResize.current(); }, RESIZE_DEBOUNCE_DELAY),
        []
    );

    useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);
    useEffect(() => { rawHandleResize.current = handleResizeInternal; }, [handleResizeInternal]);

    useEffect(() => {
        if (managersInitialized && isMountedRef.current) {
            const allManagersExist = Object.keys(canvasRefs).every(
                (id) => managerInstancesRef.current?.[id] instanceof CanvasManager
            );
            if (managersReady !== allManagersExist) setManagersReady(allManagersExist);
        } else if (managersReady) {
            setManagersReady(false);
        }
    }, [managersInitialized, canvasRefs, managersReady, managerInstancesRef]);
    
    // --- START: THE DEFINITIVE FIX IS IN THIS useEffect ---
    useEffect(() => {
        if (!managersReady || !sideA?.config || !sideB?.config) return;
        
        const managers = managerInstancesRef.current;

        const setupSideA = async () => {
            console.log(`[CanvasOrchestrator] Setting up Deck A with scene: "${sideA.config.name}" from workspace: "${activeWorkspaceNameRef.current}"`);
            const setupPromises = Object.keys(managers).map(async (layerIdStr) => {
                const manager = managers[layerIdStr];
                if (!manager) return;
                const layerConfigA = sideA.config.layers?.[layerIdStr];
                const tokenA = sideA.config.tokenAssignments?.[layerIdStr];
                const imageUrlA = resolveImageUrl(tokenA);
                await manager.setImage(imageUrlA);
                manager.applyFullConfig(layerConfigA ? JSON.parse(JSON.stringify(layerConfigA)) : null);
            });
            await Promise.all(setupPromises);
        };

        const setupSideB = async () => {
            console.log(`[CanvasOrchestrator] Setting up Deck B with scene: "${sideB.config.name}" from workspace: "${activeWorkspaceNameRef.current}"`);
            const setupPromises = Object.keys(managers).map(async (layerIdStr) => {
                const manager = managers[layerIdStr];
                if (!manager) return;
                const layerConfigB = sideB.config.layers?.[layerIdStr];
                const tokenB = sideB.config.tokenAssignments?.[layerIdStr];
                const imageUrlB = resolveImageUrl(tokenB);
                await manager.setCrossfadeTarget(imageUrlB, layerConfigB ? JSON.parse(JSON.stringify(layerConfigB)) : null);
            });
            await Promise.all(setupPromises);
        };
        
        // **THE FIX**: Compare the unique scene timestamp (`ts`), not the scene name or object reference.
        if (sideA.config?.ts !== prevSideARef.current?.config?.ts) {
            setupSideA();
        }
        if (sideB.config?.ts !== prevSideBRef.current?.config?.ts) {
            setupSideB();
        }

        // Update the refs for the next render.
        prevSideARef.current = sideA;
        prevSideBRef.current = sideB;

    }, [sideA, sideB, managersReady, managerInstancesRef]);
    // --- END: THE DEFINITIVE FIX ---


    useEffect(() => {
        if (!managersReady) return;
        const managers = managerInstancesRef.current;
        for (const layerIdStr in managers) {
            managers[layerIdStr]?.setCrossfadeValue(crossfaderValue);
        }
    }, [crossfaderValue, managersReady, managerInstancesRef]);
    
    useEffect(() => {
        if (!managersReady || !isInitiallyResolved || !currentActiveTokenAssignments) {
            return;
        }
    
        if (JSON.stringify(prevTokenAssignmentsRef.current) === JSON.stringify(currentActiveTokenAssignments)) {
            return;
        }
    
        const managers = managerInstancesRef.current;
        const activeDeckIsA = crossfaderValue < 0.5;
    
        Object.keys(managers).forEach(layerIdStr => {
            const manager = managers[layerIdStr];
            if (!manager) return;
    
            const newAssignment = currentActiveTokenAssignments[layerIdStr];
            const oldAssignment = prevTokenAssignmentsRef.current?.[layerIdStr];
    
            if (JSON.stringify(newAssignment) !== JSON.stringify(oldAssignment)) {
                const imageUrl = resolveImageUrl(newAssignment);
                
                if (activeDeckIsA) {
                    manager.setImage(imageUrl).catch(e => console.error(`[Orchestrator] Error setting image for layer ${layerIdStr} on Deck A:`, e));
                } else {
                    const configBForLayer = sideB?.config?.layers?.[layerIdStr];
                    const configBCopy = configBForLayer ? JSON.parse(JSON.stringify(configBForLayer)) : null;
                    manager.setCrossfadeTarget(imageUrl, configBCopy).catch(e => console.error(`[Orchestrator] Error setting crossfade target for layer ${layerIdStr} on Deck B:`, e));
                }
            }
        });
    
        prevTokenAssignmentsRef.current = JSON.parse(JSON.stringify(currentActiveTokenAssignments));
    
    }, [managersReady, isInitiallyResolved, currentActiveTokenAssignments, managerInstancesRef, crossfaderValue, sideB]);

    const setCanvasLayerImage = useCallback((layerId, src) => {
        if (!managersReady) return Promise.reject(new Error("Managers not ready"));
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (!manager) return Promise.reject(new Error(`Manager not found for layer ${layerId}`));

        if (crossfaderValue < 0.5) {
            return manager.setImage(src);
        } else {
            const configBForLayer = sideB?.config?.layers?.[String(layerId)];
            const configBCopy = configBForLayer ? JSON.parse(JSON.stringify(configBForLayer)) : null;
            return manager.setCrossfadeTarget(src, configBCopy);
        }
    }, [managersReady, managerInstancesRef, crossfaderValue, sideB]);
    
    const transitionToScene = useCallback(async (newSceneConfig) => {
        if (!managersReady || !newSceneConfig || !newSceneConfig.layers || !newSceneConfig.tokenAssignments) return;
        
        const transitionPromises = Object.keys(managerInstancesRef.current).map(layerIdStr => {
            const manager = managerInstancesRef.current[layerIdStr];
            const layerConfig = newSceneConfig.layers[layerIdStr];
            const tokenAssignment = newSceneConfig.tokenAssignments[layerIdStr];
            const imageUrl = resolveImageUrl(tokenAssignment);
            if (manager) return manager.transitionTo(imageUrl, layerConfig);
            return Promise.resolve();
        });
        await Promise.all(transitionPromises);
    }, [managersReady, managerInstancesRef]);

    const applyTokenAssignmentsToManagers = useCallback(async (assignments) => {
        if (!isMountedRef.current || !managersReady || !managerInstancesRef.current) return;
        
        const safeAssignments = assignments || {};
        const currentManagers = managerInstancesRef.current;
        const activeDeckIsA = crossfaderValue < 0.5;

        const imageLoadPromises = Object.keys(currentManagers).map(layerId => {
            const manager = currentManagers[layerId];
            if (!manager) return Promise.resolve();

            const assignmentValue = safeAssignments[layerId];
            const srcToApply = resolveImageUrl(assignmentValue);
            
            let imageSetPromise;
            if (activeDeckIsA) {
                imageSetPromise = manager.setImage(srcToApply);
            } else {
                const configBForLayer = sideB?.config?.layers?.[String(layerId)];
                const configBCopy = configBForLayer ? JSON.parse(JSON.stringify(configBForLayer)) : null;
                imageSetPromise = manager.setCrossfadeTarget(srcToApply, configBCopy);
            }
            return imageSetPromise.catch(e => console.error(`Error applying token to layer ${layerId}:`, e));
        });
        await Promise.allSettled(imageLoadPromises);
    }, [managersReady, managerInstancesRef, crossfaderValue, sideB]);

    const applyConfigurationsToManagers = useCallback((configs) => {
        if (!managersReady) return;
        applyConfigsToManagersInternal(configs);
    }, [managersReady, applyConfigsToManagersInternal]);

    const stopCanvasAnimations = useCallback(() => stopAllAnimationsInternal(), [stopAllAnimationsInternal]);
    const restartCanvasAnimations = useCallback(() => { if (managersReady) restartAllAnimationsInternal(); }, [managersReady, restartAllAnimationsInternal]);
    const redrawAllCanvases = useCallback(async (configs = null) => { if (!managersReady) return false; return forceRedrawAllInternal(configs); }, [managersReady, forceRedrawAllInternal]);
    const handleCanvasResize = useCallback(() => debouncedResizeHandler(), [debouncedResizeHandler]);
    const applyPlaybackValue = useCallback((layerId, key, value) => { managerInstancesRef.current[layerId]?.applyPlaybackValue(key, value); }, [managerInstancesRef]);
    const clearAllPlaybackValues = useCallback(() => { Object.values(managerInstancesRef.current).forEach(m => m.clearPlaybackValues()); }, [managerInstancesRef]);

    return useMemo(() => ({
        managersReady,
        managerInstancesRef,
        applyConfigurationsToManagers,
        applyTokenAssignmentsToManagers,
        stopCanvasAnimations,
        restartCanvasAnimations,
        redrawAllCanvases,
        handleCanvasResize,
        setCanvasLayerImage,
        applyPlaybackValue,
        clearAllPlaybackValues,
        transitionToScene,
    }), [
        managersReady, managerInstancesRef,
        applyConfigurationsToManagers, applyTokenAssignmentsToManagers,
        stopCanvasAnimations, restartCanvasAnimations, redrawAllCanvases,
        handleCanvasResize, setCanvasLayerImage, applyPlaybackValue, clearAllPlaybackValues,
        transitionToScene
    ]);
}