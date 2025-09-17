// src/hooks/useCanvasManagers.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import CanvasManager from '../utils/CanvasManager'; // Assuming CanvasManager adheres to similar principles or is out of scope

/**
 * @typedef {object} CanvasManagersAPI
 * @property {Object.<string, CanvasManager>} managers - State holding manager instances (might be slightly delayed vs ref).
 * @property {React.RefObject<Object.<string, CanvasManager>>} managerInstancesRef - Ref for immediate access to managers.
 * @property {boolean} isInitialized - True once all managers are attempted to be created.
 * @property {(layerId: string, src: string) => Promise<void>} setLayerImage - Sets the image for a specific layer.
 * @property {(layerId: string, config: object) => void} applyLayerConfig - Applies a full configuration object to a single specified CanvasManager instance.
 * @property {(configs: Object.<string, object>) => void} applyConfigurations - Applies a full configuration object to each corresponding CanvasManager instance, typically used for preset loads.
 * @property {(layerId: string, key: string, value: any) => void} updateLayerProperty - Directly updates a single non-interpolated configuration property on a specific CanvasManager. Intended for use by an orchestrator for properties not driven by interpolation.
 * @property {() => void} stopAllAnimations - Stops animations for all managed canvases.
 * @property {() => void} restartAllAnimations - Restarts animations for all managed canvases (if their config has `enabled: true`).
 * @property {(configs?: Object.<string, object> | null) => Promise<boolean>} forceRedrawAll - Forces a redraw on all managed canvases, optionally applying new configurations before redrawing. Returns true if all redraws succeeded.
 * @property {() => Object.<string, object | null>} getCurrentConfigs - Retrieves the current configuration data from all managed CanvasManager instances.
 * @property {() => Promise<void>} handleResize - Programmatically triggers the resize logic (or setupCanvas fallback) for all managers.
 */

/**
 * Manages the lifecycle and interaction logic for multiple CanvasManager instances,
 * one for each visual layer. It handles their creation, initialization,
 * and cleanup. It provides centralized functions to control all managed canvases
 * (e.g., applying full configurations, setting images, animation control).
 */
export function useCanvasManagers(canvasRefs, defaultAssets) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [managers, setManagers] = useState({});
    /** @type {React.RefObject<Object.<string, CanvasManager>>} */
    const managerInstancesRef = useRef({});
    /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
    const resizeTimeoutRef = useRef(null);
    /** @type {React.RefObject<boolean>} */
    const initRunRef = useRef(false);

    useEffect(() => {
        if (initRunRef.current) return;
        initRunRef.current = true;

        const newManagers = {};
        const createdManagerInstancesList = [];
        let managersCreatedCount = 0;
        const totalLayersExpected = Object.keys(canvasRefs).length;

        if (totalLayersExpected === 0) {
            setIsInitialized(true);
            initRunRef.current = false;
            return;
        }

        Object.keys(canvasRefs).forEach(layerId => {
            const canvasElement = canvasRefs[layerId]?.current;
            if (canvasElement) {
                try {
                    const manager = new CanvasManager(canvasElement, layerId);
                    newManagers[layerId] = manager;
                    createdManagerInstancesList.push(manager);
                    managersCreatedCount++;
                } catch (error) {
                    if (import.meta.env.DEV) console.error(`[useCanvasManagers] Failed to create CanvasManager for layer ${layerId}:`, error);
                }
            }
        });

        managerInstancesRef.current = newManagers;
        setManagers(newManagers);

        setIsInitialized(managersCreatedCount > 0 || totalLayersExpected === 0);

        initRunRef.current = false;

        const handleResizeCallback = () => {
            if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current);
            resizeTimeoutRef.current = requestAnimationFrame(() => {
                Object.values(managerInstancesRef.current).forEach(manager => {
                    if (manager?.resize) manager.resize().catch(err => { if(import.meta.env.DEV) console.error(`Error during resize for layer ${manager.layerId}:`, err) });
                    else if (manager?.setupCanvas) manager.setupCanvas().catch(err => { if(import.meta.env.DEV) console.error(`Error during setupCanvas fallback for layer ${manager.layerId} on resize:`, err) });
                });
            });
        };
        window.addEventListener('resize', handleResizeCallback, { passive: true });

        return () => {
            window.removeEventListener('resize', handleResizeCallback);
            if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current);
            createdManagerInstancesList.forEach(manager => {
                 if (manager?.destroy) manager.destroy();
            });
            initRunRef.current = false;
        };
    }, [canvasRefs, defaultAssets]);

    const setLayerImage = useCallback(async (layerId, src) => {
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (!manager) return Promise.reject(new Error(`No manager for layer ${layerId}`));
        if (typeof manager.setImage !== 'function') return Promise.reject(new Error(`Manager for layer ${layerId} has no setImage method.`));
        return manager.setImage(src);
    }, []);

    const applyLayerConfig = useCallback((layerId, config) => {
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (manager?.applyFullConfig) manager.applyFullConfig(config);
    }, []);

    // --- THIS IS THE CORRECTED, ROBUST VERSION ---
    const applyConfigurations = useCallback((configs) => {
        const currentManagers = managerInstancesRef.current || {};
        const safeConfigs = configs || {};

        // Iterate over all existing managers (e.g., '1', '2', '3')
        Object.keys(currentManagers).forEach(layerId => {
            const manager = currentManagers[layerId];
            const newConfigForLayer = safeConfigs[layerId];

            if (manager && typeof manager.applyFullConfig === 'function') {
                if (newConfigForLayer) {
                    // If a config exists for this layer in the new scene, apply it.
                    manager.applyFullConfig(newConfigForLayer);
                } else {
                    // If no config exists, it means this layer should be disabled.
                    // We apply its default config but explicitly set `enabled` to false.
                    const defaultConfig = manager.getDefaultConfig ? manager.getDefaultConfig() : {};
                    manager.applyFullConfig({ ...defaultConfig, enabled: false });
                }
            }
        });
    }, []);
    // --- END CORRECTION ---

    const updateLayerProperty = useCallback((layerId, key, value) => {
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (manager?.updateConfigProperty) manager.updateConfigProperty(key, value);
    }, []);

    const stopAllAnimations = useCallback(() => {
        Object.values(managerInstancesRef.current || {}).forEach(manager => {
            if (manager?.stopAnimationLoop) manager.stopAnimationLoop();
        });
    }, []);

    const restartAllAnimations = useCallback(() => {
        Object.values(managerInstancesRef.current || {}).forEach(manager => {
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
                        results.push(await manager.forceRedraw(configForLayer));
                    } else { results.push(false); }
                } catch (e) { results.push(false); }
            }
        }
        return results.every(Boolean);
    }, []);

    const handleResize = useCallback(async () => {
        const currentManagers = managerInstancesRef.current || {};
        for (const layerId in currentManagers) {
            const manager = currentManagers[layerId];
            if (manager?.resize) await manager.resize().catch(console.error);
            else if (manager?.setupCanvas) await manager.setupCanvas().catch(console.error);
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

    return useMemo(() => ({
        managers,
        managerInstancesRef,
        isInitialized,
        setLayerImage,
        applyLayerConfig,
        applyConfigurations,
        updateLayerProperty,
        stopAllAnimations,
        restartAllAnimations,
        forceRedrawAll,
        getCurrentConfigs,
        handleResize
    }), [
        managers, isInitialized,
        setLayerImage, applyLayerConfig, applyConfigurations, updateLayerProperty,
        stopAllAnimations, restartAllAnimations, forceRedrawAll, getCurrentConfigs, handleResize
    ]);
}