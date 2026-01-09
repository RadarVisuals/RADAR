// src/hooks/usePixiOrchestrator.js
import { useEffect, useState, useCallback, useRef } from 'react';
import PixiEngine from '../utils/PixiEngine';
import { resolveImageUrl } from '../utils/imageDecoder';

let globalEngineInstance = null;
let isInitializing = false; 

export const getPixiEngine = () => globalEngineInstance;

export function usePixiOrchestrator({ canvasRef, sideA, sideB, crossfaderValue, isReady }) {
  const [isEngineReady, setIsEngineReady] = useState(false);
  const lastProcessedSceneA = useRef(null);
  const lastProcessedSceneB = useRef(null);
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    const startup = async () => {
      if (globalEngineInstance || isInitializing) return;
      if (canvasRef.current) {
        isInitializing = true;
        const engine = new PixiEngine(canvasRef.current);
        try {
          await engine.init();
          globalEngineInstance = engine;
          setIsEngineReady(true);
        } catch (err) { console.error("[Orchestrator] Startup failed:", err); } 
        finally { isInitializing = false; }
      }
    };
    startup();
  }, [canvasRef]); 

  const syncDeckConfig = (engine, configWrapper, side, forceSnap = false) => {
    if (!configWrapper) return;
    const { layers, tokenAssignments } = configWrapper;
    
    ['1', '2', '3'].forEach(layerId => {
        if (layers?.[layerId]) {
            // FIX: If we are fading to this deck, SNAP the target scene configuration.
            // The Crossfader handles the visual glide; the individual parameters should not.
            if (forceSnap || isFirstLoadRef.current) {
                engine.snapConfig(layerId, layers[layerId], side);
            } else {
                // Background deck preparation
                engine.snapConfig(layerId, layers[layerId], side);
            }
        }
        if (tokenAssignments?.[layerId]) {
            const token = tokenAssignments[layerId];
            const src = resolveImageUrl(token);
            const id = typeof token === 'object' ? token.id : token;
            if (src) engine.setTexture(layerId, side, src, id);
        }
    });
  };

  useEffect(() => { 
      if (isEngineReady && globalEngineInstance && sideA?.config) {
          const newName = sideA.config.name;
          const configChanged = lastProcessedSceneA.current !== newName;
          syncDeckConfig(globalEngineInstance, sideA.config, 'A', configChanged);
          if (configChanged) { lastProcessedSceneA.current = newName; isFirstLoadRef.current = false; }
      }
  }, [sideA, isEngineReady]);

  useEffect(() => { 
      if (isEngineReady && globalEngineInstance && sideB?.config) {
          const newName = sideB.config.name;
          const configChanged = lastProcessedSceneB.current !== newName;
          syncDeckConfig(globalEngineInstance, sideB.config, 'B', configChanged);
          if (configChanged) { lastProcessedSceneB.current = newName; isFirstLoadRef.current = false; }
      }
  }, [sideB, isEngineReady]);

  const restartCanvasAnimations = useCallback(() => globalEngineInstance?.app?.ticker.start(), []);
  const stopCanvasAnimations = useCallback(() => globalEngineInstance?.app?.ticker.stop(), []);
  const setCanvasLayerImage = useCallback(async (layerId, src, tokenId) => {
    const activeDeck = crossfaderValue < 0.5 ? 'A' : 'B';
    if (globalEngineInstance) await globalEngineInstance.setTexture(layerId, activeDeck, src, tokenId);
  }, [crossfaderValue]);

  return { isEngineReady, restartCanvasAnimations, stopCanvasAnimations, setCanvasLayerImage, engine: globalEngineInstance };
}