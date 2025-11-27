// src/context/AssetContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { keccak256, stringToBytes } from "viem";
import { useWorkspaceContext } from './WorkspaceContext'; // Dependency
import { useUserSession } from './UserSessionContext'; // Dependency
import { useToast } from './ToastContext'; // Dependency
import { RADAR_OFFICIAL_ADMIN_ADDRESS, IPFS_GATEWAY } from "../config/global-config";
import { hexToUtf8Safe } from "../services/ConfigurationService";

const OFFICIAL_WHITELIST_KEY = keccak256(stringToBytes("RADAR.OfficialWhitelist"));
const TOKEN_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 Minutes

const AssetContext = createContext();

export const AssetProvider = ({ children }) => {
  const { configServiceRef, configServiceInstanceReady, stagedSetlist } = useWorkspaceContext();
  const { hostProfileAddress, visitorProfileAddress, isRadarProjectAdmin } = useUserSession();
  const { addToast } = useToast();

  const [officialWhitelist, setOfficialWhitelist] = useState([]);
  const [ownedTokenIdentifiers, setOwnedTokenIdentifiers] = useState({});
  const [isFetchingTokens, setIsFetchingTokens] = useState(false);
  const [tokenFetchProgress, setTokenFetchProgress] = useState({ loaded: 0, total: 0, loading: false });
  
  // --- NEW: Cache Timestamp ---
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState(0);

  // Reset cache when the viewed profile changes
  useEffect(() => {
    setOwnedTokenIdentifiers({});
    setLastFetchTimestamp(0);
    setTokenFetchProgress({ loaded: 0, total: 0, loading: false });
  }, [hostProfileAddress, visitorProfileAddress]);

  const refreshOfficialWhitelist = useCallback(async () => {
    const service = configServiceRef.current;
    if (!service || !service.checkReadyForRead()) return;
    try {
        const pointerHex = await service.loadDataFromKey(RADAR_OFFICIAL_ADMIN_ADDRESS, OFFICIAL_WHITELIST_KEY);
        if (!pointerHex || pointerHex === '0x') { setOfficialWhitelist([]); return; }
        const ipfsUri = hexToUtf8Safe(pointerHex);
        if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) { setOfficialWhitelist([]); return; }
        const cid = ipfsUri.substring(7);
        const response = await fetch(`${IPFS_GATEWAY}${cid}`);
        if (!response.ok) throw new Error(`Failed to fetch whitelist from IPFS: ${response.statusText}`);
        const list = await response.json();
        setOfficialWhitelist(Array.isArray(list) ? list : []);
    } catch (error) {
        console.error("Error fetching official collection whitelist:", error);
        setOfficialWhitelist([]);
    }
  }, [configServiceRef]);

  useEffect(() => {
    if (configServiceInstanceReady) {
      refreshOfficialWhitelist();
    }
  }, [configServiceInstanceReady, refreshOfficialWhitelist]);

  // --- UPDATED: Added 'force' parameter and caching logic ---
  const refreshOwnedTokens = useCallback(async (force = false, isSilent = false) => {
    // 1. Check Cache
    if (!force && lastFetchTimestamp > 0 && (Date.now() - lastFetchTimestamp < TOKEN_CACHE_DURATION_MS)) {
        if (import.meta.env.DEV) console.log("[AssetContext] Skipping token fetch (Cache Valid)");
        return;
    }

    const service = configServiceRef.current;
    const effectiveAddress = hostProfileAddress || visitorProfileAddress;
    
    const userLibrary = stagedSetlist?.personalCollectionLibrary || [];
    
    const combinedCollectionsMap = new Map();
    officialWhitelist.forEach(c => c && c.address && combinedCollectionsMap.set(c.address.toLowerCase(), c));
    userLibrary.forEach(c => {
        if (c && c.address && !combinedCollectionsMap.has(c.address.toLowerCase())) {
            combinedCollectionsMap.set(c.address.toLowerCase(), c);
        }
    });
    const allCollections = Array.from(combinedCollectionsMap.values());

    if (!effectiveAddress || allCollections.length === 0 || !service) {
      setOwnedTokenIdentifiers({});
      setTokenFetchProgress({ loaded: 0, total: 0, loading: false });
      return;
    }

    setIsFetchingTokens(true);
    setTokenFetchProgress({ loaded: 0, total: allCollections.length, loading: true });
    if (!isSilent) addToast("Fetching token libraries...", "info", 2000);

    try {
      const isAdminShowcase = hostProfileAddress?.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
      const newIdentifierMap = {};

      // 2. Fetch Data
      for (const collection of allCollections) {
          const standard = await service.detectCollectionStandard(collection.address);
          let identifiers = [];
  
          if (standard === 'LSP8') {
            if (isAdminShowcase) {
              identifiers = await service.getAllLSP8TokenIdsForCollection(collection.address);
              // Fallback for admin if getAll fails or returns empty
              if (identifiers.length === 0) {
                identifiers = await service.getOwnedLSP8TokenIdsForCollection(effectiveAddress, collection.address);
              }
            } else {
              identifiers = await service.getOwnedLSP8TokenIdsForCollection(effectiveAddress, collection.address);
            }
          } else if (standard === 'LSP7') {
            const balance = await service.getLSP7Balance(effectiveAddress, collection.address);
            if (balance > 0) {
              identifiers.push('LSP7_TOKEN');
            }
          }

          if (identifiers.length > 0) {
            newIdentifierMap[collection.address] = identifiers;
          }

          setTokenFetchProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
      }
      
      setOwnedTokenIdentifiers(newIdentifierMap);
      setLastFetchTimestamp(Date.now()); // 3. Update Timestamp

      if (!isSilent) {
        const totalIds = Object.values(newIdentifierMap).reduce((sum, ids) => sum + ids.length, 0);
        addToast(`Token libraries loaded: ${totalIds} assets available.`, "success", 3000);
      }
    } catch (error) {
      console.error("Failed to refresh owned token identifiers:", error);
      if (!isSilent) addToast("Could not load token libraries.", "error");
    } finally {
      setIsFetchingTokens(false);
      setTokenFetchProgress(prev => ({ ...prev, loading: false }));
    }
  }, [hostProfileAddress, visitorProfileAddress, isRadarProjectAdmin, officialWhitelist, addToast, configServiceRef, stagedSetlist, lastFetchTimestamp]);

  const contextValue = useMemo(() => ({
    officialWhitelist,
    refreshOfficialWhitelist,
    ownedTokenIdentifiers,
    isFetchingTokens,
    tokenFetchProgress,
    refreshOwnedTokens,
  }), [
    officialWhitelist,
    refreshOfficialWhitelist,
    ownedTokenIdentifiers,
    isFetchingTokens,
    tokenFetchProgress,
    refreshOwnedTokens,
  ]);

  return (
    <AssetContext.Provider value={contextValue}>
      {children}
    </AssetContext.Provider>
  );
};

AssetProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAssetContext = () => {
  const context = useContext(AssetContext);
  if (context === undefined) {
    throw new Error("useAssetContext must be used within an AssetProvider");
  }
  return context;
};