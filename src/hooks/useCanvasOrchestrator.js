// src/hooks/useCanvasOrchestrator.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVisualConfig } from '../context/VisualConfigContext';
import { useCanvasManagers } from './useCanvasManagers';
import debounce from '../utils/debounce';
import { demoAssetMap } from '../assets/DemoLayers/initLayers';
import { INTERPOLATED_MIDI_PARAMS } from '../config/midiConstants';
import CanvasManager from '../utils/CanvasManager';

const RESIZE_DEBOUNCE_DELAY = 250;

const defaultAssets = {
    1: demoAssetMap.DEMO_LAYER_4 || '',
    2: demoAssetMap.DEMO_LAYER_4 || '',
    3: demoAssetMap.DEMO_LAYER_4 || '',
};

export function useCanvasOrchestrator({ canvasRefs, configLoadNonce, isInitiallyResolved, pLockState, sideA, sideB, crossfaderValue }) {
    const isMountedRef = useRef(false);
    const [managersReady, setManagersReady] = useState(false);
    const [defaultImagesLoaded, setDefaultImagesLoaded] = useState(false);
    const lastProcessedNonceByOrchestratorRef = useRef(0);
    const prevLayerConfigsRef = useRef(null);
    
    const prevSideAConfigRef = useRef(null);
    const prevSideBConfigRef = useRef(null);

    const {
        managerInstancesRef,
        isInitialized: managersInitialized,
        setLayerImage: setLayerImageInternal,
        applyConfigurations: applyConfigsToManagersInternal,
        stopAllAnimations: stopAllAnimationsInternal,
        restartAllAnimations: restartAllAnimationsInternal,
        forceRedrawAll: forceRedrawAllInternal,
        handleResize: handleResizeInternal,
    } = useCanvasManagers(canvasRefs, defaultAssets);

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

    useEffect(() => {
        if (!managersReady || !isMountedRef.current || defaultImagesLoaded) return;
        const currentManagers = managerInstancesRef.current;
        const loadImages = async () => {
            const promises = Object.keys(currentManagers).map(layerId => {
                const manager = currentManagers[layerId];
                const src = defaultAssets[layerId];
                if (manager && src && typeof manager.setImage === "function") {
                    return manager.setImage(src).catch((e) => {
                        if (import.meta.env.DEV) console.error(`[CanvasOrchestrator] Default Image Load FAILED L${layerId}:`, e);
                        return Promise.reject(e);
                    });
                }
                return Promise.resolve();
            });
            try {
                await Promise.allSettled(promises);
                if (isMountedRef.current) setDefaultImagesLoaded(true);
            } catch (e) {
                 if (import.meta.env.DEV) console.error("[CanvasOrchestrator] Unexpected error in Promise.allSettled for default images:", e);
            }
        };
        loadImages();
    }, [managersReady, defaultImagesLoaded, managerInstancesRef]);

    const { layerConfigs: currentContextLayerConfigs } = useVisualConfig();

    const resolveImageUrl = useCallback((assignment, layerId) => {
        const fallbackSrc = defaultAssets[layerId] || defaultAssets['1'];
        if (!assignment) return fallbackSrc;
        if (typeof assignment === 'string' && assignment.startsWith("DEMO_LAYER_")) {
            return demoAssetMap[assignment] || fallbackSrc;
        }
        if (typeof assignment === 'object' && assignment !== null && assignment.src) {
            return assignment.src;
        }
        return fallbackSrc;
    }, []);

    useEffect(() => {
        if (!managersReady || !sideA?.config || !sideB?.config) return;
        const managers = managerInstancesRef.current;

        const setupSideA = async () => {
            const configA = sideA.config;
            prevSideAConfigRef.current = configA;
            const setupPromises = Object.keys(managers).map(async (layerIdStr) => {
                const manager = managers[layerIdStr];
                if (!manager) return;
                const layerConfigA = configA.layers?.[layerIdStr];
                const tokenA = configA.tokenAssignments?.[layerIdStr];
                if (!layerConfigA) return;
                const imageUrlA = resolveImageUrl(tokenA, layerIdStr);
                await manager.setImage(imageUrlA);
                manager.applyFullConfig(layerConfigA);
            });
            await Promise.all(setupPromises);
        };

        const setupSideB = async () => {
            const configB = sideB.config;
            prevSideBConfigRef.current = configB;
            const setupPromises = Object.keys(managers).map(async (layerIdStr) => {
                const manager = managers[layerIdStr];
                if (!manager) return;
                const layerConfigB = configB.layers?.[layerIdStr];
                const tokenB = configB.tokenAssignments?.[layerIdStr];
                if (!layerConfigB) return;
                const imageUrlB = resolveImageUrl(tokenB, layerIdStr);
                await manager.setCrossfadeTarget(imageUrlB, layerConfigB);
            });
            await Promise.all(setupPromises);
        };

        if (sideA.config !== prevSideAConfigRef.current) setupSideA();
        if (sideB.config !== prevSideBConfigRef.current) setupSideB();

    }, [sideA.config, sideB.config, managersReady, managerInstancesRef, resolveImageUrl]);

    useEffect(() => {
        if (!managersReady) return;
        const managers = managerInstancesRef.current;
        for (const layerIdStr in managers) {
            managers[layerIdStr]?.setCrossfadeValue(crossfaderValue);
        }
    }, [crossfaderValue, managersReady, managerInstancesRef]);

    useEffect(() => {
        if (crossfaderValue > 0.0001 && crossfaderValue < 0.9999) {
            return;
        }

        if (!isInitiallyResolved || pLockState === 'playing' || !managersReady || !currentContextLayerConfigs || !isMountedRef.current) return;
        if (configLoadNonce > lastProcessedNonceByOrchestratorRef.current) {
            lastProcessedNonceByOrchestratorRef.current = configLoadNonce;
            return;
        }

        const managers = managerInstancesRef.current;
        const prevConfigs = prevLayerConfigsRef.current;
        
        const activeDeckIsA = crossfaderValue < 0.5;

        for (const layerIdStr of ['1', '2', '3']) {
            const newConfig = currentContextLayerConfigs[layerIdStr];
            const oldConfig = prevConfigs?.[layerIdStr];
            const manager = managers[layerIdStr];
            if (!manager || !newConfig) continue;

            Object.keys(newConfig).forEach(key => {
                if (JSON.stringify(newConfig[key]) !== JSON.stringify(oldConfig?.[key])) {
                    if (activeDeckIsA) {
                        if (INTERPOLATED_MIDI_PARAMS.includes(key)) manager.snapVisualProperty?.(key, newConfig[key]);
                        else manager.updateConfigProperty?.(key, newConfig[key]);
                    } else {
                        manager.updateConfigBProperty?.(key, newConfig[key]);
                    }
                }
            });
        }
        prevLayerConfigsRef.current = JSON.parse(JSON.stringify(currentContextLayerConfigs));
    }, [currentContextLayerConfigs, managersReady, configLoadNonce, isInitiallyResolved, pLockState, managerInstancesRef, crossfaderValue]);

    // --- START MODIFICATION: Make setCanvasLayerImage crossfader-aware using existing methods ---
    const setCanvasLayerImage = useCallback((layerId, src) => {
        if (!managersReady) return Promise.reject(new Error("Managers not ready"));
        
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (!manager) {
            return Promise.reject(new Error(`Manager not found for layer ${layerId}`));
        }

        if (crossfaderValue < 0.5) {
            // Target Deck A when fader is on the left
            return manager.setImage(src);
        } else {
            // Target Deck B when fader is on the right
            const configBForLayer = sideB?.config?.layers?.[String(layerId)];
            if (configBForLayer) {
                // Use existing method with the new image src and the OLD config for Deck B
                return manager.setCrossfadeTarget(src, configBForLayer);
            } else {
                return Promise.reject(new Error(`Config for Deck B, layer ${layerId} not found.`));
            }
        }
    }, [managersReady, managerInstancesRef, crossfaderValue, sideB]);
    // --- END MODIFICATION ---

    const applyTokenAssignmentsToManagers = useCallback(async (assignments) => {
        if (!isMountedRef.current || !managersReady || !managerInstancesRef.current || !assignments) return;
        const currentManagers = managerInstancesRef.current;
        
        const activeDeckIsA = crossfaderValue < 0.5;

        const imageLoadPromises = Object.keys(currentManagers).map(layerId => {
            const manager = currentManagers[layerId];
            if (!manager) return Promise.resolve();
            const assignmentValue = assignments[layerId];
            const defaultSrc = defaultAssets[layerId];
            let srcToApply = defaultSrc;
            if (typeof assignmentValue === 'string' && assignmentValue.startsWith("DEMO_LAYER_")) {
                srcToApply = demoAssetMap[assignmentValue] || defaultSrc;
            } else if (typeof assignmentValue === 'object' && assignmentValue?.src) {
                srcToApply = assignmentValue.src;
            }

            let imageSetPromise;
            if (activeDeckIsA) {
                imageSetPromise = manager.setImage(srcToApply);
            } else {
                const configBForLayer = sideB?.config?.layers?.[String(layerId)];
                if (configBForLayer) {
                    imageSetPromise = manager.setCrossfadeTarget(srcToApply, configBForLayer);
                } else {
                    // Fallback to setting Deck A's image if B's config is missing, though this is less ideal.
                    imageSetPromise = manager.setImage(srcToApply);
                }
            }
            
            return imageSetPromise.catch(() => 
                activeDeckIsA ? manager.setImage(defaultSrc) : manager.setCrossfadeTarget(defaultSrc, sideB?.config?.layers?.[String(layerId)] || {})
            );
        });
        await Promise.allSettled(imageLoadPromises);
    }, [managersReady, managerInstancesRef, crossfaderValue, sideB]);

    const applyConfigurationsToManagers = useCallback((configs) => {
        if (!managersReady) return;
        applyConfigsToManagersInternal(configs);
        prevLayerConfigsRef.current = configs ? JSON.parse(JSON.stringify(configs)) : null;
        lastProcessedNonceByOrchestratorRef.current = configLoadNonce;
    }, [managersReady, applyConfigsToManagersInternal, configLoadNonce]);

    const stopCanvasAnimations = useCallback(() => stopAllAnimationsInternal(), [stopAllAnimationsInternal]);
    const restartCanvasAnimations = useCallback(() => {
        if (managersReady) restartAllAnimationsInternal();
    }, [managersReady, restartAllAnimationsInternal]);
    const redrawAllCanvases = useCallback(async (configs = null) => {
        if (!managersReady) return false;
        return forceRedrawAllInternal(configs);
    }, [managersReady, forceRedrawAllInternal]);
    const handleCanvasResize = useCallback(() => debouncedResizeHandler(), [debouncedResizeHandler]);

    const applyPlaybackValue = useCallback((layerId, key, value) => {
        managerInstancesRef.current[layerId]?.applyPlaybackValue(key, value);
    }, [managerInstancesRef]);

    const clearAllPlaybackValues = useCallback(() => {
        Object.values(managerInstancesRef.current).forEach(m => m.clearPlaybackValues());
    }, [managerInstancesRef]);

    return useMemo(() => ({
        managersReady,
        defaultImagesLoaded,
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
    }), [
        managersReady, defaultImagesLoaded, managerInstancesRef,
        applyConfigurationsToManagers, applyTokenAssignmentsToManagers,
        stopCanvasAnimations, restartCanvasAnimations, redrawAllCanvases,
        handleCanvasResize, setCanvasLayerImage, applyPlaybackValue, clearAllPlaybackValues
    ]);
}