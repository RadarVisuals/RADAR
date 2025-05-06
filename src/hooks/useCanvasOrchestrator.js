// src/hooks/useCanvasOrchestrator.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCanvasManagers } from './useCanvasManagers';
import debounce from '../utils/debounce';
import { demoAssetMap } from '../assets/DemoLayers/initLayers';
import { isAddress } from 'viem';
import { resolveLsp4Metadata } from '../utils/erc725.js';
import { IPFS_GATEWAY } from '../config/global-config';

const RESIZE_DEBOUNCE_DELAY = 250;

const defaultAssets = {
    1: demoAssetMap.DEMO_LAYER_1 || '',
    2: demoAssetMap.DEMO_LAYER_2 || '',
    3: demoAssetMap.DEMO_LAYER_3 || '',
};

/**
 * Orchestrates the setup and interaction with multiple canvas layers managed by
 * `useCanvasManagers`. It initializes canvas refs, tracks the readiness of
 * managers and the loading state of default images, and provides a unified
 * interface for applying configurations, handling token assignments (delegating
 * complex logic to ConfigurationService), managing image loading state, and
 * controlling the canvas lifecycle (animations, redraws, resize).
 *
 * @param {object} options - Configuration options.
 * @param {React.RefObject<import('../services/ConfigurationService').default>} options.configServiceRef - A ref to the initialized ConfigurationService instance.
 * @param {Object.<string, React.RefObject<HTMLCanvasElement>>} options.canvasRefs - Refs to the canvas elements passed from the parent.
 * @returns {{
 *   managersReady: boolean,
 *   defaultImagesLoaded: boolean,
 *   managerInstancesRef: React.RefObject<Object.<string, import('../utils/CanvasManager').default>>,
 *   applyConfigurationsToManagers: (configs: Object.<string, object>) => void,
 *   applyTokenAssignmentsToManagers: (assignments: Object.<string, any>) => Promise<void>,
 *   updateLayerConfigProperty: (layerId: string, key: string, value: any) => void,
 *   stopCanvasAnimations: () => void,
 *   restartCanvasAnimations: () => void,
 *   redrawAllCanvases: (configs?: Object.<string, object> | null) => Promise<boolean>,
 *   handleCanvasResize: () => void,
 *   setCanvasLayerImage: (layerId: string, src: string) => Promise<void>
 * }} An object containing state flags, manager instance ref, and orchestration functions.
 */
