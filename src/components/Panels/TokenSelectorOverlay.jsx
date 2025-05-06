
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PropTypes from "prop-types";
// Removed unused currentProfileAddress from useConfig import
// import { useConfig } from "../../context/ConfigContext";
import {
    entityTokenLogo,
    toplayerIcon,
    middlelayerIcon,
    bottomlayerIcon,
} from "../../assets";
import * as DemoLayers from "../../assets/DemoLayers";
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
  // Removed unused currentProfileAddress and ADMIN_PROFILE_ADDRESS
  // const { currentProfileAddress } = useConfig(); // Removed
  const [isLoading, setIsLoading] = useState(false);
  const [demoTokens, setDemoTokens] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(3);
  const [selectedTokens, setSelectedTokens] = useState({ 1: null, 2: null, 3: null });
  const [animationState, setAnimationState] = useState("hidden");
  const [displayMessage, setDisplayMessage] = useState({ text: null, type: 'info' });
  const [areImagesPreloaded, setAreImagesPreloaded] = useState(false);
  const [isPreviewingCanvas, setIsPreviewingCanvas] = useState(false);
  const [logoTimerFinished, setLogoTimerFinished] = useState(false);

  // Refs
  const statusMessageTimerRef = useRef(null);
  const holdPreviewTimerRef = useRef(null);
  const overlayRef = useRef(null);
  const logoTimerRef = useRef(null);
  const rafRef = useRef(null);
  const isMountedRef = useRef(false);
  const cancelPauseRef = useRef(null);

  // isAdmin check removed as it wasn't used effectively

  const demoLayerImageMap = useMemo(() => ({
    1: DemoLayers.demoLayer1, 2: DemoLayers.demoLayer2, 3: DemoLayers.demoLayer3,
    4: DemoLayers.demoLayer4, 5: DemoLayers.demoLayer5, 6: DemoLayers.demoLayer6,
    7: DemoLayers.demoLayer7, 8: DemoLayers.demoLayer8, 9: DemoLayers.demoLayer9,
    10: DemoLayers.demoLayer10, 11: DemoLayers.demoLayer11, 12: DemoLayers.demoLayer12,
    13: DemoLayers.demoLayer13, 14: DemoLayers.demoLayer14, 15: DemoLayers.demoLayer15,
    16: DemoLayers.demoLayer16, 17: DemoLayers.demoLayer17, 18: DemoLayers.demoLayer18,
    19: DemoLayers.demoLayer19, 20: DemoLayers.demoLayer20, 21: DemoLayers.demoLayer21,
    22: DemoLayers.demoLayer22, 23: DemoLayers.demoLayer23, 24: DemoLayers.demoLayer24,
    25: DemoLayers.demoLayer25, 26: DemoLayers.demoLayer26, 27: DemoLayers.demoLayer27,
    28: DemoLayers.demoLayer28, 29: DemoLayers.demoLayer29, 30: DemoLayers.demoLayer30,
    31: DemoLayers.demoLayer31, 32: DemoLayers.demoLayer32, 33: DemoLayers.demoLayer33,
    34: DemoLayers.demoLayer34, 35: DemoLayers.demoLayer35, 36: DemoLayers.demoLayer36,
    37: DemoLayers.demoLayer37, 38: DemoLayers.demoLayer38, 39: DemoLayers.demoLayer39,
    40: DemoLayers.demoLayer40
  }), []);

  // Populate Demo Tokens state
  useEffect(() => {
      const pdt = Object.entries(demoLayerImageMap).map(([k, s]) => ({
          id: `demo_token_${parseInt(k)}`,
          displayId: parseInt(k),
          type: 'demo',
          metadata: { name: `Demo Token #${parseInt(k)}`, image: s }
      }));
      setDemoTokens(pdt);
      setAreImagesPreloaded(false);
  }, [demoLayerImageMap]); // Removed isAdmin dependency

  // Mount tracking & Timer Cleanup
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

  // Image Preloading Effect
  useEffect(() => {
      if (!isOpen || demoTokens.length === 0 || areImagesPreloaded) {
          if (!isOpen) setAreImagesPreloaded(false);
          return;
      }
      let isEffectMounted = true;
      setIsLoading(true);
      const preloadPromises = demoTokens.map(token => new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = (err) => { reject(err); };
          img.src = token.metadata.image;
      }));
      // Removed unused 'results' variable
      Promise.allSettled(preloadPromises).then(() => {
          if (isEffectMounted && isMountedRef.current) {
              setAreImagesPreloaded(true);
              setIsLoading(false);
          }
      });
      return () => { isEffectMounted = false; };
  }, [isOpen, demoTokens, areImagesPreloaded]);

  // Status Message Setter
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

  // Animation Control Effect
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

  // Effect to transition from logo to content phase
  useEffect(() => {
      if (animationState === 'logo' && logoTimerFinished && areImagesPreloaded) {
          setAnimationState('content');
      }
  }, [animationState, logoTimerFinished, areImagesPreloaded]);


  // Event handlers
  const handleClose = useCallback(() => {
      setIsPreviewingCanvas(false);
      setAnimationState("exiting");
      if (cancelPauseRef.current) cancelPauseRef.current();
      cancelPauseRef.current = pauseBackgroundWork(OPEN_CLOSE_ANIMATION_DURATION + 100, { selector: '.main-view', debug: false });
      setTimeout(() => {
          if (isMountedRef.current) onClose();
       }, OPEN_CLOSE_ANIMATION_DURATION);
  // Removed unnecessary eslint-disable comment and animationState dependency
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

  // Rendering helpers
  const renderTokenItem = useCallback((token) => {
      const uniqueKey = token.id;
      const tokenIdentifier = token.metadata.image;
      const selectedId = selectedTokens[selectedLayer];
      const isSelected = selectedId === tokenIdentifier;
      const iconSrc = token.metadata.image || entityTokenLogo;
      const name = token.metadata.name || 'Unnamed Token';

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