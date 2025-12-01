// src/context/UserSessionContext.jsx
import React, { createContext, useContext, useMemo } from 'react';
import { useWalletStore } from '../store/useWalletStore';

const UserSessionContext = createContext(null);

export const UserSessionProvider = ({ children }) => {
  // Use a shallow selector or pick fields individually to prevent re-renders if unrelated store data changes
  const hostProfileAddress = useWalletStore(s => s.hostProfileAddress);
  const loggedInUserUPAddress = useWalletStore(s => s.loggedInUserUPAddress);
  const isHostProfileOwner = useWalletStore(s => s.isHostProfileOwner);
  const isRadarProjectAdmin = useWalletStore(s => s.isRadarProjectAdmin);
  const isPreviewMode = useWalletStore(s => s.isPreviewMode);
  
  const togglePreviewMode = useWalletStore(s => s.togglePreviewMode);

  const canSaveToHostProfile = useMemo(() => {
    return isHostProfileOwner && !isPreviewMode;
  }, [isHostProfileOwner, isPreviewMode]);

  const contextValue = useMemo(() => ({
    hostProfileAddress,
    loggedInUserUPAddress,
    isHostProfileOwner,
    isRadarProjectAdmin,
    isPreviewMode,
    canSaveToHostProfile,
    togglePreviewMode,
  }), [
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

export const useUserSession = () => {
  const context = useContext(UserSessionContext);
  if (!context) {
    throw new Error('useUserSession must be used within a UserSessionProvider component.');
  }
  return context;
};