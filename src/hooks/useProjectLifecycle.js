// src/hooks/useProjectLifecycle.js
import { useEffect, useRef } from 'react';
import { useUpProvider } from '../context/UpProvider';
import { useProjectStore } from '../store/useProjectStore';
import { useWalletStore } from '../store/useWalletStore';

export const useProjectLifecycle = () => {
  const { provider, walletClient, publicClient } = useUpProvider();
  
  // Selectors
  const hostProfileAddress = useWalletStore(s => s.hostProfileAddress);
  const loggedInUserUPAddress = useWalletStore(s => s.loggedInUserUPAddress);
  const isHostProfileOwner = useWalletStore(s => s.isHostProfileOwner);
  const isConfigReady = useProjectStore(s => s.isConfigReady);
  
  // Actions
  const initService = useProjectStore(s => s.initService);
  const loadSetlist = useProjectStore(s => s.loadSetlist);
  const resetProject = useProjectStore(s => s.resetProject);

  // Track the last wallet client to prevent unnecessary re-inits
  // We use a ref so we can compare the object reference specifically
  const lastInitWalletClientRef = useRef(null);

  // 1. Initialize Service (Reactive)
  useEffect(() => {
    // We proceed if we have at least a provider and public client (Read access)
    if (provider && publicClient) {
      // Logic: 
      // If NOT ready, we must init.
      // OR if we have a walletClient now (user logged in) but didn't before, we MUST re-init to enable writing.
      const hasNewWalletClient = walletClient !== lastInitWalletClientRef.current;
      
      if (!isConfigReady || hasNewWalletClient) {
        initService(provider, walletClient, publicClient);
        lastInitWalletClientRef.current = walletClient;
      }
    }
  }, [provider, walletClient, publicClient, initService, isConfigReady]);

  // 2. Load Data when Profile Changes
  useEffect(() => {
    if (hostProfileAddress && isConfigReady) {
      const visitorContext = !isHostProfileOwner && loggedInUserUPAddress 
        ? { isVisitor: true, loggedInUserUPAddress } 
        : null;
      
      loadSetlist(hostProfileAddress, visitorContext);
    } else if (!hostProfileAddress) {
      resetProject();
    }
  }, [hostProfileAddress, isConfigReady, isHostProfileOwner, loggedInUserUPAddress, loadSetlist, resetProject]);
};