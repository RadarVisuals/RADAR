import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import {
    entityTokenLogo,
    toplayerIcon,
    middlelayerIcon,
    bottomlayerIcon,
} from "../../assets";
// Import the variables as they are actually exported from initLayers.js
import {
    demoLayer1, demoLayer2, demoLayer3, demoLayer4, demoLayer5, demoLayer6,
    demoLayer7, demoLayer8, demoLayer9, demoLayer10, demoLayer11, demoLayer12,
    demoLayer13, demoLayer14, demoLayer15, demoLayer16, demoLayer17, demoLayer18,
    demoLayer19, demoLayer20, demoLayer21, demoLayer22, demoLayer23, demoLayer24,
    demoLayer25, demoLayer26, demoLayer27, demoLayer28, demoLayer29, demoLayer30,
    demoLayer31, demoLayer32, demoLayer33, demoLayer34, demoLayer35, demoLayer36,
    demoLayer37, demoLayer38, demoLayer39, demoLayer40
} from "../../assets/DemoLayers/initLayers"; // Ensure this path is correct
import { pauseBackgroundWork } from "../../utils/performanceHelpers";
import "./PanelStyles/TokenSelectorOverlay.css";

// Constants
const LOGO_FADE_DURATION = 400;
const LOGO_VISIBLE_DURATION = 600;
const MIN_LOGO_DISPLAY_TIME = LOGO_FADE_DURATION + LOGO_VISIBLE_DURATION;
const OPEN_CLOSE_ANIMATION_DURATION = 300;

/**
 * TokenSelectorOverlay: A modal overlay for selecting and applying demo tokens
 * to different visual layers. Includes loading animations and preview-on-hold functionality.
 */
