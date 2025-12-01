// src/hooks/usePixiOrchestrator.js
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import PixiEngine from '../utils/PixiEngine';
import { resolveImageUrl } from '../utils/imageDecoder';

export function usePixiOrchestrator({ 
  canvasRef, 
  sideA, 
  sideB, 
  crossfaderValue, 
  isReady,
  transitionMode
}) {
  const engineRef = useRef(null);
  const [isEngineReady, setIsEngineReady] = useState(false);

  // 1. Initialization
  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      const engine = new PixiEngine(canvasRef.current);
      engine.init().then(() => {
        engineRef.current = engine;
        setIsEngineReady(true);
        
        // Initial Sync
        if (sideA?.config) syncDeckConfig(engine, sideA.config, 'A');
        if (sideB?.config) syncDeckConfig(engine, sideB.config, 'B');
      });
    }
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
        setIsEngineReady(false);
      }
    };
  }, [canvasRef]); 

  // 2. Helper to sync config changes from React to Pixi
  const syncDeckConfig = (engine, configWrapper, side) => {
    if (!configWrapper) return;
    const { layers, tokenAssignments } = configWrapper;
    ['1', '2', '3'].forEach(layerId => {
        if (layers && layers[layerId]) engine.snapConfig(layerId, layers[layerId], side);
        if (tokenAssignments && tokenAssignments[layerId]) {
            const token = tokenAssignments[layerId];
            const src = resolveImageUrl(token);
            const id = typeof token === 'object' ? token.id : token;
            engine.setTexture(layerId, side, src, id);
        }
    });
  };

  // 3. Reactive Updates
  // We ONLY sync heavy config objects here. 
  // Fast stuff (crossfader, audio) is read directly by engine from store.
  
  useEffect(() => { 
      if (isEngineReady && engineRef.current && sideA?.config) {
          syncDeckConfig(engineRef.current, sideA.config, 'A'); 
      }
  }, [sideA, isEngineReady]);

  useEffect(() => { 
      if (isEngineReady && engineRef.current && sideB?.config) {
          syncDeckConfig(engineRef.current, sideB.config, 'B'); 
      }
  }, [sideB, isEngineReady]);

  // REMOVED: setCrossfade useEffect (This was causing the crash)
  // REMOVED: setTransitionMode useEffect (Engine reads this from store loop)

  // 4. Expose API for React Components
  const managerInstancesRef = useMemo(() => {
    const createLayerProxy = (layerId) => ({
        getState: (deckSide) => engineRef.current?.getState(layerId, deckSide),
        
        updateConfigProperty: (key, value) => engineRef.current?.updateConfig(layerId, key, value, 'A'),
        updateConfigBProperty: (key, value) => engineRef.current?.updateConfig(layerId, key, value, 'B'),
        
        snapProperty: (key, value) => engineRef.current?.snapConfig(layerId, { [key]: value }, 'A'),
        snapPropertyB: (key, value) => engineRef.current?.snapConfig(layerId, { [key]: value }, 'B'),

        setTargetValue: (key, value) => engineRef.current?.updateConfig(layerId, key, value, 'A'),
        setTargetValueB: (key, value) => engineRef.current?.updateConfig(layerId, key, value, 'B'),
        
        setAudioFrequencyFactor: (factor) => { if (engineRef.current) engineRef.current.setAudioFactors({ [layerId]: factor }); },
        triggerBeatPulse: (factor, duration) => engineRef.current?.triggerBeatPulse(factor, duration),
        resetAudioModifications: () => engineRef.current?.setAudioFactors({ '1': 1, '2': 1, '3': 1 }),
        
        setParallax: (x, y) => engineRef.current?.setParallax(x, y),
        
        applyPlaybackValue: (key, value) => engineRef.current?.applyPlaybackValue(layerId, key, value),
        clearPlaybackValues: () => engineRef.current?.clearPlaybackValues(),
        
        updateEffectConfig: (name, param, value) => engineRef.current?.updateEffectConfig(name, param, value),
        syncPhysics: (targetDeck) => engineRef.current?.syncDeckPhysics(layerId, targetDeck),

        destroy: () => {},
        startAnimationLoop: () => {},
        stopAnimationLoop: () => {}
    });

    return {
        current: {
            '1': createLayerProxy('1'),
            '2': createLayerProxy('2'),
            '3': createLayerProxy('3'),
        }
    };
  }, []);

  const restartCanvasAnimations = useCallback(() => { if (engineRef.current) engineRef.current.app.ticker.start(); }, []);
  const stopCanvasAnimations = useCallback(() => { if (engineRef.current) engineRef.current.app.ticker.stop(); }, []);
  
  const setCanvasLayerImage = useCallback(async (layerId, src, tokenId) => {
    // We still use the prop here to determine which deck to load into
    const activeDeck = crossfaderValue < 0.5 ? 'A' : 'B';
    if (engineRef.current) await engineRef.current.setTexture(layerId, activeDeck, src, tokenId);
  }, [crossfaderValue]);

  return {
    isEngineReady,
    managerInstancesRef,
    restartCanvasAnimations,
    stopCanvasAnimations,
    setCanvasLayerImage,
    engineRef
  };
}