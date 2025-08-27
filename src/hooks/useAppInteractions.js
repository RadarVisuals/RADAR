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
    updateLayerConfig, // This is now our combined handler passed from Mainview
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

  // Note: The `handleLayerPropChange` function is now defined and passed in from Mainview.jsx.
  // This hook now uses it directly via the `updateLayerConfig` prop name.

  const applyPlaybackValueToManager = useCallback((layerId, key, value) => {
    const manager = managerInstancesRef.current?.[String(layerId)];
    if (!manager) return;
  
    // During playback, we always snap. The sequencer provides the smooth values.
    if (typeof manager.snapVisualProperty === 'function') {
      manager.snapVisualProperty(key, value);
    }
  }, [managerInstancesRef]);

  const handleEventReceived = useCallback((event) => {
    if (!isMountedRef.current || !event?.typeId) return;
    if (typeof addNotification === 'function') addNotification(event);
    const reactionsMap = savedReactions || {};
    const typeIdToMatch = event.typeId.toLowerCase();
    const matchingReactions = Object.values(reactionsMap).filter(
      r => r?.event?.toLowerCase() === typeIdToMatch
    );
    if (matchingReactions.length > 0) {
      matchingReactions.forEach(reactionConfig => {
        if (typeof processEffect === 'function') processEffect({ ...reactionConfig, originEvent: event });
      });
    } else if (typeof createDefaultEffect === 'function') {
      createDefaultEffect(event.type);
    }
  }, [isMountedRef, addNotification, savedReactions, processEffect, createDefaultEffect]);

  useLsp1Events(visitorProfileAddress, handleEventReceived);

  useEffect(() => {
    let processed = false;
    if (pendingParamUpdate && managerInstancesRef.current) {
      const { layer, param, value: normalizedMidiValue } = pendingParamUpdate;
      const sliderConfig = sliderParams.find(p => p.prop === param);
      if (sliderConfig) {
        const scaledValue = scaleNormalizedValue(normalizedMidiValue, sliderConfig.min, sliderConfig.max);
        // Here, updateLayerConfig is actually handleUserLayerPropChange from Mainview
        updateLayerConfig(String(layer), param, scaledValue, true); // Pass true for isMidiUpdate
        processed = true;
      }
    }
    if (pendingLayerSelect) {
      const { layer } = pendingLayerSelect;
      const layerToTabMap = { 1: 'tab3', 2: 'tab2', 3: 'tab1' };
      const targetTab = layerToTabMap[layer];
      if (targetTab && typeof uiStateHook.setActiveLayerTab === 'function') {
        uiStateHook.setActiveLayerTab(targetTab);
        processed = true;
      }
    }
    if (pendingGlobalAction) {
      const actionName = pendingGlobalAction.action;
      if (actionName === 'pLockToggle' && typeof onTogglePLock === 'function') {
        onTogglePLock();
        processed = true;
      }
    }

    if (processed && typeof clearPendingActions === 'function') {
      clearPendingActions();
    }
  }, [pendingParamUpdate, pendingLayerSelect, pendingGlobalAction, onTogglePLock, updateLayerConfig, uiStateHook, clearPendingActions, managerInstancesRef]);

  const handleTokenApplied = useCallback(async (token, layerId) => {
    if (!isMountedRef.current) return;
  
    const idToSave = token.id;
    const srcToLoad = token.metadata?.image;
  
    if (!idToSave || !srcToLoad) return;
  
    const assignmentObject = { id: idToSave, src: srcToLoad };
    
    if (typeof updateTokenAssignment === 'function') {
      updateTokenAssignment(String(layerId), assignmentObject);
    }
  
    if (typeof setCanvasLayerImage === 'function') {
      try {
        await setCanvasLayerImage(String(layerId), srcToLoad);
      } catch (e) {
        // empty
      }
    }
  }, [isMountedRef, setCanvasLayerImage, updateTokenAssignment]);

  return useMemo(() => ({
    uiStateHook,
    notificationData,
    handleTokenApplied,
    processEffect,
    createDefaultEffect,
    handleLayerPropChange: updateLayerConfig, // Expose the passed-in handler
    applyPlaybackValueToManager,
  }), [
    uiStateHook, notificationData, handleTokenApplied,
    processEffect, createDefaultEffect, updateLayerConfig,
    applyPlaybackValueToManager
  ]);
};