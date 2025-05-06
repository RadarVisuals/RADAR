import { useRef, useCallback, useEffect, useState } from "react";
import VisualEffectsProcessor from "../utils/VisualEffectsProcessor"; // Adjust path if needed

/**
 * @typedef EffectConfig Base structure for defining a visual effect.
 * @property {string} type - The type identifier of the effect (e.g., 'color_overlay').
 * @property {string | number} layer - The target layer ID ('global', 1, 2, or 3).
 * @property {object} [config] - Effect-specific configuration options (e.g., color, duration).
 * @property {string} [effectId] - Optional unique ID; one will be generated if not provided.
 * @property {boolean} [isPersistent=false] - Flag indicating if the effect should persist (currently placeholder).
 * @property {boolean} [preserveAnimation=false] - Hint for whether background animations should be preserved.
 */

/**
 * @typedef EffectControlObject Object returned after applying an effect, allowing external control.
 * @property {string} effectId - The unique ID of the applied effect instance.
 * @property {string | number} layer - The target layer of the effect.
 * @property {() => void} clear - Function to manually stop and clean up the effect instance.
 */

/**
 * @typedef VisualEffectsAPI Interface provided by the useVisualEffects hook.
 * @property {(effectConfig: EffectConfig) => Promise<string | null>} processEffect - Processes and applies a given effect configuration. Returns the effect ID on success, null on failure.
 * @property {(eventType: string) => Promise<string | null>} createDefaultEffect - Creates and applies a default visual effect based on an event type string. Returns the effect ID on success, null on failure.
 * @property {(effectId: string) => void} clearPersistentEffect - Clears a specific effect by its ID (primarily intended for effects marked as persistent, though currently clears any effect).
 * @property {() => void} clearAllTimedEffects - Clears all currently active effects managed by the internal processor.
 * @property {object} persistentEffects - State holding configurations of effects marked as persistent (currently placeholder state).
 */

/**
 * Initializes and manages a `VisualEffectsProcessor` instance to handle the
 * creation, application, and cleanup of visual effects (like color overlays)
 * triggered by events or actions within the application. It provides functions
 * to process specific effect configurations or generate default effects based on event types.
 *
 * @param {(layerId: string | number, key: string, value: any) => void | null} updateLayerConfig - A function passed down from the configuration context, potentially used by some effects to modify layer properties directly (though current effects don't rely heavily on this).
 * @returns {VisualEffectsAPI} An object containing functions to manage visual effects.
 */
