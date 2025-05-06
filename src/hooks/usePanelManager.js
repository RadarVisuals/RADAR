import { useState, useCallback, useRef, useEffect } from 'react';

const OPEN_ANIMATION_DURATION = 300; // Time until animatingPanel is cleared after opening
const CLOSE_ANIMATION_DELAY = 250; // Delay before setting activePanel to null after closing starts

/**
 * Manages the state for UI panels, including which panel is currently active
 * and handling the state for opening/closing animations (`animatingPanel`).
 * It uses timeouts to coordinate the animation state with the actual panel visibility.
 * Includes logging to trace panel state changes, especially when closing.
 *
 * @param {string | null} [initialPanel=null] - The panel identifier (string) to be initially active, or null for none.
 * @returns {{
 *   activePanel: string | null,
 *   animatingPanel: string | null,
 *   openPanel: (panelName: string) => void,
 *   closePanel: () => void,
 *   togglePanel: (panelName: string) => void
 * }} An object containing the current active panel, the panel currently animating, and functions to open, close, or toggle panels.
 */
export function usePanelManager(initialPanel = null) {
  const [activePanel, setActivePanelInternal] = useState(initialPanel);
  const [animatingPanel, setAnimatingPanel] = useState(null);

  const openTimeoutRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  // Wrapper to log when activePanel becomes null
  const setActivePanel = useCallback((newPanelValue) => {
      // console.log(`[usePanelManager] setActivePanel called. Current: '${activePanel}', New: '${newPanelValue}'`); // Optional: Keep if tracing is needed
      if (newPanelValue === null && activePanel !== null) {
          // Keep this warning as requested, helps trace unexpected closes
          console.warn(`[usePanelManager] ---> Setting activePanel to NULL!`);
      }
      setActivePanelInternal(newPanelValue);
  }, [activePanel]);

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
    }

    setAnimatingPanel("closing"); // Indicate closing animation

    closeTimeoutRef.current = setTimeout(() => {
      setActivePanel(null); // Set active to null after delay
      setAnimatingPanel(null); // Clear animation state
      closeTimeoutRef.current = null;
    }, CLOSE_ANIMATION_DELAY);
  }, [setActivePanel]); // Removed activePanel dependency, not needed for logic

  /** Toggles a panel: opens it if closed, closes it if open. */
  const togglePanel = useCallback((panelName) => {
    if (activePanel === panelName) {
      closePanel();
    } else {
      openPanel(panelName);
    }
  }, [activePanel, openPanel, closePanel]);

  return {
    activePanel,
    animatingPanel,
    openPanel,
    closePanel,
    togglePanel,
  };
}