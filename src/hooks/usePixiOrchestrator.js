// src/hooks/usePixiOrchestrator.js
import { useEffect, useState, useCallback, useRef } from 'react';
import PixiEngine from '../utils/PixiEngine';
import { resolveImageUrl } from '../utils/imageDecoder';

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
  
  // Track the last processed scene names to prevent "Sync-Back" stuttering.
  // This ensures we only call snapConfig (which kills smoothing) during 
  // actual scene loads, not during manual MIDI slider tweaks.
  const lastProcessedSceneA = useRef(null);
  const lastProcessedSceneB = useRef(null);

  useEffect(() => {
    if (canvasRef.current && !globalEngineInstance) {
      const engine = new PixiEngine(canvasRef.current);
      engine.init().then(() => {
        globalEngineInstance = engine;
        setIsEngineReady(true);
      });
    }

    return () => {
      if (globalEngineInstance) {
        globalEngineInstance.destroy();
        globalEngineInstance = null;
        setIsEngineReady(false);
      }
    };
  }, [canvasRef]); 

  const syncDeckConfig = (engine, configWrapper, side, forceSnap = false) => {
    if (!configWrapper) return;
    const { layers, tokenAssignments, name } = configWrapper;
    
    ['1', '2', '3'].forEach(layerId => {
        // Only perform a hard "snap" if the scene name changed or we are forcing it.
        // This preserves the "ValueInterpolator" glide during manual MIDI edits.
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

  // Sync Side A only when the Scene reference or name changes
  useEffect(() => { 
      if (isEngineReady && globalEngineInstance && sideA?.config) {
          const newName = sideA.config.name;
          const forceSnap = lastProcessedSceneA.current !== newName;
          
          syncDeckConfig(globalEngineInstance, sideA.config, 'A', forceSnap);
          lastProcessedSceneA.current = newName;
      }
  }, [sideA, isEngineReady]);

  // Sync Side B only when the Scene reference or name changes
  useEffect(() => { 
      if (isEngineReady && globalEngineInstance && sideB?.config) {
          const newName = sideB.config.name;
          const forceSnap = lastProcessedSceneB.current !== newName;

          syncDeckConfig(globalEngineInstance, sideB.config, 'B', forceSnap);
          lastProcessedSceneB.current = newName;
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