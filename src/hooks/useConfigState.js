import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useUpProvider } from "../context/UpProvider";
import ConfigurationService from "../services/ConfigurationService";
import { useToast } from "../context/ToastContext";
import {
  RADAR_EVENT_REACTIONS_KEY,
  RADAR_MIDI_MAP_KEY,
} from "../config/global-config";
import { stringToHex, hexToString } from "viem";

/**
 * @typedef {object} ConfigStateAPI
 * @property {boolean} configServiceInstanceReady - Indicates if the ConfigurationService is ready for reads and writes based on provider/client stability.
 * @property {React.RefObject<ConfigurationService | null>} configServiceRef - Ref holding the initialized ConfigurationService instance.
 * @property {object} savedReactions - Configuration object for global event reactions stored on the host profile. Keyed by event type.
 * @property {object} midiMap - Configuration object for global MIDI mappings stored on the host profile.
 * @property {boolean} isSavingGlobal - True if global settings (reactions or MIDI map) are currently being saved to the host profile.
 * @property {Error | string | null} globalSaveError - Contains the error message if the last global settings save attempt failed.
 * @property {boolean} globalSaveSuccess - True if the last global settings save operation completed successfully.
 * @property {boolean} hasPendingChanges - True if any configuration (visual, preset, reactions, MIDI) has unsaved modifications. This flag is typically set by other contexts or components interacting with the configuration.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setHasPendingChanges - Function to manually set the `hasPendingChanges` flag. Intended for consumption by other contexts/components that modify configuration state managed elsewhere but need to signal pending changes globally.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalReactions - Saves the current `savedReactions` state to the host profile using the ConfigurationService. Returns a promise indicating success or failure.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalMidiMap - Saves the current `midiMap` state to the host profile using the ConfigurationService. Returns a promise indicating success or failure.
 * @property {(eventType: string, reactionData: object) => void} updateSavedReaction - Adds or updates a specific event reaction configuration in the local `savedReactions` state and sets `hasPendingChanges` to true.
 * @property {(eventType: string) => void} deleteSavedReaction - Removes an event reaction configuration from the local `savedReactions` state by its event type and sets `hasPendingChanges` to true if a change occurred.
 * @property {(newMap: object) => void} updateMidiMap - Replaces the entire `midiMap` configuration in the local state and sets `hasPendingChanges` to true.
 * @property {boolean} isLoadingGlobals - True if global settings (reactions, MIDI map) are currently being loaded from the host profile.
 * @property {Error | string | null} globalLoadError - Contains the error message(s) if the last attempt to load global settings failed.
 */

/**
 * Custom hook to manage global application settings (Reactions, MIDI map for the host profile),
 * the `ConfigurationService` instance, and the `hasPendingChanges` status.
 * It no longer handles preset management or live visual configurations, which have been
 * delegated to `PresetManagementContext` and `VisualConfigContext` respectively.
 * It loads global settings (reactions, MIDI map) when the profile address or service readiness changes.
 *
 * @param {string|null} currentProfileAddress The address of the host profile to manage settings for. If null, global settings are reset.
 * @returns {ConfigStateAPI} An object containing global configuration state and management functions.
 */
