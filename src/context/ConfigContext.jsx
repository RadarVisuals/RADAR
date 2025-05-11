// src/context/ConfigContext.jsx
import React, {
  createContext,
  useContext,
  useMemo,
} from "react";
import PropTypes from "prop-types";
import useConfigState from "../hooks/useConfigState";
import { useUserSession } from "./UserSessionContext";

/**
 * @typedef {object} ConfigContextValue
 * @property {boolean} configServiceInstanceReady - True if ConfigurationService is instantiated and has its clients.
 * @property {React.RefObject<import('../services/ConfigurationService.js').default | null>} configServiceRef - Ref to the ConfigurationService instance.
 * @property {object} savedReactions - User-defined reactions to blockchain events for the host profile.
 * @property {object} midiMap - User's global MIDI controller mappings stored on the host profile.
 * @property {boolean} isSavingGlobal - True if global settings (reactions/MIDI) are currently being saved.
 * @property {Error | string | null} globalSaveError - Error from the last global settings save attempt.
 * @property {boolean} globalSaveSuccess - True if the last global settings save operation was successful.
 * @property {boolean} isLoadingGlobals - True if global settings (reactions, MIDI map) are currently being loaded.
 * @property {Error | string | null} globalLoadError - Error from the last attempt to load global settings.
 * @property {boolean} hasPendingChanges - True if any configuration has unsaved modifications.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setHasPendingChanges - Manually sets the pending changes flag.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalReactions - Saves only the global event reactions to the host profile.
 * @property {() => Promise<{success: boolean, error?: string}>} saveGlobalMidiMap - Saves only the global MIDI map to the host profile.
 * @property {(eventType: string, reactionData: object) => void} updateSavedReaction - Adds or updates a specific event reaction configuration.
 * @property {(eventType: string) => void} deleteSavedReaction - Removes an event reaction configuration.
 * @property {(newMap: object) => void} updateMidiMap - Replaces the entire MIDI map configuration.
 */

/** @type {ConfigContextValue} */
const defaultConfigContext = {
  configServiceInstanceReady: false,
  configServiceRef: { current: null },
  savedReactions: {},
  midiMap: {},
  isSavingGlobal: false,
  globalSaveError: null,
  globalSaveSuccess: false,
  isLoadingGlobals: false,
  globalLoadError: null,
  hasPendingChanges: false,
  setHasPendingChanges: () => {},
  saveGlobalReactions: async () => ({ success: false, error: "Provider not initialized" }),
  saveGlobalMidiMap: async () => ({ success: false, error: "Provider not initialized" }),
  updateSavedReaction: () => {},
  deleteSavedReaction: () => {},
  updateMidiMap: () => {},
};

const ConfigContext = createContext(defaultConfigContext);

export const ConfigProvider = ({ children }) => {
  const { hostProfileAddress } = useUserSession();
  const configStateHook = useConfigState(hostProfileAddress);

  const contextValue = useMemo(
    () => ({
      ...configStateHook,
    }),
    [configStateHook]
  );

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
};

ConfigProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

// Ensure this export is exactly as named and is not commented out or conditionally exported.
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    const err = new Error("useConfig must be used within a ConfigProvider component.");
    // It's good practice to log the stack trace for easier debugging.
    console.error("useConfig context details: Attempted to use context but found undefined.", err.stack);
    throw err;
  }
  return context;
};