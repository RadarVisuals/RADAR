// src/hooks/usePanelManager.js
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// MODIFIED: Adjusted JS animation timing constants
const OPEN_ANIMATION_DURATION = 500; // Was 300
const CLOSE_ANIMATION_DELAY = 480;   // Was 250, adjust as needed, slightly less than CSS duration

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

  // Wrapper to log when activePanel becomes null
  const setActivePanel = useCallback((newPanelValue) => {
      const previousActivePanel = activePanel; // Capture for logging
      if (newPanelValue === null && previousActivePanel !== null) {
          // Keep this warning as requested, helps trace unexpected closes
          if (import.meta.env.DEV) {
            console.warn(`[usePanelManager] ---> Setting activePanel to NULL! (Previous: '${previousActivePanel}')`);
          }
      }
      setActivePanelInternal(newPanelValue);
  }, [activePanel]); // Dependency: activePanel (for logging the previous value)

  // Cleanup timeouts on unmount
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

  /** Opens a specific panel, handling animation state. */
  const openPanel = useCallback((panelName) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (openTimeoutRef.current) {
        clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = null;
    }

    setAnimatingPanel(panelName); // Indicate opening animation
    setActivePanel(panelName); // Make panel active

    openTimeoutRef.current = setTimeout(() => {
      setAnimatingPanel(null); // Clear animation state after duration
      openTimeoutRef.current = null;
    }, OPEN_ANIMATION_DURATION);
  }, [setActivePanel]);

  /** Closes the currently active panel, handling animation state. */
  const closePanel = useCallback(() => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current); // Prevent duplicate close timeouts
        closeTimeoutRef.current = null;
    }

    setAnimatingPanel("closing"); // Indicate closing animation

    closeTimeoutRef.current = setTimeout(() => {
      setActivePanel(null); // Set active to null after delay
      setAnimatingPanel(null); // Clear animation state
      closeTimeoutRef.current = null;
    }, CLOSE_ANIMATION_DELAY);
  }, [setActivePanel]);

  /** Toggles a panel: opens it if closed, closes it if open. */
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