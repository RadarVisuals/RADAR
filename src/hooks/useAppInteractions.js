// src/hooks/useAppInteractions.js
import { useCallback, useEffect, useMemo } from 'react';
import { useUIState } from './useUIState';
import { useVisualEffects } from './useVisualEffects';
import { useLsp1Events } from './useLsp1Events';
import { useEngineStore } from '../store/useEngineStore'; 
import { useProfileSessionState, useInteractionSettingsState } from './configSelectors'; 
import { useVisualEngine } from './useVisualEngine';
import { useNotificationContext } from './useNotificationContext'; 
import { sliderParams } from '../config/sliderParams';
import { scaleNormalizedValue } from "../utils/helpers";
import { syncBridge } from '../utils/SyncBridge';
import SignalBus from '../utils/SignalBus'; 
import { useShallow } from 'zustand/react/shallow';
import { getPixiEngine } from './usePixiOrchestrator';

export const useAppInteractions = (props) => {
  const {
    managerInstancesRef,
    isMountedRef,
    onTogglePLock,
    onNextScene,
    onPrevScene,
    onNextWorkspace,
    onPrevWorkspace,
  } = props;

  const { hostProfileAddress } = useProfileSessionState(); 
  const uiStateHook = useUIState('tab1');
  const { addNotification } = useNotificationContext();
  const { savedReactions } = useInteractionSettingsState();
  const { updateLayerConfig, updateTokenAssignment, handleCrossfaderChange } = useVisualEngine();
  const { processEffect, createDefaultEffect } = useVisualEffects(updateLayerConfig);
  
  const { pendingActions, clearPendingActions } = useEngineStore(useShallow(s => ({
    pendingActions: s.pendingActions,
    clearPendingActions: s.clearPendingActions
  })));

  // SYNC BRIDGE: SUBSCRIBE TO DECK AND AUDIO SETTING CHANGES
  useEffect(() => {
    const unsub = useEngineStore.subscribe(
      (state) => ({ a: state.sideA.config, b: state.sideB.config, audio: state.audioSettings }),
      (current, prev) => {
        const engine = getPixiEngine();
        
        // ENHANCED SYNC: When sending a deck config, attach the master physics state.
        // This ensures the receiver tab is phase-locked to the controller.
        if (current.a !== prev.a) {
          const physicsContext = {};
          if (engine?.layerManager) {
            engine.layerManager.layerList.forEach(l => {
              physicsContext[l.id] = { continuousAngle: l.physics.continuousAngle, driftPhase: l.physics.driftPhase };
            });
          }
          syncBridge.sendDeckConfig('A', { ...current.a, sharedPhysicsContext: physicsContext });
        }
        
        if (current.b !== prev.b) {
          const physicsContext = {};
          if (engine?.layerManager) {
            engine.layerManager.layerList.forEach(l => {
              physicsContext[l.id] = { continuousAngle: l.physics.continuousAngle, driftPhase: l.physics.driftPhase };
            });
          }
          syncBridge.sendDeckConfig('B', { ...current.b, sharedPhysicsContext: physicsContext });
        }

        if (current.audio !== prev.audio) {
          syncBridge.sendAudioSettings(current.audio);
        }
      }
    );
    return unsub;
  }, []);
  
  const applyPlaybackValueToManager = useCallback((layerId, key, value) => {
    const manager = managerInstancesRef.current?.[String(layerId)];
    if (manager?.snapVisualProperty) {
      manager.snapVisualProperty(key, value);
    }
  }, [managerInstancesRef]);

  const handleEventReceived = useCallback((event) => {
    if (!isMountedRef.current || !event?.typeId) return;
    
    if (addNotification) addNotification(event);
    if (event.type) {
        SignalBus.emit('event:trigger', { type: event.type });
    }

    const reactionsMap = savedReactions || {};
    const typeIdToMatch = event.typeId.toLowerCase();
    const matchingReaction = Object.values(reactionsMap).find(
      r => r?.event?.toLowerCase() === typeIdToMatch || r?.event === event.type 
    );

    if (matchingReaction && processEffect) {
      processEffect({ ...matchingReaction, originEvent: event });
    }
    
  }, [isMountedRef, addNotification, savedReactions, processEffect]);

  useLsp1Events(hostProfileAddress, handleEventReceived);

  useEffect(() => {
    if (pendingActions && pendingActions.length > 0) {
      pendingActions.forEach(action => {
        switch (action.type) {
          case 'paramUpdate': {
            const { layer, param, value: normalizedMidiValue } = action;
            const sliderConfig = sliderParams.find(p => p.prop === param);
            const manager = managerInstancesRef.current?.[String(layer)];
            if (sliderConfig && manager) {
              const scaledValue = scaleNormalizedValue(normalizedMidiValue, sliderConfig.min, sliderConfig.max);
              updateLayerConfig(String(layer), param, scaledValue, true);
            }
            break;
          }
          case 'layerSelect': {
            const layerToTabMap = { 1: 'tab3', 2: 'tab2', 3: 'tab1' };
            const targetTab = layerToTabMap[action.layer];
            if (targetTab && uiStateHook.setActiveLayerTab) {
              uiStateHook.setActiveLayerTab(targetTab);
            }
            break;
          }
          case 'globalAction': {
            const actionName = action.action;
            if (actionName === 'pLockToggle' && onTogglePLock) {
              onTogglePLock();
            }
            break;
          }
          case 'crossfaderUpdate': {
            const { value } = action;
            if (handleCrossfaderChange) {
              handleCrossfaderChange(value);
            }
            break;
          }
          case 'nextScene':
            if (onNextScene) onNextScene();
            break;
          case 'prevScene':
            if (onPrevScene) onPrevScene();
            break;
          case 'nextWorkspace':
            if (onNextWorkspace) onNextWorkspace();
            break;
          case 'prevWorkspace':
            if (onPrevWorkspace) onPrevWorkspace();
            break;
          default:
            break;
        }
      });
      clearPendingActions();
    }
  }, [
    pendingActions, clearPendingActions, managerInstancesRef, updateLayerConfig,
    uiStateHook, onTogglePLock, handleCrossfaderChange, onNextScene, onPrevScene,
    onNextWorkspace, onPrevWorkspace,
  ]);

  const handleTokenApplied = useCallback(async (token, layerId) => {
    if (!isMountedRef.current) return;
    if (updateTokenAssignment) {
      updateTokenAssignment(token, layerId);
    }
  }, [isMountedRef, updateTokenAssignment]);

  return useMemo(() => ({
    uiStateHook,
    handleTokenApplied,
    processEffect,
    createDefaultEffect,
    applyPlaybackValueToManager,
  }), [
    uiStateHook, handleTokenApplied,
    processEffect, createDefaultEffect,
    applyPlaybackValueToManager
  ]);
};