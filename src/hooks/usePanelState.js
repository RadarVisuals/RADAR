// src/hooks/usePanelState.js
import { useState, useCallback, useEffect, useMemo, useRef } from "react";

const OPEN_ANIMATION_DURATION = 500;
const CLOSE_ANIMATION_DELAY = 500;

/**
 * @typedef {object} PanelState
 * @property {string | null} activePanel - The identifier of the currently active panel (e.g., 'controls', 'notifications', 'tokens'), or null if no panel is active.
 * @property {string | null} animatingPanel - The identifier of the panel currently undergoing an open/close animation (e.g., 'controls', 'closing'), or null.
 * @property {boolean} tokenSelectorOpen - True if the token selector overlay should be open. This is typically true when `activePanel` is 'tokens'.
 * @property {string} activeLayerTab - The identifier of the currently active layer tab (e.g., 'tab1', 'tab2', 'tab3').
 * @property {React.Dispatch<React.SetStateAction<string>>} setActiveLayerTab - Function to set the active layer tab.
 * @property {(panelName: string | null) => void} togglePanel - Function to toggle a panel's visibility (opens if closed, closes if open). Pass `null` to close the current panel.
 * @property {(panelName: string) => void} openPanel - Function to open a specific panel.
 * @property {() => void} closePanel - Function to close any currently active panel.
 * @property {(panelName: string) => boolean} isPanelActive - Function to check if a specific panel is currently active.
 * @property {() => number} getActiveLayerId - Function to get the numerical layer ID corresponding to the `activeLayerTab`.
 * @property {Object.<string, number>} tabToLayer - A mapping from tab identifiers (e.g., 'tab1') to their corresponding numerical layer IDs (e.g., 1).
 */

/**
 * Manages all state related to UI panels, layer tabs, and panel animations.
 * This hook is a consolidation of the previous `usePanelManager` and `usePanelState` hooks.
 *
 * @param {string|null} [initialPanel=null] - The identifier of the panel to be initially active.
 * @param {string} [initialLayerTab='tab1'] - The identifier of the initially active layer tab.
 * @returns {PanelState} An object containing the panel and tab state, along with functions to manage them.
 */
export function usePanelState(initialPanel = null, initialLayerTab = 'tab1') {
  const [activePanel, setActivePanel] = useState(initialPanel);
  const [animatingPanel, setAnimatingPanel] = useState(null);
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState(initialPanel === "tokens");
  const [activeLayerTab, setActiveLayerTab] = useState(initialLayerTab);

  const openTimeoutRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setTokenSelectorOpen(activePanel === "tokens");
  }, [activePanel]);

  const openPanel = useCallback((panelName) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);

    setAnimatingPanel(panelName);
    setActivePanel(panelName);

    openTimeoutRef.current = setTimeout(() => {
      setAnimatingPanel(null);
    }, OPEN_ANIMATION_DURATION);
  }, []);

  const closePanel = useCallback(() => {
    if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);

    setAnimatingPanel("closing");

    closeTimeoutRef.current = setTimeout(() => {
      setActivePanel(null);
      setAnimatingPanel(null);
    }, CLOSE_ANIMATION_DELAY);
  }, []);

  const togglePanel = useCallback((panelName) => {
      const cleanPanelName = panelName === "null" ? null : panelName;
      // Directly check the current state, don't use a state updater function here.
      if (activePanel === cleanPanelName) {
        closePanel();
      } else {
        openPanel(cleanPanelName);
      }
    }, [activePanel, openPanel, closePanel]);

  const isPanelActive = useCallback((panelName) => {
    return activePanel === panelName;
  }, [activePanel]);

  const tabToLayer = useMemo(() => ({
    tab1: 3, // Top
    tab2: 2, // Middle
    tab3: 1, // Bottom
  }), []);

  const getActiveLayerId = useCallback(() => {
    return tabToLayer[activeLayerTab] || 3;
  }, [activeLayerTab, tabToLayer]);

  return useMemo(() => ({
    activePanel,
    animatingPanel,
    tokenSelectorOpen,
    activeLayerTab,
    setActiveLayerTab,
    togglePanel,
    openPanel,
    closePanel,
    isPanelActive,
    getActiveLayerId,
    tabToLayer,
  }), [
    activePanel,
    animatingPanel,
    tokenSelectorOpen,
    activeLayerTab,
    togglePanel,
    openPanel,
    closePanel,
    isPanelActive,
    getActiveLayerId,
    tabToLayer,
  ]);
}