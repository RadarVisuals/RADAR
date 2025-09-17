// src/hooks/useAppInteractions.js
import { useCallback, useEffect, useMemo } from 'react';
import { useUIState } from './useUIState';
import { useNotifications } from './useNotifications';
import { useVisualEffects } from './useVisualEffects';
import { useLsp1Events } from './useLsp1Events';
import { useMIDI } from '../context/MIDIContext';
import { useUserSession } from '../context/UserSessionContext';
import { sliderParams } from '../components/Panels/EnhancedControlPanel';
import { scaleNormalizedValue } from "../utils/helpers";

export const useAppInteractions = (props) => {
  const {
    updateLayerConfig,
    currentProfileAddress,
    savedReactions,
    managerInstancesRef,
    setCanvasLayerImage,
    updateTokenAssignment,
    isMountedRef,
    onTogglePLock,
  } = props;

  const { visitorProfileAddress } = useUserSession();
  const uiStateHook = useUIState('tab1');
  const notificationData = useNotifications();
  const { addNotification } = notificationData;
  const { processEffect, createDefaultEffect } = useVisualEffects(updateLayerConfig);
  
  const { 
    pendingParamUpdate, 
    pendingLayerSelect, 
    pendingGlobalAction,
    clearPendingActions 
  } = useMIDI();

  const applyPlaybackValueToManager = useCallback((layerId, key, value) => {
    const manager = managerInstancesRef.current?.[String(layerId)];
    if (manager?.snapVisualProperty) {
      manager.snapVisualProperty(key, value);
    }
  }, [managerInstancesRef]);

  const handleEventReceived = useCallback((event) => {
    if (!isMountedRef.current || !event?.typeId) return;
    if (addNotification) addNotification(event);
    const reactionsMap = savedReactions || {};
    const typeIdToMatch = event.typeId.toLowerCase();
    const matchingReactions = Object.values(reactionsMap).filter(
      r => r?.event?.toLowerCase() === typeIdToMatch
    );
    if (matchingReactions.length > 0) {
      matchingReactions.forEach(reactionConfig => {
        if (processEffect) processEffect({ ...reactionConfig, originEvent: event });
      });
    } else if (createDefaultEffect) {
      createDefaultEffect(event.type);
    }
  }, [isMountedRef, addNotification, savedReactions, processEffect, createDefaultEffect]);

  useLsp1Events(visitorProfileAddress, handleEventReceived);

  useEffect(() => {
    let processed = false;
    if (pendingParamUpdate && managerInstancesRef.current) {
      const { layer, param, value: normalizedMidiValue } = pendingParamUpdate;
      const sliderConfig = sliderParams.find(p => p.prop === param);
      const manager = managerInstancesRef.current?.[String(layer)];
      
      if (sliderConfig && manager) {
        const scaledValue = scaleNormalizedValue(normalizedMidiValue, sliderConfig.min, sliderConfig.max);
        
        // --- THIS IS THE FIX ---
        // We now call the main update handler with a flag indicating this is a MIDI update.
        // This allows the handler in MainView.jsx to choose the correct interpolation method
        // for either Deck A or Deck B based on the crossfader position.
        updateLayerConfig(String(layer), param, scaledValue, true); // The 'true' is for 'isMidiUpdate'
        // --- END FIX ---

        processed = true;
      }
    }
    if (pendingLayerSelect) {
      const { layer } = pendingLayerSelect;
      const layerToTabMap = { 1: 'tab3', 2: 'tab2', 3: 'tab1' };
      const targetTab = layerToTabMap[layer];
      if (targetTab && uiStateHook.setActiveLayerTab) {
        uiStateHook.setActiveLayerTab(targetTab);
        processed = true;
      }
    }
    if (pendingGlobalAction) {
      const actionName = pendingGlobalAction.action;
      if (actionName === 'pLockToggle' && onTogglePLock) {
        onTogglePLock();
        processed = true;
      }
    }

    if (processed && clearPendingActions) {
      clearPendingActions();
    }
  }, [pendingParamUpdate, pendingLayerSelect, pendingGlobalAction, onTogglePLock, updateLayerConfig, uiStateHook, clearPendingActions, managerInstancesRef]);

  const handleTokenApplied = useCallback(async (token, layerId) => {
    if (!isMountedRef.current) return;
    const idToSave = token.id;
    const srcToLoad = token.metadata?.image;
    if (!idToSave || !srcToLoad) return;
    const assignmentObject = { id: idToSave, src: srcToLoad };
    if (updateTokenAssignment) updateTokenAssignment(String(layerId), assignmentObject);
    if (setCanvasLayerImage) {
      try { await setCanvasLayerImage(String(layerId), srcToLoad); } catch (e) { /* empty */ }
    }
  }, [isMountedRef, setCanvasLayerImage, updateTokenAssignment]);

  return useMemo(() => ({
    uiStateHook,
    notificationData,
    handleTokenApplied,
    processEffect,
    createDefaultEffect,
    applyPlaybackValueToManager,
  }), [
    uiStateHook, notificationData, handleTokenApplied,
    processEffect, createDefaultEffect,
    applyPlaybackValueToManager
  ]);
};