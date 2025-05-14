// src/hooks/useCanvasOrchestrator.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { useVisualConfig } from '../context/VisualConfigContext';
import { useCanvasManagers } from './useCanvasManagers'; // Local hook

import debounce from '../utils/debounce'; // Local utility
import { resolveLsp4Metadata } from '../utils/erc725.js'; // Local utility
import { demoAssetMap } from '../assets/DemoLayers/initLayers'; // Local assets
import { IPFS_GATEWAY } from '../config/global-config'; // Local config
import { INTERPOLATED_MIDI_PARAMS } from '../config/midiConstants'; // Local config

import { isAddress } from 'viem'; // Third-party library
import CanvasManager from '../utils/CanvasManager'; // For instanceof check

const RESIZE_DEBOUNCE_DELAY = 250; // Milliseconds for debouncing resize events

// --- MODIFIED: Align defaultAssets with fallback-config.js using DEMO_LAYER_4 ---
// This object defines the default images to be loaded for each canvas layer
// if no other specific image or token is assigned.
const defaultAssets = {
    1: demoAssetMap.DEMO_LAYER_4 || '', // Use DEMO_LAYER_4 as per fallback-config
    2: demoAssetMap.DEMO_LAYER_4 || '', // Use DEMO_LAYER_4
    3: demoAssetMap.DEMO_LAYER_4 || '', // Use DEMO_LAYER_4
};
// --- END MODIFICATION ---

/**
 * @typedef {object} CanvasOrchestratorAPI
 * @property {boolean} managersReady - True if all expected CanvasManager instances are initialized and ready.
 * @property {boolean} defaultImagesLoaded - True if the initial default images for all layers have been successfully loaded.
 * @property {React.RefObject<Object.<string, import('../utils/CanvasManager').default>>} managerInstancesRef - Direct ref to the CanvasManager instances, as managed by `useCanvasManagers`.
 * @property {(configs: Object.<string, object>) => void} applyConfigurationsToManagers - Applies full layer configurations to all canvas managers. Updates internal tracking for reactive effects. This is typically used for applying a loaded preset.
 * @property {(assignments: Object.<string, string | object | null>) => Promise<void>} applyTokenAssignmentsToManagers - Resolves and applies token/image assignments to canvas layers based on various input types (demo keys, owned asset objects, LSP4 addresses, direct URLs).
 * @property {() => void} stopCanvasAnimations - Stops animations on all managed canvases.
 * @property {() => void} restartCanvasAnimations - Restarts animations on all managed canvases if they are ready and configured to be enabled.
 * @property {(configs?: Object.<string, object> | null) => Promise<boolean>} redrawAllCanvases - Forces a redraw on all canvases, optionally applying new configurations before redrawing. Returns true if all redraws succeeded.
 * @property {() => void} handleCanvasResize - Debounced handler to trigger resize logic on all canvases.
 * @property {(layerId: string, src: string) => Promise<void>} setCanvasLayerImage - Sets an image for a specific canvas layer directly.
 */

/**
 * Orchestrates multiple CanvasManager instances, handling their initialization,
 * configuration application (from presets or context changes), image assignments,
 * and lifecycle events like animations and resizing. It acts as a bridge between
 * global configuration state (`VisualConfigContext`, `configLoadNonce`) and the
 * individual `CanvasManager` instances.
 *
 * @param {object} params - Parameters for the orchestrator.
 * @param {React.RefObject<import('../services/ConfigurationService').default | null>} params.configServiceRef - Ref to the ConfigurationService, used for resolving LSP4 metadata.
 * @param {Object.<string, React.RefObject<HTMLCanvasElement>>} params.canvasRefs - Refs to the canvas elements for each layer.
 * @param {number} params.configLoadNonce - A nonce that changes when a new global configuration (preset) is loaded, used to coordinate updates.
 * @returns {CanvasOrchestratorAPI} An API object for interacting with the orchestrated canvas managers.
 */
