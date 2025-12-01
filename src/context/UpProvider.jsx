// src/context/UpProvider.jsx
import React, { createContext, useContext, useEffect } from "react";
import { useWalletStore } from "../store/useWalletStore";
import { useShallow } from 'zustand/react/shallow';

const UpContext = createContext(undefined);

export function useUpProvider() {
  const context = useContext(UpContext);
  if (context === undefined) {
    throw new Error("useUpProvider must be used within an UpProvider.");
  }
  return context;
}

export function UpProvider({ children }) {
  const initWallet = useWalletStore((state) => state.initWallet);
  
  // FIX: Wrapped selector in useShallow to prevent infinite re-renders
  const state = useWalletStore(useShallow((s) => ({
    provider: s.provider,
    walletClient: s.walletClient,
    publicClient: s.publicClient,
    chainId: s.chainId,
    accounts: s.accounts,
    contextAccounts: s.contextAccounts,
    walletConnected: s.isWalletConnected,
    isConnecting: false, // Deprecated but kept for compatibility
    initializationError: s.initializationError,
    fetchStateError: s.fetchStateError,
    hasCriticalError: !!s.initializationError,
  })));

  // Initialize once on mount
  useEffect(() => {
    initWallet();
  }, [initWallet]);

  return (
    <UpContext.Provider value={state}>
      {children}
    </UpContext.Provider>
  );
}