// src/components/Panels/TokenSelectorOverlay.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import {
    toplayerIcon,
    middlelayerIcon,
    bottomlayerIcon,
} from "../../assets";
import { demoAssetMap } from "../../assets/DemoLayers/initLayers";
import { manageOverlayDimmingEffect } from "../../utils/performanceHelpers";
import { globalAnimationFlags } from "../../utils/globalAnimationFlags";
import "./PanelStyles/TokenSelectorOverlay.css";

const OPEN_CLOSE_ANIMATION_DURATION = 300;
const CONTENT_VISIBILITY_DELAY = 50;
const INITIAL_OPERATIONS_DELAY = 16;
const IMAGE_PRELOAD_DELAY_AFTER_CONTENT_VISIBLE = 200;
const IMAGE_PRELOAD_BATCH_SIZE = 40; // Load images in batches of 40
const IMAGE_PRELOAD_BATCH_DELAY = 50; // Small delay between batches (ms)

const TokenSelectorOverlay = ({ isOpen, onClose, onTokenApplied, readOnly = false }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [triggerImagePreload, setTriggerImagePreload] = useState(false);
  const [demoTokens, setDemoTokens] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(3);
  const [selectedTokens, setSelectedTokens] = useState({ 1: null, 2: null, 3: null });
  const [animationState, setAnimationState] = useState("hidden");
  const [displayMessage, setDisplayMessage] = useState({ text: null, type: 'info' });
  const [areImagesPreloaded, setAreImagesPreloaded] = useState(false);
  const [isPreviewingCanvas, setIsPreviewingCanvas] = useState(false);
  const [loadedImageCount, setLoadedImageCount] = useState(0); // For progress

  const statusMessageTimerRef = useRef(null);
  const overlayRef = useRef(null);
  const contentDelayTimerRef = useRef(null);
  const operationsDelayTimerRef = useRef(null);
  const isMountedRef = useRef(false);
  const cancelDimmingEffectRef = useRef(null);
  const imagePreloadTimerRef = useRef(null);
  const batchLoadAbortControllerRef = useRef(null); // To abort batch loading

  useEffect(() => {
      isMountedRef.current = true;
      return () => {
          isMountedRef.current = false;
          if (statusMessageTimerRef.current) clearTimeout(statusMessageTimerRef.current);
          if (contentDelayTimerRef.current) clearTimeout(contentDelayTimerRef.current);
          if (operationsDelayTimerRef.current) clearTimeout(operationsDelayTimerRef.current);
          if (cancelDimmingEffectRef.current) cancelDimmingEffectRef.current();
          if (imagePreloadTimerRef.current) clearTimeout(imagePreloadTimerRef.current);
          if (batchLoadAbortControllerRef.current) batchLoadAbortControllerRef.current.abort();
          globalAnimationFlags.isTokenSelectorOpening = false;
      };
  }, []);

  useEffect(() => {
    if (isOpen) {
        globalAnimationFlags.isTokenSelectorOpening = true;
        setAreImagesPreloaded(false);
        setTriggerImagePreload(false);
        setIsLoadingImages(false);
        setLoadedImageCount(0); // Reset loaded count
        if (batchLoadAbortControllerRef.current) batchLoadAbortControllerRef.current.abort(); // Abort previous loading

        if (operationsDelayTimerRef.current) clearTimeout(operationsDelayTimerRef.current);
        operationsDelayTimerRef.current = setTimeout(() => {
            if (isMountedRef.current && isOpen) {
                setInternalIsOpen(true);
            } else if (isMountedRef.current && !isOpen) {
                globalAnimationFlags.isTokenSelectorOpening = false;
            }
        }, INITIAL_OPERATIONS_DELAY);
    } else {
        globalAnimationFlags.isTokenSelectorOpening = false;
        setInternalIsOpen(false);
        if (operationsDelayTimerRef.current) clearTimeout(operationsDelayTimerRef.current);
        setAnimationState("hidden");
        setAreImagesPreloaded(false);
        setIsLoadingImages(false);
        setTriggerImagePreload(false);
        setLoadedImageCount(0);
        if (imagePreloadTimerRef.current) clearTimeout(imagePreloadTimerRef.current);
        if (batchLoadAbortControllerRef.current) batchLoadAbortControllerRef.current.abort();
    }
    return () => {
        if (operationsDelayTimerRef.current) clearTimeout(operationsDelayTimerRef.current);
        if (isOpen && !isMountedRef.current) {
             globalAnimationFlags.isTokenSelectorOpening = false;
        }
    };
  }, [isOpen]);

  useEffect(() => {
      const structuredDemoTokens = Object.entries(demoAssetMap).map(([key, src]) => ({
          id: key,
          displayId: key,
          type: 'demo',
          metadata: { name: `Demo ${key.replace("DEMO_LAYER_", "Asset ")}`, image: src }
      }));
      setDemoTokens(structuredDemoTokens);
  }, []);

  useEffect(() => {
    if (animationState === "content" && internalIsOpen && !triggerImagePreload && !areImagesPreloaded) {
        if (imagePreloadTimerRef.current) clearTimeout(imagePreloadTimerRef.current);
        setIsLoadingImages(true);
        imagePreloadTimerRef.current = setTimeout(() => {
            if (isMountedRef.current && internalIsOpen && animationState === "content") {
                setTriggerImagePreload(true);
            }
        }, IMAGE_PRELOAD_DELAY_AFTER_CONTENT_VISIBLE);
    }
    return () => {
        if (imagePreloadTimerRef.current) clearTimeout(imagePreloadTimerRef.current);
    };
  }, [animationState, internalIsOpen, triggerImagePreload, areImagesPreloaded]);


  useEffect(() => {
      if (triggerImagePreload && demoTokens.length > 0 && !areImagesPreloaded) {
          batchLoadAbortControllerRef.current = new AbortController();
          const signal = batchLoadAbortControllerRef.current.signal;

          const loadBatch = async (startIndex) => {
              if (signal.aborted || !isMountedRef.current) return;

              const batch = demoTokens.slice(startIndex, startIndex + IMAGE_PRELOAD_BATCH_SIZE);
              if (batch.length === 0) {
                  if (isMountedRef.current) {
                      setAreImagesPreloaded(true);
                      setIsLoadingImages(false);
                  }
                  return;
              }

              const promises = batch.map(token => {
                  if (signal.aborted) return Promise.reject(new Error("Aborted"));
                  const imgSrc = token.metadata?.image;
                  if (typeof imgSrc !== 'string' || !imgSrc) return Promise.resolve({ status: 'fulfilled' });
                  return new Promise((resolve) => {
                      const img = new Image();
                      const timeoutId = setTimeout(() => resolve({ status: 'rejected', reason: `Timeout for ${imgSrc}` }), 5000); // 5s timeout per image
                      img.onload = () => { clearTimeout(timeoutId); resolve({ status: 'fulfilled', value: imgSrc }); };
                      img.onerror = () => { clearTimeout(timeoutId); resolve({ status: 'rejected', reason: `Failed for ${imgSrc}` }); };
                      if (signal.aborted) { clearTimeout(timeoutId); resolve({ status: 'rejected', reason: 'Aborted before src set' }); return; }
                      img.src = imgSrc;
                  });
              });

              await Promise.allSettled(promises);
              if (signal.aborted || !isMountedRef.current) return;

              setLoadedImageCount(prev => prev + batch.length);

              if (startIndex + IMAGE_PRELOAD_BATCH_SIZE < demoTokens.length) {
                  setTimeout(() => loadBatch(startIndex + IMAGE_PRELOAD_BATCH_SIZE), IMAGE_PRELOAD_BATCH_DELAY);
              } else {
                  if (isMountedRef.current) {
                      setAreImagesPreloaded(true);
                      setIsLoadingImages(false);
                  }
              }
          };

          loadBatch(0);

          return () => {
              if (batchLoadAbortControllerRef.current) {
                  batchLoadAbortControllerRef.current.abort();
              }
          };
      }
  }, [triggerImagePreload, demoTokens, areImagesPreloaded]);


  useEffect(() => {
    if (contentDelayTimerRef.current) clearTimeout(contentDelayTimerRef.current);
    contentDelayTimerRef.current = null;

    if (internalIsOpen) {
        if (animationState === 'hidden' || animationState === 'exiting') {
            setAnimationState("hidden");
            if (cancelDimmingEffectRef.current) cancelDimmingEffectRef.current();
            cancelDimmingEffectRef.current = manageOverlayDimmingEffect(
                OPEN_CLOSE_ANIMATION_DURATION + CONTENT_VISIBILITY_DELAY + 50,
                { selector: '.main-view' }
            );
            contentDelayTimerRef.current = setTimeout(() => {
                if (internalIsOpen && isMountedRef.current) {
                    setAnimationState("content");
                }
            }, CONTENT_VISIBILITY_DELAY);
        }
    } else { 
        if (animationState !== 'hidden' && animationState !== 'exiting') {
             if (cancelDimmingEffectRef.current) cancelDimmingEffectRef.current();
             cancelDimmingEffectRef.current = manageOverlayDimmingEffect(OPEN_CLOSE_ANIMATION_DURATION + 50, { selector: '.main-view' });
             setAnimationState('exiting');
        }
        setIsPreviewingCanvas(false);
    }
    return () => {
        if (contentDelayTimerRef.current) clearTimeout(contentDelayTimerRef.current);
    };
  }, [internalIsOpen, animationState]);

  const showStatusMessage = useCallback((text, type = 'info', duration = 3000) => {
      setDisplayMessage({ text, type });
      if (statusMessageTimerRef.current) { clearTimeout(statusMessageTimerRef.current); }
      if (duration > 0 && text !== null) {
          statusMessageTimerRef.current = setTimeout(() => {
              if (isMountedRef.current) setDisplayMessage({ text: null, type: 'info' });
          }, duration);
      } else if (text === null) {
          setDisplayMessage({ text: null, type: 'info' });
      }
  }, []);

  const handleClose = useCallback(() => {
    globalAnimationFlags.isTokenSelectorOpening = false;
    if (batchLoadAbortControllerRef.current) batchLoadAbortControllerRef.current.abort();
    onClose();
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
          if (!isPreviewingCanvas && areImagesPreloaded) {
              const tokenIdentifierForKey = e.currentTarget.dataset.tokenIdKey;
              const tokenName = e.currentTarget.dataset.tokenName;
              const tokenImageSrc = e.currentTarget.dataset.tokenIdValue;
              setSelectedTokens((prev) => ({ ...prev, [selectedLayer]: tokenImageSrc, }));
              const layerName = selectedLayer === 3 ? "top" : selectedLayer === 2 ? "middle" : "bottom";
              showStatusMessage(`Applied ${tokenName || 'token'} to ${layerName} layer`, "success");
              if (onTokenApplied) {
                  onTokenApplied(tokenIdentifierForKey, selectedLayer);
              }
          }
          setIsPreviewingCanvas(true);
      } catch (error) { console.error("[TokenSelector] Error in handleTokenPointerDown:", error); }
  }, [isPreviewingCanvas, selectedLayer, onTokenApplied, showStatusMessage, areImagesPreloaded]);

  const handleTokenPointerLeave = useCallback((e) => {
      try {
          e.stopPropagation();
          setIsPreviewingCanvas(false);
      } catch (error) { console.error("[TokenSelector] Error in handleTokenPointerLeave:", error); }
  }, []);

  const handleTokenPointerUp = useCallback((e) => {
      try {
          e.stopPropagation();
          e.currentTarget.releasePointerCapture(e.pointerId);
          setIsPreviewingCanvas(false);
      } catch (error) { console.error("[TokenSelector] Error in handleTokenPointerUp:", error); }
  }, []);

  const renderTokenItem = useCallback((token) => {
      const uniqueKey = token.id;
      const tokenImageSrc = token.metadata?.image ?? '';
      const isSelected = selectedTokens[selectedLayer] === tokenImageSrc;
      const iconSrc = tokenImageSrc || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      const name = token.metadata?.name || 'Unnamed Token';

      if (!tokenImageSrc) return null;
      return (
        <div
            key={uniqueKey}
            className={`token-item ${isSelected ? "selected" : ""} ${readOnly ? "read-only" : ""}`}
            data-token-id-key={token.id}
            data-token-id-value={tokenImageSrc}
            data-token-name={name} data-token-type={token.type}
            onPointerDown={handleTokenPointerDown} onPointerUp={handleTokenPointerUp} onPointerLeave={handleTokenPointerLeave}
            title={readOnly ? `Viewing Mode - ${name} (Demo tokens usable)` : name}
        >
            <div className="token-image-container">
                <img src={iconSrc} alt={name} className="token-image" crossOrigin={iconSrc?.startsWith("http") ? "anonymous" : undefined} onError={(e) => { e.target.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; }} draggable="false" />
            </div>
            <div className="token-name">{name}</div>
        </div>
      );
  }, [selectedLayer, selectedTokens, readOnly, handleTokenPointerDown, handleTokenPointerUp, handleTokenPointerLeave]);

  const overlayClassName = useMemo(() => {
      let classes = 'overlay token-selector-overlay';
      if (internalIsOpen || animationState === 'exiting') {
          classes += ' visible';
      }
      classes += ` state-${animationState}`;
      if (isPreviewingCanvas) classes += ' preview-mode';
      return classes;
  }, [internalIsOpen, animationState, isPreviewingCanvas]);

  if (!isOpen && animationState === 'hidden') {
      return null;
  }

  let tokenDisplayContent;
  if (isLoadingImages && !areImagesPreloaded) {
    const progressPercent = demoTokens.length > 0 ? Math.round((loadedImageCount / demoTokens.length) * 100) : 0;
    tokenDisplayContent = <div className="loading-message">Preloading assets... ({progressPercent}%)</div>;
  } else if (areImagesPreloaded && demoTokens.length > 0) {
    tokenDisplayContent = (
      <div className="token-section demo-section">
        <div className="tokens-grid">{demoTokens.map(renderTokenItem)}</div>
      </div>
    );
  } else if (!isLoadingImages && demoTokens.length === 0) { // Case for no demo tokens at all
    tokenDisplayContent = <div className="status-message info">No demo tokens available.</div>;
  } else { // Fallback, or initial state before loading starts
    tokenDisplayContent = <div className="loading-message">Initializing...</div>;
  }


  return (
    <>
      <div className={`status-message ${displayMessage.type} ${!displayMessage.text ? 'hidden' : ''}`}>
          {displayMessage.text}
      </div>

      {(internalIsOpen || animationState === 'exiting') && (
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
                  <button className="close-button" onClick={handleClose} aria-label="Close token selector">✕</button>
              </div>
              
              {(animationState === 'content' || animationState === 'exiting') && (
                  <div className="overlay-body">
                    {readOnly && ( <div className="visitor-banner"> You are viewing another profile... </div> )}
                    <div className="token-display-area">
                      {tokenDisplayContent}
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