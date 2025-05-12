// src/hooks/useCanvasOrchestrator.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCanvasManagers } from './useCanvasManagers';
import debounce from '../utils/debounce';
import { demoAssetMap } from '../assets/DemoLayers/initLayers';
import { isAddress } from 'viem';
import { resolveLsp4Metadata } from '../utils/erc725.js';
import { IPFS_GATEWAY } from '../config/global-config';
import { INTERPOLATED_MIDI_PARAMS } from '../config/midiConstants';
import { useVisualConfig } from '../context/VisualConfigContext';


const RESIZE_DEBOUNCE_DELAY = 250;

const defaultAssets = {
    1: demoAssetMap.DEMO_LAYER_1 || '',
    2: demoAssetMap.DEMO_LAYER_2 || '',
    3: demoAssetMap.DEMO_LAYER_3 || '',
};

export function useCanvasOrchestrator({ configServiceRef, canvasRefs, configLoadNonce }) { 
    const isMountedRef = useRef(false);
    const [managersReady, setManagersReady] = useState(false);
    const [defaultImagesLoaded, setDefaultImagesLoaded] = useState(false);
    const lastProcessedNonceByOrchestratorRef = useRef(0); 

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
                (id) => managerInstancesRef.current?.[id] instanceof Object
            );
            setManagersReady(allManagersExist);
        } else if (managersReady) { 
            setManagersReady(false);
        }
    }, [managersInitialized, canvasRefs, managerInstancesRef, managersReady]);

    useEffect(() => {
        if (!managersReady || !isMountedRef.current || defaultImagesLoaded) return;
        const currentManagers = managerInstancesRef.current;
        const loadImages = async () => {
            const promises = Object.keys(currentManagers).map(layerId => {
                const manager = currentManagers[layerId];
                const src = defaultAssets[layerId];
                if (manager && src && typeof manager.setImage === "function") {
                    return manager.setImage(src).catch((e) => {
                        if (import.meta.env.DEV) {
                            console.error(`[CanvasOrchestrator] Default Image Load FAILED L${layerId}:`, e);
                        }
                    });
                }
                return Promise.resolve();
            });
            try {
                const results = await Promise.allSettled(promises);
                if (isMountedRef.current) {
                    const allSucceeded = results.every(r => r.status === 'fulfilled');
                    setDefaultImagesLoaded(allSucceeded);
                }
            } catch (e) { 
                if (import.meta.env.DEV) {
                    console.error("[CanvasOrchestrator] Error in Promise.allSettled for default images:", e);
                }
                if (isMountedRef.current) setDefaultImagesLoaded(false); 
            }
        };
        loadImages();
    }, [managersReady, defaultImagesLoaded, managerInstancesRef]);

    const { layerConfigs: currentContextLayerConfigs } = useVisualConfig();
    const prevLayerConfigsRef = useRef(null);

    useEffect(() => {
        if (!managersReady || !currentContextLayerConfigs || !isMountedRef.current) {
            return;
        }

        if (configLoadNonce > lastProcessedNonceByOrchestratorRef.current) {
            if (import.meta.env.DEV) {
                console.log(`[CanvasOrchestrator] Reactive Effect: New configLoadNonce (${configLoadNonce}) detected. Orchestrator nonce was (${lastProcessedNonceByOrchestratorRef.current}). Deferring to RenderLifecycle. Updating orchestrator nonce.`);
            }
            lastProcessedNonceByOrchestratorRef.current = configLoadNonce;
            return; 
        }
        
        if (lastProcessedNonceByOrchestratorRef.current !== configLoadNonce && import.meta.env.DEV) {
            console.warn(`[CanvasOrchestrator] Reactive Effect: Nonce mismatch after initial check. Orchestrator: ${lastProcessedNonceByOrchestratorRef.current}, Global: ${configLoadNonce}. Syncing orchestrator nonce.`);
        }
        lastProcessedNonceByOrchestratorRef.current = configLoadNonce;


        const managers = managerInstancesRef.current;
        if (!managers) return;

        const prevConfigs = prevLayerConfigsRef.current;

        let changedOverall = false;
        for (const layerIdStr of ['1', '2', '3']) {
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

                /* // Previous detailed comparison log - kept commented for reference
                if (import.meta.env.DEV) {
                    const isDirectlyDifferent = oldValue !== newValue;
                    const isDriftStateKey = key === 'driftState';
                    const driftStateIsDifferent = isDriftStateKey && JSON.stringify(oldValue) !== JSON.stringify(newValue);
                    
                    const keysToAlwaysLog = ['opacity', 'size', 'speed', 'xaxis', 'yaxis', 'angle'];
                    if (propertyChanged || keysToAlwaysLog.includes(key) ) {
                        console.log(
                            `[Orchestrator Check L${layerIdStr} - ${key}] ` +
                            `Old: ${isDriftStateKey ? JSON.stringify(oldValue) : oldValue}, ` +
                            `New: ${isDriftStateKey ? JSON.stringify(newValue) : newValue}, ` +
                            `DirectlyDifferent: ${isDirectlyDifferent}, ` +
                            `DriftStateDifferent: ${isDriftStateKey ? driftStateIsDifferent : 'N/A'}, ` +
                            `PropChangedFlag: ${propertyChanged}`
                        );
                    }
                }
                */

                if (propertyChanged) {
                    changedOverall = true;
                    // --- FOCUSED LOGGING FOR PROPERTY APPLICATION ---
                    if (import.meta.env.DEV) {
                        const actionType = INTERPOLATED_MIDI_PARAMS.includes(key) ? "SNAP_VISUAL_PROPERTY" : "UPDATE_CONFIG_PROPERTY";
                        console.log(
                            `%c[ORCHESTRATOR_APPLY L${layerIdStr} - ${key}] Action: ${actionType}, NewValue: ${newValue}`,
                            'color: darkorange; font-weight: bold;', // Using darkorange for visibility
                            ` (Details: Old from prevLayerConfigsRef: ${key === 'driftState' ? JSON.stringify(oldValue) : oldValue}, NewValFromVisualConfigContext: ${key === 'driftState' ? JSON.stringify(newValue) : newValue})`
                        );
                    }
                    // --- END FOCUSED LOGGING ---

                    if (INTERPOLATED_MIDI_PARAMS.includes(key)) {
                        if (typeof manager.snapVisualProperty === 'function') {
                            manager.snapVisualProperty(key, newValue);
                        } else {
                            if (import.meta.env.DEV) {
                                console.warn(`[Orchestrator] manager for layer ${layerIdStr} missing snapVisualProperty for ${key}`);
                            }
                        }
                    } else {
                        if (typeof manager.updateConfigProperty === 'function') {
                            manager.updateConfigProperty(key, newValue);
                        } else {
                           if (import.meta.env.DEV) {
                                console.warn(`[Orchestrator] manager for layer ${layerIdStr} missing updateConfigProperty for ${key}`);
                           }
                        }
                    }
                }
            });
        }
        if (changedOverall) {
            if (import.meta.env.DEV) console.log(`[CanvasOrchestrator Reactive Effect] Overall changes detected. Updating prevLayerConfigsRef to reflect currentContextLayerConfigs.`);
            prevLayerConfigsRef.current = JSON.parse(JSON.stringify(currentContextLayerConfigs));
        }
    }, [currentContextLayerConfigs, managersReady, managerInstancesRef, configLoadNonce]);

    const setCanvasLayerImage = useCallback((layerId, src) => {
        if (!managersReady) return Promise.reject(new Error("Managers not ready"));
        return setLayerImageInternal(layerId, src);
    }, [managersReady, setLayerImageInternal]);

    const applyTokenAssignmentsToManagers = useCallback(async (assignments) => {
        if (!isMountedRef.current || !managersReady || !managerInstancesRef.current || !assignments || !configServiceRef?.current) {
            return Promise.resolve();
        }
        const currentManagers = managerInstancesRef.current;
        const imageLoadPromises = [];
        for (const layerId of ['1', '2', '3']) {
            const manager = currentManagers[layerId];
            if (!manager) continue;
            const assignmentValue = assignments[layerId];
            const defaultAssetSrcForThisLayer = defaultAssets[layerId];
            let imageSourceToApply = defaultAssetSrcForThisLayer;
            try {
                if (typeof assignmentValue === 'string' && assignmentValue.startsWith("DEMO_LAYER_")) {
                    const demoAssetSource = demoAssetMap[assignmentValue];
                    if (demoAssetSource) imageSourceToApply = demoAssetSource;
                    else if (import.meta.env.DEV) console.warn(`[Orchestrator] Demo key '${assignmentValue}' not found for L${layerId}.`);
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
                    if (resolvedImageUrl) imageSourceToApply = resolvedImageUrl;
                    else if (import.meta.env.DEV) console.warn(`[Orchestrator] Could not resolve image URL from LSP4 for ${assignmentValue} on L${layerId}`);
                } else if (typeof assignmentValue === 'string' && (assignmentValue.includes('/') || assignmentValue.startsWith('data:'))) {
                     imageSourceToApply = assignmentValue;
                } else if (assignmentValue && import.meta.env.DEV) {
                    console.warn(`[Orchestrator] Unhandled assignment type or value for L${layerId}:`, assignmentValue);
                }

                if (manager.setImage && imageSourceToApply) {
                    imageLoadPromises.push(
                        setLayerImageInternal(layerId, imageSourceToApply).catch(err => {
                            if (import.meta.env.DEV) console.error(`[CanvasOrchestrator] L${layerId}: Error setting image '${String(imageSourceToApply).substring(0,60)}':`, err);
                            if (defaultAssetSrcForThisLayer && manager.setImage && imageSourceToApply !== defaultAssetSrcForThisLayer) {
                                return setLayerImageInternal(layerId, defaultAssetSrcForThisLayer);
                            } 
                        })
                    );
                } else if (!manager.setImage && import.meta.env.DEV) {
                    console.warn(`[CanvasOrchestrator] L${layerId}: manager.setImage is not available.`);
                }
            } catch (errorAssignmentProcessing) { 
                if (import.meta.env.DEV) console.error(`[CanvasOrchestrator] L${layerId}: Outer error processing assignment '${JSON.stringify(assignmentValue)}': `, errorAssignmentProcessing);
                if (defaultAssetSrcForThisLayer && manager.setImage) {
                    imageLoadPromises.push(setLayerImageInternal(layerId, defaultAssetSrcForThisLayer));
                }
            }
        }
        if (imageLoadPromises.length > 0) await Promise.allSettled(imageLoadPromises);
    }, [managersReady, configServiceRef, managerInstancesRef, setLayerImageInternal]);

    const applyConfigurationsToManagers = useCallback((configs) => {
        if (!managersReady) return;
        if (import.meta.env.DEV) {
            console.log("[CanvasOrchestrator] applyConfigurationsToManagers CALLED with:", JSON.parse(JSON.stringify(configs)));
        }
        applyConfigsToManagersInternal(configs);
        prevLayerConfigsRef.current = configs ? JSON.parse(JSON.stringify(configs)) : null;
        lastProcessedNonceByOrchestratorRef.current = configLoadNonce;

    }, [managersReady, applyConfigsToManagersInternal, configLoadNonce]);

    const stopCanvasAnimations = useCallback(() => stopAllAnimationsInternal(), [stopAllAnimationsInternal]);
    const restartCanvasAnimations = useCallback(() => { if (managersReady) restartAllAnimationsInternal(); }, [managersReady, restartAllAnimationsInternal]);
    const redrawAllCanvases = useCallback(async (configs = null) => { if (!managersReady) return false; return forceRedrawAllInternal(configs); }, [managersReady, forceRedrawAllInternal]);
    const handleCanvasResize = useCallback(() => debouncedResizeHandler(), [debouncedResizeHandler]);

    return {
        managersReady, defaultImagesLoaded, managerInstancesRef,
        applyConfigurationsToManagers, applyTokenAssignmentsToManagers,
        stopCanvasAnimations, restartCanvasAnimations, redrawAllCanvases,
        handleCanvasResize, setCanvasLayerImage,
    };
}