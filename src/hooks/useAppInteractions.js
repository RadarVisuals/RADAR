// src/hooks/useAppInteractions.js
import { useCallback, useEffect, useMemo } from 'react';
import { useUIState } from './useUIState';
import { useNotifications } from './useNotifications';
import { useVisualEffects } from './useVisualEffects';
import { useLsp1Events } from './useLsp1Events';
import { IPFS_GATEWAY } from "../config/global-config";
import { demoAssetMap } from '../assets/DemoLayers/initLayers';
import { sliderParams } from '../components/Panels/EnhancedControlPanel';
import { INTERPOLATED_MIDI_PARAMS } from '../config/midiConstants';
import { scaleNormalizedValue } from "../utils/helpers";
import { resolveLsp4Metadata } from '../utils/erc725.js';
import { isAddress } from 'viem';

export const useAppInteractions = (props) => {
  const {
    updateLayerConfig,
    currentProfileAddress,
    savedReactions,
    managerInstancesRef,
    setCanvasLayerImage,
    updateTokenAssignment,
    configServiceRef,
    pendingParamUpdate,
    pendingLayerSelect,
    clearPendingActions,
    isMountedRef,
  } = props;

  const uiStateHook = useUIState('tab1');
  const notificationData = useNotifications();
  const { addNotification } = notificationData;
  const { processEffect, createDefaultEffect } = useVisualEffects(updateLayerConfig);

  const handleLayerPropChange = useCallback((layerId, key, value) => {
    if (typeof updateLayerConfig === 'function') {
      updateLayerConfig(String(layerId), key, value);
    }
    const manager = managerInstancesRef.current?.[String(layerId)];
    if (!manager) return;
    if (INTERPOLATED_MIDI_PARAMS.includes(key)) {
      if (typeof manager.setTargetValue === 'function') manager.setTargetValue(key, value);
    } else {
      if (typeof manager.updateConfigProperty === 'function') manager.updateConfigProperty(key, value);
    }
  }, [updateLayerConfig, managerInstancesRef]);

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

  useLsp1Events(currentProfileAddress, handleEventReceived);

  useEffect(() => {
    let processed = false;
    if (pendingParamUpdate && managerInstancesRef.current) {
      const { layer, param, value: normalizedMidiValue } = pendingParamUpdate;
      const manager = managerInstancesRef.current[String(layer)];
      if (manager) {
        const sliderConfig = sliderParams.find(p => p.prop === param);
        if (sliderConfig) {
          const scaledValue = scaleNormalizedValue(normalizedMidiValue, sliderConfig.min, sliderConfig.max);
          handleLayerPropChange(String(layer), param, scaledValue);
          processed = true;
        }
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
    if (processed && typeof clearPendingActions === 'function') {
      clearPendingActions();
    }
  }, [pendingParamUpdate, pendingLayerSelect, handleLayerPropChange, uiStateHook.setActiveLayerTab, clearPendingActions, managerInstancesRef]);

  // --- UPDATED to handle new object structure from owned tokens ---
  const handleTokenApplied = useCallback(async (data, layerId) => {
    if (!isMountedRef.current) return;
  
    let idToSaveInConfig = null;
    let srcToLoadInCanvas = null;
  
    // Case 1: Owned Token (LSP7 or LSP8), passed as an object
    if (typeof data === 'object' && data !== null && data.type === 'owned') {
      idToSaveInConfig = data.address; // Save the collection address
      srcToLoadInCanvas = data.iconUrl; // Use the pre-resolved image URL
    } 
    // Case 2: Demo Token, passed as a string key
    else if (typeof data === 'string') {
      idToSaveInConfig = data;
      srcToLoadInCanvas = demoAssetMap[data];
    }
  
    if (!idToSaveInConfig) {
      if (import.meta.env.DEV) console.warn("[AppInteractions] Could not determine a valid identifier to save for the token assignment.");
      return;
    }
  
    // CRITICAL: Update the token assignment in the context FIRST.
    if (typeof updateTokenAssignment === 'function') {
      updateTokenAssignment(String(layerId), idToSaveInConfig);
    }
  
    // Then, update the canvas image if we have a source URL.
    if (srcToLoadInCanvas && typeof setCanvasLayerImage === 'function') {
      try {
        await setCanvasLayerImage(String(layerId), srcToLoadInCanvas);
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error(`[AppInteractions handleTokenApplied L${layerId}] setCanvasLayerImage failed for ${String(srcToLoadInCanvas).substring(0,60)}...:`, e);
        }
      }
    } else if (!srcToLoadInCanvas) {
      if (import.meta.env.DEV) console.warn(`[AppInteractions] No valid image source to load for layer ${layerId}.`);
    }
  }, [isMountedRef, setCanvasLayerImage, updateTokenAssignment]);

  return useMemo(() => ({
    uiStateHook,
    notificationData,
    handleTokenApplied,
    processEffect,
    createDefaultEffect,
    handleLayerPropChange,
  }), [
    uiStateHook, notificationData, handleTokenApplied,
    processEffect, createDefaultEffect, handleLayerPropChange
  ]);
};