// src/hooks/useCanvasManagers.js
import { useState, useEffect, useRef, useCallback } from 'react';
import CanvasManager from '../utils/CanvasManager';

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
 * @returns {{
 *   managers: Object.<string, CanvasManager>, // State holding manager instances (might be slightly delayed vs ref)
 *   managerInstancesRef: React.RefObject<Object.<string, CanvasManager>>, // Ref for immediate access to managers
 *   isInitialized: boolean, // True once all managers are attempted to be created
 *   setLayerImage: (layerId: string, src: string) => Promise<void>,
 *   applyLayerConfig: (layerId: string, config: object) => void, // Applies a full config to one layer
 *   applyConfigurations: (configs: Object.<string, object>) => void, // Applies full configs to all layers (for preset loads)
 *   updateLayerProperty: (layerId: string, key: string, value: any) => void, // For direct, non-interpolated updates by orchestrator if needed
 *   stopAllAnimations: () => void,
 *   restartAllAnimations: () => void,
 *   forceRedrawAll: (configs?: Object.<string, object> | null) => Promise<boolean>,
 *   getCurrentConfigs: () => Object.<string, object | null>,
 *   handleResize: () => Promise<void>
 * }} An object containing the manager instances, initialization status, and control functions.
 */
export function useCanvasManagers(canvasRefs, defaultAssets) {
    const [isInitialized, setIsInitialized] = useState(false);
    // 'managers' state might be useful if components need to react to the set of managers changing,
    // but managerInstancesRef is generally used for direct interaction.
    const [managers, setManagers] = useState({});
    const managerInstancesRef = useRef({});
    const resizeTimeoutRef = useRef(null);
    const initRunRef = useRef(false); // To prevent re-running initialization effect unnecessarily

    useEffect(() => {
        if (initRunRef.current) return; // Only run initialization once per canvasRefs/defaultAssets change
        initRunRef.current = true;

        const newManagers = {};
        const createdManagerInstancesList = []; // To keep track for cleanup
        let managersCreatedCount = 0;
        const totalLayersExpected = Object.keys(canvasRefs).length;

        if (totalLayersExpected === 0) {
            // console.warn("[useCanvasManagers] No canvas refs provided during initialization.");
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
                    console.error(`[useCanvasManagers] Failed to create CanvasManager for layer ${layerId}:`, error);
                }
            } else {
                console.warn(`[useCanvasManagers] Canvas ref not available for layer ${layerId} during initialization attempt.`);
            }
        });

        managerInstancesRef.current = newManagers;
        setManagers(newManagers); // Update state

        if (managersCreatedCount === totalLayersExpected) {
             setIsInitialized(true);
        } else {
             // This warning is important if not all managers could be created
             console.warn(`[useCanvasManagers] Manager creation mismatch. Expected: ${totalLayersExpected}, Created: ${managersCreatedCount}. isInitialized may be false or reflect partial setup.`);
             setIsInitialized(managersCreatedCount > 0); // Consider initialized if at least one manager was created
        }

        initRunRef.current = false; // Reset for potential future re-initializations if deps change

        // Resize handler
        const handleResizeCallback = () => {
            if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current);
            resizeTimeoutRef.current = requestAnimationFrame(() => {
                Object.values(managerInstancesRef.current).forEach(manager => {
                    if (manager && typeof manager.resize === 'function') {
                         manager.resize().catch(err => console.error(`Error during resize for layer ${manager.layerId}:`, err));
                    } else if (manager && typeof manager.setupCanvas === 'function') {
                         manager.setupCanvas().catch(err => console.error(`Error during setupCanvas fallback for layer ${manager.layerId} on resize:`, err));
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

    const setLayerImage = useCallback((layerId, src) => {
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (!manager) return Promise.reject(`No manager for layer ${layerId}`);
        if (typeof manager.setImage !== 'function') return Promise.reject(`Manager for layer ${layerId} has no setImage method.`);
        return manager.setImage(src);
    }, []); // managerInstancesRef is stable

    // loadTokenImage seems to have been removed from CanvasManager, if it was specific to TokenService, this can be removed.
    // If it's a general image loading with metadata, its implementation in CanvasManager would be needed.
    // For now, assuming it's not part of CanvasManager's direct API.
    // const loadTokenImage = useCallback((layerId, tokenMetadata) => { ... });

    /** Applies a full configuration object to a single specified CanvasManager instance. */
    const applyLayerConfig = useCallback((layerId, config) => {
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (manager && typeof manager.applyFullConfig === 'function') {
            manager.applyFullConfig(config);
        } else {
            console.warn(`[useCanvasManagers] Cannot apply full config: Manager or method missing for layer ${layerId}`);
        }
    }, []);

    /**
     * Applies a full configuration object to each corresponding CanvasManager instance.
     * This is typically used when a new preset is loaded.
     */
    const applyConfigurations = useCallback((configs) => {
        if (!configs || typeof configs !== 'object') {
            console.warn("[useCanvasManagers applyConfigurations] Invalid or no configs object provided.");
            return;
        }
        const currentManagers = managerInstancesRef.current || {};
        Object.entries(configs).forEach(([layerId, config]) => {
            const manager = currentManagers[String(layerId)];
            if (manager && typeof manager.applyFullConfig === 'function') {
                manager.applyFullConfig(config);
            } else {
                // console.warn(`[useCanvasManagers applyConfigurations] No manager or applyFullConfig for layer ${layerId}`);
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
     * @param {string} layerId - The ID of the layer.
     * @param {string} key - The configuration property key.
     * @param {any} value - The new value for the property.
     */
    const updateLayerProperty = useCallback((layerId, key, value) => {
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (!manager) {
            console.warn(`[useCanvasManagers] updateLayerProperty: Manager missing for layer ${layerId}`);
            return;
        }
        if (typeof manager.updateConfigProperty === 'function') {
            manager.updateConfigProperty(key, value);
        } else {
            console.error(`[useCanvasManagers] updateLayerProperty: No updateConfigProperty method on manager for layer ${layerId}.`);
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
            } else if (manager?.setupCanvas) { // Fallback if resize isn't available
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
        managers, // The state variable (might have a slight delay from ref)
        managerInstancesRef, // Ref for immediate access
        isInitialized,
        setLayerImage,
        // loadTokenImage, // Removed as it's not part of CanvasManager's direct API in this iteration
        applyLayerConfig,
        applyConfigurations,
        updateLayerProperty, // This is now primarily for the orchestrator's internal reactive updates
        stopAllAnimations,
        restartAllAnimations,
        forceRedrawAll,
        getCurrentConfigs,
        handleResize
    };
}

// Default export is not conventional for hooks, but kept if it was intentional.
// export default useCanvasManagers; // Typically, hooks are just named exports.