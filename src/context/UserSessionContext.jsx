// src/context/UserSessionContext.jsx
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

import { useUpProvider } from './UpProvider'; // Local context
import { RADAR_OFFICIAL_ADMIN_ADDRESS } from '../config/global-config.js'; // Local config

import { isAddress } from 'viem'; // Third-party utility

/**
 * @typedef {object} UserSessionContextValue
 * @property {string | null} hostProfileAddress - The Universal Profile address currently being viewed or configured. This is typically derived from `contextAccounts[0]` of `useUpProvider`.
 * @property {string | null} visitorProfileAddress - The Universal Profile address of the current user/visitor interacting with the application. This is typically derived from `accounts[0]` of `useUpProvider`.
 * @property {boolean} isHostProfileOwner - True if the `visitorProfileAddress` is the same as the `hostProfileAddress`, indicating the visitor owns the profile being viewed.
 * @property {boolean} isRadarProjectAdmin - True if the `visitorProfileAddress` matches the `RADAR_OFFICIAL_ADMIN_ADDRESS`, granting special administrative privileges.
 * @property {boolean} isPreviewMode - True if the application is currently operating in a special preview or demonstration mode, which might restrict certain actions like saving.
 * @property {boolean} canSaveToHostProfile - True if the current user (visitor) has permissions to save changes to the `hostProfileAddress`. This is typically true if the visitor is the owner and not in preview mode.
 * @property {() => void} togglePreviewMode - Function to toggle the `isPreviewMode` state.
 */

/**
 * Default values for the UserSessionContext.
 * These are used if a component tries to consume the context without a `UserSessionProvider` higher up in the tree.
 * @type {UserSessionContextValue}
 */
export const defaultUserSessionContextValue = { // Renamed for clarity
  hostProfileAddress: null,
  visitorProfileAddress: null,
  isHostProfileOwner: false,
  isRadarProjectAdmin: false,
  isPreviewMode: false,
  canSaveToHostProfile: false,
  togglePreviewMode: () => {
    if (import.meta.env.DEV) {
      console.warn("togglePreviewMode called on default UserSessionContext. Ensure UserSessionProvider is an ancestor.");
    }
  },
};

const UserSessionContext = createContext(defaultUserSessionContextValue);

/**
 * Provides user session context, including information about the host profile being viewed,
 * the visitor's profile, ownership status, administrative privileges (if applicable),
 * and the application's preview mode state. It derives most of its core data from `useUpProvider`.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components that will have access to this context.
 * @returns {JSX.Element} The UserSessionProvider component.
 */
export const UserSessionProvider = ({ children }) => {
  const { accounts, contextAccounts } = useUpProvider();
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const hostProfileAddress = useMemo(() => {
    const address = contextAccounts && contextAccounts.length > 0 && isAddress(contextAccounts[0])
      ? contextAccounts[0]
      : null;
    // if (import.meta.env.DEV) {
      // console.log("[UserSessionProvider] Calculated hostProfileAddress:", address, "from contextAccounts:", contextAccounts);
    // }
    return address;
  }, [contextAccounts]);

  const visitorProfileAddress = useMemo(() => {
    const address = accounts && accounts.length > 0 && isAddress(accounts[0])
      ? accounts[0]
      : null;
    // if (import.meta.env.DEV) {
      // console.log("[UserSessionProvider] Calculated visitorProfileAddress:", address, "from accounts:", accounts);
    // }
    return address;
  }, [accounts]);

  const isHostProfileOwner = useMemo(() => {
    if (!visitorProfileAddress || !hostProfileAddress) {
      return false;
    }
    return visitorProfileAddress.toLowerCase() === hostProfileAddress.toLowerCase();
  }, [visitorProfileAddress, hostProfileAddress]);

  const isRadarProjectAdmin = useMemo(() => {
    if (!visitorProfileAddress || !RADAR_OFFICIAL_ADMIN_ADDRESS) return false;
    // Validate the configured admin address format once
    if (!isAddress(RADAR_OFFICIAL_ADMIN_ADDRESS)) {
        if (import.meta.env.DEV) {
            console.warn("[UserSessionContext] RADAR_OFFICIAL_ADMIN_ADDRESS in global-config.js is not a valid Ethereum address. isRadarProjectAdmin will always be false.");
        }
        return false;
    }
    return visitorProfileAddress.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
  }, [visitorProfileAddress]); // RADAR_OFFICIAL_ADMIN_ADDRESS is a constant, not a dependency for re-memoization

  const canSaveToHostProfile = useMemo(() => {
    // User can save if they are the owner of the host profile AND not in preview mode.
    // Admin status could grant save permissions even if not owner, but that's not implemented here.
    return isHostProfileOwner && !isPreviewMode;
  }, [isHostProfileOwner, isPreviewMode]);

  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode(prev => !prev);
  }, []); // setIsPreviewMode is stable

  const contextValue = useMemo(() => {
    const val = {
      hostProfileAddress,
      visitorProfileAddress,
      isHostProfileOwner,
      isRadarProjectAdmin,
      isPreviewMode,
      canSaveToHostProfile,
      togglePreviewMode,
    };
    // if (import.meta.env.DEV) {
      // console.log("[UserSessionProvider] Providing contextValue:", val);
    // }
    return val;
  }, [
    hostProfileAddress,
    visitorProfileAddress,
    isHostProfileOwner,
    isRadarProjectAdmin,
    isPreviewMode,
    canSaveToHostProfile,
    togglePreviewMode,
  ]);

  return (
    <UserSessionContext.Provider value={contextValue}>
      {children}
    </UserSessionContext.Provider>
  );
};

UserSessionProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Custom hook to consume the `UserSessionContext`.
 * Provides access to host and visitor profile information, ownership status,
 * admin status, preview mode, and save permissions.
 * Throws an error if used outside of a `UserSessionProvider`.
 *
 * @returns {UserSessionContextValue} The user session context value.
 * @throws {Error} If the hook is not used within a `UserSessionProvider`.
 */
export const useUserSession = () => {
  const context = useContext(UserSessionContext);
  if (context === undefined) { // Standard check for missing provider
    const err = new Error('useUserSession must be used within a UserSessionProvider component.');
    if (import.meta.env.DEV) {
        console.error("useUserSession context details: Attempted to use context but found undefined. This usually means UserSessionProvider is missing as an ancestor.", err.stack);
    }
    throw err;
  }
  return context;
};