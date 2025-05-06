// src/hooks/useCanvasManagers.js
import { useState, useEffect, useRef, useCallback } from 'react';
import CanvasManager from '../utils/CanvasManager';

/**
 * Manages the lifecycle and interaction logic for multiple CanvasManager instances,
 * one for each visual layer. It handles the creation, initialization, configuration application,
 * and cleanup of these managers. It also provides centralized functions to control
 * all managed canvases simultaneously (e.g., setting images, updating properties,
 * starting/stopping animations, handling resizes, forcing redraws).
 *
 * @param {Object.<string, React.RefObject<HTMLCanvasElement>>} canvasRefs - An object where keys are layer IDs ('1', '2', '3') and values are React refs to the corresponding canvas elements.
 * @param {Object.<string, string>} defaultAssets - An object mapping layer IDs to their default image source URLs.
 * @param {Object} [initialConfigs={}] - Optional initial configurations for the layers. (Currently not directly used in this hook's initialization logic but could be used for initial setup if needed).
 * @returns {{
 *   managers: Object.<string, CanvasManager>,
 *   managerInstancesRef: React.RefObject<Object.<string, CanvasManager>>,
 *   isInitialized: boolean,
 *   setLayerImage: (layerId: string, src: string) => Promise<void>,
 *   loadTokenImage: (layerId: string, tokenMetadata: object) => Promise<boolean>,
 *   applyLayerConfig: (layerId: string, config: object) => void,
 *   applyConfigurations: (configs: Object.<string, object>) => void,
 *   updateLayerProperty: (layerId: string, key: string, value: any) => void,
 *   stopAllAnimations: () => void,
 *   restartAllAnimations: () => void,
 *   forceRedrawAll: (configs?: Object.<string, object> | null) => Promise<boolean>,
 *   getCurrentConfigs: () => Object.<string, object | null>,
 *   handleResize: () => Promise<void>
 * }} An object containing the manager instances (in state and ref), initialization status, and control functions.
 */