export function useVisualEffects(updateLayerConfig) {
  const processorRef = useRef(null);
  // State to potentially track persistent effects in the future
  const [persistentEffects, setPersistentEffects] = useState({});
  const updateLayerConfigRef = useRef(updateLayerConfig);

  // Keep the updateLayerConfig function reference up-to-date
  useEffect(() => {
    updateLayerConfigRef.current = updateLayerConfig;
  }, [updateLayerConfig]);

  // Initialize and clean up the VisualEffectsProcessor instance
  useEffect(() => {
    processorRef.current = new VisualEffectsProcessor();
    // console.log("[useVisualEffects] VisualEffectsProcessor Initialized."); // Removed log

    const processorInstance = processorRef.current; // Capture instance for cleanup closure

    return () => {
      // console.log("[useVisualEffects] Cleaning up VisualEffectsProcessor..."); // Removed log
      const processorToClean = processorRef.current || processorInstance;
      if (processorToClean && typeof processorToClean.cancelAllEffects === "function") {
        // console.log("[useVisualEffects] Calling cancelAllEffects on processor."); // Removed log
        processorToClean.cancelAllEffects();
      } else {
        // Keep warning for potential cleanup issues
        console.warn("[useVisualEffects] VisualEffectsProcessor instance or cancelAllEffects method not available during cleanup.");
      }
    };
  }, []);

  /** Processes and applies a specific visual effect configuration. */
  const processEffect = useCallback(async (effectConfig) => {
    const currentProcessor = processorRef.current;
    const currentUpdateFn = updateLayerConfigRef.current;

    if (!currentProcessor) {
      console.warn("[useVisualEffects processEffect] Processor not ready.");
      return null;
    }
    // Allow effects without needing updateLayerConfig for now
    // if (typeof currentUpdateFn !== "function") {
    //   console.warn("[useVisualEffects processEffect] updateLayerConfig function not available.");
    //   return null;
    // }
    if (!effectConfig || (!effectConfig.type && !effectConfig.effect) || !effectConfig.layer) {
      console.warn("[useVisualEffects processEffect] Invalid effect object:", effectConfig);
      return null;
    }

    const type = effectConfig.type || effectConfig.effect;
    const layerId = String(effectConfig.layer);
    const isPersistent = effectConfig.isPersistent === true;
    // Processor now generates ID internally if not provided
    const fullConfig = { ...effectConfig, type: type, layer: layerId };

    // console.log(`[useVisualEffects processEffect] Processing effect...`); // Removed log
    try {
      const controlObject = await currentProcessor.processEffect(fullConfig, currentUpdateFn);
      if (controlObject?.effectId && isPersistent) {
        // console.log(`[useVisualEffects processEffect] Registered persistent effect placeholder: ${controlObject.effectId}`); // Removed log
        // Placeholder state update if needed: setPersistentEffects(prev => ({ ...prev, [controlObject.effectId]: fullConfig }));
      }
      return controlObject?.effectId;
    } catch (error) {
      // Keep error log
      console.error(`[useVisualEffects processEffect] Error processing effect ${effectConfig.effectId || '(new)'}:`, error);
      return null;
    }
  }, []);

  /** Creates and applies a default visual effect based on an event type string. */
  const createDefaultEffect = useCallback(async (eventType) => {
    const currentProcessor = processorRef.current;
    const currentUpdateFn = updateLayerConfigRef.current;

    if (!currentProcessor) {
      console.warn("[useVisualEffects createDefaultEffect] Processor not ready.");
      return null;
    }
    // Allow effects without needing updateLayerConfig for now
    // if (typeof currentUpdateFn !== "function") {
    //   console.warn("[useVisualEffects createDefaultEffect] updateLayerConfig function not available.");
    //   return null;
    // }

    // console.log(`[useVisualEffects createDefaultEffect] Creating default effect for event: ${eventType}`); // Removed log
    try {
      const controlObject = await currentProcessor.createDefaultEffect(eventType, currentUpdateFn);
      return controlObject?.effectId;
    } catch (error) {
      // Keep error log
      console.error(`[useVisualEffects createDefaultEffect] Error creating default effect for ${eventType}:`, error);
      if (error instanceof TypeError && error.message.includes("is not a function")) {
        console.error(`[useVisualEffects createDefaultEffect] DETECTED 'is not a function' error. Processor state:`, currentProcessor);
      }
      return null;
    }
  }, []);

  /** Manually stops and cleans up a specific effect instance by its ID. */
  const clearPersistentEffect = useCallback((effectId) => {
    const currentProcessor = processorRef.current;
    if (!currentProcessor) {
      console.warn("[useVisualEffects clearPersistentEffect] Processor not ready.");
      return;
    }
    if (!effectId) return;

    // console.log(`[useVisualEffects clearPersistentEffect] Clearing effect: ${effectId}`); // Removed log
    try {
      currentProcessor.cancelEffect(effectId);
      setPersistentEffects((prev) => {
        if (!prev[effectId]) return prev;
        const newState = { ...prev };
        delete newState[effectId];
        // console.log(`[useVisualEffects clearPersistentEffect] Persistent effect ${effectId} removed from state.`); // Removed log
        return newState;
      });
    } catch (error) {
      // Keep error log
      console.error(`[useVisualEffects clearPersistentEffect] Error cancelling effect ${effectId}:`, error);
    }
  }, []);

  /** Stops and cleans up ALL currently active effects managed by the processor. */
  const clearAllTimedEffects = useCallback(() => {
    const currentProcessor = processorRef.current;
    if (!currentProcessor) {
      console.warn("[useVisualEffects clearAllTimedEffects] Processor not ready.");
      return;
    }

    // console.log("[useVisualEffects clearAllTimedEffects] Clearing ALL processor-managed effects."); // Removed log
    try {
      currentProcessor.cancelAllEffects();
      // setPersistentEffects({}); // Clear local persistent state if needed
    } catch (error) {
      // Keep error log
      console.error(`[useVisualEffects clearAllTimedEffects] Error cancelling all effects:`, error);
    }
  }, []);

  return {
    processEffect,
    createDefaultEffect,
    clearPersistentEffect,
    clearAllTimedEffects,
    persistentEffects,
  };
}