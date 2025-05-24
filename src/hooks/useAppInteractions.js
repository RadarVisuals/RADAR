// src/hooks/useAppInteractions.js
import { useCallback, useEffect, useMemo } from 'react'; // Added useMemo
import { useUIState } from './useUIState';
import { useNotifications } from './useNotifications';
import { useVisualEffects } from './useVisualEffects';
import { useLsp1Events } from './useLsp1Events';

// Config & Assets
import { IPFS_GATEWAY } from "../config/global-config";
import { demoAssetMap } from '../assets/DemoLayers/initLayers';
import { sliderParams } from '../components/Panels/EnhancedControlPanel'; // Assuming this path is correct relative to this hook's usage
import { INTERPOLATED_MIDI_PARAMS } from '../config/midiConstants';

// Utils
import { scaleNormalizedValue } from "../utils/helpers";
import { resolveLsp4Metadata } from '../utils/erc725.js';
import { isAddress } from 'viem';

/**
 * @typedef {import('../services/ConfigService').default} ConfigService
 * @typedef {import('../utils/CanvasManager').default} CanvasManager // Corrected path
 * @typedef {import('./useUIState').UIState} UIStateHook // Assuming UIState is the return type of useUIState
 * @typedef {import('./useNotifications').NotificationsAPI} NotificationHook // Assuming NotificationsAPI is the return type
 * @typedef {import('./useVisualEffects').VisualEffectsAPI} VisualEffectsHook // Assuming VisualEffectsAPI is the return type
 * @typedef {import('../context/VisualConfigContext').AllLayerConfigs} LayerConfigsType // Placeholder
 * @typedef {import('../context/VisualConfigContext').TokenAssignments} TokenAssignmentsType // Placeholder
 * @typedef {import('../context/MIDIContext').MIDIContextValue['pendingParamUpdate']} PendingParamUpdate // More specific type
 * @typedef {import('../context/MIDIContext').MIDIContextValue['pendingLayerSelect']} PendingLayerSelect // More specific type
 * @typedef {import('../services/LSP1EventService').ProcessedLsp1Event} LSP1UniversalReceiverEvent // Assuming ProcessedLsp1Event from LSP1EventService
 * @typedef {import('../context/ConfigContext').ConfigContextValue['savedReactions'][string]} ReactionConfig // Type for a single reaction config
 */

/**
 * @typedef {object} UseAppInteractionsProps
 * @property {(layerId: string, key: string, value: any) => void} updateLayerConfig - Function to update a layer's visual configuration.
 * @property {string | null} currentProfileAddress - The address of the currently viewed Universal Profile.
 * @property {{ [key: string]: ReactionConfig }} savedReactions - The map of saved event reactions for the current profile.
 * @property {React.RefObject<{[key: string]: CanvasManager}>} managerInstancesRef - Ref to the canvas manager instances.
 * @property {(layerId: string, src: string) => Promise<void>} setCanvasLayerImage - Function to set an image on a specific canvas layer.
 * @property {(layerId: string, tokenId: string | object | null) => void} updateTokenAssignment - Function to update the token assignment for a layer.
 * @property {React.RefObject<ConfigService | null>} configServiceRef - Ref to the ConfigurationService instance.
 * @property {PendingParamUpdate | null} pendingParamUpdate - Pending MIDI parameter update data.
 * @property {PendingLayerSelect | null} pendingLayerSelect - Pending MIDI layer selection data.
 * @property {() => void} clearPendingActions - Function to clear pending MIDI actions.
 * @property {React.RefObject<boolean>} isMountedRef - Ref indicating if the consuming component is mounted.
 */

/**
 * @typedef {object} AppInteractionsHook
 * @property {UIStateHook} uiStateHook - The state and functions returned by `useUIState`.
 * @property {NotificationHook} notificationData - The state and functions returned by `useNotifications`.
 * @property {(data: any, layerId: string) => Promise<void>} handleTokenApplied - Callback to handle applying a token/asset to a layer.
 * @property {VisualEffectsHook['processEffect']} processEffect - Function to process and apply a visual effect.
 * @property {VisualEffectsHook['createDefaultEffect']} createDefaultEffect - Function to create and apply a default visual effect for an event.
 * @property {(layerId: string, key: string, value: any) => void} handleLayerPropChange - Callback to handle changes to a layer's properties.
 */

