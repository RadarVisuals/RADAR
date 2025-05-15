// src/hooks/usePanelManager.js
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

const OPEN_ANIMATION_DURATION = 500; 
const CLOSE_ANIMATION_DELAY = 500;   // MODIFIED: Match CSS animation duration (0.5s)

/**
 * @typedef {object} PanelManagerState
 * @property {string | null} activePanel - The identifier of the currently active panel.
 * @property {string | null} animatingPanel - The panel identifier that is currently undergoing an open/close animation (e.g., the panel name when opening, or "closing" when closing).
 * @property {(panelName: string) => void} openPanel - Function to open a specific panel.
 * @property {() => void} closePanel - Function to close the currently active panel.
 * @property {(panelName: string) => void} togglePanel - Function to toggle a panel's state (open if closed, close if open).
 */

/**
 * Manages the state for UI panels, including which panel is currently active
 * and handling the state for opening/closing animations (`animatingPanel`).
 * It uses timeouts to coordinate the animation state with the actual panel visibility.
 * Includes logging to trace panel state changes, especially when closing.
 *
 * @param {string | null} [initialPanel=null] - The panel identifier (string) to be initially active, or null for none.
 * @returns {PanelManagerState} An object containing panel state and control functions.
 */
export function usePanelManager(initialPanel = null) {
  const [activePanel, setActivePanelInternal] = useState(initialPanel);
  const [animatingPanel, setAnimatingPanel] = useState(null);

  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const openTimeoutRef = useRef(null);
  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const closeTimeoutRef = useRef(null);

  const setActivePanel = useCallback((newPanelValue) => {
      const previousActivePanel = activePanel; 
      if (newPanelValue === null && previousActivePanel !== null) {
          if (import.meta.env.DEV) {
            // console.warn(`[usePanelManager] ---> Setting activePanel to NULL! (Previous: '${previousActivePanel}')`); // Kept for debugging if needed
          }
      }
      setActivePanelInternal(newPanelValue);
  }, [activePanel]); 

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
  }, [setActivePanel]);

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
  }, [setActivePanel]);

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