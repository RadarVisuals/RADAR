import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import {
    entityTokenLogo,
    toplayerIcon,
    middlelayerIcon,
    bottomlayerIcon,
} from "../../assets";
// Import demo layer assets directly
import {
    demoLayer1, demoLayer2, demoLayer3, demoLayer4, demoLayer5, demoLayer6,
    demoLayer7, demoLayer8, demoLayer9, demoLayer10, demoLayer11, demoLayer12,
    demoLayer13, demoLayer14, demoLayer15, demoLayer16, demoLayer17, demoLayer18,
    demoLayer19, demoLayer20, demoLayer21, demoLayer22, demoLayer23, demoLayer24,
    demoLayer25, demoLayer26, demoLayer27, demoLayer28, demoLayer29, demoLayer30,
    demoLayer31, demoLayer32, demoLayer33, demoLayer34, demoLayer35, demoLayer36,
    demoLayer37, demoLayer38, demoLayer39, demoLayer40
} from "../../assets/DemoLayers/initLayers";
import { pauseBackgroundWork } from "../../utils/performanceHelpers";
import "./PanelStyles/TokenSelectorOverlay.css";

// Constants for animation timings
const LOGO_FADE_DURATION = 400;
const LOGO_VISIBLE_DURATION = 600;
const MIN_LOGO_DISPLAY_TIME = LOGO_FADE_DURATION + LOGO_VISIBLE_DURATION;
const OPEN_CLOSE_ANIMATION_DURATION = 300;

/**
 * TokenSelectorOverlay: A modal overlay for selecting and applying demo tokens
 * to different visual layers. Includes loading animations and preview-on-hold functionality.
 * Shows a message when in read-only mode.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.isOpen - Controls whether the overlay is open.
 * @param {Function} props.onClose - Callback function to close the overlay.
 * @param {Function} props.onTokenApplied - Callback function when a token is selected and applied.
 * @param {boolean} [props.readOnly=false] - If true, disables token application (visitor mode).
 * @returns {React.ReactElement | null} The rendered component or null.
 */
