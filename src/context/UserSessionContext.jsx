// src/context/UserSessionContext.jsx
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useUpProvider } from './UpProvider';
import { isAddress } from 'viem';
import { RADAR_OFFICIAL_ADMIN_ADDRESS } from '../config/global-config.js'; 

/**
 * @typedef {object} UserSessionContextValue
 * @property {string | null} hostProfileAddress - The Universal Profile address being viewed/configured (from contextAccounts[0]).
 * @property {string | null} visitorProfileAddress - The Universal Profile address of the visitor (from accounts[0]).
 * @property {boolean} isHostProfileOwner - True if visitorProfileAddress is the same as hostProfileAddress.
 * @property {boolean} isRadarProjectAdmin - True if the visitorProfileAddress matches the RADAR_OFFICIAL_ADMIN_ADDRESS.
 * @property {boolean} isPreviewMode - True if the application is in a special preview/demo mode.
 * @property {boolean} canSaveToHostProfile - True if the current user has permissions to save changes to the hostProfileAddress.
 * @property {() => void} togglePreviewMode - Function to toggle the preview mode.
 */

/** @type {UserSessionContextValue} */
export const defaultUserSessionContext = {
  hostProfileAddress: null,
  visitorProfileAddress: null,
  isHostProfileOwner: false,
  isRadarProjectAdmin: false,
  isPreviewMode: false,
  canSaveToHostProfile: false,
  togglePreviewMode: () => {},
};

const UserSessionContext = createContext(defaultUserSessionContext);

/**
 * Provides user session context, including host and visitor profile addresses,
 * ownership status, admin status, and preview mode state.
 * @param {object} props
 * @param {React.ReactNode} props.children - The child components.
 * @returns {JSX.Element} The provider component.
 */
export const UserSessionProvider = ({ children }) => {
  const { accounts, contextAccounts } = useUpProvider();
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const hostProfileAddress = useMemo(() => {
    const address = contextAccounts && contextAccounts.length > 0 && isAddress(contextAccounts[0])
      ? contextAccounts[0]
      : null;
    if (import.meta.env.DEV) {
      // console.log("[UserSessionProvider] Calculated hostProfileAddress:", address, "from contextAccounts:", contextAccounts);
    }
    return address;
  }, [contextAccounts]);

  const visitorProfileAddress = useMemo(() => {
    const address = accounts && accounts.length > 0 && isAddress(accounts[0])
      ? accounts[0]
      : null;
    if (import.meta.env.DEV) {
      // console.log("[UserSessionProvider] Calculated visitorProfileAddress:", address, "from accounts:", accounts);
    }
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
    if (!isAddress(RADAR_OFFICIAL_ADMIN_ADDRESS)) {
        if (import.meta.env.DEV) {
            console.warn("[UserSessionContext] RADAR_OFFICIAL_ADMIN_ADDRESS is not a valid address. isRadarProjectAdmin will be false.");
        }
        return false;
    }
    return visitorProfileAddress.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
  }, [visitorProfileAddress]);

  const canSaveToHostProfile = useMemo(() => {
    return isHostProfileOwner && !isPreviewMode;
  }, [isHostProfileOwner, isPreviewMode]);

  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode(prev => !prev);
  }, []);

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
    if (import.meta.env.DEV) {
      // console.log("[UserSessionProvider] Providing contextValue:", val);
    }
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
 * Custom hook to consume the UserSessionContext.
 * @returns {UserSessionContextValue} The user session context value.
 * @throws {Error} If used outside of a UserSessionProvider.
 */
export const useUserSession = () => {
  const context = useContext(UserSessionContext);
  if (context === undefined) {
    throw new Error('useUserSession must be used within a UserSessionProvider');
  }
  return context;
};