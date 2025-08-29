// src/hooks/useCanvasOrchestrator.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { useVisualConfig } from '../context/VisualConfigContext';
import { useCanvasManagers } from './useCanvasManagers';

import debounce from '../utils/debounce';
import { resolveLsp4Metadata } from '../utils/erc725.js';
import { demoAssetMap } from '../assets/DemoLayers/initLayers';
import { IPFS_GATEWAY } from '../config/global-config';
import { INTERPOLATED_MIDI_PARAMS } from '../config/midiConstants';

import { isAddress } from 'viem';
import CanvasManager from '../utils/CanvasManager';

const RESIZE_DEBOUNCE_DELAY = 250;

const defaultAssets = {
    1: demoAssetMap.DEMO_LAYER_4 || '',
    2: demoAssetMap.DEMO_LAYER_4 || '',
    3: demoAssetMap.DEMO_LAYER_4 || '',
};

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
 * @param {boolean} params.isInitiallyResolved - A flag from `PresetManagementContext` that is true only after the initial workspace has been loaded.
 * @param {string} params.pLockState - The current state of the p-lock sequencer.
 * @returns {CanvasOrchestratorAPI} An API object for interacting with the orchestrated canvas managers.
 */
export function useCanvasOrchestrator({ configServiceRef, canvasRefs, configLoadNonce, isInitiallyResolved, pLockState }) {
    const isMountedRef = useRef(false);
    const [managersReady, setManagersReady] = useState(false);
    const [defaultImagesLoaded, setDefaultImagesLoaded] = useState(false);
    const lastProcessedNonceByOrchestratorRef = useRef(0);
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

    const rawHandleResize = useRef(handleResizeInternal);
    const debouncedResizeHandler = useMemo(
        () => debounce(() => { if (rawHandleResize.current) rawHandleResize.current(); }, RESIZE_DEBOUNCE_DELAY),
        []
    );

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        rawHandleResize.current = handleResizeInternal;
    }, [handleResizeInternal]);

    useEffect(() => {
        if (managersInitialized && isMountedRef.current) {
            const allManagersExist = Object.keys(canvasRefs).every(
                (id) => managerInstancesRef.current?.[id] instanceof CanvasManager
            );
            if (managersReady !== allManagersExist) {
                setManagersReady(allManagersExist);
            }
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
                        if (import.meta.env.DEV) {
                            console.error(`[CanvasOrchestrator] Default Image Load FAILED L${layerId} (src: ${src}):`, e);
                        }
                        return Promise.reject(e);
                    });
                }
                return Promise.resolve();
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
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.error("[CanvasOrchestrator] Unexpected error in Promise.allSettled for default images:", e);
                }
                if (isMountedRef.current) setDefaultImagesLoaded(false);
            }
        };
        loadImages();
    }, [managersReady, defaultImagesLoaded, managerInstancesRef]);

    const { layerConfigs: currentContextLayerConfigs } = useVisualConfig();

    // This is the core reactive effect that applies visual changes.
    useEffect(() => {
        if (!isInitiallyResolved) {
            return;
        }

        if (pLockState === 'playing' || pLockState === 'resetting' || pLockState === 'arming_to_play') {
            return;
        }

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
    }, [currentContextLayerConfigs, managersReady, managerInstancesRef, configLoadNonce, isInitiallyResolved, pLockState]);

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
      if (!isMountedRef.current || !managersReady || !managerInstancesRef.current || !assignments) {
          if (import.meta.env.DEV) {
              console.warn("[CanvasOrchestrator applyTokenAssignmentsToManagers] Aborted due to unmet conditions:", {
                  isMounted: isMountedRef.current, managersReady, hasManagerInstances: !!managerInstancesRef.current, hasAssignments: !!assignments
              });
          }
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
                  if (demoAssetSource) {
                      imageSourceToApply = demoAssetSource;
                  }
              } else if (typeof assignmentValue === 'object' && assignmentValue !== null && assignmentValue.src) {
                  imageSourceToApply = assignmentValue.src;
              } else if (assignmentValue && import.meta.env.DEV) {
                  console.warn(`[CanvasOrchestrator] Unhandled assignment type for L${layerId}:`, assignmentValue, `. Using default.`);
              }
  
              if (manager.setImage && imageSourceToApply) {
                  imageLoadPromises.push(
                      setLayerImageInternal(layerId, imageSourceToApply).catch(err => {
                          if (import.meta.env.DEV) {
                              console.error(`[CanvasOrchestrator] L${layerId}: Error setting image '${String(imageSourceToApply).substring(0,60)}...':`, err);
                          }
                          if (defaultAssetSrcForThisLayer && manager.setImage && imageSourceToApply !== defaultAssetSrcForThisLayer) {
                              if (import.meta.env.DEV) {
                                  console.log(`[CanvasOrchestrator] L${layerId}: Falling back to default asset after error.`);
                              }
                              return setLayerImageInternal(layerId, defaultAssetSrcForThisLayer);
                          }
                          return Promise.reject(err);
                      })
                  );
              }
          } catch (error) {
              if (import.meta.env.DEV) {
                  console.error(`[CanvasOrchestrator] L${layerId}: Outer error processing assignment '${JSON.stringify(assignmentValue)}': `, error);
              }
              if (defaultAssetSrcForThisLayer && manager?.setImage) {
                  imageLoadPromises.push(setLayerImageInternal(layerId, defaultAssetSrcForThisLayer));
              }
          }
      }
      if (imageLoadPromises.length > 0) {
          await Promise.allSettled(imageLoadPromises);
      }
    }, [managersReady, managerInstancesRef, setLayerImageInternal]);

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