export function useCanvasOrchestrator({ configServiceRef, canvasRefs, configLoadNonce }) {
    /** @type {React.RefObject<boolean>} */
    const isMountedRef = useRef(false);
    const [managersReady, setManagersReady] = useState(false);
    const [defaultImagesLoaded, setDefaultImagesLoaded] = useState(false);
    /** @type {React.RefObject<number>} */
    const lastProcessedNonceByOrchestratorRef = useRef(0);
    /** @type {React.RefObject<Object.<string, object> | null>} */
    const prevLayerConfigsRef = useRef(null);

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

    /** @type {React.RefObject<() => Promise<void>>} */
    const rawHandleResize = useRef(handleResizeInternal);
    const debouncedResizeHandler = useMemo(
        () => debounce(() => { if (rawHandleResize.current) rawHandleResize.current(); }, RESIZE_DEBOUNCE_DELAY),
        [] // Debounce function should be stable
    );

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        rawHandleResize.current = handleResizeInternal;
    }, [handleResizeInternal]);

    // Effect to determine if all CanvasManager instances are ready
    useEffect(() => {
        if (managersInitialized && isMountedRef.current) {
            const allManagersExist = Object.keys(canvasRefs).every(
                (id) => managerInstancesRef.current?.[id] instanceof CanvasManager
            );
            if (managersReady !== allManagersExist) {
                setManagersReady(allManagersExist);
            }
        } else if (managersReady) { // If not initialized or not mounted, but was previously ready
            setManagersReady(false);
        }
    }, [managersInitialized, canvasRefs, managersReady, managerInstancesRef]); // managerInstancesRef ADDED HERE

    // Effect to load default images once managers are ready
    useEffect(() => {
        if (!managersReady || !isMountedRef.current || defaultImagesLoaded) return;

        const currentManagers = managerInstancesRef.current;
        const loadImages = async () => {
            const promises = Object.keys(currentManagers).map(layerId => {
                const manager = currentManagers[layerId];
                const src = defaultAssets[layerId]; // This will now use DEMO_LAYER_4
                if (manager && src && typeof manager.setImage === "function") {
                    return manager.setImage(src).catch((e) => {
                        if (import.meta.env.DEV) {
                            console.error(`[CanvasOrchestrator] Default Image Load FAILED L${layerId} (src: ${src}):`, e);
                        }
                        // Propagate error to be caught by Promise.allSettled
                        return Promise.reject(e);
                    });
                }
                return Promise.resolve(); // Resolve if no manager, src, or setImage
            });

            try {
                const results = await Promise.allSettled(promises);
                if (isMountedRef.current) {
                    const allSucceeded = results.every(r => r.status === 'fulfilled');
                    setDefaultImagesLoaded(allSucceeded);
                    if (!allSucceeded && import.meta.env.DEV) {
                        console.warn("[CanvasOrchestrator] Not all default images loaded successfully. Results:", results);
                    }
                }
            } catch (e) { // Should not be reached if using Promise.allSettled correctly
                if (import.meta.env.DEV) {
                    console.error("[CanvasOrchestrator] Unexpected error in Promise.allSettled for default images:", e);
                }
                if (isMountedRef.current) setDefaultImagesLoaded(false);
            }
        };
        loadImages();
    }, [managersReady, defaultImagesLoaded, managerInstancesRef]);

    const { layerConfigs: currentContextLayerConfigs } = useVisualConfig();

    // Effect to react to changes in layer configurations from VisualConfigContext or configLoadNonce
    useEffect(() => {
        if (!managersReady || !currentContextLayerConfigs || !isMountedRef.current) {
            return;
        }

        if (configLoadNonce > lastProcessedNonceByOrchestratorRef.current) {
            if (import.meta.env.DEV) {
                console.log(`[CanvasOrchestrator] Reactive Effect: New configLoadNonce (${configLoadNonce}) detected. Orchestrator nonce was (${lastProcessedNonceByOrchestratorRef.current}). Deferring to RenderLifecycle/applyConfigurationsToManagers. Updating orchestrator nonce.`);
            }
            lastProcessedNonceByOrchestratorRef.current = configLoadNonce;
            return;
        }

        if (lastProcessedNonceByOrchestratorRef.current !== configLoadNonce && import.meta.env.DEV) {
            console.warn(`[CanvasOrchestrator] Reactive Effect: Nonce mismatch after initial check. Orchestrator: ${lastProcessedNonceByOrchestratorRef.current}, Global: ${configLoadNonce}. Syncing orchestrator nonce.`);
            lastProcessedNonceByOrchestratorRef.current = configLoadNonce;
        }

        const managers = managerInstancesRef.current;
        if (!managers) return;

        const prevConfigs = prevLayerConfigsRef.current;
        let changedOverall = false;

        for (const layerIdStr of ['1', '2', '3']) { // Assuming fixed layer IDs
            const newConfigForLayer = currentContextLayerConfigs[layerIdStr];
            const oldConfigForLayer = prevConfigs ? prevConfigs[layerIdStr] : null;
            const manager = managers[layerIdStr];

            if (!manager || !newConfigForLayer) continue;

            Object.keys(newConfigForLayer).forEach(key => {
                const newValue = newConfigForLayer[key];
                const oldValue = oldConfigForLayer ? oldConfigForLayer[key] : undefined;

                let propertyChanged = oldValue !== newValue;
                if (key === 'driftState') {
                    propertyChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue);
                }

                if (propertyChanged) {
                    changedOverall = true;
                    if (import.meta.env.DEV) {
                        const actionType = INTERPOLATED_MIDI_PARAMS.includes(key) ? "SNAP_VISUAL_PROPERTY" : "UPDATE_CONFIG_PROPERTY";
                        const formattedNewValue = typeof newValue === 'object' ? JSON.stringify(newValue) : newValue;
                        const formattedOldValue = typeof oldValue === 'object' ? JSON.stringify(oldValue) : oldValue;
                        console.log(
                            `%c[ORCHESTRATOR_APPLY L${layerIdStr} - ${key}] Action: ${actionType}, NewValue: ${formattedNewValue}`,
                            'color: darkorange; font-weight: bold;',
                            `(Details: Old from prevLayerConfigsRef: ${formattedOldValue}, NewValFromVisualConfigContext: ${formattedNewValue})`
                        );
                    }

                    if (INTERPOLATED_MIDI_PARAMS.includes(key)) {
                        if (typeof manager.snapVisualProperty === 'function') {
                            manager.snapVisualProperty(key, newValue);
                        } else if (import.meta.env.DEV) {
                            console.warn(`[CanvasOrchestrator] Manager for layer ${layerIdStr} missing snapVisualProperty for ${key}`);
                        }
                    } else {
                        if (typeof manager.updateConfigProperty === 'function') {
                            manager.updateConfigProperty(key, newValue);
                        } else if (import.meta.env.DEV) {
                            console.warn(`[CanvasOrchestrator] Manager for layer ${layerIdStr} missing updateConfigProperty for ${key}`);
                        }
                    }
                }
            });
        }
        if (changedOverall || !prevConfigs) {
            if (import.meta.env.DEV && changedOverall) {
                 console.log(`[CanvasOrchestrator Reactive Effect] Overall changes detected. Updating prevLayerConfigsRef to reflect currentContextLayerConfigs.`);
            }
            prevLayerConfigsRef.current = JSON.parse(JSON.stringify(currentContextLayerConfigs));
        }
    }, [currentContextLayerConfigs, managersReady, managerInstancesRef, configLoadNonce]);


    const setCanvasLayerImage = useCallback((layerId, src) => {
        if (!managersReady) {
            if (import.meta.env.DEV) {
                console.warn("[CanvasOrchestrator setCanvasLayerImage] Attempted to set image, but managers are not ready.");
            }
            return Promise.reject(new Error("Managers not ready"));
        }
        return setLayerImageInternal(layerId, src);
    }, [managersReady, setLayerImageInternal]);

    const applyTokenAssignmentsToManagers = useCallback(async (assignments) => {
        if (!isMountedRef.current || !managersReady || !managerInstancesRef.current || !assignments || !configServiceRef?.current) {
            if (import.meta.env.DEV) {
                console.warn("[CanvasOrchestrator applyTokenAssignmentsToManagers] Aborted due to unmet conditions:", {
                    isMounted: isMountedRef.current, managersReady, hasManagerInstances: !!managerInstancesRef.current, hasAssignments: !!assignments, hasConfigService: !!configServiceRef?.current
                });
            }
            return Promise.resolve();
        }
        const currentManagers = managerInstancesRef.current;
        const imageLoadPromises = [];

        for (const layerId of ['1', '2', '3']) { // Assuming fixed layer IDs
            const manager = currentManagers[layerId];
            if (!manager) continue;

            const assignmentValue = assignments[layerId];
            const defaultAssetSrcForThisLayer = defaultAssets[layerId];
            let imageSourceToApply = defaultAssetSrcForThisLayer;

            try {
                if (typeof assignmentValue === 'string' && assignmentValue.startsWith("DEMO_LAYER_")) {
                    const demoAssetSource = demoAssetMap[assignmentValue];
                    if (demoAssetSource) {
                        imageSourceToApply = demoAssetSource;
                    } else if (import.meta.env.DEV) {
                        console.warn(`[CanvasOrchestrator] Demo key '${assignmentValue}' not found for L${layerId}. Using default: ${defaultAssetSrcForThisLayer}`);
                    }
                } else if (typeof assignmentValue === 'object' && assignmentValue?.type === 'owned' && assignmentValue.iconUrl) {
                    imageSourceToApply = assignmentValue.iconUrl;
                } else if (typeof assignmentValue === 'string' && isAddress(assignmentValue)) {
                    const metadata = await resolveLsp4Metadata(configServiceRef.current, assignmentValue);
                    let resolvedImageUrl = null;
                    if (metadata?.LSP4Metadata) {
                        const meta = metadata.LSP4Metadata;
                        const url = meta.assets?.[0]?.url || meta.icon?.[0]?.url || meta.images?.[0]?.[0]?.url || null;
                        if (url && typeof url === 'string') {
                            const trimmedUrl = url.trim();
                            if (trimmedUrl.startsWith('ipfs://')) resolvedImageUrl = `${IPFS_GATEWAY}${trimmedUrl.slice(7)}`;
                            else if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) resolvedImageUrl = trimmedUrl;
                        }
                    }
                    if (resolvedImageUrl) {
                        imageSourceToApply = resolvedImageUrl;
                    } else if (import.meta.env.DEV) {
                        console.warn(`[CanvasOrchestrator] Could not resolve image URL from LSP4 for ${assignmentValue} on L${layerId}. Using default: ${defaultAssetSrcForThisLayer}`);
                    }
                } else if (typeof assignmentValue === 'string' && (assignmentValue.includes('/') || assignmentValue.startsWith('data:'))) {
                     imageSourceToApply = assignmentValue;
                } else if (assignmentValue === null || assignmentValue === undefined) {
                    imageSourceToApply = defaultAssetSrcForThisLayer;
                } else if (assignmentValue && import.meta.env.DEV) {
                    console.warn(`[CanvasOrchestrator] Unhandled assignment type or value for L${layerId}:`, assignmentValue, `. Using default: ${defaultAssetSrcForThisLayer}`);
                }

                if (manager.setImage && imageSourceToApply) {
                    imageLoadPromises.push(
                        setLayerImageInternal(layerId, imageSourceToApply).catch(err => {
                            if (import.meta.env.DEV) {
                                console.error(`[CanvasOrchestrator] L${layerId}: Error setting image '${String(imageSourceToApply).substring(0,60)}...':`, err);
                            }
                            if (defaultAssetSrcForThisLayer && manager.setImage && imageSourceToApply !== defaultAssetSrcForThisLayer) {
                                if (import.meta.env.DEV) {
                                    console.log(`[CanvasOrchestrator] L${layerId}: Falling back to default asset '${defaultAssetSrcForThisLayer}' after error.`);
                                }
                                return setLayerImageInternal(layerId, defaultAssetSrcForThisLayer);
                            }
                            return Promise.reject(err);
                        })
                    );
                } else if (!manager.setImage && import.meta.env.DEV) {
                    console.warn(`[CanvasOrchestrator] L${layerId}: manager.setImage is not available.`);
                }
            } catch (errorAssignmentProcessing) {
                if (import.meta.env.DEV) {
                    console.error(`[CanvasOrchestrator] L${layerId}: Outer error processing assignment '${JSON.stringify(assignmentValue)}': `, errorAssignmentProcessing);
                }
                if (defaultAssetSrcForThisLayer && manager?.setImage) {
                    imageLoadPromises.push(setLayerImageInternal(layerId, defaultAssetSrcForThisLayer));
                }
            }
        }
        if (imageLoadPromises.length > 0) {
            await Promise.allSettled(imageLoadPromises);
        }
    }, [managersReady, configServiceRef, managerInstancesRef, setLayerImageInternal]);

    const applyConfigurationsToManagers = useCallback((configs) => {
        if (!managersReady) {
            if (import.meta.env.DEV) {
                console.warn("[CanvasOrchestrator applyConfigurationsToManagers] Attempted to apply configs, but managers are not ready.");
            }
            return;
        }
        if (import.meta.env.DEV) {
            console.log("[CanvasOrchestrator] applyConfigurationsToManagers CALLED with:", configs ? JSON.parse(JSON.stringify(configs)) : null);
        }
        applyConfigsToManagersInternal(configs);
        prevLayerConfigsRef.current = configs ? JSON.parse(JSON.stringify(configs)) : null;
        lastProcessedNonceByOrchestratorRef.current = configLoadNonce;

    }, [managersReady, applyConfigsToManagersInternal, configLoadNonce]);

    const stopCanvasAnimations = useCallback(() => {
        stopAllAnimationsInternal();
    }, [stopAllAnimationsInternal]);

    const restartCanvasAnimations = useCallback(() => {
        if (managersReady) {
            restartAllAnimationsInternal();
        } else if (import.meta.env.DEV) {
            console.warn("[CanvasOrchestrator restartCanvasAnimations] Attempted to restart animations, but managers are not ready.");
        }
    }, [managersReady, restartAllAnimationsInternal]);

    const redrawAllCanvases = useCallback(async (configs = null) => {
        if (!managersReady) {
            if (import.meta.env.DEV) {
                console.warn("[CanvasOrchestrator redrawAllCanvases] Attempted to redraw, but managers are not ready.");
            }
            return false;
        }
        return forceRedrawAllInternal(configs);
    }, [managersReady, forceRedrawAllInternal]);

    const handleCanvasResize = useCallback(() => {
        debouncedResizeHandler();
    }, [debouncedResizeHandler]);


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
    }), [
        managersReady, defaultImagesLoaded, managerInstancesRef,
        applyConfigurationsToManagers, applyTokenAssignmentsToManagers,
        stopCanvasAnimations, restartCanvasAnimations, redrawAllCanvases,
        handleCanvasResize, setCanvasLayerImage
    ]);
}