/**
 * `useAppInteractions` is a custom React hook that centralizes the management of various
 * application-level user interactions, UI state, notifications, and event handling logic.
 * It aims to decouple these concerns from the main application view (`MainView.jsx`),
 * making `MainView` more focused on layout and orchestration.
 *
 * **Core Responsibilities:**
 * 1.  **UI State Management:** Initializes and exposes `useUIState` for managing panel visibility, active tabs, and overlays.
 * 2.  **Notifications:** Initializes and exposes `useNotifications` for adding and managing toast-like notifications.
 * 3.  **Visual Effects:** Initializes `useVisualEffects` to provide functions for triggering visual effects in response to events or actions.
 * 4.  **LSP1 Event Handling:**
 *     - Initializes `useLsp1Events` to listen for on-chain events related to the current Universal Profile.
 *     - Contains the `handleEventReceived` callback, which processes incoming LSP1 events, adds notifications, and triggers appropriate visual effects based on `savedReactions` or default behaviors.
 * 5.  **MIDI Action Processing:**
 *     - Includes a `useEffect` hook to process pending MIDI actions (`pendingParamUpdate`, `pendingLayerSelect`) received from `MIDIContext`.
 *     - Translates MIDI inputs into application actions like changing layer parameters (via `handleLayerPropChange`) or switching active layer tabs (via `uiStateHook.setActiveLayerTab`).
 * 6.  **Token Application Logic:**
 *     - Contains the `handleTokenApplied` callback, which manages the logic for resolving token metadata (including IPFS URIs) and instructing the `useCanvasOrchestrator` (via `setCanvasLayerImage` prop) to load the image onto the specified canvas layer. It also updates the global token assignment state (via `updateTokenAssignment` prop).
 * 7.  **Layer Property Changes:** Provides `handleLayerPropChange` as a stable callback for UI components to update layer configurations.
 *
 * **Props (`UseAppInteractionsProps`):**
 * This hook requires several functions and state values from parent contexts or other hooks to perform its duties:
 * - Functions to update global state (`updateLayerConfig`, `updateTokenAssignment`).
 * - Current application state (`currentProfileAddress`, `savedReactions`, `pendingParamUpdate`, etc.).
 * - Refs to services or instances needed for operations (`managerInstancesRef`, `configServiceRef`, `isMountedRef`).
 * - Functions to interact with other systems (`setCanvasLayerImage`, `clearPendingActions`).
 *
 * **Returns (`AppInteractionsHook`):**
 * It returns a memoized object containing:
 * - `uiStateHook`: The complete API from `useUIState`.
 * - `notificationData`: The complete API from `useNotifications`.
 * - `handleTokenApplied`: The callback for token application.
 * - `processEffect`, `createDefaultEffect`: Functions from `useVisualEffects`.
 * - `handleLayerPropChange`: The callback for layer property updates.
 *
 * By encapsulating these interaction patterns, `useAppInteractions` helps to simplify `MainView.jsx` and makes the overall application logic more modular and testable.
 *
 * @param {UseAppInteractionsProps} props - The properties required by the hook.
 * @returns {AppInteractionsHook} A memoized object containing UI state, notification handlers, and interaction callbacks.
 */
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

  const uiStateHook = useUIState('tab1'); // Initialize useUIState
  const notificationData = useNotifications(); // Initialize useNotifications
  const { addNotification } = notificationData;
  const { processEffect, createDefaultEffect } = useVisualEffects(updateLayerConfig); // Initialize useVisualEffects

  const handleLayerPropChange = useCallback((layerId, key, value) => {
    if (typeof updateLayerConfig === 'function') {
      updateLayerConfig(String(layerId), key, value);
    }
  }, [updateLayerConfig]); // updateLayerConfig should be stable

  const handleEventReceived = useCallback((event) => {
    if (!isMountedRef.current || !event?.typeId) {
      if (import.meta.env.DEV && event) console.warn(`[AppInteractions handleEventReceived] Event missing typeId or component not mounted. Event type: ${event.type}`);
      return;
    }
    if (typeof addNotification === 'function') addNotification(event);

    const reactionsMap = savedReactions || {};
    const typeIdToMatch = event.typeId.toLowerCase();

    if (import.meta.env.DEV) {
      const timestamp = performance.now().toFixed(0);
      console.log(`%c[AppInteractions Event ${timestamp}] TypeID: ${typeIdToMatch} (Type: ${event.type})`, 'color: lime; font-weight: bold;');
    }

    const matchingReactions = Object.values(reactionsMap).filter(
      r => r?.event?.toLowerCase() === typeIdToMatch
    );

    if (import.meta.env.DEV && matchingReactions.length > 0) {
      console.log(`%c[AppInteractions Event ${performance.now().toFixed(0)}] Found ${matchingReactions.length} matching reaction(s) for ${typeIdToMatch}`, 'color: lightgreen;');
    } else if (import.meta.env.DEV && matchingReactions.length === 0) {
      console.log(`%c[AppInteractions Event ${performance.now().toFixed(0)}] No matching reactions found for ${typeIdToMatch}. Available reaction event keys: ${Object.values(reactionsMap).map(r => r?.event).join(', ')}`, 'color: orange;');
    }

    if (matchingReactions.length > 0) {
      matchingReactions.forEach(reactionConfig => {
        if (typeof processEffect === 'function') {
          processEffect({ ...reactionConfig, originEvent: event })
            .catch(e => { if (import.meta.env.DEV) console.error("[AppInteractions] Error processing configured reaction:", e); });
        }
      });
    } else if (typeof createDefaultEffect === 'function') {
      if (import.meta.env.DEV) console.log(`%c[AppInteractions Event ${performance.now().toFixed(0)}] No specific reaction, creating default for type: ${event.type}`, 'color: skyblue;');
      createDefaultEffect(event.type)
        .catch(e => { if (import.meta.env.DEV) console.error("[AppInteractions] Error creating default effect:", e); });
    }
  }, [isMountedRef, addNotification, savedReactions, processEffect, createDefaultEffect]);

  useLsp1Events(currentProfileAddress, handleEventReceived); // Initialize useLsp1Events

  useEffect(() => {
    let processed = false;
    if (pendingParamUpdate && managerInstancesRef.current) {
      const { layer, param, value: normalizedMidiValue } = pendingParamUpdate;
      const manager = managerInstancesRef.current[String(layer)];
      if (manager) {
        const sliderConfig = sliderParams.find(p => p.prop === param);
        if (sliderConfig) {
          const scaledValue = scaleNormalizedValue(normalizedMidiValue, sliderConfig.min, sliderConfig.max);
          if (INTERPOLATED_MIDI_PARAMS.includes(param) && typeof manager.setTargetValue === 'function') {
            manager.setTargetValue(param, scaledValue);
          }
          handleLayerPropChange(String(layer), param, scaledValue);
          processed = true;
        }
      }
    }
    if (pendingLayerSelect) {
      const { layer } = pendingLayerSelect;
      const layerToTabMap = { 1: 'tab3', 2: 'tab2', 3: 'tab1' }; // Maps layer ID to tab ID
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

  const handleTokenApplied = useCallback(async (data, layerId) => {
    if (!isMountedRef.current || typeof setCanvasLayerImage !== 'function' || !configServiceRef.current) {
        if(import.meta.env.DEV) console.warn("[AppInteractions handleTokenApplied] Pre-condition fail or not mounted", {isMounted: isMountedRef.current, setCanvasLayerImageExists: !!setCanvasLayerImage, configServiceRefCurrentExists: !!configServiceRef.current});
        return;
    }

    let idToSaveInConfig = null;
    let srcToLoadInCanvas = null;

    if (data?.type === 'owned' && data.address && isAddress(data.address)) {
      idToSaveInConfig = data.address;
      const metadata = await resolveLsp4Metadata(configServiceRef.current, data.address);
      if (metadata?.LSP4Metadata) {
        const meta = metadata.LSP4Metadata;
        const url = meta.assets?.[0]?.url || meta.icon?.[0]?.url || meta.images?.[0]?.[0]?.url || null;
        if (url && typeof url === 'string') {
          const trimmedUrl = url.trim();
          if (trimmedUrl.startsWith('ipfs://')) srcToLoadInCanvas = `${IPFS_GATEWAY}${trimmedUrl.slice(7)}`;
          else if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) srcToLoadInCanvas = trimmedUrl;
        }
      }
      if (!srcToLoadInCanvas && data.iconUrl) srcToLoadInCanvas = data.iconUrl;
    } else if (typeof data === 'string') {
      if (Object.prototype.hasOwnProperty.call(demoAssetMap, data)) {
        idToSaveInConfig = data;
        srcToLoadInCanvas = demoAssetMap[data];
      } else if (Object.values(demoAssetMap).includes(data)) {
        const demoKey = Object.keys(demoAssetMap).find(key => demoAssetMap[key] === data);
        idToSaveInConfig = demoKey || data;
        srcToLoadInCanvas = data;
      } else if (data.startsWith('http') || data.startsWith('data:')) {
        idToSaveInConfig = data.startsWith('data:') ? data.substring(0, 50) + '...' : data;
        srcToLoadInCanvas = data;
      } else {
        idToSaveInConfig = data;
        srcToLoadInCanvas = data;
        if (import.meta.env.DEV) console.warn(`[AppInteractions handleTokenApplied] Unknown string token data: ${data}. Attempting to load as URL.`);
      }
    }

    if (srcToLoadInCanvas) {
      await setCanvasLayerImage(String(layerId), srcToLoadInCanvas)
        .catch(e => { if (import.meta.env.DEV) console.error(`[AppInteractions handleTokenApplied L${layerId}] setCanvasLayerImage failed for ${String(srcToLoadInCanvas).substring(0,60)}...:`, e); });
    } else if (import.meta.env.DEV) {
        console.warn(`[AppInteractions handleTokenApplied L${layerId}] No valid image source found to apply for token data:`, data);
    }

    if (typeof updateTokenAssignment === 'function' && idToSaveInConfig !== null) {
      updateTokenAssignment(String(layerId), idToSaveInConfig);
    }
  }, [isMountedRef, setCanvasLayerImage, updateTokenAssignment, configServiceRef]); // Dependencies

  // --- APPLIED FIX: Memoize the return object ---
  return useMemo(() => ({
    uiStateHook,          // Object from useUIState, should be memoized by useUIState
    notificationData,     // Object from useNotifications, should be memoized by useNotifications
    handleTokenApplied,   // useCallback
    processEffect,        // From useVisualEffects, should be stable
    createDefaultEffect,  // From useVisualEffects, should be stable
    handleLayerPropChange,// useCallback
  }), [
    uiStateHook, notificationData, handleTokenApplied,
    processEffect, createDefaultEffect, handleLayerPropChange
  ]);
  // --- END APPLIED FIX ---
};