const TokenSelectorOverlay = ({ isOpen, onClose, onTokenApplied, readOnly = false }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [demoTokens, setDemoTokens] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(3);
  const [selectedTokens, setSelectedTokens] = useState({ 1: null, 2: null, 3: null });
  const [animationState, setAnimationState] = useState("hidden");
  const [displayMessage, setDisplayMessage] = useState({ text: null, type: 'info' });
  const [areImagesPreloaded, setAreImagesPreloaded] = useState(false);
  const [isPreviewingCanvas, setIsPreviewingCanvas] = useState(false);
  const [logoTimerFinished, setLogoTimerFinished] = useState(false);

  const statusMessageTimerRef = useRef(null);
  const holdPreviewTimerRef = useRef(null);
  const overlayRef = useRef(null);
  const logoTimerRef = useRef(null);
  const rafRef = useRef(null);
  const isMountedRef = useRef(false);
  const cancelPauseRef = useRef(null);

  // demoLayerImageMap correctly uses the individually imported demoLayerX variables
  const demoLayerImageMap = useMemo(() => ({
    1: demoLayer1, 2: demoLayer2, 3: demoLayer3, 4: demoLayer4, 5: demoLayer5,
    6: demoLayer6, 7: demoLayer7, 8: demoLayer8, 9: demoLayer9, 10: demoLayer10,
    11: demoLayer11, 12: demoLayer12, 13: demoLayer13, 14: demoLayer14, 15: demoLayer15,
    16: demoLayer16, 17: demoLayer17, 18: demoLayer18, 19: demoLayer19, 20: demoLayer20,
    21: demoLayer21, 22: demoLayer22, 23: demoLayer23, 24: demoLayer24, 25: demoLayer25,
    26: demoLayer26, 27: demoLayer27, 28: demoLayer28, 29: demoLayer29, 30: demoLayer30,
    31: demoLayer31, 32: demoLayer32, 33: demoLayer33, 34: demoLayer34, 35: demoLayer35,
    36: demoLayer36, 37: demoLayer37, 38: demoLayer38, 39: demoLayer39, 40: demoLayer40
  }), []); // <<< CHANGED TO EMPTY DEPENDENCY ARRAY to satisfy ESLint exhaustive-deps for static imports

  useEffect(() => {
      const pdt = Object.entries(demoLayerImageMap).map(([k, s]) => ({
          id: `demo_token_${parseInt(k)}`,
          displayId: parseInt(k),
          type: 'demo',
          metadata: { name: `Demo Token #${parseInt(k)}`, image: s } // 's' is now the direct image path
      }));
      setDemoTokens(pdt);
      setAreImagesPreloaded(false); // Reset preloading state when map changes
  }, [demoLayerImageMap]);

  useEffect(() => {
      isMountedRef.current = true;
      const timers = { status: statusMessageTimerRef.current, logo: logoTimerRef.current, hold: holdPreviewTimerRef.current };
      const rafs = { main: rafRef.current };
      const pauseCancel = cancelPauseRef.current;
      return () => {
          isMountedRef.current = false;
          if (timers.status) clearTimeout(timers.status);
          if (timers.logo) clearTimeout(timers.logo);
          if (timers.hold) clearTimeout(timers.hold);
          if (rafs.main) cancelAnimationFrame(rafs.main);
          if (pauseCancel) pauseCancel();
          statusMessageTimerRef.current = null;
          logoTimerRef.current = null;
          holdPreviewTimerRef.current = null;
          rafRef.current = null;
          cancelPauseRef.current = null;
      };
  }, []);

  useEffect(() => {
      if (!isOpen || demoTokens.length === 0 || areImagesPreloaded) {
          if (!isOpen) setAreImagesPreloaded(false);
          return;
      }
      let isEffectMounted = true;
      setIsLoading(true);
      const preloadPromises = demoTokens.map(token => {
        if (typeof token.metadata.image !== 'string' || !token.metadata.image) {
          console.warn(`[TokenSelectorOverlay] Preload skipped for token ID ${token.id}: image source is invalid. Source:`, token.metadata.image);
          return Promise.resolve({ status: 'fulfilled', value: `Skipped invalid source for token ${token.id}` });
        }
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ status: 'fulfilled', value: token.metadata.image });
            img.onerror = (err) => {
                console.error(`[TokenSelectorOverlay] Preload FAILED for ${token.metadata.image}:`, err);
                resolve({ status: 'rejected', reason: `Failed for ${token.metadata.image}` });
            };
            img.src = token.metadata.image;
        });
      });

      Promise.allSettled(preloadPromises).then((results) => {
          if (isEffectMounted && isMountedRef.current) {
              const failedLoads = results.filter(r => r.status === 'rejected');
              if (failedLoads.length > 0) {
                  console.warn(`[TokenSelectorOverlay] ${failedLoads.length} images failed to preload.`);
              }
              setAreImagesPreloaded(true);
              setIsLoading(false);
          }
      });
      return () => { isEffectMounted = false; };
  }, [isOpen, demoTokens, areImagesPreloaded]);

  const showStatusMessage = useCallback((text, type = 'info', duration = 3000) => {
      setDisplayMessage({ text, type });
      if (statusMessageTimerRef.current) { clearTimeout(statusMessageTimerRef.current); }
      if (duration > 0 && text !== null) {
          statusMessageTimerRef.current = setTimeout(() => {
              if (isMountedRef.current) setDisplayMessage({ text: null, type: 'info' });
              statusMessageTimerRef.current = null;
          }, duration);
      } else if (text === null) {
          setDisplayMessage({ text: null, type: 'info' });
      }
  }, []);

  useEffect(() => {
    const clearOpeningTimers = () => {
        if (logoTimerRef.current) { clearTimeout(logoTimerRef.current); logoTimerRef.current = null; }
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };

    if (isOpen) {
        if (animationState === 'hidden' || animationState === 'exiting') {
            clearOpeningTimers();
            setAnimationState("hidden");
            setLogoTimerFinished(false);

            if (cancelPauseRef.current) cancelPauseRef.current();
            cancelPauseRef.current = pauseBackgroundWork(MIN_LOGO_DISPLAY_TIME + 500, { selector: '.main-view', debug: false });

            rafRef.current = requestAnimationFrame(() => {
                if (!isOpen || !isMountedRef.current) return;
                setAnimationState("logo");

                logoTimerRef.current = setTimeout(() => {
                    if (!isOpen || !isMountedRef.current) return;
                    setLogoTimerFinished(true);
                    logoTimerRef.current = null;
                }, MIN_LOGO_DISPLAY_TIME);
            });
        }
    } else {
        if (animationState !== 'hidden' && animationState !== 'exiting') {
             if (cancelPauseRef.current) cancelPauseRef.current();
             cancelPauseRef.current = pauseBackgroundWork(OPEN_CLOSE_ANIMATION_DURATION + 100, { selector: '.main-view', debug: false });
             setAnimationState('exiting');
        }
        setIsPreviewingCanvas(false);
        setAreImagesPreloaded(false);
        setLogoTimerFinished(false);
        clearOpeningTimers();
        if (holdPreviewTimerRef.current) clearTimeout(holdPreviewTimerRef.current);
        holdPreviewTimerRef.current = null;
    }

    return () => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [isOpen, animationState]);

  useEffect(() => {
      if (animationState === 'logo' && logoTimerFinished && areImagesPreloaded) {
          setAnimationState('content');
      }
  }, [animationState, logoTimerFinished, areImagesPreloaded]);

  const handleClose = useCallback(() => {
      setIsPreviewingCanvas(false);
      setAnimationState("exiting");
      if (cancelPauseRef.current) cancelPauseRef.current();
      cancelPauseRef.current = pauseBackgroundWork(OPEN_CLOSE_ANIMATION_DURATION + 100, { selector: '.main-view', debug: false });
      setTimeout(() => {
          if (isMountedRef.current) onClose();
       }, OPEN_CLOSE_ANIMATION_DURATION);
  }, [onClose]);

  const handleBackgroundClick = useCallback((e) => {
      if (isPreviewingCanvas) return;
      if (overlayRef.current && e.target === overlayRef.current) {
          handleClose();
      }
  }, [isPreviewingCanvas, handleClose]);

  const handleTokenPointerDown = useCallback((e) => {
      try {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          if (!isPreviewingCanvas) {
              const tokenIdentifier = e.currentTarget.dataset.tokenId;
              const tokenName = e.currentTarget.dataset.tokenName;
              const tokenType = e.currentTarget.dataset.tokenType;

              if (readOnly && tokenType === 'demo') {
                  showStatusMessage("Read-only: Demo changes disallowed.", "warning");
                  return;
              }
              setSelectedTokens((prev) => ({ ...prev, [selectedLayer]: tokenIdentifier, }));
              const layerName = selectedLayer === 3 ? "top" : selectedLayer === 2 ? "middle" : "bottom";
              showStatusMessage(`Applied ${tokenName || 'token'} to ${layerName} layer`, "success");

              if (onTokenApplied) {
                  onTokenApplied(tokenIdentifier, selectedLayer);
              } else {
                  console.warn("[TokenSelector] onTokenApplied prop is missing!");
              }
          }
          setIsPreviewingCanvas(true);
      } catch (error) { console.error("[Preview Debug] Error in handleTokenPointerDown:", error); }
  }, [isPreviewingCanvas, readOnly, selectedLayer, onTokenApplied, showStatusMessage]);

  const handleTokenPointerLeave = useCallback((e) => {
      try {
          e.stopPropagation();
          setIsPreviewingCanvas(false);
      } catch (error) { console.error("[Preview Debug] Error in handleTokenPointerLeave:", error); }
  }, []);

  const handleTokenPointerUp = useCallback((e) => {
      try {
          e.stopPropagation();
          e.currentTarget.releasePointerCapture(e.pointerId);
          setIsPreviewingCanvas(false);
      } catch (error) { console.error("[Preview Debug] Error in handleTokenPointerUp:", error); }
  }, []);

  const renderTokenItem = useCallback((token) => {
      const uniqueKey = token.id;
      const tokenIdentifier = typeof token.metadata.image === 'string' ? token.metadata.image : '';
      const selectedId = selectedTokens[selectedLayer];
      const isSelected = selectedId === tokenIdentifier;
      const iconSrc = typeof token.metadata.image === 'string' && token.metadata.image ? token.metadata.image : entityTokenLogo;
      const name = token.metadata.name || 'Unnamed Token';

      if (!tokenIdentifier) {
        console.warn(`[TokenSelectorOverlay renderTokenItem] Token ID ${uniqueKey} has invalid image path:`, token.metadata.image);
        return null;
      }

      return (
        <div
            key={uniqueKey}
            className={`token-item ${isSelected ? "selected" : ""}`}
            data-token-id={tokenIdentifier}
            data-token-name={name}
            data-token-type={token.type}
            onPointerDown={handleTokenPointerDown}
            onPointerUp={handleTokenPointerUp}
            onPointerLeave={handleTokenPointerLeave}
            title={name}
        >
            <div className="token-image-container">
                <img src={iconSrc} alt={name} className="token-image" crossOrigin={iconSrc?.startsWith("http") ? "anonymous" : undefined} onError={(e) => { e.target.src = entityTokenLogo; }} draggable="false" />
            </div>
            <div className="token-name">{name}</div>
        </div>
      );
  }, [selectedLayer, selectedTokens, handleTokenPointerDown, handleTokenPointerUp, handleTokenPointerLeave]);

  const overlayClassName = useMemo(() => {
      let classes = 'overlay token-selector-overlay';
      if (animationState !== 'hidden' && animationState !== 'exiting') { classes += ' visible'; }
      classes += ` state-${animationState}`;
      if (isPreviewingCanvas) classes += ' preview-mode';
      return classes;
  }, [animationState, isPreviewingCanvas]);

  if (!isOpen && animationState === 'hidden') {
      return null;
  }

  return (
    <>
      {animationState === 'logo' && (
          <div className="logo-transition-container visible">
              <img src={entityTokenLogo} alt="Loading..." className="logo-animation" />
          </div>
      )}

      <div className={`status-message ${displayMessage.type} ${!displayMessage.text ? 'hidden' : ''}`}>
          {displayMessage.text}
      </div>

      {(animationState !== 'hidden') && (
          <div ref={overlayRef} className={overlayClassName} onClick={handleBackgroundClick}>
            <div className="overlay-content">
              <div className="overlay-header token-selector-header">
                  <div className="header-center-content">
                      <div className="layer-buttons">
                          <button className={`layer-button ${selectedLayer === 3 ? "active" : ""}`} onClick={() => setSelectedLayer(3)} title="Select Top Layer"> <img src={toplayerIcon} alt="L3" className="layer-button-icon" /> </button>
                          <button className={`layer-button ${selectedLayer === 2 ? "active" : ""}`} onClick={() => setSelectedLayer(2)} title="Select Middle Layer"> <img src={middlelayerIcon} alt="L2" className="layer-button-icon" /> </button>
                          <button className={`layer-button ${selectedLayer === 1 ? "active" : ""}`} onClick={() => setSelectedLayer(1)} title="Select Bottom Layer"> <img src={bottomlayerIcon} alt="L1" className="layer-button-icon" /> </button>
                      </div>
                  </div>
                  <button className="close-button" onClick={handleClose}>✕</button>
              </div>

              {(animationState === 'content' || animationState === 'exiting') && (
                  <div className="overlay-body">
                    <div className="token-display-area">
                      {isLoading || (animationState === 'logo' && !areImagesPreloaded) ? (
                         <div className="loading-message">Preloading assets...</div>
                       ) : (
                        <>
                          <div className="token-section demo-section">
                            {demoTokens.length > 0 ? (
                              <div className="tokens-grid">
                                {demoTokens.map(renderTokenItem)}
                              </div>
                            ) : (
                              <div className="status-message info">No demo tokens available.</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
              )}
            </div>
          </div>
      )}
    </>
  );
};

TokenSelectorOverlay.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onTokenApplied: PropTypes.func.isRequired,
  readOnly: PropTypes.bool
};

export default TokenSelectorOverlay;