const TokenSelectorOverlay = ({ isOpen, onClose, onTokenApplied, readOnly = false }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [demoTokens, setDemoTokens] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(3); // Default to top layer
  const [selectedTokens, setSelectedTokens] = useState({ 1: null, 2: null, 3: null });
  const [animationState, setAnimationState] = useState("hidden"); // 'hidden', 'logo', 'content', 'exiting'
  const [displayMessage, setDisplayMessage] = useState({ text: null, type: 'info' });
  const [areImagesPreloaded, setAreImagesPreloaded] = useState(false);
  const [isPreviewingCanvas, setIsPreviewingCanvas] = useState(false); // Currently unused, kept for potential future use
  const [logoTimerFinished, setLogoTimerFinished] = useState(false);

  // Refs for managing timers, DOM elements, and component mount state
  const statusMessageTimerRef = useRef(null);
  const holdPreviewTimerRef = useRef(null); // Currently unused
  const overlayRef = useRef(null);
  const logoTimerRef = useRef(null);
  const rafRef = useRef(null);
  const isMountedRef = useRef(false);
  const cancelPauseRef = useRef(null);

  // Memoize the mapping of demo layer IDs to their imported image paths
  const demoLayerImageMap = useMemo(() => ({
    1: demoLayer1, 2: demoLayer2, 3: demoLayer3, 4: demoLayer4, 5: demoLayer5,
    6: demoLayer6, 7: demoLayer7, 8: demoLayer8, 9: demoLayer9, 10: demoLayer10,
    11: demoLayer11, 12: demoLayer12, 13: demoLayer13, 14: demoLayer14, 15: demoLayer15,
    16: demoLayer16, 17: demoLayer17, 18: demoLayer18, 19: demoLayer19, 20: demoLayer20,
    21: demoLayer21, 22: demoLayer22, 23: demoLayer23, 24: demoLayer24, 25: demoLayer25,
    26: demoLayer26, 27: demoLayer27, 28: demoLayer28, 29: demoLayer29, 30: demoLayer30,
    31: demoLayer31, 32: demoLayer32, 33: demoLayer33, 34: demoLayer34, 35: demoLayer35,
    36: demoLayer36, 37: demoLayer37, 38: demoLayer38, 39: demoLayer39, 40: demoLayer40
  }), []); // Static imports, empty dependency array is correct here

  // Effect to structure the demo token data based on the image map
  useEffect(() => {
      const structuredDemoTokens = Object.entries(demoLayerImageMap).map(([key, src]) => ({
          id: `demo_token_${parseInt(key)}`, // Internal unique ID
          displayId: parseInt(key), // Number for display if needed
          type: 'demo',
          metadata: { name: `Demo Token #${parseInt(key)}`, image: src } // Use the imported image path
      }));
      setDemoTokens(structuredDemoTokens);
      setAreImagesPreloaded(false); // Reset preload state when map changes
  }, [demoLayerImageMap]);

  // Effect for component mount/unmount and cleanup
  useEffect(() => {
      isMountedRef.current = true;
      // Capture current timer/ref values for cleanup function
      const timers = { status: statusMessageTimerRef.current, logo: logoTimerRef.current, hold: holdPreviewTimerRef.current };
      const rafs = { main: rafRef.current };
      const pauseCancel = cancelPauseRef.current;
      return () => {
          isMountedRef.current = false;
          // Clear all potentially active timers and cancel RAF/pause on unmount
          if (timers.status) clearTimeout(timers.status);
          if (timers.logo) clearTimeout(timers.logo);
          if (timers.hold) clearTimeout(timers.hold);
          if (rafs.main) cancelAnimationFrame(rafs.main);
          if (pauseCancel) pauseCancel();
          // Nullify refs to prevent memory leaks
          statusMessageTimerRef.current = null;
          logoTimerRef.current = null;
          holdPreviewTimerRef.current = null;
          rafRef.current = null;
          cancelPauseRef.current = null;
      };
  }, []);

  // Effect to preload demo token images when the overlay is opened
  useEffect(() => {
      if (!isOpen || demoTokens.length === 0 || areImagesPreloaded) {
          if (!isOpen) setAreImagesPreloaded(false); // Reset preload state on close
          return;
      }
      let isEffectMounted = true; // Track mount status within this effect run
      setIsLoading(true);
      const preloadPromises = demoTokens.map(token => {
        const imgSrc = token.metadata?.image;
        if (typeof imgSrc !== 'string' || !imgSrc) {
          console.warn(`[TokenSelectorOverlay] Preload skipped for token ID ${token.id}: invalid image source.`);
          return Promise.resolve({ status: 'fulfilled' }); // Treat invalid source as fulfilled (won't block UI)
        }
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ status: 'fulfilled', value: imgSrc });
            img.onerror = () => {
                console.error(`[TokenSelectorOverlay] Preload FAILED for ${imgSrc}`);
                resolve({ status: 'rejected', reason: `Failed for ${imgSrc}` });
            };
            img.src = imgSrc;
        });
      });

      Promise.allSettled(preloadPromises).then((results) => {
          if (isEffectMounted && isMountedRef.current) {
              const failedCount = results.filter(r => r.status === 'rejected').length;
              if (failedCount > 0) {
                  console.warn(`[TokenSelectorOverlay] ${failedCount} images failed to preload.`);
              }
              setAreImagesPreloaded(true);
              setIsLoading(false);
          }
      });
      return () => { isEffectMounted = false; }; // Cleanup for this effect run
  }, [isOpen, demoTokens, areImagesPreloaded]);

  // Function to display temporary status messages
  const showStatusMessage = useCallback((text, type = 'info', duration = 3000) => {
      setDisplayMessage({ text, type });
      if (statusMessageTimerRef.current) { clearTimeout(statusMessageTimerRef.current); }
      if (duration > 0 && text !== null) {
          statusMessageTimerRef.current = setTimeout(() => {
              if (isMountedRef.current) setDisplayMessage({ text: null, type: 'info' });
              statusMessageTimerRef.current = null;
          }, duration);
      } else if (text === null) { // Allow clearing the message immediately
          setDisplayMessage({ text: null, type: 'info' });
      }
  }, []);

  // Effect to manage the overlay's opening/closing animation states
  useEffect(() => {
    const clearOpeningTimers = () => {
        if (logoTimerRef.current) { clearTimeout(logoTimerRef.current); logoTimerRef.current = null; }
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };

    if (isOpen) {
        if (animationState === 'hidden' || animationState === 'exiting') {
            clearOpeningTimers();
            setAnimationState("hidden"); // Ensure starting from hidden
            setLogoTimerFinished(false); // Reset logo timer flag

            // Pause background animations while overlay is opening/visible
            if (cancelPauseRef.current) cancelPauseRef.current();
            cancelPauseRef.current = pauseBackgroundWork(MIN_LOGO_DISPLAY_TIME + 500);

            // Use RAF to ensure state update happens before animation triggers
            rafRef.current = requestAnimationFrame(() => {
                if (!isOpen || !isMountedRef.current) return; // Check again within RAF
                setAnimationState("logo"); // Start logo animation

                // Timer to mark the end of the logo display phase
                logoTimerRef.current = setTimeout(() => {
                    if (!isOpen || !isMountedRef.current) return; // Check again within timeout
                    setLogoTimerFinished(true);
                    logoTimerRef.current = null;
                }, MIN_LOGO_DISPLAY_TIME);
            });
        }
    } else { // Handle closing
        if (animationState !== 'hidden' && animationState !== 'exiting') {
             if (cancelPauseRef.current) cancelPauseRef.current();
             // Pause background briefly during close animation
             cancelPauseRef.current = pauseBackgroundWork(OPEN_CLOSE_ANIMATION_DURATION + 100);
             setAnimationState('exiting');
        }
        // Reset states needed for next open
        setIsPreviewingCanvas(false);
        setAreImagesPreloaded(false); // Reset preload status on close
        setLogoTimerFinished(false);
        clearOpeningTimers(); // Clear any pending opening timers
        if (holdPreviewTimerRef.current) clearTimeout(holdPreviewTimerRef.current);
        holdPreviewTimerRef.current = null;
    }

    // Cleanup RAF on effect re-run or unmount
    return () => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [isOpen, animationState]); // Depend on isOpen and animationState

  // Effect to transition from logo state to content state once ready
  useEffect(() => {
      if (animationState === 'logo' && logoTimerFinished && areImagesPreloaded) {
          setAnimationState('content');
      }
  }, [animationState, logoTimerFinished, areImagesPreloaded]);

  // Callback to handle closing the overlay
  const handleClose = useCallback(() => {
      setIsPreviewingCanvas(false);
      setAnimationState("exiting");
      if (cancelPauseRef.current) cancelPauseRef.current();
      cancelPauseRef.current = pauseBackgroundWork(OPEN_CLOSE_ANIMATION_DURATION + 100);
      // Delay calling the parent onClose until the animation finishes
      setTimeout(() => {
          if (isMountedRef.current) onClose();
       }, OPEN_CLOSE_ANIMATION_DURATION);
  }, [onClose]);

  // Callback to close the overlay when clicking the background backdrop
  const handleBackgroundClick = useCallback((e) => {
      if (isPreviewingCanvas) return; // Don't close if previewing
      if (overlayRef.current && e.target === overlayRef.current) {
          handleClose();
      }
  }, [isPreviewingCanvas, handleClose]);

  // Callback for when a token item is pressed down
  const handleTokenPointerDown = useCallback((e) => {
      try {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId); // Capture pointer events
          if (!isPreviewingCanvas) { // Avoid action if already previewing
              const tokenIdentifier = e.currentTarget.dataset.tokenId; // Get image path/id
              const tokenName = e.currentTarget.dataset.tokenName;

              if (readOnly) { // Check if in visitor/read-only mode
                  showStatusMessage("Viewing mode: Loading tokens is disabled.", "warning");
                  return;
              }

              // Update locally selected token state (visual feedback)
              setSelectedTokens((prev) => ({ ...prev, [selectedLayer]: tokenIdentifier, }));
              const layerName = selectedLayer === 3 ? "top" : selectedLayer === 2 ? "middle" : "bottom";
              showStatusMessage(`Applied ${tokenName || 'token'} to ${layerName} layer`, "success");

              // Call the callback to apply the token in the main application
              if (onTokenApplied) {
                  // Pass the identifier used in the dataset (image path/URL)
                  onTokenApplied(tokenIdentifier, selectedLayer);
              } else {
                  console.warn("[TokenSelector] onTokenApplied prop is missing!");
              }
          }
          setIsPreviewingCanvas(true); // Enter preview mode (currently unused visually)
      } catch (error) { console.error("[TokenSelector] Error in handleTokenPointerDown:", error); }
  }, [isPreviewingCanvas, readOnly, selectedLayer, onTokenApplied, showStatusMessage]);

  // Callback for when the pointer leaves a token item
  const handleTokenPointerLeave = useCallback((e) => {
      try {
          e.stopPropagation();
          setIsPreviewingCanvas(false); // Exit preview mode
      } catch (error) { console.error("[TokenSelector] Error in handleTokenPointerLeave:", error); }
  }, []);

  // Callback for when the pointer is released from a token item
  const handleTokenPointerUp = useCallback((e) => {
      try {
          e.stopPropagation();
          e.currentTarget.releasePointerCapture(e.pointerId); // Release pointer capture
          setIsPreviewingCanvas(false); // Exit preview mode
      } catch (error) { console.error("[TokenSelector] Error in handleTokenPointerUp:", error); }
  }, []);

  // Memoized function to render a single token item
  const renderTokenItem = useCallback((token) => {
      const uniqueKey = token.id; // Use internal ID for React key
      const tokenIdentifier = token.metadata?.image ?? ''; // Image path used for selection logic
      const selectedId = selectedTokens[selectedLayer];
      const isSelected = selectedId === tokenIdentifier;
      const iconSrc = tokenIdentifier || entityTokenLogo; // Use image path or fallback logo
      const name = token.metadata?.name || 'Unnamed Token';

      if (!tokenIdentifier) {
        console.warn(`[TokenSelectorOverlay] Token ID ${uniqueKey} has invalid image path.`);
        return null; // Don't render item if image path is missing
      }

      return (
        <div
            key={uniqueKey}
            className={`token-item ${isSelected ? "selected" : ""} ${readOnly ? "read-only" : ""}`}
            data-token-id={tokenIdentifier} // Use image path as identifier for click handler
            data-token-name={name}
            data-token-type={token.type} // Store type (e.g., 'demo')
            onPointerDown={handleTokenPointerDown}
            onPointerUp={handleTokenPointerUp}
            onPointerLeave={handleTokenPointerLeave}
            title={readOnly ? `Viewing Mode - Cannot apply ${name}` : name}
        >
            <div className="token-image-container">
                <img
                    src={iconSrc}
                    alt={name}
                    className="token-image"
                    crossOrigin={iconSrc?.startsWith("http") ? "anonymous" : undefined}
                    onError={(e) => { e.target.src = entityTokenLogo; }} // Fallback on image error
                    draggable="false"
                />
            </div>
            {/* Token name is visually hidden by CSS, kept for accessibility/data */}
            <div className="token-name">{name}</div>
        </div>
      );
  }, [selectedLayer, selectedTokens, readOnly, handleTokenPointerDown, handleTokenPointerUp, handleTokenPointerLeave]);

  // Memoize overlay class names based on state
  const overlayClassName = useMemo(() => {
      let classes = 'overlay token-selector-overlay';
      if (animationState !== 'hidden' && animationState !== 'exiting') { classes += ' visible'; }
      classes += ` state-${animationState}`;
      if (isPreviewingCanvas) classes += ' preview-mode';
      return classes;
  }, [animationState, isPreviewingCanvas]);

  // Don't render anything if closed and hidden
  if (!isOpen && animationState === 'hidden') {
      return null;
  }

  return (
    <>
      {/* Logo transition container */}
      {animationState === 'logo' && (
          <div className="logo-transition-container visible">
              <img src={entityTokenLogo} alt="Loading..." className="logo-animation" />
          </div>
      )}

      {/* Status message display */}
      <div className={`status-message ${displayMessage.type} ${!displayMessage.text ? 'hidden' : ''}`}>
          {displayMessage.text}
      </div>

      {/* Main overlay container */}
      {(animationState !== 'hidden') && (
          <div ref={overlayRef} className={overlayClassName} onClick={handleBackgroundClick}>
            <div className="overlay-content">
              {/* Header with layer selection and close button */}
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

              {/* Main content area (visible after logo/preload) */}
              {(animationState === 'content' || animationState === 'exiting') && (
                  <div className="overlay-body">
                    {/* Visitor/Read-Only Banner */}
                    {readOnly && (
                        <div className="visitor-banner">
                           Viewing Mode - Selecting tokens is disabled. Add RADAR with{' '}
                           <span style={{ color: '#61dafb' /* Or your preferred blue, e.g., 'blue' */ }}>
                               <code>
                                   {'<iframe src="https://radar725.netlify.app/" allow="microphone; midi; fullscreen"></iframe>'}
                               </code>
                           </span>
                           {' '}to your profile's grid for full functionality.
                        </div>
                    )}

                    {/* Token grid display area */}
                    <div className="token-display-area">
                      {isLoading || (animationState === 'logo' && !areImagesPreloaded) ? (
                         <div className="loading-message">Preloading assets...</div>
                       ) : (
                        <>
                          {/* Currently only shows demo tokens */}
                          <div className="token-section demo-section">
                            {demoTokens.length > 0 ? (
                              <div className="tokens-grid">
                                {demoTokens.map(renderTokenItem)}
                              </div>
                            ) : (
                              <div className="status-message info">No demo tokens available.</div>
                            )}
                          </div>
                          {/* Placeholder for owned tokens grid */}
                          {/* <div className="token-section owned-section">
                                <h3>My Owned Tokens</h3>
                                <div className="tokens-grid"></div>
                          </div> */}
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