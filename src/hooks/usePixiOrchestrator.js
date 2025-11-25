// src/hooks/usePixiOrchestrator.js
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import PixiEngine from '../utils/PixiEngine';
import { resolveImageUrl } from '../utils/imageDecoder';

export function usePixiOrchestrator({ canvasRef, sideA, sideB, crossfaderValue, isReady }) {
  const engineRef = useRef(null);
  const [isEngineReady, setIsEngineReady] = useState(false);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      const engine = new PixiEngine(canvasRef.current);
      engine.init().then(() => {
        engineRef.current = engine;
        setIsEngineReady(true);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef]); 

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

  useEffect(() => { if (isEngineReady && engineRef.current && sideA?.config) syncDeckConfig(engineRef.current, sideA.config, 'A'); }, [sideA, isEngineReady]);
  useEffect(() => { if (isEngineReady && engineRef.current && sideB?.config) syncDeckConfig(engineRef.current, sideB.config, 'B'); }, [sideB, isEngineReady]);
  useEffect(() => { if (isEngineReady && engineRef.current) engineRef.current.setCrossfade(crossfaderValue); }, [crossfaderValue, isEngineReady]);

  const managerInstancesRef = useMemo(() => {
    const createLayerProxy = (layerId) => ({
        getState: (deckSide) => engineRef.current?.getState(layerId, deckSide),
        updateConfigProperty: (key, value) => engineRef.current?.updateConfig(layerId, key, value, 'A'),
        updateConfigBProperty: (key, value) => engineRef.current?.updateConfig(layerId, key, value, 'B'),
        setTargetValue: (key, value) => engineRef.current?.updateConfig(layerId, key, value, 'A'),
        setTargetValueB: (key, value) => engineRef.current?.updateConfig(layerId, key, value, 'B'),
        setAudioFrequencyFactor: (factor) => { if (engineRef.current) engineRef.current.setAudioFactors({ [layerId]: factor }); },
        triggerBeatPulse: (factor, duration) => engineRef.current?.triggerBeatPulse(factor, duration),
        resetAudioModifications: () => engineRef.current?.setAudioFactors({ '1': 1, '2': 1, '3': 1 }),
        setParallax: (x, y) => engineRef.current?.setParallax(x, y),
        applyPlaybackValue: (key, value) => engineRef.current?.applyPlaybackValue(layerId, key, value),
        clearPlaybackValues: () => engineRef.current?.clearPlaybackValues(),
        
        // --- NEW: Pass through Effect Updates ---
        updateEffectConfig: (name, param, value) => engineRef.current?.updateEffectConfig(name, param, value),

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