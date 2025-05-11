// src/hooks/useConfigState.js
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useUpProvider } from "../context/UpProvider";
import ConfigurationService from "../services/ConfigurationService";
import { useToast } from "../context/ToastContext";
import {
  RADAR_EVENT_REACTIONS_KEY,
  RADAR_MIDI_MAP_KEY,
} from "../config/global-config";
import { stringToHex, hexToString } from "viem"; // Added hexToString

/**
 * @typedef {object} ConfigStateAPI
 * @property {boolean} configServiceInstanceReady - Indicates if the ConfigurationService is ready for reads and writes.
 * @property {React.RefObject<ConfigurationService | null>} configServiceRef - Ref to the ConfigurationService instance.
 * @property {object} savedReactions - Configuration object for global event reactions stored on the host profile.
 * @property {object} midiMap - Configuration object for global MIDI mappings stored on the host profile.
 * @property {boolean} isSavingGlobal - True if global settings (reactions/MIDI) are currently being saved.
 * @property {Error | string | null} globalSaveError - Error from the last global settings save attempt.
 * @property {boolean} globalSaveSuccess - True if the last global settings save operation was successful.
 * @property {boolean} hasPendingChanges - True if any configuration (visual, preset, reactions, MIDI) has unsaved modifications. This flag is typically set by other contexts.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setHasPendingChanges - Manually sets the pending changes flag. Consumed by other contexts.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalReactions - Saves only the global event reactions to the host profile.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalMidiMap - Saves only the global MIDI map to the host profile.
 * @property {(eventType: string, reactionData: object) => void} updateSavedReaction - Adds or updates a specific event reaction configuration in this hook's state.
 * @property {(eventType: string) => void} deleteSavedReaction - Removes an event reaction configuration from this hook's state.
 * @property {(newMap: object) => void} updateMidiMap - Replaces the entire MIDI map configuration in this hook's state.
 * @property {boolean} isLoadingGlobals - True if global settings (reactions, MIDI map) are currently being loaded.
 * @property {Error | string | null} globalLoadError - Error from the last attempt to load global settings.
 */

/**
 * Custom hook to manage global application settings (Reactions, MIDI map for the host profile),
 * the `ConfigurationService` instance, and the `hasPendingChanges` status.
 * It no longer handles preset management or live visual configurations, which have been
 * delegated to `PresetManagementContext` and `VisualConfigContext` respectively.
 * It loads global settings (reactions, MIDI map) when the profile address or service readiness changes.
 *
 * @param {string|null} currentProfileAddress The address of the host profile to manage settings for.
 * @returns {ConfigStateAPI} An object containing global configuration state and management functions.
 */
