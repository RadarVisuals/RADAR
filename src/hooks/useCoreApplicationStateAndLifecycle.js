// src/hooks/useCoreApplicationStateAndLifecycle.js
import { useRef, useEffect, useCallback, useMemo, startTransition } from "react";
import { usePixiOrchestrator } from "./usePixiOrchestrator"; 
import { useRenderLifecycle } from './useRenderLifecycle';
import { useCanvasContainer } from './useCanvasContainer';
import { useAudioVisualizer } from './useAudioVisualizer';
import { useAnimationLifecycleManager } from './useAnimationLifecycleManager';
import { usePLockSequencer } from './usePLockSequencer';
import { useVisualEngine } from '../hooks/useVisualEngine';
import { useUpProvider } from '../context/UpProvider';
import { useProjectStore } from '../store/useProjectStore'; 
import { useWalletStore } from '../store/useWalletStore'; 
import { useEngineStore } from '../store/useEngineStore';
import SignalBus from '../utils/SignalBus';
import fallbackConfig from '../config/fallback-config';

export const useCoreApplicationStateAndLifecycle = (props) => {
  const { isBenignOverlayActive, animatingPanel } = props;
  const isInitiallyResolved = useProjectStore(s => !!s.setlist);
  const loadError = useProjectStore(s => s.error);
  const isFullyLoaded = useProjectStore(s => !s.isLoading && !!s.activeWorkspaceName);
  const isLoading = useProjectStore(s => s.isLoading);
  const stagedWorkspace = useProjectStore(s => s.stagedWorkspace);
  const activeSceneName = useProjectStore(s => s.activeSceneName);
  const setActiveSceneName = useProjectStore(s => s.setActiveSceneName);
  const activeWorkspaceName = useProjectStore(s => s.activeWorkspaceName);
  const { sideA, sideB, renderedCrossfaderValue, uiControlConfig, updateLayerConfig, transitionMode } = useVisualEngine();
  const { upInitializationError, upFetchStateError } = useUpProvider();
  const currentProfileAddress = useWalletStore(s => s.hostProfileAddress);
  const isMountedRef = useRef(false);
  const internalResetLifecycleRef = useRef(null);
  const canvasRef = useRef(null); 
  const hasInitializedDecksRef = useRef(false);

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);
  const isReadyForLifecycle = isFullyLoaded && !isLoading;
  
  const fullSceneList = useMemo(() => 
    Object.values(stagedWorkspace?.presets || {})
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })), 
    [stagedWorkspace]
  );

  useEffect(() => {
    if (!isReadyForLifecycle || hasInitializedDecksRef.current) return;
    
    const store = useEngineStore.getState();
    store.setCrossfader(0.0); 
    store.setRenderedCrossfader(0.0); 
    SignalBus.emit('crossfader:set', 0.0);

    if (fullSceneList.length > 0) {
        const initialSceneName = stagedWorkspace.defaultPresetName || fullSceneList[0]?.name;
        let startIndex = fullSceneList.findIndex(p => p.name === initialSceneName);
        if (startIndex === -1) startIndex = 0;
        const nextIndex = fullSceneList.length > 1 ? (startIndex + 1) % fullSceneList.length : startIndex;
        
        // Use spread for shallow copy instead of expensive JSON stringify
        store.setDeckConfig('A', { ...fullSceneList[startIndex] });
        store.setDeckConfig('B', { ...fullSceneList[nextIndex] });
        
        if (activeSceneName !== fullSceneList[startIndex].name) {
            setActiveSceneName(fullSceneList[startIndex].name);
        }
    } else {
        const blankConfig = { name: "Init", ...fallbackConfig };
        store.setDeckConfig('A', blankConfig);
        store.setDeckConfig('B', blankConfig);
    }
    hasInitializedDecksRef.current = true;
  }, [isReadyForLifecycle, fullSceneList, stagedWorkspace, activeSceneName, setActiveSceneName]);

  useEffect(() => {
    const handleDocked = (side) => {
        const { isAutoFading, sideA, sideB, sequencerState } = useEngineStore.getState();
        const storeActions = useEngineStore.getState();
        
        if (isAutoFading || fullSceneList.length < 2) return;
        
        let nextScene;
        if (sequencerState.active) { 
            nextScene = fullSceneList[sequencerState.nextIndex % fullSceneList.length]; 
        } else { 
            const currentName = side === 'A' ? sideA.config?.name : sideB.config?.name; 
            const idx = fullSceneList.findIndex(s => s.name === currentName); 
            nextScene = fullSceneList[(idx + 1) % fullSceneList.length]; 
        }

        if (!nextScene) return;

        // OPTIMIZATION: Check if target deck already has this scene to avoid redundant state updates
        if (side === 'A') { 
            if (sideB.config?.name !== nextScene.name) {
                storeActions.setDeckConfig('B', { ...nextScene }); 
            }
            // PERFORMANCE: Use startTransition to update the UI (scene list highlights) without blocking the engine
            startTransition(() => {
                if (activeSceneName !== sideA.config?.name) setActiveSceneName(sideA.config?.name);
            });
        } 
        else if (side === 'B') { 
            if (sideA.config?.name !== nextScene.name) {
                storeActions.setDeckConfig('A', { ...nextScene }); 
            }
            startTransition(() => {
                if (activeSceneName !== sideB.config?.name) setActiveSceneName(sideB.config?.name);
            });
        }
    };
    const unsub = SignalBus.on('crossfader:docked', handleDocked); return () => unsub();
  }, [fullSceneList, activeSceneName, setActiveSceneName]);

  useEffect(() => { hasInitializedDecksRef.current = false; }, [currentProfileAddress]);
  
  const orchestrator = usePixiOrchestrator({ canvasRef, sideA, sideB, crossfaderValue: renderedCrossfaderValue, isReady: isReadyForLifecycle, transitionMode });
  
  const managerProxy = useMemo(() => {
    if (!orchestrator.engine) return null;
    const engine = orchestrator.engine;
    const createLayerProxy = (layerId) => ({ 
        setAudioFrequencyFactor: (f) => engine.setAudioFactors({ [layerId]: f }), 
        triggerBeatPulse: (f, d) => engine.triggerBeatPulse(f, d), 
        resetAudioModifications: () => engine.setAudioFactors({ '1': 1, '2': 1, '3': 1 }), 
        setParallax: (x, y) => engine.setParallax(x, y), 
        applyPlaybackValue: (k, v) => engine.applyPlaybackValue(layerId, k, v) 
    });
    return { '1': createLayerProxy('1'), '2': createLayerProxy('2'), '3': createLayerProxy('3'), engine: engine };
  }, [orchestrator.engine]);

  const sequencer = usePLockSequencer({
    onValueUpdate: (layerId, paramName, value) => { 
        updateLayerConfig(String(layerId), paramName, value, false, true); 
        if (orchestrator.isEngineReady && orchestrator.engine?.applyPlaybackValue) { 
            orchestrator.engine.applyPlaybackValue(String(layerId), paramName, value); 
        } 
    },
    onAnimationEnd: (finalStateSnapshot) => { 
        if (orchestrator.isEngineReady && orchestrator.engine?.clearPlaybackValues) { 
            orchestrator.engine.clearPlaybackValues(); 
        } 
        if (finalStateSnapshot) { 
            for (const layerId in finalStateSnapshot) { 
                for (const paramName in finalStateSnapshot[layerId]) { 
                    updateLayerConfig(layerId, paramName, finalStateSnapshot[layerId][paramName]); 
                } 
            } 
        } 
    }
  });

  const audioState = useAudioVisualizer();
  const handleZeroDimensionsOrchestrator = useCallback(() => { if (isMountedRef.current && internalResetLifecycleRef.current) { internalResetLifecycleRef.current(); } }, []);
  const { containerRef, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen } = useCanvasContainer({ onResize: () => {}, onZeroDimensions: handleZeroDimensionsOrchestrator });
  
  const renderLifecycleData = useRenderLifecycle({ 
      managersReady: orchestrator.isEngineReady, 
      isInitiallyResolved: isReadyForLifecycle, 
      hasValidDimensions, 
      isContainerObservedVisible, 
      configLoadNonce: 0, 
      currentProfileAddress, 
      layerConfigs: uiControlConfig?.layers, 
      targetLayerConfigsForPreset: null, 
      targetTokenAssignmentsForPreset: null, 
      loadError, upInitializationError, upFetchStateError, 
      stopAllAnimations: orchestrator.stopCanvasAnimations, 
      restartCanvasAnimations: orchestrator.restartCanvasAnimations, 
      isFullyLoaded: isReadyForLifecycle 
  });

  useEffect(() => { internalResetLifecycleRef.current = renderLifecycleData.resetLifecycle; }, [renderLifecycleData.resetLifecycle]);
  
  useAnimationLifecycleManager({ 
      isMounted: isMountedRef.current, 
      renderState: renderLifecycleData.renderState, 
      isContainerObservedVisible, 
      isBenignOverlayActive, 
      animatingPanel, 
      isAnimating: renderLifecycleData.isAnimating, 
      isTransitioning: renderLifecycleData.isTransitioning, 
      restartCanvasAnimations: orchestrator.restartCanvasAnimations, 
      stopCanvasAnimations: orchestrator.stopCanvasAnimations 
  });

  return useMemo(() => ({
      containerRef, 
      pixiCanvasRef: canvasRef, 
      managerInstancesRef: { current: managerProxy }, 
      audioState, 
      renderState: renderLifecycleData.renderState, 
      loadingStatusMessage: renderLifecycleData.loadingStatusMessage, 
      isStatusFadingOut: renderLifecycleData.isStatusFadingOut, 
      showStatusDisplay: renderLifecycleData.showStatusDisplay, 
      showRetryButton: renderLifecycleData.showRetryButton, 
      isTransitioning: renderLifecycleData.isTransitioning, 
      outgoingLayerIdsOnTransitionStart: renderLifecycleData.outgoingLayerIdsOnTransitionStart, 
      makeIncomingCanvasVisible: renderLifecycleData.makeIncomingCanvasVisible, 
      isAnimating: renderLifecycleData.isAnimating, 
      handleManualRetry: renderLifecycleData.handleManualRetry, 
      resetLifecycle: renderLifecycleData.resetLifecycle, 
      managersReady: orchestrator.isEngineReady, 
      stopCanvasAnimations: orchestrator.stopCanvasAnimations, 
      restartCanvasAnimations: orchestrator.restartCanvasAnimations, 
      setCanvasLayerImage: orchestrator.setCanvasLayerImage, 
      hasValidDimensions, 
      isContainerObservedVisible, 
      isFullscreenActive, 
      enterFullscreen, 
      isMountedRef, 
      sequencer, 
      uiControlConfig,
  }), [isReadyForLifecycle, managerProxy, orchestrator.isEngineReady, renderLifecycleData, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, sequencer, uiControlConfig]);
};