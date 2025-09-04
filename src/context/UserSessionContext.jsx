// src/context/UserSessionContext.jsx
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

import { useUpProvider } from './UpProvider'; // Local context
import { RADAR_OFFICIAL_ADMIN_ADDRESS } from '../config/global-config.js'; // Local config

import { isAddress } from 'viem'; // Third-party utility

export const defaultUserSessionContextValue = {
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

export const UserSessionProvider = ({ children }) => {
  const { accounts, contextAccounts } = useUpProvider();
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const hostProfileAddress = useMemo(() => {
    // --- START: MODIFIED LOGIC ---
    // Prioritize contextAccounts for when viewing another profile.
    if (contextAccounts && contextAccounts.length > 0 && isAddress(contextAccounts[0])) {
      return contextAccounts[0];
    }
    // Fallback to the visitor's own account if no specific context is provided.
    if (accounts && accounts.length > 0 && isAddress(accounts[0])) {
      return accounts[0];
    }
    // If neither is available, there's no host profile.
    return null;
    // --- END: MODIFIED LOGIC ---
  }, [contextAccounts, accounts]); // <-- ADDED 'accounts' TO DEPENDENCY ARRAY

  const visitorProfileAddress = useMemo(() => {
    const address = accounts && accounts.length > 0 && isAddress(accounts[0])
      ? accounts[0]
      : null;
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
            console.warn("[UserSessionContext] RADAR_OFFICIAL_ADMIN_ADDRESS in global-config.js is not a valid Ethereum address. isRadarProjectAdmin will always be false.");
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

export const useUserSession = () => {
  const context = useContext(UserSessionContext);
  if (context === undefined) {
    const err = new Error('useUserSession must be used within a UserSessionProvider component.');
    if (import.meta.env.DEV) {
        console.error("useUserSession context details: Attempted to use context but found undefined. This usually means UserSessionProvider is missing as an ancestor.", err.stack);
    }
    throw err;
  }
  return context;
};