const useConfigState = (currentProfileAddress) => {
  const {
      provider, walletClient, publicClient,
      isConnecting: upIsConnecting,
      hasCriticalError: upHasCriticalError
  } = useUpProvider();

  const { addToast } = useToast();
  const configServiceRef = useRef(null);
  const prevProfileAddressForGlobalsRef = useRef(null); // Track address for global loads

  // State managed by this hook
  const [savedReactions, setSavedReactions] = useState({});
  const [midiMap, setMidiMap] = useState({}); // This is the host profile's stored MIDI map
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);
  const [globalSaveError, setGlobalSaveError] = useState(null);
  const [globalSaveSuccess, setGlobalSaveSuccess] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isLoadingGlobals, setIsLoadingGlobals] = useState(false); // New state for loading globals
  const [globalLoadError, setGlobalLoadError] = useState(null);   // New state for global load errors


  const isUpProviderStableForRead = useMemo(() => {
      return !!publicClient && !upIsConnecting && !upHasCriticalError;
  }, [publicClient, upIsConnecting, upHasCriticalError]);

  // Effect to initialize and update ConfigurationService instance
  useEffect(() => {
    if (provider && !configServiceRef.current) {
        configServiceRef.current = new ConfigurationService(provider, walletClient, publicClient);
    }
    if (configServiceRef.current) {
        // Update clients if they change (e.g., chain change)
        if (configServiceRef.current.publicClient !== publicClient) {
            configServiceRef.current.publicClient = publicClient;
        }
        if (configServiceRef.current.walletClient !== walletClient) {
            configServiceRef.current.walletClient = walletClient;
        }
        configServiceRef.current.checkReadyForRead();
        configServiceRef.current.checkReadyForWrite();
    }
  }, [provider, publicClient, walletClient]);

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
            let reactionsLoaded = false;
            let midiLoaded = false;

            try {
                const reactionsHex = await service.loadDataFromKey(currentProfileAddress, RADAR_EVENT_REACTIONS_KEY);
                if (reactionsHex && reactionsHex !== '0x') {
                    setSavedReactions(JSON.parse(hexToString(reactionsHex)));
                } else {
                    setSavedReactions({}); // Reset if no data
                }
                reactionsLoaded = true;
            } catch (e) {
                console.error("Error loading global reactions:", e);
                setGlobalLoadError(prev => `${prev || ''} Reactions: ${e.message}`.trim());
                setSavedReactions({}); // Reset on error
            }

            try {
                const midiHex = await service.loadDataFromKey(currentProfileAddress, RADAR_MIDI_MAP_KEY);
                if (midiHex && midiHex !== '0x') {
                    setMidiMap(JSON.parse(hexToString(midiHex)));
                } else {
                    setMidiMap({}); // Reset if no data
                }
                midiLoaded = true;
            } catch (e) {
                console.error("Error loading global MIDI map:", e);
                setGlobalLoadError(prev => `${prev || ''} MIDI: ${e.message}`.trim());
                setMidiMap({}); // Reset on error
            }
            
            if (reactionsLoaded && midiLoaded && !globalLoadError) {
                // console.log("[useConfigState] Global settings (reactions, MIDI map) loaded successfully.");
            }
            setIsLoadingGlobals(false);
        } else {
            // Reset if no address or service not ready
            setSavedReactions({});
            setMidiMap({});
            setIsLoadingGlobals(false); // Ensure loading is false if conditions aren't met
            setGlobalLoadError(null);
        }
    };

    // Load globals if address changes or if service becomes ready for a previously set address
    if (currentProfileAddress !== prevProfileAddressForGlobalsRef.current || 
        (currentProfileAddress && configServiceInstanceReady && !isLoadingGlobals && !globalLoadError && prevProfileAddressForGlobalsRef.current === null)
    ) {
        prevProfileAddressForGlobalsRef.current = currentProfileAddress;
        loadGlobalSettings();
    } else if (!currentProfileAddress) { // If address becomes null, reset
        prevProfileAddressForGlobalsRef.current = null;
        setSavedReactions({});
        setMidiMap({});
        setIsLoadingGlobals(false);
        setGlobalLoadError(null);
    }

  }, [currentProfileAddress, configServiceInstanceReady, isLoadingGlobals, globalLoadError]); // Added isLoadingGlobals and globalLoadError to prevent re-fetch loops on error


  /**
   * Saves the current global event reactions to the host profile.
   */
  const saveGlobalReactions = useCallback(async () => {
     const service = configServiceRef.current;
     const addressToSave = currentProfileAddress;
     const isReady = !!service && configServiceInstanceReady && service.checkReadyForWrite();
     if (!isReady || !addressToSave) {
         const errorMsg = !isReady ? "Write service not ready." : "No profile address.";
         addToast(errorMsg, "error"); return { success: false, error: errorMsg };
     }
     setIsSavingGlobal(true); setGlobalSaveError(null); setGlobalSaveSuccess(false);
     try {
         const dataKey = RADAR_EVENT_REACTIONS_KEY; const dataToSave = savedReactions || {};
         const jsonString = JSON.stringify(dataToSave); const hexValue = stringToHex(jsonString);
         const result = await service.saveDataToKey(addressToSave, dataKey, hexValue);
         if (result.success) {
            addToast(`Global reactions saved successfully!`, 'success');
            setGlobalSaveSuccess(true); setHasPendingChanges(false); // Saving clears pending changes
         } else { throw new Error(result.error || "Save reactions failed."); }
         return result;
     } catch (error) {
        const errorMsg = error.message || `Unknown reactions save error.`; setGlobalSaveError(errorMsg);
        addToast(`Error saving reactions: ${errorMsg}`, 'error');
        setGlobalSaveSuccess(false); return { success: false, error: errorMsg };
     } finally {
        setIsSavingGlobal(false);
     }
  }, [currentProfileAddress, savedReactions, addToast, configServiceInstanceReady, configServiceRef, setHasPendingChanges]); // Added setHasPendingChanges

  /**
   * Saves the current global MIDI map (for the host profile) to the host profile.
   */
  const saveGlobalMidiMap = useCallback(async () => {
     const service = configServiceRef.current;
     const addressToSave = currentProfileAddress;
     const isReady = !!service && configServiceInstanceReady && service.checkReadyForWrite();
     if (!isReady || !addressToSave) {
         const errorMsg = !isReady ? "Write service not ready." : "No profile address.";
         addToast(errorMsg, "error"); return { success: false, error: errorMsg };
     }
    setIsSavingGlobal(true); setGlobalSaveError(null); setGlobalSaveSuccess(false);
     try {
        const dataKey = RADAR_MIDI_MAP_KEY; const dataToSave = midiMap || {}; // Use midiMap from this hook's state
        const jsonString = JSON.stringify(dataToSave); const hexValue = stringToHex(jsonString);
        const result = await service.saveDataToKey(addressToSave, dataKey, hexValue);
        if (result.success) {
            addToast(`Global MIDI map saved successfully!`, 'success');
            setGlobalSaveSuccess(true); setHasPendingChanges(false); // Saving clears pending changes
         } else { throw new Error(result.error || "Save MIDI map failed."); }
         return result;
     } catch (error) {
        const errorMsg = error.message || `Unknown MIDI save error.`; setGlobalSaveError(errorMsg);
        addToast(`Error saving MIDI map: ${errorMsg}`, 'error');
        setGlobalSaveSuccess(false); return { success: false, error: errorMsg };
     } finally {
        setIsSavingGlobal(false);
     }
  }, [currentProfileAddress, midiMap, addToast, configServiceInstanceReady, configServiceRef, setHasPendingChanges]); // Added setHasPendingChanges

  /**
   * Updates a specific event reaction configuration in the local state.
   */
  const updateSavedReaction = useCallback((eventType, reactionData) => {
      if (!eventType || !reactionData) return;
      setSavedReactions((prev) => ({ ...prev, [eventType]: reactionData }));
      setHasPendingChanges(true);
  }, [setHasPendingChanges]); // Added setHasPendingChanges

  /**
   * Removes an event reaction configuration from the local state.
   */
  const deleteSavedReaction = useCallback((eventType) => {
    if (!eventType) return;
    setSavedReactions((prev) => {
      const newState = { ...prev };
      if (newState[eventType]) { 
        delete newState[eventType]; 
        setHasPendingChanges(true); 
        return newState; 
      }
      return prev;
    });
  }, [setHasPendingChanges]); // Added setHasPendingChanges

  /**
   * Replaces the entire MIDI map configuration in the local state (for the host profile).
   */
  const updateMidiMap = useCallback((newMap) => {
    setMidiMap(newMap); 
    setHasPendingChanges(true);
  }, [setHasPendingChanges]); // Added setHasPendingChanges

  // Memoize the final context state provided by this hook
  const contextState = useMemo(() => ({
      configServiceInstanceReady,
      configServiceRef,
      savedReactions,
      midiMap, // Host profile's MIDI map
      isSavingGlobal,
      globalSaveError,
      globalSaveSuccess,
      hasPendingChanges,
      setHasPendingChanges, // Expose setter for other contexts/components
      saveGlobalReactions,
      saveGlobalMidiMap,
      updateSavedReaction,
      deleteSavedReaction,
      updateMidiMap,
      isLoadingGlobals, // New
      globalLoadError,   // New
      // Removed preset-related state and functions
  }), [
      configServiceInstanceReady, configServiceRef,
      savedReactions, midiMap, isSavingGlobal, globalSaveError, globalSaveSuccess,
      hasPendingChanges, setHasPendingChanges, saveGlobalReactions, saveGlobalMidiMap,
      updateSavedReaction, deleteSavedReaction, updateMidiMap,
      isLoadingGlobals, globalLoadError // New
  ]);

  return contextState;
};

export default useConfigState;