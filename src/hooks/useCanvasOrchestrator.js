// src/hooks/useCanvasOrchestrator.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import debounce from '../utils/debounce';
import CanvasManager from '../utils/CanvasManager';
import { resolveImageUrl } from '../utils/imageDecoder';

const RESIZE_DEBOUNCE_DELAY = 250;

export function useCanvasOrchestrator({ canvasRefs, sideA, sideB, crossfaderValue, isInitiallyResolved, activeWorkspaceName }) {
    const isMountedRef = useRef(false);
    const [managersReady, setManagersReady] = useState(false);
    const [managers, setManagers] = useState({});
    const managerInstancesRef = useRef({});
    const resizeTimeoutRef = useRef(null);
    
    const activeWorkspaceNameRef = useRef(activeWorkspaceName);
    useEffect(() => {
        activeWorkspaceNameRef.current = activeWorkspaceName;
    }, [activeWorkspaceName]);

    useEffect(() => {
        const allRefsAreSet = Object.values(canvasRefs).every(deckRefs => 
            deckRefs.A?.current instanceof HTMLCanvasElement &&
            deckRefs.B?.current instanceof HTMLCanvasElement
        );
        if (!allRefsAreSet) return;

        const newManagers = {};
        Object.keys(canvasRefs).forEach(layerId => {
            const canvasElementA = canvasRefs[layerId]?.A?.current;
            const canvasElementB = canvasRefs[layerId]?.B?.current;
            if (canvasElementA && canvasElementB) {
                newManagers[layerId] = new CanvasManager(canvasElementA, canvasElementB, layerId);
            }
        });

        managerInstancesRef.current = newManagers;
        setManagers(newManagers);
        
        const allManagersExist = Object.keys(canvasRefs).every(id => managerInstancesRef.current?.[id] instanceof CanvasManager);
        setManagersReady(allManagersExist);

        const debouncedResize = debounce(() => {
            Object.values(managerInstancesRef.current).forEach(manager => {
                if (manager?.setupCanvas) manager.setupCanvas().catch(err => console.error(`Error during resize for layer ${manager.layerId}:`, err));
            });
        }, RESIZE_DEBOUNCE_DELAY);

        window.addEventListener('resize', debouncedResize, { passive: true });

        return () => {
            window.removeEventListener('resize', debouncedResize);
            Object.values(managerInstancesRef.current).forEach(manager => {
                if (manager?.destroy) manager.destroy();
            });
            managerInstancesRef.current = {};
        };
    }, [canvasRefs]);


    useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);
    
    useEffect(() => {
        if (!managersReady || !sideA?.config?.ts) return;
        const setup = async () => {
            const managers = managerInstancesRef.current;
            const setupPromises = Object.keys(managers).map(async (layerIdStr) => {
                const manager = managers[layerIdStr];
                if (!manager) return;
                const layerConfigA = sideA.config.layers?.[layerIdStr];
                const tokenA = sideA.config.tokenAssignments?.[layerIdStr];
                const imageUrlA = resolveImageUrl(tokenA);
                const tokenIdA = typeof tokenA === 'object' ? tokenA.id : tokenA;
                await manager.setImage(imageUrlA, tokenIdA);
                manager.applyFullConfig(layerConfigA ? JSON.parse(JSON.stringify(layerConfigA)) : null);
            });
            await Promise.all(setupPromises);
        };
        setup();
    }, [sideA.config?.ts, managersReady]);
    
    useEffect(() => {
        if (!managersReady || !sideB?.config?.ts) return;
        const setup = async () => {
            const managers = managerInstancesRef.current;
            const setupPromises = Object.keys(managers).map(async (layerIdStr) => {
                const manager = managers[layerIdStr];
                if (!manager) return;
                const layerConfigB = sideB.config.layers?.[layerIdStr];
                const tokenB = sideB.config.tokenAssignments?.[layerIdStr];
                const imageUrlB = resolveImageUrl(tokenB);
                const tokenIdB = typeof tokenB === 'object' ? tokenB.id : tokenB;
                await manager.setCrossfadeTarget(imageUrlB, layerConfigB ? JSON.parse(JSON.stringify(layerConfigB)) : null, tokenIdB);
            });
            await Promise.all(setupPromises);
        };
        setup();
    }, [sideB.config?.ts, managersReady]);

    useEffect(() => {
        if (!managersReady) return;
        const managers = managerInstancesRef.current;
        for (const layerIdStr in managers) {
            const manager = managers[layerIdStr];
            if (manager) {
                // --- START: SIMPLIFIED LOGIC ---
                // The CanvasManager's internal draw loop now handles interpolation.
                // We just need to tell it the latest crossfader value.
                manager.setCrossfadeValue(crossfaderValue);
                // --- END: SIMPLIFIED LOGIC ---

                // --- START: FIX FOR OPACITY AND RACE CONDITION (Remains the same) ---
                const layerOpacityA = sideA.config?.layers?.[layerIdStr]?.opacity ?? 1.0;
                const layerOpacityB = sideB.config?.layers?.[layerIdStr]?.opacity ?? 1.0;

                const angle = crossfaderValue * 0.5 * Math.PI;
                const crossfadeOpacityA = Math.cos(angle);
                const crossfadeOpacityB = Math.sin(angle);

                let finalOpacityA = crossfadeOpacityA * layerOpacityA;
                let finalOpacityB = crossfadeOpacityB * layerOpacityB;

                // **RACE CONDITION FIX:** Check if the content is ready before making the canvas visible.
                const targetTokenA_Assignment = sideA.config?.tokenAssignments?.[layerIdStr];
                const targetTokenB_Assignment = sideB.config?.tokenAssignments?.[layerIdStr];
                const targetTokenA_Id = typeof targetTokenA_Assignment === 'object' ? targetTokenA_Assignment.id : targetTokenA_Assignment;
                const targetTokenB_Id = typeof targetTokenB_Assignment === 'object' ? targetTokenB_Assignment.id : targetTokenB_Assignment;

                const isDeckA_ContentReady = manager.tokenA_id === targetTokenA_Id;
                const isDeckB_ContentReady = manager.tokenB_id === targetTokenB_Id;

                if (!isDeckA_ContentReady) finalOpacityA = 0;
                if (!isDeckB_ContentReady) finalOpacityB = 0;
                
                if (manager.canvasA) {
                    manager.canvasA.style.opacity = finalOpacityA;
                    manager.canvasA.style.mixBlendMode = sideA.config?.layers?.[layerIdStr]?.blendMode || 'normal';
                }
                if (manager.canvasB) {
                    manager.canvasB.style.opacity = finalOpacityB;
                    manager.canvasB.style.mixBlendMode = sideB.config?.layers?.[layerIdStr]?.blendMode || 'normal';
                }
                // --- END: FIX FOR OPACITY AND RACE CONDITION ---
            }
        }
    }, [crossfaderValue, managersReady, sideA, sideB]);
    
    const setCanvasLayerImage = useCallback((layerId, src, tokenId) => {
        if (!managersReady) return Promise.reject(new Error("Managers not ready"));
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (!manager) return Promise.reject(new Error(`Manager not found for layer ${layerId}`));

        if (crossfaderValue < 0.5) {
            return manager.setImage(src, tokenId);
        } else {
            const configBForLayer = sideB?.config?.layers?.[String(layerId)];
            const configBCopy = configBForLayer ? JSON.parse(JSON.stringify(configBForLayer)) : null;
            return manager.setCrossfadeTarget(src, configBCopy, tokenId);
        }
    }, [managersReady, crossfaderValue, sideB]);

    const stopCanvasAnimations = useCallback(() => {
        Object.values(managerInstancesRef.current || {}).forEach(manager => {
            if (manager?.stopAnimationLoop) manager.stopAnimationLoop();
        });
    }, []);

    const restartCanvasAnimations = useCallback(() => {
        if (!managersReady) return;
        Object.values(managerInstancesRef.current || {}).forEach(manager => {
            const config = manager?.getConfigData?.();
            if (manager?.startAnimationLoop && config?.enabled) {
                manager.startAnimationLoop();
            }
        });
    }, [managersReady]);
    
    const handleCanvasResize = useCallback(() => {
        Object.values(managerInstancesRef.current || {}).forEach(manager => {
            if (manager?.setupCanvas) manager.setupCanvas().catch(err => console.error(`Error during resize for layer ${manager.layerId}:`, err));
        });
    }, []);

    const applyPlaybackValue = useCallback((layerId, key, value) => { managerInstancesRef.current[layerId]?.applyPlaybackValue(key, value); }, []);
    const clearAllPlaybackValues = useCallback(() => { Object.values(managerInstancesRef.current).forEach(m => m.clearPlaybackValues()); }, []);

    return useMemo(() => ({
        managersReady,
        managerInstancesRef,
        stopCanvasAnimations,
        restartCanvasAnimations,
        handleCanvasResize,
        setCanvasLayerImage,
        applyPlaybackValue,
        clearAllPlaybackValues,
    }), [
        managersReady,
        stopCanvasAnimations,
        restartCanvasAnimations,
        handleCanvasResize,
        setCanvasLayerImage,
        applyPlaybackValue,
        clearAllPlaybackValues,
    ]);
}