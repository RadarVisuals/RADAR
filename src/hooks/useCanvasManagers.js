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
 *
 * The `updateLayerProperty` function is kept for potential direct, non-reactive updates
 * to non-interpolated properties if needed by orchestrator logic. However, primary layer
 * parameter updates are expected to be reactive, driven by `VisualConfigContext` changes
 * handled in `useCanvasOrchestrator`.
 *
 * @param {Object.<string, React.RefObject<HTMLCanvasElement>>} canvasRefs - An object where keys are layer IDs ('1', '2', '3') and values are React refs to the corresponding canvas elements.
 * @param {Object.<string, string>} defaultAssets - An object mapping layer IDs to their default image source URLs.
 * @returns {CanvasManagersAPI} An object containing the manager instances, initialization status, and control functions.
 */
export function useCanvasManagers(canvasRefs, defaultAssets) {
    const [isInitialized, setIsInitialized] = useState(false);
    // 'managers' state might be useful if components need to react to the set of managers changing,
    // but managerInstancesRef is generally used for direct interaction.
    const [managers, setManagers] = useState({});
    /** @type {React.RefObject<Object.<string, CanvasManager>>} */
    const managerInstancesRef = useRef({});
    /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
    const resizeTimeoutRef = useRef(null);
    /** @type {React.RefObject<boolean>} */
    const initRunRef = useRef(false); // To prevent re-running initialization effect unnecessarily

    useEffect(() => {
        if (initRunRef.current) return; // Only run initialization once per canvasRefs/defaultAssets change
        initRunRef.current = true;

        const newManagers = {};
        const createdManagerInstancesList = []; // To keep track for cleanup
        let managersCreatedCount = 0;
        const totalLayersExpected = Object.keys(canvasRefs).length;

        if (totalLayersExpected === 0) {
            if (import.meta.env.DEV) {
                console.warn("[useCanvasManagers] No canvas refs provided during initialization.");
            }
            setIsInitialized(true); // Considered initialized if no canvases are expected
            initRunRef.current = false; // Allow re-init if refs change later
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
                    if (import.meta.env.DEV) {
                        console.error(`[useCanvasManagers] Failed to create CanvasManager for layer ${layerId}:`, error);
                    }
                }
            } else {
                if (import.meta.env.DEV) {
                    console.warn(`[useCanvasManagers] Canvas ref not available for layer ${layerId} during initialization attempt.`);
                }
            }
        });

        managerInstancesRef.current = newManagers;
        setManagers(newManagers); // Update state

        if (managersCreatedCount !== totalLayersExpected) {
             if (import.meta.env.DEV) {
                 console.warn(`[useCanvasManagers] Manager creation mismatch. Expected: ${totalLayersExpected}, Created: ${managersCreatedCount}. isInitialized may be false or reflect partial setup.`);
             }
        }
        setIsInitialized(managersCreatedCount > 0 || totalLayersExpected === 0); // Initialized if any manager created or none expected

        initRunRef.current = false; // Reset for potential future re-initializations if deps change

        // Resize handler
        const handleResizeCallback = () => {
            if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current);
            resizeTimeoutRef.current = requestAnimationFrame(() => {
                Object.values(managerInstancesRef.current).forEach(manager => {
                    if (manager && typeof manager.resize === 'function') {
                         manager.resize().catch(err => {
                             if(import.meta.env.DEV) console.error(`Error during resize for layer ${manager.layerId}:`, err)
                         });
                    } else if (manager && typeof manager.setupCanvas === 'function') { // Fallback if resize isn't available
                         manager.setupCanvas().catch(err => {
                             if(import.meta.env.DEV) console.error(`Error during setupCanvas fallback for layer ${manager.layerId} on resize:`, err)
                         });
                    }
                });
            });
        };
        window.addEventListener('resize', handleResizeCallback, { passive: true });

        // Cleanup function
        return () => {
            window.removeEventListener('resize', handleResizeCallback);
            if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current);
            // Use the list of instances created during *this specific effect run* for cleanup
            createdManagerInstancesList.forEach(manager => {
                 if (manager && typeof manager.destroy === 'function') {
                     manager.destroy();
                 }
            });
            initRunRef.current = false; // Ensure reset on unmount too
        };
    }, [canvasRefs, defaultAssets]); // Re-run if canvasRefs or defaultAssets change

    const setLayerImage = useCallback(async (layerId, src) => {
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (!manager) {
            if (import.meta.env.DEV) console.warn(`[useCanvasManagers setLayerImage] No manager for layer ${layerId}`);
            return Promise.reject(new Error(`No manager for layer ${layerId}`));
        }
        if (typeof manager.setImage !== 'function') {
            if (import.meta.env.DEV) console.warn(`[useCanvasManagers setLayerImage] Manager for layer ${layerId} has no setImage method.`);
            return Promise.reject(new Error(`Manager for layer ${layerId} has no setImage method.`));
        }
        return manager.setImage(src);
    }, []); // managerInstancesRef is stable

    // loadTokenImage seems to have been removed from CanvasManager, if it was specific to TokenService, this can be removed.
    // If it's a general image loading with metadata, its implementation in CanvasManager would be needed.
    // For now, assuming it's not part of CanvasManager's direct API.

    /** Applies a full configuration object to a single specified CanvasManager instance. */
    const applyLayerConfig = useCallback((layerId, config) => {
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (manager && typeof manager.applyFullConfig === 'function') {
            manager.applyFullConfig(config);
        } else {
            if (import.meta.env.DEV) {
                console.warn(`[useCanvasManagers applyLayerConfig] Cannot apply full config: Manager or method missing for layer ${layerId}`);
            }
        }
    }, []);

    /**
     * Applies a full configuration object to each corresponding CanvasManager instance.
     * This is typically used when a new preset is loaded.
     */
    const applyConfigurations = useCallback((configs) => {
        if (!configs || typeof configs !== 'object') {
            if (import.meta.env.DEV) {
                console.warn("[useCanvasManagers applyConfigurations] Invalid or no configs object provided.");
            }
            return;
        }
        const currentManagers = managerInstancesRef.current || {};
        Object.entries(configs).forEach(([layerId, config]) => {
            const manager = currentManagers[String(layerId)];
            if (manager && typeof manager.applyFullConfig === 'function') {
                manager.applyFullConfig(config);
            } else {
                 if (import.meta.env.DEV) {
                    // console.warn(`[useCanvasManagers applyConfigurations] No manager or applyFullConfig for layer ${layerId} when applying new configs.`);
                 }
            }
        });
        // Ensure layers not in the incoming config are handled (e.g., set to a default enabled state)
        Object.entries(currentManagers).forEach(([layerId, manager]) => {
            if (!configs[String(layerId)] && manager && typeof manager.applyFullConfig === 'function') {
                const currentManagerConfig = manager.getConfigData?.() || {};
                // Apply existing config but ensure 'enabled' is true, or apply a default enabled config
                manager.applyFullConfig({ ...(manager.getDefaultConfig?.() || {}), ...currentManagerConfig, enabled: true });
            }
        });
    }, []);

    /**
     * Directly updates a single non-interpolated configuration property on a specific CanvasManager.
     * This is intended for use by `useCanvasOrchestrator` if it needs to make direct updates
     * for properties not driven by interpolation (e.g., 'speed', 'opacity', 'blendMode').
     */
    const updateLayerProperty = useCallback((layerId, key, value) => {
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (!manager) {
            if (import.meta.env.DEV) {
                console.warn(`[useCanvasManagers updateLayerProperty] Manager missing for layer ${layerId}`);
            }
            return;
        }
        if (typeof manager.updateConfigProperty === 'function') {
            manager.updateConfigProperty(key, value);
        } else {
            if (import.meta.env.DEV) {
                console.error(`[useCanvasManagers updateLayerProperty] No updateConfigProperty method on manager for layer ${layerId}.`);
            }
        }
    }, []); // managerInstancesRef is stable

    const stopAllAnimations = useCallback(() => {
        Object.values(managerInstancesRef.current || {}).forEach(manager => {
            if (manager && typeof manager.stopAnimationLoop === 'function') manager.stopAnimationLoop();
        });
    }, []);

    const restartAllAnimations = useCallback(() => {
        Object.values(managerInstancesRef.current || {}).forEach(manager => {
            const config = manager?.getConfigData?.();
            if (manager && typeof manager.startAnimationLoop === 'function' && config?.enabled) {
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
                        if (import.meta.env.DEV) console.warn(`[useCanvasManagers forceRedrawAll] forceRedraw missing on manager L${layerId}`);
                        results.push(false);
                    }
                } catch (e) {
                    if (import.meta.env.DEV) console.error(`[useCanvasManagers forceRedrawAll] Error redrawing layer ${layerId}:`, e);
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
                catch (error) { if(import.meta.env.DEV) console.error(`[useCanvasManagers handleResize] Error resizing layer ${layerId}:`, error); }
            } else if (manager?.setupCanvas) { // Fallback if resize isn't available
                 try { await manager.setupCanvas(); }
                 catch (error) { if(import.meta.env.DEV) console.error(`[useCanvasManagers handleResize] Error setting up canvas for layer ${layerId} during resize:`, error); }
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

    return useMemo(() => ({
        managers, // The state variable (might have a slight delay from ref)
        managerInstancesRef, // Ref for immediate access
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