export function useCanvasOrchestrator({ configServiceRef, canvasRefs }) {
    const isMountedRef = useRef(false);

    const [managersReady, setManagersReady] = useState(false);
    const [defaultImagesLoaded, setDefaultImagesLoaded] = useState(false);

    const {
        managerInstancesRef,
        isInitialized: managersInitialized,
        setLayerImage: setLayerImageInternal,
        applyConfigurations: applyConfigsToManagersInternal,
        stopAllAnimations: stopAllAnimationsInternal,
        restartAllAnimations: restartAllAnimationsInternal,
        forceRedrawAll: forceRedrawAllInternal,
        handleResize: handleResizeInternal,
        updateLayerProperty,
    } = useCanvasManagers(canvasRefs, defaultAssets);

    const rawHandleResize = useRef(handleResizeInternal);

    const debouncedResizeHandler = useMemo(
        () => debounce(() => {
            if (rawHandleResize.current) { rawHandleResize.current(); }
            else { console.warn("[useCanvasOrchestrator] Debounced resize skipped: handleResizeInternal not available."); }
        }, RESIZE_DEBOUNCE_DELAY),
        []
    );

    useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

    useEffect(() => { rawHandleResize.current = handleResizeInternal; }, [handleResizeInternal]);

    useEffect(() => {
        if (managersInitialized && isMountedRef.current) {
            const allManagersExist = Object.keys(canvasRefs).every( id => managerInstancesRef.current?.[id] instanceof Object );
            if (allManagersExist) {
                setManagersReady(true);
            } else {
                console.warn("[useCanvasOrchestrator] Managers initialized signal received BUT ref seems empty/incomplete. Keeping managersReady = false.");
                setManagersReady(false);
            }
        } else {
            if (managersReady) { setManagersReady(false); }
        }
    }, [managersInitialized, canvasRefs, managerInstancesRef, managersReady]);

    useEffect(() => {
        const logPrefix = "[useCanvasOrchestrator Default Image Load]";
        if (!managersReady || !isMountedRef.current || defaultImagesLoaded) {
            return;
        }

        const currentManagers = managerInstancesRef.current;
        const loadImages = async () => {
            const promises = [];

            for (const layerId in currentManagers) {
                const manager = currentManagers[layerId];
                const src = defaultAssets[layerId];

                if (manager && src && typeof manager.setImage === "function") {
                    promises.push(manager.setImage(src)
                        .catch((e) => {
                            console.error(`${logPrefix} FAILED L${layerId}:`, e);
                        }));
                } else if (!manager) {
                    console.warn(`${logPrefix} No manager instance found for L${layerId} during default load.`);
                } else if (!src) {
                     console.warn(`${logPrefix} No default asset source found for L${layerId}.`);
                }
            }

            try {
                const results = await Promise.allSettled(promises);
                const allSucceeded = results.every(r => r.status === 'fulfilled');
                if (isMountedRef.current) {
                    setDefaultImagesLoaded(allSucceeded);
                    if (!allSucceeded) {
                        console.error(`${logPrefix} One or more default images failed to load.`);
                    } else {
                        console.log(`${logPrefix} All default images loaded successfully.`);
                    }
                }
            } catch (error) {
                console.error(`${logPrefix} Unexpected error during default image loading:`, error);
                if (isMountedRef.current) {
                    setDefaultImagesLoaded(false);
                }
            }
        };

        loadImages();

    }, [managersReady, defaultImagesLoaded]);

    const setCanvasLayerImage = useCallback((layerId, src) => {
        if (!managersReady) {
           console.warn(`[useCanvasOrchestrator setCanvasLayerImage] Skipped L${layerId}: Managers not ready.`);
           return Promise.reject("Managers not ready");
        }
        return setLayerImageInternal(layerId, src);
    }, [managersReady, setLayerImageInternal]);

    const applyTokenAssignmentsToManagers = useCallback(async (assignments) => {
        const logPrefix = "[useCanvasOrchestrator applyTokens]";
        if (!isMountedRef.current || !managersReady || !managerInstancesRef.current || !assignments || !configServiceRef?.current) {
            console.log(`${logPrefix} Skipped (Pre-conditions not met).`);
            return Promise.resolve();
        }

        const currentManagers = managerInstancesRef.current;
        const imageLoadPromises = [];
        const layerSources = {};

        console.log(`${logPrefix} Starting assignment process...`, assignments);

        for (const layerId of ['1', '2', '3']) {
            const manager = currentManagers[layerId];
            if (!manager) {
                console.warn(`${logPrefix} Missing manager for L${layerId}`);
                continue;
            }

            const assignmentValue = assignments[layerId];
            const defaultAssetSrc = defaultAssets[layerId];
            let imageSourceToApply = defaultAssetSrc;

            try {
                // --- Resolve Image Source Logic ---
                if (typeof assignmentValue === 'string' && assignmentValue.startsWith("DEMO_LAYER_")) {
                    const demoAssetSource = demoAssetMap[assignmentValue];
                    if (demoAssetSource) { imageSourceToApply = demoAssetSource; }
                } else if (typeof assignmentValue === 'object' && assignmentValue?.type === 'owned' && assignmentValue.iconUrl) {
                    imageSourceToApply = assignmentValue.iconUrl;
                } else if (typeof assignmentValue === 'string' && isAddress(assignmentValue)) {
                    try {
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
                        if (resolvedImageUrl) { imageSourceToApply = resolvedImageUrl; }
                        else { console.warn(`${logPrefix} L${layerId}: Could not resolve image URL from LSP4 metadata for ${assignmentValue}`); }
                    } catch (error) { console.error(`${logPrefix} L${layerId}: Error resolving LSP4 for ${assignmentValue}:`, error); }
                } else if (typeof assignmentValue === 'string' && (assignmentValue.includes('/') || assignmentValue.startsWith('data:'))) {
                     imageSourceToApply = assignmentValue;
                }
                // --- End Resolve Image Source Logic ---

                layerSources[layerId] = imageSourceToApply;

                if (manager.setImage) {
                    if (imageSourceToApply) {
                        imageLoadPromises.push(
                            setLayerImageInternal(layerId, imageSourceToApply)
                                .catch(err => {
                                    console.error(`${logPrefix} L${layerId}: Error setting image '${imageSourceToApply.substring(0,60)}':`, err);
                                    if (defaultAssetSrc && manager.setImage) {
                                        return setLayerImageInternal(layerId, defaultAssetSrc)
                                                   .catch(revertErr => {
                                                        console.error(`${logPrefix} L${layerId}: Failed to revert to default image:`, revertErr);
                                                        throw revertErr;
                                                    });
                                    }
                                    throw err;
                                })
                        );
                    } else {
                        console.error(`${logPrefix} L${layerId}: CRITICAL - imageSourceToApply resolved to null/undefined! Reverting to default.`);
                        if (defaultAssetSrc && manager.setImage) {
                            imageLoadPromises.push(setLayerImageInternal(layerId, defaultAssetSrc));
                        }
                    }
                } else { console.warn(`${logPrefix} manager.setImage missing for L${layerId}`); }

            } catch (error) {
                console.error(`${logPrefix} L${layerId}: ERROR processing assignment '${JSON.stringify(assignmentValue)}': `, error);
                try {
                    if (defaultAssetSrc && manager.setImage) {
                       imageLoadPromises.push(setLayerImageInternal(layerId, defaultAssetSrc));
                    }
                } catch (revertError) { console.error(`${logPrefix} Failed to revert L${layerId} to default after error:`, revertError); }
            }
        }

        if (imageLoadPromises.length > 0) {
            console.log(`${logPrefix} Waiting for ${imageLoadPromises.length} image loading promises...`);
            const results = await Promise.allSettled(imageLoadPromises);
            console.log(`${logPrefix} All image loading promises settled. Results:`);
            results.forEach((result, index) => {
                const layerId = Object.keys(layerSources)[index] || `Promise ${index}`;
                const source = layerSources[layerId] || 'Unknown Source';
                if (result.status === 'fulfilled') {
                    console.log(`  Layer ${layerId} (Source: ${source.substring(0,60)}...): Fulfilled`);
                } else {
                    console.error(`  Layer ${layerId} (Source: ${source.substring(0,60)}...): Rejected - Reason:`, result.reason);
                }
            });
        } else {
            console.log(`${logPrefix} No image load promises to await.`);
        }

    }, [managersReady, configServiceRef, managerInstancesRef, setLayerImageInternal]);

    const applyConfigurationsToManagers = useCallback((configs) => {
        const logPrefix = "[useCanvasOrchestrator applyConfigs]"; // Add prefix
        if (!managersReady) { console.warn(`${logPrefix} Skipped: Managers not ready.`); return; }

        // --- ADDED STEP 3 LOGGING ---
        console.log(`${logPrefix} Applying configs:`, JSON.parse(JSON.stringify(configs || {})));
        // Adjust the key '3' if your layer IDs are different
        const layer3Key = '3';
        if (configs && configs[layer3Key]) {
            console.log(`${logPrefix} Layer 3 'enabled' being passed: ${configs[layer3Key].enabled}`);
        } else {
            console.log(`${logPrefix} Configs object missing Layer 3 (using key '${layer3Key}') when applying.`);
        }
        // --- END ADDED LOGGING ---

        applyConfigsToManagersInternal(configs);
    }, [managersReady, applyConfigsToManagersInternal]);


    const updateLayerConfigProperty = useCallback((layerId, key, value) => {
        if (!managersReady) { return; }
        updateLayerProperty(layerId, key, value);
    }, [managersReady, updateLayerProperty]);

    const stopCanvasAnimations = useCallback(() => { stopAllAnimationsInternal(); }, [stopAllAnimationsInternal]);

    const restartCanvasAnimations = useCallback(() => { if (!managersReady) return; restartAllAnimationsInternal(); }, [managersReady, restartAllAnimationsInternal]);

    const redrawAllCanvases = useCallback(async (configs = null) => {
        if (!managersReady) { console.warn("[useCanvasOrchestrator redrawAll] Skipped: Managers not ready."); return false; }
        return await forceRedrawAllInternal(configs);
    }, [managersReady, forceRedrawAllInternal]);

    const handleCanvasResize = useCallback(() => { debouncedResizeHandler(); }, [debouncedResizeHandler]);

    return {
        // canvasRefs removed from return
        managersReady,
        defaultImagesLoaded,
        managerInstancesRef,
        applyConfigurationsToManagers,
        applyTokenAssignmentsToManagers,
        updateLayerConfigProperty,
        stopCanvasAnimations,
        restartCanvasAnimations,
        redrawAllCanvases,
        handleCanvasResize,
        setCanvasLayerImage,
    };
}