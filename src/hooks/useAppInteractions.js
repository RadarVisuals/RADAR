// src/hooks/useAppInteractions.js
import { useCallback, useEffect, useMemo } from 'react';
import { useUIState } from './useUIState';
import { useVisualEffects } from './useVisualEffects';
import { useLsp1Events } from './useLsp1Events';
import { useEngineStore } from '../store/useEngineStore'; // Updated
import { useProfileSessionState, useInteractionSettingsState } from './configSelectors'; 
import { useVisualEngine } from './useVisualEngine';
import { useNotificationContext } from './useNotificationContext'; 
import { sliderParams } from '../config/sliderParams';
import { scaleNormalizedValue } from "../utils/helpers";
import SignalBus from '../utils/SignalBus'; 
import { useShallow } from 'zustand/react/shallow'; // Added for performance

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
  const { addNotification, unreadCount } = useNotificationContext();
  
  const { savedReactions } = useInteractionSettingsState();
  
  const { updateLayerConfig, updateTokenAssignment, handleCrossfaderChange } = useVisualEngine();
  
  const { processEffect, createDefaultEffect } = useVisualEffects(updateLayerConfig);
  
  // --- REFACTORED: Get MIDI actions from Engine Store ---
  const { pendingActions, clearPendingActions } = useEngineStore(useShallow(s => ({
    pendingActions: s.pendingActions,
    clearPendingActions: s.clearPendingActions
  })));
  
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
      r => r?.event?.toLowerCase() === typeIdToMatch || 
           r?.event === event.type 
    );

    if (matchingReaction) {
      if (processEffect) processEffect({ ...matchingReaction, originEvent: event });
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
            const { layer } = action;
            const layerToTabMap = { 1: 'tab3', 2: 'tab2', 3: 'tab1' };
            const targetTab = layerToTabMap[layer];
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
    pendingActions,
    clearPendingActions,
    managerInstancesRef,
    updateLayerConfig,
    uiStateHook,
    onTogglePLock,
    handleCrossfaderChange,
    onNextScene,
    onPrevScene,
    onNextWorkspace,
    onPrevWorkspace,
  ]);

  const handleTokenApplied = useCallback(async (token, layerId) => {
    if (!isMountedRef.current) return;
    if (updateTokenAssignment) {
      updateTokenAssignment(token, layerId);
    }
  }, [isMountedRef, updateTokenAssignment]);

  return useMemo(() => ({
    uiStateHook,
    notificationData: { unreadCount },
    handleTokenApplied,
    processEffect,
    createDefaultEffect,
    applyPlaybackValueToManager,
  }), [
    uiStateHook, unreadCount, handleTokenApplied,
    processEffect, createDefaultEffect,
    applyPlaybackValueToManager
  ]);
};