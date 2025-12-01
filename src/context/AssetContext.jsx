// src/context/AssetContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { keccak256, stringToBytes } from "viem";
import { useWorkspaceContext } from './WorkspaceContext';
import { useUserSession } from './UserSessionContext';
import { useToast } from './ToastContext';
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
  
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState(0);
  const prevCollectionCountRef = useRef(0);

  useEffect(() => {
    setOwnedTokenIdentifiers({});
    setLastFetchTimestamp(0);
    setTokenFetchProgress({ loaded: 0, total: 0, loading: false });
    prevCollectionCountRef.current = 0;
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

  const refreshOwnedTokens = useCallback(async (force = false, isSilent = false) => {
    const service = configServiceRef.current;
    if (!service || !service.checkReadyForRead()) return;

    // effectiveAddress is the profile we are viewing (either our own, or one we are visiting)
    const effectiveAddress = hostProfileAddress || visitorProfileAddress;
    
    // Combine official + personal libraries into one list to scan
    // We explicitly tag them to know which strategy to use later
    const userLibrary = stagedSetlist?.personalCollectionLibrary || [];
    const combinedCollectionsMap = new Map();
    
    // Add Official Collections (Tag as Official)
    officialWhitelist.forEach(c => {
        if (c && c.address) {
            combinedCollectionsMap.set(c.address.toLowerCase(), { ...c, _isOfficial: true });
        }
    });
    
    // Add Personal Collections (Tag as NOT Official)
    // Note: If a collection is in both, Official takes precedence (set first)
    userLibrary.forEach(c => {
        if (c && c.address && !combinedCollectionsMap.has(c.address.toLowerCase())) {
            combinedCollectionsMap.set(c.address.toLowerCase(), { ...c, _isOfficial: false });
        }
    });
    const allCollections = Array.from(combinedCollectionsMap.values());

    // --- CACHE CHECK ---
    const collectionCountChanged = allCollections.length !== prevCollectionCountRef.current;
    if (!force && !collectionCountChanged && lastFetchTimestamp > 0 && (Date.now() - lastFetchTimestamp < TOKEN_CACHE_DURATION_MS)) {
        if (import.meta.env.DEV) console.log("[AssetContext] Skipping token fetch (Cache Valid & RPC Protection)");
        return;
    }

    if (!effectiveAddress || allCollections.length === 0) {
      setOwnedTokenIdentifiers({});
      return;
    }

    setIsFetchingTokens(true);
    setTokenFetchProgress({ loaded: 0, total: allCollections.length, loading: true });
    
    if (!isSilent && (force || collectionCountChanged)) {
       addToast("Syncing library...", "info", 1500);
    }

    try {
      // --- LOGIC SPLIT: SHOWCASE VS USER MODE ---
      
      // Showcase Mode: ONLY if the currently viewed profile IS the Official Admin Address
      const isAdminShowcase = hostProfileAddress?.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
      
      let newIdentifierMap = {};

      if (isAdminShowcase) {
        // === ADMIN HYBRID MODE ===
        if (import.meta.env.DEV) console.log("[AssetContext] Running in ADMIN MODE (Hybrid Fetch)");
        
        for (const collection of allCollections) {
            const standard = await service.detectCollectionStandard(collection.address);
            let identifiers = [];
            
            if (standard === 'LSP8') {
                if (collection._isOfficial) {
                    // CASE A: Official Collection -> SHOWCASE ALL (Total Supply)
                    if (import.meta.env.DEV) console.log(`[AssetContext] Fetching FULL supply for Official: ${collection.name}`);
                    identifiers = await service.getAllLSP8TokenIdsForCollection(collection.address);
                    
                    // Fallback: If total supply scan returns 0 (e.g. enumerable issue), try owned
                    if (identifiers.length === 0) {
                        identifiers = await service.getOwnedLSP8TokenIdsForCollection(effectiveAddress, collection.address);
                    }
                } else {
                    // CASE B: Personal Collection -> USER OWNED ONLY
                    if (import.meta.env.DEV) console.log(`[AssetContext] Fetching OWNED only for Personal: ${collection.name}`);
                    identifiers = await service.getOwnedLSP8TokenIdsForCollection(effectiveAddress, collection.address);
                }
            } else if (standard === 'LSP7') {
                const balance = await service.getLSP7Balance(effectiveAddress, collection.address);
                if (balance > 0) identifiers.push('LSP7_TOKEN');
            }
            
            if (identifiers.length > 0) newIdentifierMap[collection.address] = identifiers;
            setTokenFetchProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
        }
      } else {
        // === USER MODE ===
        // Fetches ONLY tokens owned by 'effectiveAddress' (using tokenIdsOf).
        if (import.meta.env.DEV) console.log("[AssetContext] Running in USER MODE (Fetching Owned Tokens Only)");
        
        // This function inside ConfigurationService strictly uses 'tokenIdsOf'
        newIdentifierMap = await service.getBatchCollectionData(effectiveAddress, allCollections);
      }
      
      setOwnedTokenIdentifiers(newIdentifierMap);
      setLastFetchTimestamp(Date.now());
      prevCollectionCountRef.current = allCollections.length;

      if (!isSilent && (force || collectionCountChanged)) {
        const totalIds = Object.values(newIdentifierMap).reduce((sum, ids) => sum + ids.length, 0);
        addToast(`Library sync complete: ${totalIds} assets.`, "success", 2000);
      }
    } catch (error) {
      console.error("Failed to refresh owned token identifiers:", error);
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
  }), [officialWhitelist, refreshOfficialWhitelist, ownedTokenIdentifiers, isFetchingTokens, tokenFetchProgress, refreshOwnedTokens]);

  return (
    <AssetContext.Provider value={contextValue}>
      {children}
    </AssetContext.Provider>
  );
};

AssetProvider.propTypes = { children: PropTypes.node.isRequired };
export const useAssetContext = () => {
  const context = useContext(AssetContext);
  if (context === undefined) throw new Error("useAssetContext must be used within an AssetProvider");
  return context;
};