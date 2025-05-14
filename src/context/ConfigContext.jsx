// src/context/ConfigContext.jsx
import React, {
  createContext,
  useContext,
  useMemo,
  // Removed useState, useEffect, useCallback, useRef as they are not directly used in this file
} from "react";
import PropTypes from "prop-types";

import useConfigState from "../hooks/useConfigState"; // Local hook
import { useUserSession } from "./UserSessionContext"; // Local context

/**
 * @typedef {import('../hooks/useConfigState').ConfigStateAPI} ConfigContextValue - The shape of the context value, derived from `useConfigState`.
 * This includes state related to the ConfigurationService instance, global settings like
 * event reactions and MIDI maps, their loading/saving status, and pending changes.
 */

/**
 * Default values for the ConfigContext.
 * These values are used if a component tries to consume the context
 * without a `ConfigProvider` higher up in the tree.
 * @type {ConfigContextValue}
 */
const defaultConfigContextValue = {
  configServiceInstanceReady: false,
  configServiceRef: { current: null }, // React.RefObject needs a 'current' property
  savedReactions: {},
  midiMap: {},
  isSavingGlobal: false,
  globalSaveError: null,
  globalSaveSuccess: false,
  isLoadingGlobals: false,
  globalLoadError: null,
  hasPendingChanges: false,
  setHasPendingChanges: () => {
    if (import.meta.env.DEV) {
      console.warn("setHasPendingChanges called on default ConfigContext value. Ensure ConfigProvider is an ancestor.");
    }
  },
  saveGlobalReactions: async () => {
    if (import.meta.env.DEV) {
      console.warn("saveGlobalReactions called on default ConfigContext value.");
    }
    return { success: false, error: "Provider not initialized" };
  },
  saveGlobalMidiMap: async () => {
    if (import.meta.env.DEV) {
      console.warn("saveGlobalMidiMap called on default ConfigContext value.");
    }
    return { success: false, error: "Provider not initialized" };
  },
  updateSavedReaction: () => {
    if (import.meta.env.DEV) {
      console.warn("updateSavedReaction called on default ConfigContext value.");
    }
  },
  deleteSavedReaction: () => {
    if (import.meta.env.DEV) {
      console.warn("deleteSavedReaction called on default ConfigContext value.");
    }
  },
  updateMidiMap: () => {
    if (import.meta.env.DEV) {
      console.warn("updateMidiMap called on default ConfigContext value.");
    }
  },
};

const ConfigContext = createContext(defaultConfigContextValue);

/**
 * Provides configuration-related state to its children components.
 * This includes the ConfigurationService instance, global settings (reactions, MIDI map),
 * their loading/saving status, and management of pending changes.
 * It utilizes the `useConfigState` hook for its core logic, driven by the
 * `hostProfileAddress` from `UserSessionContext`.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to be rendered within this provider.
 * @returns {JSX.Element} The ConfigProvider component.
 */
export const ConfigProvider = ({ children }) => {
  const { hostProfileAddress } = useUserSession();
  const configStateHookValues = useConfigState(hostProfileAddress); // Renamed for clarity

  // The contextValue directly uses all properties returned by useConfigState.
  // useMemo is appropriate here because configStateHookValues is memoized by useConfigState itself.
  const contextValue = useMemo(
    () => ({
      ...configStateHookValues,
    }),
    [configStateHookValues]
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

/**
 * Custom hook to consume the `ConfigContext`.
 * Provides access to global configuration state and management functions.
 * Throws an error if used outside of a `ConfigProvider`.
 *
 * @returns {ConfigContextValue} The current value of the ConfigContext.
 * @throws {Error} If the hook is not used within a `ConfigProvider`.
 */
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    // Error for developers if context is used incorrectly
    const err = new Error("useConfig must be used within a ConfigProvider component.");
    if (import.meta.env.DEV) {
        // Log additional details in development for easier debugging
        console.error("useConfig context details: Attempted to use context but found undefined. This usually means ConfigProvider is missing as an ancestor of the component calling useConfig.", err.stack);
    }
    throw err;
  }
  return context;
};