// src/components/Panels/TokenSelectorOverlay.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { toplayerIcon, middlelayerIcon, bottomlayerIcon } from "../../assets";
import { demoAssetMap } from "../../assets/DemoLayers/initLayers";
import { manageOverlayDimmingEffect } from "../../utils/performanceHelpers";
import { globalAnimationFlags } from "../../utils/globalAnimationFlags";
import { usePresetManagement } from "../../context/PresetManagementContext";
import { useUserSession } from "../../context/UserSessionContext";
import "./PanelStyles/TokenSelectorOverlay.css";

const OPEN_CLOSE_ANIMATION_DURATION = 300;
const CONTENT_VISIBILITY_DELAY = 50;
const INITIAL_OPERATIONS_DELAY = 16;

const TokenSelectorOverlay = ({ isOpen, onClose, onTokenApplied, readOnly = false }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [demoTokens, setDemoTokens] = useState([]);
  const [ownedTokens, setOwnedTokens] = useState([]);
  const [isLoadingOwned, setIsLoadingOwned] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState(3);
  const [selectedTokens, setSelectedTokens] = useState({ 1: null, 2: null, 3: null });
  const [animationState, setAnimationState] = useState("hidden");

  const { workspace, configServiceRef } = usePresetManagement();
  const { visitorProfileAddress } = useUserSession();
  const personalCollectionLibrary = useMemo(() => workspace?.personalCollectionLibrary || [], [workspace]);

  const isMountedRef = useRef(false);
  const operationsDelayTimerRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const structuredDemoTokens = Object.entries(demoAssetMap).map(([key, src]) => ({
        id: key, type: 'demo', metadata: { name: `Demo ${key.replace("DEMO_LAYER_", "Asset ")}`, image: src }
    }));
    setDemoTokens(structuredDemoTokens);
  }, []);

  useEffect(() => {
    if (isOpen) {
      globalAnimationFlags.isTokenSelectorOpening = true;
      if (operationsDelayTimerRef.current) clearTimeout(operationsDelayTimerRef.current);
      operationsDelayTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setInternalIsOpen(true);
      }, INITIAL_OPERATIONS_DELAY);
    } else {
      globalAnimationFlags.isTokenSelectorOpening = false;
      setInternalIsOpen(false);
      if (operationsDelayTimerRef.current) clearTimeout(operationsDelayTimerRef.current);
      setAnimationState("hidden");
    }
  }, [isOpen]);

  useEffect(() => {
    if (internalIsOpen) {
      if (animationState === 'hidden' || animationState === 'exiting') {
        const cancelDimming = manageOverlayDimmingEffect(OPEN_CLOSE_ANIMATION_DURATION + CONTENT_VISIBILITY_DELAY + 50);
        setTimeout(() => {
          if (isMountedRef.current && internalIsOpen) setAnimationState("content");
        }, CONTENT_VISIBILITY_DELAY);
        return cancelDimming;
      }
    } else {
      if (animationState !== 'hidden' && animationState !== 'exiting') {
        const cancelDimming = manageOverlayDimmingEffect(OPEN_CLOSE_ANIMATION_DURATION + 50);
        setAnimationState('exiting');
        return cancelDimming;
      }
    }
  }, [internalIsOpen, animationState]);

  useEffect(() => {
    if (!isOpen) {
      setOwnedTokens([]);
      setIsLoadingOwned(false);
      return;
    }
    const fetchOwnedTokens = async () => {
      if (!visitorProfileAddress || personalCollectionLibrary.length === 0 || !configServiceRef.current) {
        setIsLoadingOwned(false);
        return;
      }
      setIsLoadingOwned(true);
      const allTokens = [];
      for (const collection of personalCollectionLibrary) {
        const standard = await configServiceRef.current.detectCollectionStandard(collection.address);
        if (standard === 'LSP8') {
          const tokenIds = await configServiceRef.current.getOwnedLSP8TokenIdsForCollection(visitorProfileAddress, collection.address);
          for (const tokenId of tokenIds) {
            const metadata = await configServiceRef.current.getTokenMetadata(collection.address, tokenId);
            if (metadata?.image) {
              allTokens.push({ id: `${collection.address}-${tokenId}`, type: 'owned', address: collection.address, metadata });
            }
          }
        } else if (standard === 'LSP7') {
          const balance = await configServiceRef.current.getLSP7Balance(visitorProfileAddress, collection.address);
          if (balance > 0n) {
            const metadata = await configServiceRef.current.getLSP4CollectionMetadata(collection.address);
            if (metadata?.image) {
              allTokens.push({ id: collection.address, type: 'owned', address: collection.address, metadata });
            }
          }
        }
      }
      if (isMountedRef.current) {
        setOwnedTokens(allTokens);
        setIsLoadingOwned(false);
      }
    };
    fetchOwnedTokens();
  }, [isOpen, visitorProfileAddress, personalCollectionLibrary, configServiceRef]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  const handleTokenClick = useCallback((token) => {
    const tokenImage = token.metadata?.image;
    if (!tokenImage || !onTokenApplied) return;
    const identifier = token.type === 'owned' 
      ? { type: 'owned', address: token.address, iconUrl: token.metadata.image } 
      : token.id;
    onTokenApplied(identifier, selectedLayer);
    setSelectedTokens(prev => ({ ...prev, [selectedLayer]: tokenImage }));
  }, [selectedLayer, onTokenApplied]);

  const renderTokenItem = useCallback((token) => {
    const tokenImageSrc = token.metadata?.image ?? '';
    if (!tokenImageSrc) return null;
    return (
      <div key={token.id} className={`token-item ${selectedTokens[selectedLayer] === tokenImageSrc ? "selected" : ""}`} onClick={() => handleTokenClick(token)} title={token.metadata.name}>
        <div className="token-image-container">
          <img src={tokenImageSrc} alt={token.metadata.name} className="token-image" crossOrigin="anonymous" draggable="false" />
        </div>
      </div>
    );
  }, [selectedLayer, selectedTokens, handleTokenClick]);
  
  const overlayClassName = `overlay token-selector-overlay ${internalIsOpen || animationState === 'exiting' ? 'visible' : ''} state-${animationState}`;
  if (!isOpen && animationState === 'hidden') return null;

  return (
    <div className={overlayClassName} onClick={handleClose}>
      <div className="overlay-content" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header token-selector-header">
          <div className="header-center-content">
            <div className="layer-buttons">
              <button className={`layer-button ${selectedLayer === 3 ? "active" : ""}`} onClick={() => setSelectedLayer(3)} title="Select Top Layer"> <img src={toplayerIcon} alt="L3" className="layer-button-icon" /> </button>
              <button className={`layer-button ${selectedLayer === 2 ? "active" : ""}`} onClick={() => setSelectedLayer(2)} title="Select Middle Layer"> <img src={middlelayerIcon} alt="L2" className="layer-button-icon" /> </button>
              <button className={`layer-button ${selectedLayer === 1 ? "active" : ""}`} onClick={() => setSelectedLayer(1)} title="Select Bottom Layer"> <img src={bottomlayerIcon} alt="L1" className="layer-button-icon" /> </button>
            </div>
          </div>
          <button className="close-button" onClick={handleClose} aria-label="Close token selector">✕</button>
        </div>
        <div className="overlay-body">
          <div className="token-display-area">
            <div className="token-section">
              <h3 className="token-section-header">My Owned Tokens</h3>
              {isLoadingOwned ? (
                <div className="loading-message">Loading your tokens...</div>
              ) : ownedTokens.length > 0 ? (
                <div className="tokens-grid">{ownedTokens.map(renderTokenItem)}</div>
              ) : (
                <div className="status-message info">
                  {visitorProfileAddress ? "No tokens found in your library collections." : "Connect a profile to see your tokens."}
                </div>
              )}
            </div>
            <div className="token-section">
              <h3 className="token-section-header">Demo Tokens</h3>
              <div className="tokens-grid">{demoTokens.map(renderTokenItem)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

TokenSelectorOverlay.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onTokenApplied: PropTypes.func.isRequired,
  readOnly: PropTypes.bool
};

export default TokenSelectorOverlay;