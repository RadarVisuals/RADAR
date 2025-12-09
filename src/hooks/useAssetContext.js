import { useProjectStore } from '../store/useProjectStore';
import { useWalletStore } from '../store/useWalletStore';
import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

/**
 * Adapter hook to replace the old AssetContext.
 * Connects components to the Asset slice of useProjectStore.
 */
export const useAssetContext = () => {
  const {
    officialWhitelist,
    ownedTokenIdentifiers,
    isFetchingTokens,
    tokenFetchProgress,
    refreshOfficialWhitelist,
    refreshOwnedTokens: storeRefreshOwnedTokens
  } = useProjectStore(useShallow(state => ({
    officialWhitelist: state.officialWhitelist,
    ownedTokenIdentifiers: state.ownedTokenIdentifiers,
    isFetchingTokens: state.isFetchingTokens,
    tokenFetchProgress: state.tokenFetchProgress,
    refreshOfficialWhitelist: state.refreshOfficialWhitelist,
    refreshOwnedTokens: state.refreshOwnedTokens
  })));

  const hostProfileAddress = useWalletStore(s => s.hostProfileAddress);

  // Wrap the store action to automatically inject the host address
  const refreshOwnedTokens = useCallback((force = false, isSilent = false) => {
    if (hostProfileAddress) {
      storeRefreshOwnedTokens(hostProfileAddress, force, isSilent);
    }
  }, [hostProfileAddress, storeRefreshOwnedTokens]);

  return {
    officialWhitelist,
    ownedTokenIdentifiers,
    isFetchingTokens,
    tokenFetchProgress,
    refreshOfficialWhitelist,
    refreshOwnedTokens
  };
};