// src/components/Panels/TokenSelectorOverlay.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import PropTypes from "prop-types";
import { toplayerIcon, middlelayerIcon, bottomlayerIcon } from "../../assets";
import { demoAssetMap } from "../../assets/DemoLayers/initLayers";
import { manageOverlayDimmingEffect, safeRequestIdleCallback, safeCancelIdleCallback } from "../../utils/performanceHelpers";
import { globalAnimationFlags } from "../../utils/globalAnimationFlags";
import { usePresetManagement } from "../../context/PresetManagementContext";
import { useUserSession } from "../../context/UserSessionContext";
import "./PanelStyles/TokenSelectorOverlay.css";

const OPEN_CLOSE_ANIMATION_DURATION = 300;
const LAZY_RENDER_DELAY = 80;
const INITIAL_VISIBLE_COUNT = 8;

const TokenSelectorOverlay = ({ isOpen, onClose, onTokenApplied, readOnly = false }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState(3);
  const [selectedTokens, setSelectedTokens] = useState({ 1: null, 2: null, 3: null });
  const [animationState, setAnimationState] = useState("hidden");
  const [isPreviewMode, setIsPreviewMode] = useState(false); // For fade preview
  
  // Lazy rendering states
  const [loadingSequence, setLoadingSequence] = useState([]);
  const [isLazyLoading, setIsLazyLoading] = useState(false);

  const { ownedTokens, isFetchingTokens, refreshOwnedTokens } = usePresetManagement();
  const { visitorProfileAddress } = useUserSession();

  const isMountedRef = useRef(false);
  const lazyRenderIdRef = useRef(null);
  const overlayContentRef = useRef(null);
  const loadingCompleteRef = useRef(false);
  const currentTokensRef = useRef({ owned: [], demo: [] }); // Cache tokens to prevent reloading

  // Memoize demo tokens
  const demoTokens = useMemo(() => {
    return Object.entries(demoAssetMap).map(([key, src]) => ({
      id: key, 
      type: 'demo', 
      metadata: { 
        name: `Demo ${key.replace("DEMO_LAYER_", "Asset ")}`, 
        image: src 
      }
    }));
  }, []);

  // Update token cache when tokens change, but don't trigger reload if overlay is open
  useEffect(() => {
    currentTokensRef.current = {
      owned: ownedTokens || [],
      demo: demoTokens || []
    };
  }, [ownedTokens, demoTokens]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { 
      isMountedRef.current = false;
      if (lazyRenderIdRef.current) {
        safeCancelIdleCallback(lazyRenderIdRef.current);
      }
    };
  }, []);

  // Token loading function - stable reference
  const initializeTokenLoading = useCallback(() => {
    if (!isMountedRef.current || loadingCompleteRef.current) {
      console.log(`🚫 Token loading blocked - mounted: ${isMountedRef.current}, complete: ${loadingCompleteRef.current}`);
      return;
    }
    
    console.log('🚀 Starting token loading...');
    setIsLazyLoading(true);
    
    // Use cached token data to prevent dependency issues
    const currentOwnedTokens = currentTokensRef.current.owned;
    const currentDemoTokens = currentTokensRef.current.demo;
    
    // Create the proper loading sequence: owned tokens first, then demo tokens
    const ownedWithSection = currentOwnedTokens.map((token, index) => ({
      ...token, 
      section: 'owned',
      id: token.id || `owned-${index}-${Date.now()}`
    }));
    
    const demoWithSection = currentDemoTokens.map((token, index) => ({
      ...token, 
      section: 'demo',
      id: token.id || `demo-${index}-${Date.now()}`
    }));
    
    const allTokensInOrder = [...ownedWithSection, ...demoWithSection];
    
    console.log(`📊 Total tokens to load: ${allTokensInOrder.length} (Owned: ${ownedWithSection.length}, Demo: ${demoWithSection.length})`);
    
    if (allTokensInOrder.length === 0) {
      setIsLazyLoading(false);
      loadingCompleteRef.current = true;
      return;
    }
    
    // Show initial batch immediately
    const initialBatch = allTokensInOrder.slice(0, INITIAL_VISIBLE_COUNT);
    setLoadingSequence(initialBatch);
    console.log(`🎬 Initial batch loaded: ${initialBatch.length} tokens`);
    
    let currentIndex = INITIAL_VISIBLE_COUNT;
    
    const renderNextBatch = () => {
      // Check if we should continue
      if (!isMountedRef.current) {
        console.log('🛑 Token loading cancelled - component unmounted');
        return;
      }

      if (loadingCompleteRef.current) {
        console.log('🛑 Token loading cancelled - already complete');
        return;
      }

      if (currentIndex >= allTokensInOrder.length) {
        console.log('✅ Token loading complete! All tokens loaded.');
        setIsLazyLoading(false);
        loadingCompleteRef.current = true;
        return;
      }

      const nextToken = allTokensInOrder[currentIndex];
      if (nextToken && nextToken.id) {
        console.log(`➕ Loading token ${currentIndex + 1}/${allTokensInOrder.length}: ${nextToken.metadata?.name || nextToken.id}`);
        setLoadingSequence(prev => {
          // Prevent duplicates
          if (prev.find(token => token.id === nextToken.id)) {
            console.log(`⚠️ Duplicate token found: ${nextToken.id}`);
            return prev;
          }
          return [...prev, nextToken];
        });
      }
      
      currentIndex++;
      
      // Continue loading next token
      if (currentIndex < allTokensInOrder.length && isMountedRef.current && !loadingCompleteRef.current) {
        lazyRenderIdRef.current = safeRequestIdleCallback(renderNextBatch, { timeout: 100 });
      } else {
        console.log('✅ Token loading complete!');
        setIsLazyLoading(false);
        loadingCompleteRef.current = true;
      }
    };
    
    // Start the loading process
    if (currentIndex < allTokensInOrder.length) {
      lazyRenderIdRef.current = safeRequestIdleCallback(renderNextBatch, { timeout: 50 });
    } else {
      console.log('✅ All tokens already loaded in initial batch');
      setIsLazyLoading(false);
      loadingCompleteRef.current = true;
    }
  }, []); // Empty dependency array - function is stable

  // Main overlay state effect - ONLY depends on isOpen
  useEffect(() => {
    console.log(`🔄 Overlay useEffect triggered - isOpen: ${isOpen}`);
    
    if (isOpen) {
      console.log('📂 Opening overlay...');
      globalAnimationFlags.isTokenSelectorOpening = true;
      setAnimationState("opening");
      
      // Reset loading states
      setLoadingSequence([]);
      setIsLazyLoading(false);
      loadingCompleteRef.current = false;

      // Cancel any existing loading
      if (lazyRenderIdRef.current) {
        safeCancelIdleCallback(lazyRenderIdRef.current);
        lazyRenderIdRef.current = null;
      }

      // Minimal immediate setup
      const openTimeout = setTimeout(() => {
        if (isMountedRef.current) {
          setInternalIsOpen(true);
          setAnimationState("content");
          
          // Start token loading after overlay is visually open
          const loadTimeout = setTimeout(() => {
            if (isMountedRef.current && !loadingCompleteRef.current) {
              console.log('⏰ Starting delayed token loading...');
              initializeTokenLoading();
            }
          }, 150); // Slightly longer delay
          
          return () => clearTimeout(loadTimeout);
        }
      }, 50);

      return () => {
        clearTimeout(openTimeout);
      };

    } else {
      console.log('📁 Closing overlay...');
      globalAnimationFlags.isTokenSelectorOpening = false;
      
      // Cancel any ongoing lazy rendering immediately
      if (lazyRenderIdRef.current) {
        safeCancelIdleCallback(lazyRenderIdRef.current);
        lazyRenderIdRef.current = null;
      }
      
      // Start exit animation
      setAnimationState("exiting");
      
      // Clean up after animation completes
      const closeTimeout = setTimeout(() => {
        if (isMountedRef.current) {
          setInternalIsOpen(false);
          setAnimationState("hidden");
          setLoadingSequence([]);
          setIsLazyLoading(false);
          loadingCompleteRef.current = false;
        }
      }, OPEN_CLOSE_ANIMATION_DURATION);

      return () => clearTimeout(closeTimeout);
    }
  }, [isOpen, initializeTokenLoading]); // Only depend on isOpen and stable function

  useEffect(() => {
    if (animationState === "opening" || animationState === "exiting") {
      const cancelDimming = manageOverlayDimmingEffect(OPEN_CLOSE_ANIMATION_DURATION + 100);
      return cancelDimming;
    }
  }, [animationState]);

  const handleClose = useCallback(() => {
    if (animationState === "exiting") return;
    onClose();
  }, [onClose, animationState]);
  
  // --- FIX: This new handler combines token application AND preview mode start ---
  const handleTokenMouseDown = useCallback((token, e) => {
    // Only proceed on left mouse button down
    if (e.button !== 0) return;

    // Part 1: Apply the token immediately
    const tokenImage = token.metadata?.image;
    if (!tokenImage || !onTokenApplied) return;
    
    const identifier = token.type === 'owned' 
      ? { type: 'owned', address: token.address, iconUrl: token.metadata.image } 
      : token.id;
    
    onTokenApplied(identifier, selectedLayer);
    setSelectedTokens(prev => ({ ...prev, [selectedLayer]: tokenImage }));

    // Part 2: Start the preview mode fade
    setIsPreviewMode(true);
  }, [onTokenApplied, selectedLayer]);
  // --- END FIX ---

  const handleMouseUp = useCallback(() => {
    setIsPreviewMode(false);
  }, []);

  // Add global mouse up listener to catch mouse up outside the overlay
  useEffect(() => {
    if (isPreviewMode) {
      const handleGlobalMouseUp = () => setIsPreviewMode(false);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isPreviewMode]);

  // Memoized token renderer
  const TokenItem = useMemo(() => {
    const TokenComponent = ({ token, sequenceIndex, isSelected, onMouseDown, onMouseUp }) => {
      const tokenImageSrc = token.metadata?.image ?? '';
      const [hasAnimated, setHasAnimated] = useState(false);
      
      useEffect(() => {
        // Mark as animated after first render to prevent re-animation
        const timer = setTimeout(() => setHasAnimated(true), sequenceIndex * LAZY_RENDER_DELAY + 400);
        return () => clearTimeout(timer);
      }, [sequenceIndex]);
      
      if (!tokenImageSrc) return null;
      
      return (
        <div 
          className={`token-item ${isSelected ? "selected" : ""} ${hasAnimated ? "no-animate" : "loaded"}`} 
          onMouseDown={(e) => onMouseDown(token, e)} // Pass the token and event
          onMouseUp={onMouseUp}
          title={token.metadata.name}
          style={{ 
            animationDelay: hasAnimated ? '0ms' : `${sequenceIndex * LAZY_RENDER_DELAY}ms`
          }}
        >
          <div className="token-image-container">
            <img 
              src={tokenImageSrc} 
              alt={token.metadata.name} 
              className="token-image" 
              crossOrigin="anonymous" 
              draggable="false"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      );
    };
    
    return React.memo(TokenComponent);
  }, []);

  // Separate refresh function that forces a reload
  const handleRefreshTokens = useCallback(() => {
    console.log('🔄 Manually refreshing tokens...');
    
    // Cancel current loading
    if (lazyRenderIdRef.current) {
      safeCancelIdleCallback(lazyRenderIdRef.current);
      lazyRenderIdRef.current = null;
    }
    
    // Reset and restart loading
    setLoadingSequence([]);
    setIsLazyLoading(false);
    loadingCompleteRef.current = false;
    
    // Refresh from context first
    refreshOwnedTokens(false);
    
    // Restart loading after context refresh
    setTimeout(() => {
      if (isMountedRef.current && isOpen) {
        console.log('🔄 Restarting token loading after refresh...');
        initializeTokenLoading();
      }
    }, 300);
  }, [refreshOwnedTokens, isOpen, initializeTokenLoading]);

  // Layer selection should NOT trigger any re-renders or effects
  const handleLayerSelection = useCallback((layer) => {
    console.log(`🎯 Layer selected: ${layer} (should NOT trigger token reload)`);
    setSelectedLayer(layer);
  }, []);

  const overlayClassName = `overlay token-selector-overlay ${
    internalIsOpen || animationState === 'exiting' ? 'visible' : ''
  } state-${animationState} ${isPreviewMode ? 'preview-mode' : ''}`;

  if (!isOpen && animationState === 'hidden') return null;

  return (
    <div 
      className={overlayClassName} 
      onClick={handleClose}
    >
      <div className="overlay-content" ref={overlayContentRef} onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header token-selector-header">
          <div className="header-center-content">
            <div className="layer-buttons">
              <button 
                className={`layer-button ${selectedLayer === 3 ? "active" : ""}`} 
                onClick={() => handleLayerSelection(3)} 
                title="Select Top Layer"
              > 
                <img src={toplayerIcon} alt="L3" className="layer-button-icon" /> 
              </button>
              <button 
                className={`layer-button ${selectedLayer === 2 ? "active" : ""}`} 
                onClick={() => handleLayerSelection(2)} 
                title="Select Middle Layer"
              > 
                <img src={middlelayerIcon} alt="L2" className="layer-button-icon" /> 
              </button>
              <button 
                className={`layer-button ${selectedLayer === 1 ? "active" : ""}`} 
                onClick={() => handleLayerSelection(1)} 
                title="Select Bottom Layer"
              > 
                <img src={bottomlayerIcon} alt="L1" className="layer-button-icon" /> 
              </button>
            </div>
          </div>
          <button className="close-button" onClick={handleClose} aria-label="Close token selector">✕</button>
        </div>
        
        <div className="overlay-body">
          <div className="token-display-area">
            {/* Owned Tokens Section */}
            <div className="token-section">
              <div className="token-section-header">
                <h3>My Owned Tokens ({currentTokensRef.current.owned.length})</h3>
                <button 
                  className="btn btn-sm btn-outline" 
                  onClick={handleRefreshTokens}
                  disabled={isFetchingTokens || !visitorProfileAddress || isLazyLoading}
                  title="Re-scan your profile for new tokens"
                >
                  {isFetchingTokens ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              
              {isFetchingTokens && currentTokensRef.current.owned.length === 0 ? (
                <div className="loading-message">
                  <div className="spinner"></div>
                  Loading your tokens...
                </div>
              ) : !isFetchingTokens && currentTokensRef.current.owned.length === 0 ? (
                <div className="status-message info">
                  {visitorProfileAddress ? "No tokens found in your library collections." : "Connect a profile to see your tokens."}
                </div>
              ) : (
                <div className="tokens-grid">
                  {loadingSequence
                    .filter(token => token && token.section === 'owned')
                    .map((token) => (
                      <TokenItem 
                        key={token.id} 
                        token={token} 
                        sequenceIndex={loadingSequence.findIndex(t => t && t.id === token.id)}
                        isSelected={selectedTokens[selectedLayer] === token.metadata?.image}
                        onMouseDown={handleTokenMouseDown}
                        onMouseUp={handleMouseUp}
                      />
                    ))}
                </div>
              )}
            </div>
            
            {/* Demo Tokens Section */}
            <div className="token-section">
              <div className="token-section-header">
                <h3>Demo Tokens ({demoTokens.length})</h3>
              </div>
              <div className="tokens-grid">
                {loadingSequence
                  .filter(token => token && token.section === 'demo')
                  .map((token) => (
                    <TokenItem 
                      key={token.id} 
                      token={token} 
                      sequenceIndex={loadingSequence.findIndex(t => t && t.id === token.id)}
                      isSelected={selectedTokens[selectedLayer] === token.metadata?.image}
                      onMouseDown={handleTokenMouseDown}
                      onMouseUp={handleMouseUp}
                    />
                  ))}
              </div>
            </div>

            {/* Loading indicator */}
            {isLazyLoading && (
              <div className="loading-message">
                <div className="spinner"></div>
                Loading tokens... ({loadingSequence.length} of {currentTokensRef.current.owned.length + demoTokens.length} loaded)
              </div>
            )}
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

export default React.memo(TokenSelectorOverlay);