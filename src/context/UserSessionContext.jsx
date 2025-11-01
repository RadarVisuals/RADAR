// src/context/UserSessionContext.jsx
import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';

import { useUpProvider } from './UpProvider'; // Local context
import { RADAR_OFFICIAL_ADMIN_ADDRESS } from '../config/global-config.js'; // Local config

import { isAddress } from 'viem'; // Third-party utility
import { ERC725 } from '@erc725/erc725.js';
import lsp3ProfileSchema from '@erc725/erc725.js/schemas/LSP3ProfileMetadata.json';
import { IPFS_GATEWAY } from '../config/global-config';

export const defaultUserSessionContextValue = {
  hostProfileAddress: null,
  loggedInUserUPAddress: null,
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
  const { accounts, contextAccounts, publicClient } = useUpProvider();
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isHostProfileOwner, setIsHostProfileOwner] = useState(false);
  
  // --- START OF FIX: State to capture the logged-in user's own UP address ---
  const [loggedInUserUPAddress, setLoggedInUserUPAddress] = useState(null);
  // --- END OF FIX ---

  const hostProfileAddress = useMemo(() => {
    if (contextAccounts && contextAccounts.length > 0 && isAddress(contextAccounts[0])) {
      return contextAccounts[0];
    }
    return null;
  }, [contextAccounts]);

  // This effect correctly determines if the connected user owns the viewed profile.
  useEffect(() => {
    const controllerAddress = accounts && accounts.length > 0 ? accounts[0] : null;
    const profileAddress = hostProfileAddress;

    if (!controllerAddress || !profileAddress || !publicClient) {
      setIsHostProfileOwner(false);
      return;
    }

    const checkOwnership = async () => {
      try {
        if (controllerAddress.toLowerCase() === profileAddress.toLowerCase()) {
            setIsHostProfileOwner(true);
            return;
        }
        const erc725 = new ERC725(lsp3ProfileSchema, profileAddress, publicClient.transport.url, { ipfsGateway: IPFS_GATEWAY });
        const permissions = await erc725.getPermissions(controllerAddress);
        const hasSuperSetData = ERC725.decodePermissions(permissions).SUPER_SETDATA;
        setIsHostProfileOwner(hasSuperSetData);
      } catch (error) {
        setIsHostProfileOwner(false);
      }
    };
    checkOwnership();
  }, [accounts, hostProfileAddress, publicClient]);
  
  // --- START OF FIX: Effect to capture and retain the logged-in user's UP address ---
  useEffect(() => {
    // When the user is confirmed as the owner of the current profile,
    // we know that `hostProfileAddress` is their own address. We capture it.
    if (isHostProfileOwner && hostProfileAddress) {
      setLoggedInUserUPAddress(hostProfileAddress);
    }
    
    // If the user disconnects entirely (no controlling accounts), clear their UP address.
    if (accounts && accounts.length === 0) {
      setLoggedInUserUPAddress(null);
    }
  }, [isHostProfileOwner, hostProfileAddress, accounts]);
  // --- END OF FIX ---

  const isRadarProjectAdmin = useMemo(() => {
    if (!loggedInUserUPAddress || !isHostProfileOwner) return false;
    
    if (!isAddress(RADAR_OFFICIAL_ADMIN_ADDRESS)) {
        if (import.meta.env.DEV) {
            console.warn("[UserSessionContext] RADAR_OFFICIAL_ADMIN_ADDRESS in global-config.js is not a valid Ethereum address. isRadarProjectAdmin will always be false.");
        }
        return false;
    }
    return loggedInUserUPAddress.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
  }, [loggedInUserUPAddress, isHostProfileOwner]);

  const canSaveToHostProfile = useMemo(() => {
    return isHostProfileOwner && !isPreviewMode;
  }, [isHostProfileOwner, isPreviewMode]);

  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode(prev => !prev);
  }, []);

  const contextValue = useMemo(() => {
    return {
      hostProfileAddress,
      loggedInUserUPAddress,
      isHostProfileOwner,
      isRadarProjectAdmin,
      isPreviewMode,
      canSaveToHostProfile,
      togglePreviewMode,
    };
  }, [
    hostProfileAddress,
    loggedInUserUPAddress,
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