// src/hooks/usePixiOrchestrator.js
import { useEffect, useState, useCallback } from 'react';
import PixiEngine from '../utils/PixiEngine';
import { resolveImageUrl } from '../utils/imageDecoder';

// SINGLETON REGISTRY
let globalEngineInstance = null;
export const getPixiEngine = () => globalEngineInstance;

export function usePixiOrchestrator({ 
  canvasRef, 
  sideA, 
  sideB, 
  crossfaderValue, 
  isReady 
}) {
  const [isEngineReady, setIsEngineReady] = useState(false);

  useEffect(() => {
    if (canvasRef.current && !globalEngineInstance) {
      console.log("[Orchestrator] Initializing Global PixiEngine...");
      const engine = new PixiEngine(canvasRef.current);
      
      engine.init().then(() => {
        globalEngineInstance = engine;
        setIsEngineReady(true);
        
        if (sideA?.config) syncDeckConfig(engine, sideA.config, 'A');
        if (sideB?.config) syncDeckConfig(engine, sideB.config, 'B');
      });
    }

    return () => {
      if (globalEngineInstance) {
        console.log("[Orchestrator] Destroying Global PixiEngine...");
        globalEngineInstance.destroy();
        globalEngineInstance = null;
        setIsEngineReady(false);
      }
    };
  }, [canvasRef]); 

  const syncDeckConfig = (engine, configWrapper, side) => {
    if (!configWrapper) return;
    const { layers, tokenAssignments } = configWrapper;
    
    ['1', '2', '3'].forEach(layerId => {
        if (layers?.[layerId]) engine.snapConfig(layerId, layers[layerId], side);
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
          syncDeckConfig(globalEngineInstance, sideA.config, 'A'); 
      }
  }, [sideA, isEngineReady]);

  useEffect(() => { 
      if (isEngineReady && globalEngineInstance && sideB?.config) {
          syncDeckConfig(globalEngineInstance, sideB.config, 'B'); 
      }
  }, [sideB, isEngineReady]);

  const restartCanvasAnimations = useCallback(() => globalEngineInstance?.app.ticker.start(), []);
  const stopCanvasAnimations = useCallback(() => globalEngineInstance?.app.ticker.stop(), []);
  
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