const useConfigState = (currentProfileAddress) => {
  const {
      provider, walletClient, publicClient,
      isConnecting: upIsConnecting,
      hasCriticalError: upHasCriticalError
  } = useUpProvider();

  const { addToast } = useToast();
  /** @type {React.RefObject<ConfigurationService | null>} */
  const configServiceRef = useRef(null);
  const prevProfileAddressForGlobalsRef = useRef(null);

  // State managed by this hook
  const [savedReactions, setSavedReactions] = useState({});
  const [midiMap, setMidiMap] = useState({}); // Host profile's stored MIDI map
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);
  const [globalSaveError, setGlobalSaveError] = useState(null);
  const [globalSaveSuccess, setGlobalSaveSuccess] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isLoadingGlobals, setIsLoadingGlobals] = useState(false);
  const [globalLoadError, setGlobalLoadError] = useState(null);


  const isUpProviderStableForRead = useMemo(() => {
      // Service is stable for reading if we have a public client and the provider isn't connecting or in an error state.
      return !!publicClient && !upIsConnecting && !upHasCriticalError;
  }, [publicClient, upIsConnecting, upHasCriticalError]);

  // Effect to initialize and update ConfigurationService instance
  useEffect(() => {
    if (provider && !configServiceRef.current) {
        // Initialize service only if provider exists and service isn't already initialized
        configServiceRef.current = new ConfigurationService(provider, walletClient, publicClient);
    }
    if (configServiceRef.current) {
        // Update clients if they change (e.g., wallet connection, chain change)
        if (configServiceRef.current.publicClient !== publicClient) {
            configServiceRef.current.publicClient = publicClient;
        }
        if (configServiceRef.current.walletClient !== walletClient) {
            configServiceRef.current.walletClient = walletClient;
        }
        // Re-check readiness flags whenever clients change
        configServiceRef.current.checkReadyForRead();
        configServiceRef.current.checkReadyForWrite();
    }
  }, [provider, publicClient, walletClient]);

  /**
   * Memoized boolean indicating if the ConfigurationService instance exists and is ready for read operations.
   * @type {boolean}
   */
  const configServiceInstanceReady = useMemo(() => {
      return !!configServiceRef.current && isUpProviderStableForRead;
  }, [isUpProviderStableForRead]);

  // Effect to load global reactions and MIDI map when profile or service readiness changes
  useEffect(() => {
    const loadGlobalSettings = async () => {
        if (currentProfileAddress && configServiceInstanceReady && configServiceRef.current) {
            const service = configServiceRef.current;
            setIsLoadingGlobals(true);
            setGlobalLoadError(null);
            let currentLoadErrors = [];

            try {
                const reactionsHex = await service.loadDataFromKey(currentProfileAddress, RADAR_EVENT_REACTIONS_KEY);
                if (reactionsHex && reactionsHex !== '0x') {
                    setSavedReactions(JSON.parse(hexToString(reactionsHex)));
                } else {
                    setSavedReactions({}); // Reset if no data or '0x'
                }
                // reactionsLoaded = true; // Removed unused variable
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.error("Error loading global reactions:", e);
                }
                currentLoadErrors.push(`Reactions: ${e.message}`);
                setSavedReactions({}); // Reset on error
            }

            try {
                const midiHex = await service.loadDataFromKey(currentProfileAddress, RADAR_MIDI_MAP_KEY);
                if (midiHex && midiHex !== '0x') {
                    setMidiMap(JSON.parse(hexToString(midiHex)));
                } else {
                    setMidiMap({}); // Reset if no data or '0x'
                }
                // midiLoaded = true; // Removed unused variable
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.error("Error loading global MIDI map:", e);
                }
                currentLoadErrors.push(`MIDI: ${e.message}`);
                setMidiMap({}); // Reset on error
            }

            if (currentLoadErrors.length > 0) {
                setGlobalLoadError(currentLoadErrors.join('; '));
            }

            setIsLoadingGlobals(false);
        } else {
            // Reset state if no address or service not ready
            setSavedReactions({});
            setMidiMap({});
            setIsLoadingGlobals(false); // Ensure loading is false if conditions aren't met
            setGlobalLoadError(null);
        }
    };

    // Determine if a load should be triggered
    const shouldLoad = currentProfileAddress && configServiceInstanceReady && !isLoadingGlobals;
    const addressChanged = currentProfileAddress !== prevProfileAddressForGlobalsRef.current;

    if (addressChanged || (shouldLoad && prevProfileAddressForGlobalsRef.current !== currentProfileAddress)) {
        prevProfileAddressForGlobalsRef.current = currentProfileAddress;
        loadGlobalSettings();
    } else if (!currentProfileAddress && prevProfileAddressForGlobalsRef.current !== null) { // Handle address becoming null
        prevProfileAddressForGlobalsRef.current = null;
        setSavedReactions({});
        setMidiMap({});
        setIsLoadingGlobals(false);
        setGlobalLoadError(null);
    }

  // Only re-run load when address or service readiness fundamentally changes, or loading finishes.
  // Avoid re-fetching constantly on transient errors by not including globalLoadError here.
  }, [currentProfileAddress, configServiceInstanceReady, isLoadingGlobals]);


  /**
   * Saves the current global event reactions state to the host profile via ConfigurationService.
   * @async
   * @returns {Promise<{success: boolean, error?: string}>} A promise resolving with the save operation result.
   */
  const saveGlobalReactions = useCallback(async () => {
     const service = configServiceRef.current;
     const addressToSave = currentProfileAddress;
     // Check service readiness for writing
     const isReady = !!service && configServiceInstanceReady && service.checkReadyForWrite();
     if (!isReady || !addressToSave) {
         const errorMsg = !isReady ? "Configuration service not ready for writing." : "No host profile address provided.";
         addToast(errorMsg, "error"); return { success: false, error: errorMsg };
     }
     setIsSavingGlobal(true); setGlobalSaveError(null); setGlobalSaveSuccess(false);
     try {
         const dataKey = RADAR_EVENT_REACTIONS_KEY; const dataToSave = savedReactions || {};
         const jsonString = JSON.stringify(dataToSave); const hexValue = stringToHex(jsonString);
         const result = await service.saveDataToKey(addressToSave, dataKey, hexValue);
         if (result.success) {
            addToast(`Global reactions saved successfully!`, 'success');
            setGlobalSaveSuccess(true);
            // Assuming successful save clears pending changes related to reactions
            // Note: This might need adjustment if other pending changes exist.
            setHasPendingChanges(false);
         } else { throw new Error(result.error || "Save reactions operation failed."); }
         return result;
     } catch (error) {
        const errorMsg = error.message || `An unknown error occurred while saving reactions.`; setGlobalSaveError(errorMsg);
        addToast(`Error saving reactions: ${errorMsg}`, 'error');
        setGlobalSaveSuccess(false); return { success: false, error: errorMsg };
     } finally {
        setIsSavingGlobal(false);
     }
  }, [currentProfileAddress, savedReactions, addToast, configServiceInstanceReady, configServiceRef, setHasPendingChanges]);

  /**
   * Saves the current global MIDI map state (for the host profile) to the host profile via ConfigurationService.
   * @async
   * @returns {Promise<{success: boolean, error?: string}>} A promise resolving with the save operation result.
   */
  const saveGlobalMidiMap = useCallback(async () => {
     const service = configServiceRef.current;
     const addressToSave = currentProfileAddress;
     // Check service readiness for writing
     const isReady = !!service && configServiceInstanceReady && service.checkReadyForWrite();
     if (!isReady || !addressToSave) {
         const errorMsg = !isReady ? "Configuration service not ready for writing." : "No host profile address provided.";
         addToast(errorMsg, "error"); return { success: false, error: errorMsg };
     }
    setIsSavingGlobal(true); setGlobalSaveError(null); setGlobalSaveSuccess(false);
     try {
        const dataKey = RADAR_MIDI_MAP_KEY; const dataToSave = midiMap || {}; // Use midiMap from this hook's state
        const jsonString = JSON.stringify(dataToSave); const hexValue = stringToHex(jsonString);
        const result = await service.saveDataToKey(addressToSave, dataKey, hexValue);
        if (result.success) {
            addToast(`Global MIDI map saved successfully!`, 'success');
            setGlobalSaveSuccess(true);
            // Assuming successful save clears pending changes related to the MIDI map
            // Note: This might need adjustment if other pending changes exist.
            setHasPendingChanges(false);
         } else { throw new Error(result.error || "Save MIDI map operation failed."); }
         return result;
     } catch (error) {
        const errorMsg = error.message || `An unknown error occurred while saving the MIDI map.`; setGlobalSaveError(errorMsg);
        addToast(`Error saving MIDI map: ${errorMsg}`, 'error');
        setGlobalSaveSuccess(false); return { success: false, error: errorMsg };
     } finally {
        setIsSavingGlobal(false);
     }
  }, [currentProfileAddress, midiMap, addToast, configServiceInstanceReady, configServiceRef, setHasPendingChanges]);

  /**
   * Updates or adds a specific event reaction configuration in the local state. Sets `hasPendingChanges` to true.
   * @param {string} eventType - The identifier for the event type (e.g., 'up:reaction:received').
   * @param {object} reactionData - The configuration data for this reaction.
   * @returns {void}
   */
  const updateSavedReaction = useCallback((eventType, reactionData) => {
      if (!eventType || !reactionData) return;
      setSavedReactions((prev) => ({ ...prev, [eventType]: reactionData }));
      setHasPendingChanges(true);
  }, [setHasPendingChanges]);

  /**
   * Removes an event reaction configuration from the local state by its event type. Sets `hasPendingChanges` to true if a deletion occurred.
   * @param {string} eventType - The identifier for the event type to remove.
   * @returns {void}
   */
  const deleteSavedReaction = useCallback((eventType) => {
    if (!eventType) return;
    setSavedReactions((prev) => {
      const newState = { ...prev };
      if (newState[eventType]) {
        delete newState[eventType];
        setHasPendingChanges(true); // Mark changes as pending only if deletion happened
        return newState;
      }
      return prev; // Return previous state if key didn't exist
    });
  }, [setHasPendingChanges]);

  /**
   * Replaces the entire MIDI map configuration in the local state (for the host profile). Sets `hasPendingChanges` to true.
   * @param {object} newMap - The new MIDI map object.
   * @returns {void}
   */
  const updateMidiMap = useCallback((newMap) => {
    setMidiMap(newMap || {}); // Ensure it's an object, default to empty if null/undefined
    setHasPendingChanges(true);
  }, [setHasPendingChanges]);

  // Memoize the final context state provided by this hook
  const contextState = useMemo(() => ({
      configServiceInstanceReady,
      configServiceRef,
      savedReactions,
      midiMap,
      isSavingGlobal,
      globalSaveError,
      globalSaveSuccess,
      hasPendingChanges,
      setHasPendingChanges,
      saveGlobalReactions,
      saveGlobalMidiMap,
      updateSavedReaction,
      deleteSavedReaction,
      updateMidiMap,
      isLoadingGlobals,
      globalLoadError,
  }), [
      configServiceInstanceReady, configServiceRef,
      savedReactions, midiMap, isSavingGlobal, globalSaveError, globalSaveSuccess,
      hasPendingChanges, setHasPendingChanges, saveGlobalReactions, saveGlobalMidiMap,
      updateSavedReaction, deleteSavedReaction, updateMidiMap,
      isLoadingGlobals, globalLoadError
  ]);

  return contextState;
};

export default useConfigState;