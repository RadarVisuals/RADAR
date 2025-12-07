// src/context/AssetContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { keccak256, stringToBytes } from "viem";
import { useProjectStore } from '../store/useProjectStore';
import { useWalletStore } from '../store/useWalletStore';
import { useToast } from './ToastContext';
import { RADAR_OFFICIAL_ADMIN_ADDRESS, IPFS_GATEWAY } from "../config/global-config";
import { hexToUtf8Safe } from "../services/ConfigurationService";

const OFFICIAL_WHITELIST_KEY = keccak256(stringToBytes("RADAR.OfficialWhitelist"));
const TOKEN_CACHE_DURATION_MS = 5 * 60 * 1000;

const AssetContext = createContext();

export const AssetProvider = ({ children }) => {
  const configService = useProjectStore(s => s.configService);
  const configServiceInstanceReady = useProjectStore(s => s.isConfigReady);
  const stagedSetlist = useProjectStore(s => s.stagedSetlist);
  
  const hostProfileAddress = useWalletStore(s => s.hostProfileAddress);
  const visitorProfileAddress = useWalletStore(s => s.hostProfileAddress); 
  const isRadarProjectAdmin = useWalletStore(s => s.isRadarProjectAdmin);
  
  const { addToast } = useToast();

  const [officialWhitelist, setOfficialWhitelist] = useState([]);
  const [ownedTokenIdentifiers, setOwnedTokenIdentifiers] = useState({});
  const [isFetchingTokens, setIsFetchingTokens] = useState(false);
  const [tokenFetchProgress, setTokenFetchProgress] = useState({ loaded: 0, total: 0, loading: false });
  
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState(0);
  const prevCollectionCountRef = useRef(0);
  
  // --- FIX: Ref to track loading state synchronously for Strict Mode ---
  const isFetchingTokensRef = useRef(false);

  useEffect(() => {
    setOwnedTokenIdentifiers({});
    setLastFetchTimestamp(0);
    setTokenFetchProgress({ loaded: 0, total: 0, loading: false });
    prevCollectionCountRef.current = 0;
    isFetchingTokensRef.current = false;
  }, [hostProfileAddress]);

  const refreshOfficialWhitelist = useCallback(async () => {
    const service = useProjectStore.getState().configService;
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
  }, []);

  useEffect(() => {
    if (configServiceInstanceReady) {
      refreshOfficialWhitelist();
    }
  }, [configServiceInstanceReady, refreshOfficialWhitelist]);

  const refreshOwnedTokens = useCallback(async (force = false, isSilent = false) => {
    const service = useProjectStore.getState().configService;
    if (!service || !service.checkReadyForRead()) return;

    // --- FIX: Block duplicate calls immediately ---
    if (isFetchingTokensRef.current) return;

    const effectiveAddress = hostProfileAddress;
    
    const userLibrary = useProjectStore.getState().stagedSetlist?.personalCollectionLibrary || [];
    const combinedCollectionsMap = new Map();
    
    officialWhitelist.forEach(c => {
        if (c && c.address) {
            combinedCollectionsMap.set(c.address.toLowerCase(), { ...c, _isOfficial: true });
        }
    });
    
    userLibrary.forEach(c => {
        if (c && c.address && !combinedCollectionsMap.has(c.address.toLowerCase())) {
            combinedCollectionsMap.set(c.address.toLowerCase(), { ...c, _isOfficial: false });
        }
    });
    const allCollections = Array.from(combinedCollectionsMap.values());

    const collectionCountChanged = allCollections.length !== prevCollectionCountRef.current;
    if (!force && !collectionCountChanged && lastFetchTimestamp > 0 && (Date.now() - lastFetchTimestamp < TOKEN_CACHE_DURATION_MS)) {
        return;
    }

    if (!effectiveAddress || allCollections.length === 0) {
      setOwnedTokenIdentifiers({});
      return;
    }

    // --- Set lock ---
    isFetchingTokensRef.current = true;
    setIsFetchingTokens(true);
    setTokenFetchProgress({ loaded: 0, total: allCollections.length, loading: true });
    
    if (!isSilent && (force || collectionCountChanged)) {
       addToast("Syncing library...", "info", 1500);
    }

    try {
      const isAdminShowcase = hostProfileAddress?.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
      let newIdentifierMap = {};

      if (isAdminShowcase) {
        for (const collection of allCollections) {
            const standard = await service.detectCollectionStandard(collection.address);
            let identifiers = [];
            
            if (standard === 'LSP8') {
                if (collection._isOfficial) {
                    identifiers = await service.getAllLSP8TokenIdsForCollection(collection.address);
                    if (identifiers.length === 0) {
                        identifiers = await service.getOwnedLSP8TokenIdsForCollection(effectiveAddress, collection.address);
                    }
                } else {
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
      // --- Release lock ---
      isFetchingTokensRef.current = false;
      setIsFetchingTokens(false);
      setTokenFetchProgress(prev => ({ ...prev, loading: false }));
    }
  }, [hostProfileAddress, officialWhitelist, addToast, lastFetchTimestamp]);

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