// src/hooks/useAppInteractions.js
import { useCallback, useEffect, useMemo } from 'react';
import { useUIState } from './useUIState';
// 1. RESTORED: We need this for the specific color pulse overlays
import { useVisualEffects } from './useVisualEffects';
import { useLsp1Events } from './useLsp1Events';
import { useMIDI } from '../context/MIDIContext';
import { useProfileSessionState, useInteractionSettingsState } from './configSelectors'; 
import { useVisualEngineContext } from '../context/VisualEngineContext';
import { useNotificationContext } from './useNotificationContext'; 
import { sliderParams } from '../config/sliderParams';
import { scaleNormalizedValue } from "../utils/helpers";
import SignalBus from '../utils/SignalBus'; 

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
  
  // 2. RETRIEVED: Get the saved reactions from the Store/ConfigurationService
  const { savedReactions } = useInteractionSettingsState();
  
  const { updateLayerConfig, updateTokenAssignment, handleCrossfaderChange } = useVisualEngineContext();
  
  // 3. RESTORED: Initialize the effects processor for Color Overlays
  const { processEffect, createDefaultEffect } = useVisualEffects(updateLayerConfig);
  
  const { 
    pendingActions,
    clearPendingActions 
  } = useMIDI();
  
  const applyPlaybackValueToManager = useCallback((layerId, key, value) => {
    const manager = managerInstancesRef.current?.[String(layerId)];
    if (manager?.snapVisualProperty) {
      manager.snapVisualProperty(key, value);
    }
  }, [managerInstancesRef]);

  // --- DUAL PATH EVENT HANDLER ---
  const handleEventReceived = useCallback((event) => {
    if (!isMountedRef.current || !event?.typeId) return;
    
    // Path 1: UI Notification (Toasts/Panel)
    if (addNotification) addNotification(event);

    // Path 2: Modulation Matrix Signal
    if (event.type) {
        // This sends the raw signal (0->1) to the Matrix
        SignalBus.emit('event:trigger', { type: event.type });
    }

    // Path 3: Saved Event Reactions (The "Events Panel" logic)
    const reactionsMap = savedReactions || {};
    const typeIdToMatch = event.typeId.toLowerCase(); // Matches on-chain ID
    
    // Find config saved in Profile
    const matchingReaction = Object.values(reactionsMap).find(
      r => r?.event?.toLowerCase() === typeIdToMatch || // Match by ID
           r?.event === event.type // Match by human name (fallback)
    );

    if (matchingReaction) {
      // If user has a saved reaction, trigger it (DOM Overlay)
      if (processEffect) processEffect({ ...matchingReaction, originEvent: event });
    } else if (createDefaultEffect) {
      // Optional: Trigger default if nothing saved
      // createDefaultEffect(event.type);
    }
    
  }, [isMountedRef, addNotification, savedReactions, processEffect, createDefaultEffect]);

  useLsp1Events(hostProfileAddress, handleEventReceived);

  // ... (MIDI Handling Effect remains unchanged) ...
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
    // 4. RESTORED: Return these so the EventsPanel can use them for Previews
    processEffect,
    createDefaultEffect,
    applyPlaybackValueToManager,
  }), [
    uiStateHook, unreadCount, handleTokenApplied,
    processEffect, createDefaultEffect,
    applyPlaybackValueToManager
  ]);
};