export function useCanvasManagers(canvasRefs, defaultAssets) { // Removed unused initialConfigs param
    const [isInitialized, setIsInitialized] = useState(false);
    const [managers, setManagers] = useState({});
    const managerInstancesRef = useRef({});
    const resizeTimeoutRef = useRef(null);
    const initRunRef = useRef(false);

    useEffect(() => {
        if (initRunRef.current) {
            return;
        }
        initRunRef.current = true;

        const newManagers = {};
        const managerInstances = [];
        let managersCreatedCount = 0;
        const totalLayers = Object.keys(canvasRefs).length;

        if (totalLayers === 0) {
            console.warn("[useCanvasManagers] No canvas refs provided.");
            setIsInitialized(true);
            initRunRef.current = false;
            return;
        }

        Object.keys(canvasRefs).forEach(layerId => {
            const canvas = canvasRefs[layerId]?.current;
            if (canvas) {
                try {
                    const manager = new CanvasManager(canvas, layerId);
                    newManagers[layerId] = manager;
                    managerInstances.push(manager);
                    managersCreatedCount++;
                } catch (error) {
                    console.error(`[useCanvasManagers] Failed to create CanvasManager for layer ${layerId}:`, error);
                }
            } else {
                console.warn(`[useCanvasManagers] Canvas ref not available for layer ${layerId} during init.`);
            }
        });

        managerInstancesRef.current = newManagers;
        setManagers(newManagers);

        if (managersCreatedCount === totalLayers) {
             setIsInitialized(true);
        } else {
             console.warn(`[useCanvasManagers] Manager creation mismatch. Expected: ${totalLayers}, Created: ${managersCreatedCount}. isInitialized remains false.`);
             setIsInitialized(false);
        }

        initRunRef.current = false;

        const handleResizeCallback = () => {
            if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current);
            resizeTimeoutRef.current = requestAnimationFrame(() => {
                Object.values(managerInstancesRef.current).forEach(manager => {
                    if (manager && typeof manager.resize === 'function') {
                         manager.resize().catch(err => console.error(`Error during resize for layer ${manager.layerId}:`, err));
                    } else if (manager && typeof manager.setupCanvas === 'function') {
                         // Fallback if resize isn't available but setupCanvas is
                         manager.setupCanvas().catch(err => console.error(`Error during setupCanvas fallback for layer ${manager.layerId}:`, err));
                    }
                });
            });
        };
        window.addEventListener('resize', handleResizeCallback, { passive: true });

        return () => {
            window.removeEventListener('resize', handleResizeCallback);
            if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current);
            managerInstances.forEach(manager => {
                 if (manager && typeof manager.destroy === 'function') {
                     manager.destroy();
                 }
            });
            initRunRef.current = false;
        };
    }, [canvasRefs, defaultAssets]);

    const setLayerImage = useCallback((layerId, src) => {
        const manager = managerInstancesRef.current?.[layerId];
        if (!manager) return Promise.reject(`No manager found for layer ${layerId}`);
        if (typeof manager.setImage !== 'function') return Promise.reject(`Manager for layer ${layerId} has no setImage method.`);
        return manager.setImage(src);
    }, []);

    const loadTokenImage = useCallback((layerId, tokenMetadata) => {
        const manager = managerInstancesRef.current?.[layerId];
        if (!manager) return Promise.reject(`No manager found for layer ${layerId}`);
        if (typeof manager.loadTokenImage !== 'function') return Promise.reject(`Manager for layer ${layerId} has no loadTokenImage method.`);
        return manager.loadTokenImage(tokenMetadata);
    }, []);

    const applyLayerConfig = useCallback((layerId, config) => {
        const manager = managerInstancesRef.current?.[layerId];
        if (manager && typeof manager.applyFullConfig === 'function') {
            manager.applyFullConfig(config);
        } else {
            console.warn(`[useCanvasManagers] Cannot apply config: Manager or method missing for layer ${layerId}`);
        }
    }, []);

    const applyConfigurations = useCallback((configs) => {
        if (!configs || typeof configs !== 'object') return;
        const currentManagers = managerInstancesRef.current || {};
        Object.entries(configs).forEach(([layerId, config]) => {
            const manager = currentManagers[layerId];
            if (manager?.applyFullConfig) {
                manager.applyFullConfig(config);
            }
        });
        // Ensure layers not in the incoming config are enabled by default
        Object.entries(currentManagers).forEach(([layerId, manager]) => {
            if (!configs[layerId] && manager?.applyFullConfig) {
                const currentConfig = manager.getConfigData?.() || {};
                manager.applyFullConfig({ ...currentConfig, enabled: true });
            }
        });
    }, []);

    const updateLayerProperty = useCallback((layerId, key, value) => {
        const manager = managerInstancesRef.current?.[layerId];
        if (!manager) {
            console.warn(`[useCanvasManagers] Manager missing for layer ${layerId}`);
            return;
        }
        if (typeof manager.updateConfigProperty === 'function') {
            manager.updateConfigProperty(key, value);
        } else {
            console.error(`[useCanvasManagers] Cannot update property: No updateConfigProperty method found on manager for layer ${layerId}.`);
        }
    }, []);

    const stopAllAnimations = useCallback(() => {
        const currentManagers = managerInstancesRef.current || {};
        Object.values(currentManagers).forEach(manager => {
            if (manager?.stopAnimationLoop) manager.stopAnimationLoop();
        });
    }, []);

    const restartAllAnimations = useCallback(() => {
        const currentManagers = managerInstancesRef.current || {};
        Object.values(currentManagers).forEach(manager => {
            const config = manager?.getConfigData?.();
            if (manager?.startAnimationLoop && config?.enabled) {
                manager.startAnimationLoop();
            }
        });
    }, []);

    const forceRedrawAll = useCallback(async (configs = null) => {
        const results = [];
        const currentManagers = managerInstancesRef.current || {};
        for (const layerId in currentManagers) {
            const manager = currentManagers[layerId];
            if (manager) {
                try {
                    const configForLayer = configs ? configs[layerId] : null;
                    if (typeof manager.forceRedraw === 'function') {
                        const result = await manager.forceRedraw(configForLayer);
                        results.push(result);
                    } else {
                        console.warn(`[useCanvasManagers] forceRedraw missing on manager L${layerId}`);
                        results.push(false);
                    }
                } catch (e) {
                    console.error(`[useCanvasManagers] Error redrawing layer ${layerId}:`, e);
                    results.push(false);
                }
            }
        }
        return results.every(Boolean);
    }, []);

    const handleResize = useCallback(async () => {
        const currentManagers = managerInstancesRef.current || {};
        for (const layerId in currentManagers) {
            const manager = currentManagers[layerId];
            if (manager?.resize) {
                try { await manager.resize(); }
                catch (error) { console.error(`[useCanvasManagers] Error resizing layer ${layerId}:`, error); }
            } else if (manager?.setupCanvas) {
                 try { await manager.setupCanvas(); }
                 catch (error) { console.error(`[useCanvasManagers] Error setting up canvas for layer ${layerId} during resize:`, error); }
            }
        }
    }, []);

    const getCurrentConfigs = useCallback(() => {
        const configs = {};
        const currentManagers = managerInstancesRef.current || {};
        Object.entries(currentManagers).forEach(([layerId, manager]) => {
            configs[layerId] = manager?.getConfigData?.() ?? null;
        });
        return configs;
    }, []);

    return {
        managers,
        managerInstancesRef,
        isInitialized,
        setLayerImage,
        loadTokenImage,
        applyLayerConfig,
        applyConfigurations,
        updateLayerProperty,
        stopAllAnimations,
        restartAllAnimations,
        forceRedrawAll,
        getCurrentConfigs,
        handleResize
    };
}

export default useCanvasManagers;