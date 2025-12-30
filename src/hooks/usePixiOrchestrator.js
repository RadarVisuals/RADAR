// src/hooks/usePixiOrchestrator.js
import { useEffect, useState, useCallback, useRef } from 'react';
import PixiEngine from '../utils/PixiEngine';
import { resolveImageUrl } from '../utils/imageDecoder';

let globalEngineInstance = null;
let isInitializing = false; // Async lock to prevent duplicate app creation

export const getPixiEngine = () => globalEngineInstance;

export function usePixiOrchestrator({ 
  canvasRef, 
  sideA, 
  sideB, 
  crossfaderValue, 
  isReady 
}) {
  const [isEngineReady, setIsEngineReady] = useState(false);
  
  const lastProcessedSceneA = useRef(null);
  const lastProcessedSceneB = useRef(null);

  useEffect(() => {
    const startup = async () => {
      // If engine exists OR is currently booting up, do nothing.
      if (globalEngineInstance || isInitializing) return;

      if (canvasRef.current) {
        isInitializing = true;
        const engine = new PixiEngine(canvasRef.current);
        
        try {
          await engine.init();
          globalEngineInstance = engine;
          setIsEngineReady(true);
        } catch (err) {
          console.error("[Orchestrator] Startup failed:", err);
        } finally {
          isInitializing = false;
        }
      }
    };

    startup();

    return () => {
      // In a production build, we typically want the engine to persist.
      // If you need a hard reset on unmount, uncomment below.
      /*
      if (globalEngineInstance) {
          globalEngineInstance.destroy();
          globalEngineInstance = null;
          setIsEngineReady(false);
      }
      */
    };
  }, [canvasRef]); 

  const syncDeckConfig = (engine, configWrapper, side, forceSnap = false) => {
    if (!configWrapper) return;
    const { layers, tokenAssignments } = configWrapper;
    
    ['1', '2', '3'].forEach(layerId => {
        if (layers?.[layerId] && forceSnap) {
            engine.snapConfig(layerId, layers[layerId], side);
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
          const forceSnap = lastProcessedSceneA.current !== newName;
          syncDeckConfig(globalEngineInstance, sideA.config, 'A', forceSnap);
          lastProcessedSceneA.current = newName;
      }
  }, [sideA, isEngineReady]);

  useEffect(() => { 
      if (isEngineReady && globalEngineInstance && sideB?.config) {
          const newName = sideB.config.name;
          const forceSnap = lastProcessedSceneB.current !== newName;
          syncDeckConfig(globalEngineInstance, sideB.config, 'B', forceSnap);
          lastProcessedSceneB.current = newName;
      }
  }, [sideB, isEngineReady]);

  const restartCanvasAnimations = useCallback(() => globalEngineInstance?.app?.ticker.start(), []);
  const stopCanvasAnimations = useCallback(() => globalEngineInstance?.app?.ticker.stop(), []);
  
  const setCanvasLayerImage = useCallback(async (layerId, src, tokenId) => {
    const activeDeck = crossfaderValue < 0.5 ? 'A' : 'B';
    if (globalEngineInstance) await globalEngineInstance.setTexture(layerId, activeDeck, src, tokenId);
  }, [crossfaderValue]);

  return {
    isEngineReady,
    restartCanvasAnimations,
    stopCanvasAnimations,
    setCanvasLayerImage,
    engine: globalEngineInstance
  };
}