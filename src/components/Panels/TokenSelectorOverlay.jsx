// src/components/Panels/TokenSelectorOverlay.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import PropTypes from "prop-types";
import { toplayerIcon, middlelayerIcon, bottomlayerIcon } from "../../assets";
import { demoAssetMap } from "../../assets/DemoLayers/initLayers";
import { manageOverlayDimmingEffect } from "../../utils/performanceHelpers";
import { globalAnimationFlags } from "../../utils/globalAnimationFlags";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useAssetContext } from "../../context/AssetContext";
import { useVisualEngineContext } from "../../context/VisualEngineContext";
import { useUserSession } from "../../context/UserSessionContext";
import TokenGrid from "./TokenGrid";
import LazyLoadImage from "./LazyLoadImage";
import "./PanelStyles/TokenSelectorOverlay.css";

const OPEN_CLOSE_ANIMATION_DURATION = 300;
const PAGE_SIZE = 40;

const TokenSelectorOverlay = ({ isOpen, onClose, readOnly = false }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState(3);
  const [selectedTokens, setSelectedTokens] = useState({ 1: null, 2: null, 3: null });
  const [animationState, setAnimationState] = useState("hidden");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState("");
  const [paletteModalState, setPaletteModalState] = useState({ isOpen: false, token: null });
  const [expandedSections, setExpandedSections] = useState({});
  const [collectionSort, setCollectionSort] = useState('name');

  const [loadedTokens, setLoadedTokens] = useState({});
  const [collectionPages, setCollectionPages] = useState({});
  const [isLoadingMore, setIsLoadingMore] = useState({});
  const [hasMoreToLoad, setHasMoreToLoad] = useState({});

  const {
    stagedActiveWorkspace,
    addPalette, removePalette, addTokenToPalette, removeTokenFromPalette,
    configServiceRef,
  } = useWorkspaceContext();

  const {
    ownedTokenIdentifiers,
    tokenFetchProgress,
    officialWhitelist = [],
    refreshOwnedTokens, 
  } = useAssetContext();

  const { updateTokenAssignment } = useVisualEngineContext();

  const { visitorProfileAddress, isHostProfileOwner } = useUserSession();

  const isMountedRef = useRef(false);
  const hasFetchedInitialIdentifiers = useRef(false);
  const overlayContentRef = useRef(null);
  const tokenDisplayAreaRef = useRef(null);

  useEffect(() => {
    if (isOpen && !hasFetchedInitialIdentifiers.current) {
      if (import.meta.env.DEV) console.log("[TokenSelectorOverlay] Opened for the first time, triggering token identifier fetch.");
      refreshOwnedTokens();
      hasFetchedInitialIdentifiers.current = true;
    }
  }, [isOpen, refreshOwnedTokens]);

  const demoTokens = useMemo(() => {
    return Object.entries(demoAssetMap).map(([key, src]) => ({
      id: key, type: 'demo', metadata: { name: `Demo ${key.replace("DEMO_LAYER_", "Asset ")}`, image: src }
    }));
  }, []);

  const userPalettes = useMemo(() => stagedActiveWorkspace?.userPalettes || {}, [stagedActiveWorkspace]);
  const userLibrary = useMemo(() => stagedActiveWorkspace?.personalCollectionLibrary || [], [stagedActiveWorkspace]);

  const combinedCollectionLibrary = useMemo(() => {
    const collectionMap = new Map();
    (officialWhitelist || []).forEach(c => {
        if (c && c.address) {
            collectionMap.set(c.address.toLowerCase(), { ...c, isOfficial: true });
        }
    });
    (userLibrary || []).forEach(c => {
        if (c && c.address && !collectionMap.has(c.address.toLowerCase())) {
            collectionMap.set(c.address.toLowerCase(), { ...c, isOfficial: false });
        }
    });
    return Array.from(collectionMap.values());
  }, [officialWhitelist, userLibrary]);
  
  // <-- NEW: Memoize the expensive token map separately
  const combinedTokenMap = useMemo(() => {
    const map = new Map();
    Object.values(loadedTokens).flat().forEach(t => map.set(t.id, t));
    demoTokens.forEach(t => map.set(t.id, t));
    return map;
  }, [loadedTokens, demoTokens]);

  // <-- UPDATED: This calculation is now very cheap
  const paletteTokens = useMemo(() => {
    const palettes = {};
    if (userPalettes) {
      for (const paletteName in userPalettes) {
        palettes[paletteName] = userPalettes[paletteName]
          .map(tokenId => combinedTokenMap.get(tokenId))
          .filter(Boolean);
      }
    }
    return palettes;
  }, [combinedTokenMap, userPalettes]);
  
  const sortedCollectionLibrary = useMemo(() => {
    if (!Array.isArray(combinedCollectionLibrary)) return [];
    return [...combinedCollectionLibrary].sort((a, b) => {
      if (collectionSort === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (collectionSort === 'addedAt') {
        return (b.addedAt || 0) - (a.addedAt || 0);
      }
      return 0;
    });
  }, [combinedCollectionLibrary, collectionSort]);

  useEffect(() => {
    const initialHasMore = {};
    for (const collectionAddr in ownedTokenIdentifiers) {
      const totalIds = ownedTokenIdentifiers[collectionAddr]?.length || 0;
      const currentlyLoaded = loadedTokens[collectionAddr]?.length || 0;
      initialHasMore[collectionAddr] = currentlyLoaded < totalIds;
    }
    setHasMoreToLoad(initialHasMore);
  }, [ownedTokenIdentifiers, loadedTokens]);

  const loadMoreTokens = useCallback(async (collectionAddress) => {
    if (isLoadingMore[collectionAddress] || !hasMoreToLoad[collectionAddress] || !configServiceRef.current) {
        return;
    }

    setIsLoadingMore(prev => ({ ...prev, [collectionAddress]: true }));
    const currentPage = collectionPages[collectionAddress] || 0;
    const identifiers = ownedTokenIdentifiers[collectionAddress] || [];

    try {
        const newTokens = await configServiceRef.current.getTokensMetadataForPage(
            collectionAddress,
            identifiers,
            currentPage,
            PAGE_SIZE
        );
        
        if (isMountedRef.current) {
            if (newTokens.length > 0) {
                setLoadedTokens(prev => ({
                    ...prev,
                    [collectionAddress]: [...(prev[collectionAddress] || []), ...newTokens],
                }));
                setCollectionPages(prev => ({ ...prev, [collectionAddress]: currentPage + 1 }));
            }

            if (newTokens.length < PAGE_SIZE) {
                setHasMoreToLoad(prev => ({ ...prev, [collectionAddress]: false }));
            }
        }
    } catch (error) {
        console.error(`Failed to load more tokens for ${collectionAddress}:`, error);
    } finally {
        if (isMountedRef.current) {
            setIsLoadingMore(prev => ({ ...prev, [collectionAddress]: false }));
        }
    }
  }, [isLoadingMore, hasMoreToLoad, collectionPages, ownedTokenIdentifiers, configServiceRef]);

  const toggleSection = (sectionId) => {
    const isExpanding = !expandedSections[sectionId];
    setExpandedSections(prev => ({ ...prev, [sectionId]: isExpanding }));
    
    if (isExpanding && (!loadedTokens[sectionId] || loadedTokens[sectionId].length === 0)) {
      loadMoreTokens(sectionId);
    }
  };

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  useEffect(() => {
    if (isOpen) {
      globalAnimationFlags.isTokenSelectorOpening = true;
      setAnimationState("opening");
      const openTimeout = setTimeout(() => {
        if (isMountedRef.current) { setInternalIsOpen(true); setAnimationState("content"); }
      }, 50);
      return () => clearTimeout(openTimeout);
    } else {
      globalAnimationFlags.isTokenSelectorOpening = false;
      setAnimationState("exiting");
      const closeTimeout = setTimeout(() => {
        if (isMountedRef.current) { setInternalIsOpen(false); setAnimationState("hidden"); }
      }, OPEN_CLOSE_ANIMATION_DURATION);
      return () => clearTimeout(closeTimeout);
    }
  }, [isOpen]);

  useEffect(() => {
    if (animationState === "opening" || animationState === "exiting") {
      const cancelDimming = manageOverlayDimmingEffect(OPEN_CLOSE_ANIMATION_DURATION + 100);
      return cancelDimming;
    }
  }, [animationState]);

  const handleClose = useCallback(() => { if (animationState === "exiting") return; onClose(); }, [onClose, animationState]);

  const handleTokenMouseDown = useCallback((token, e) => {
    if (e.button !== 0) return;
    const tokenImage = token.metadata?.image;
    if (!tokenImage || !updateTokenAssignment) return;
    updateTokenAssignment(token, selectedLayer);
    setSelectedTokens(prev => ({ ...prev, [selectedLayer]: tokenImage }));
    setIsPreviewMode(true);
  }, [updateTokenAssignment, selectedLayer]);

  const handleMouseUp = useCallback(() => { setIsPreviewMode(false); }, []);

  useEffect(() => {
    if (isPreviewMode) {
      const handleGlobalMouseUp = () => setIsPreviewMode(false);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isPreviewMode]);

  const handleCreatePalette = () => { const name = newPaletteName.trim(); if (name) { addPalette(name); setNewPaletteName(""); } };
  const handleRemovePalette = (paletteName) => { if (window.confirm(`Are you sure you want to delete the "${paletteName}" palette?`)) { removePalette(paletteName); } };
  const handleRemoveTokenFromPalette = (paletteName, tokenId) => { removeTokenFromPalette(paletteName, tokenId); };
  const handleAddToPaletteClick = (token) => { setPaletteModalState({ isOpen: true, token }); };
  const handleSelectPaletteForToken = (paletteName) => { if (paletteModalState.token) { addTokenToPalette(paletteName, paletteModalState.token.id); } setPaletteModalState({ isOpen: false, token: null }); };

  const renderTokenItem = useCallback((token, { onAddToPalette, onRemoveFromPalette, paletteName } = {}) => {
    const tokenImageSrc = token.metadata?.image ?? '';
    
    return (
      <div className={`token-item ${selectedTokens[selectedLayer] === tokenImageSrc ? "selected" : ""}`} onMouseDown={(e) => handleTokenMouseDown(token, e)} onMouseUp={handleMouseUp} title={token.metadata.name}>
        <div className="token-image-container">
          <LazyLoadImage src={tokenImageSrc} alt={token.metadata.name} className="token-image" />
        </div>
        {onAddToPalette && isHostProfileOwner && (<button className="add-to-palette-btn" onClick={(e) => { e.stopPropagation(); onAddToPalette(token); }} onMouseDown={(e) => e.stopPropagation()} title="Add to Palette">+</button>)}
        {onRemoveFromPalette && paletteName && isHostProfileOwner && (<button className="remove-from-palette-btn" onClick={(e) => { e.stopPropagation(); onRemoveFromPalette(paletteName, token.id); }} onMouseDown={(e) => e.stopPropagation()} title="Remove from Palette">-</button>)}
      </div>
    );
  }, [selectedLayer, selectedTokens, handleTokenMouseDown, handleMouseUp, isHostProfileOwner]);

  const overlayClassName = `overlay token-selector-overlay ${internalIsOpen || animationState === 'exiting' ? 'visible' : ''} state-${animationState} ${isPreviewMode ? 'preview-mode' : ''}`;
  if (!isOpen && animationState === 'hidden') return null;

  return (
    <div className={overlayClassName} onClick={handleClose}>
      <div className="overlay-content" ref={overlayContentRef} onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header token-selector-header">
          <div className="header-center-content">
            <div className="layer-buttons">
              <button className={`layer-button ${selectedLayer === 3 ? "active" : ""}`} onClick={() => setSelectedLayer(3)} title="Select Top Layer"><img src={toplayerIcon} alt="L3" className="layer-button-icon" /></button>
              <button className={`layer-button ${selectedLayer === 2 ? "active" : ""}`} onClick={() => setSelectedLayer(2)} title="Select Middle Layer"><img src={middlelayerIcon} alt="L2" className="layer-button-icon" /></button>
              <button className={`layer-button ${selectedLayer === 1 ? "active" : ""}`} onClick={() => setSelectedLayer(1)} title="Select Bottom Layer"><img src={bottomlayerIcon} alt="L1" className="layer-button-icon" /></button>
            </div>
          </div>
          <button className="close-button" onClick={handleClose} aria-label="Close token selector">✕</button>
        </div>
        <div className="overlay-body">
          {tokenFetchProgress.loading && ( <div className="loading-progress-header"><div className="progress-text">Loading Asset Libraries... ({tokenFetchProgress.loaded} / {tokenFetchProgress.total})</div><div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${tokenFetchProgress.total > 0 ? (tokenFetchProgress.loaded / tokenFetchProgress.total) * 100 : 0}%` }}></div></div></div> )}
          <div className="token-display-area" ref={tokenDisplayAreaRef}>
            <div className="token-section palette-section">
              <div className="token-section-header"><h3>My Palettes</h3></div>
              {isHostProfileOwner && (
                <div className="create-palette-form">
                  <input type="text" value={newPaletteName} onChange={(e) => setNewPaletteName(e.target.value)} placeholder="New Palette Name" className="form-control" />
                  <button onClick={handleCreatePalette} className="btn btn-sm" disabled={!newPaletteName.trim()}>Create</button>
                </div>
              )}
              {Object.keys(userPalettes).length > 0 ? (Object.keys(userPalettes).map(paletteName => (<div key={paletteName} className="collection-group"><div className="collection-header"><button onClick={() => toggleSection(paletteName)} className="collection-toggle-button">{paletteName} ({paletteTokens[paletteName]?.length || 0})<span className={`chevron ${expandedSections[paletteName] ? 'expanded' : ''}`}>›</span></button>{isHostProfileOwner && (<button onClick={() => handleRemovePalette(paletteName)} className="delete-palette-btn" title={`Delete "${paletteName}" palette`}>🗑️</button>)}</div>{expandedSections[paletteName] && (<TokenGrid scrollContainerRef={tokenDisplayAreaRef} tokens={paletteTokens[paletteName] || []} renderTokenItem={(token) => renderTokenItem(token, { onRemoveFromPalette: handleRemoveTokenFromPalette, paletteName })} hasMore={false} onLoadMore={()=>{}} isLoading={false} />)}</div>))) : <p className="no-items-message">Create a palette to organize tokens.</p>}
            </div>
            <div className="token-section">
              <div className="token-section-header"><h3>My Collections</h3><div className="sort-controls"><label htmlFor="collection-sort">Sort by:</label><select id="collection-sort" value={collectionSort} onChange={(e) => setCollectionSort(e.target.value)} className="custom-select custom-select-sm"><option value="name">Name</option><option value="addedAt">Date Added</option></select></div></div>
              {sortedCollectionLibrary.length > 0 ? (sortedCollectionLibrary.map(collection => (<div key={collection.address} className="collection-group"><button onClick={() => toggleSection(collection.address)} className="collection-header collection-toggle-button">{collection.name} ({(ownedTokenIdentifiers[collection.address]?.length || 0)})<span className={`chevron ${expandedSections[collection.address] ? 'expanded' : ''}`}>›</span></button>{expandedSections[collection.address] && (<TokenGrid scrollContainerRef={tokenDisplayAreaRef} tokens={loadedTokens[collection.address] || []} renderTokenItem={(token) => renderTokenItem(token, { onAddToPalette: handleAddToPaletteClick })} hasMore={hasMoreToLoad[collection.address] || false} onLoadMore={() => loadMoreTokens(collection.address)} isLoading={isLoadingMore[collection.address] || false} />)}</div>))) : <p className="no-items-message">{!visitorProfileAddress ? "Connect a profile to see your tokens." : "No collections found."}</p>}
            </div>
            <div className="token-section">
              <div className="collection-group"><button onClick={() => toggleSection('demo')} className="collection-header collection-toggle-button">Demo Tokens ({demoTokens.length})<span className={`chevron ${expandedSections['demo'] ? 'expanded' : ''}`}>›</span></button>{expandedSections['demo'] && (<TokenGrid scrollContainerRef={tokenDisplayAreaRef} tokens={demoTokens} renderTokenItem={(token) => renderTokenItem(token, { onAddToPalette: handleAddToPaletteClick })} hasMore={false} onLoadMore={()=>{}} isLoading={false} />)}</div>
            </div>
          </div>
        </div>
      </div>
      {paletteModalState.isOpen && isHostProfileOwner && (<div className="palette-modal-overlay" onClick={(e) => { e.stopPropagation(); setPaletteModalState({ isOpen: false, token: null }); }}><div className="palette-modal-content" onClick={(e) => e.stopPropagation()}><h4>Add to Palette</h4>{Object.keys(userPalettes).length > 0 ? (<div className="palette-list">{Object.keys(userPalettes).map(paletteName => (<button key={paletteName} onClick={() => handleSelectPaletteForToken(paletteName)} className="btn btn-block">{paletteName}</button>))}</div>) : <p>No palettes created yet.</p>}</div></div>)}
    </div>
  );
};

TokenSelectorOverlay.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  readOnly: PropTypes.bool
};

export default React.memo(TokenSelectorOverlay);