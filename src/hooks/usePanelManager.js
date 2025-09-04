// src/hooks/usePanelManager.js
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

const OPEN_ANIMATION_DURATION = 500; 
const CLOSE_ANIMATION_DELAY = 500;

export function usePanelManager(initialPanel = null) {
  const [activePanel, setActivePanelInternal] = useState(initialPanel);
  const [animatingPanel, setAnimatingPanel] = useState(null);

  const openTimeoutRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  // --- START: MODIFIED LOGIC ---
  // CORRECTED: The state setter from `useState` is stable. We wrap it in `useCallback`
  // with an empty dependency array to create a single, stable function for the lifetime
  // of the component. This prevents stale closures in dependent functions.
  const setActivePanel = useCallback((newPanelValue) => {
      setActivePanelInternal(newPanelValue);
  }, []); // Empty dependency array is correct here.
  // --- END: MODIFIED LOGIC ---

  useEffect(() => {
    return () => {
      if (openTimeoutRef.current) {
        clearTimeout(openTimeoutRef.current);
      }
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const openPanel = useCallback((panelName) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (openTimeoutRef.current) {
        clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = null;
    }

    setAnimatingPanel(panelName); 
    setActivePanel(panelName); 

    openTimeoutRef.current = setTimeout(() => {
      setAnimatingPanel(null); 
      openTimeoutRef.current = null;
    }, OPEN_ANIMATION_DURATION);
  }, [setActivePanel]); // This now depends on the stable setActivePanel function.

  const closePanel = useCallback(() => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current); 
        closeTimeoutRef.current = null;
    }

    setAnimatingPanel("closing"); 

    closeTimeoutRef.current = setTimeout(() => {
      setActivePanel(null); 
      setAnimatingPanel(null); 
      closeTimeoutRef.current = null;
    }, CLOSE_ANIMATION_DELAY);
  }, [setActivePanel]); // This now depends on the stable setActivePanel function.

  const togglePanel = useCallback((panelName) => {
    if (activePanel === panelName) {
      closePanel();
    } else {
      openPanel(panelName);
    }
  }, [activePanel, openPanel, closePanel]);

  return useMemo(() => ({
    activePanel,
    animatingPanel,
    openPanel,
    closePanel,
    togglePanel,
  }), [activePanel, animatingPanel, openPanel, closePanel, togglePanel]);
}