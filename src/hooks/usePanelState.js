import { useState, useCallback, useEffect, useMemo } from "react"; // Added useMemo

/**
 * @typedef {object} PanelState
 * @property {string | null} activePanel - The identifier of the currently active panel (e.g., 'controls', 'notifications'), or null if no panel is active.
 * @property {boolean} tokenSelectorOpen - True if the token selector overlay should be open, typically when `activePanel` is 'tokens'.
 * @property {string} activeLayerTab - The identifier of the currently active layer tab (e.g., 'tab1', 'tab2', 'tab3').
 * @property {React.Dispatch<React.SetStateAction<string>>} setActiveLayerTab - Function to set the active layer tab.
 * @property {(panelName: string | null) => void} togglePanel - Function to toggle a panel's visibility (opens if closed, closes if open).
 * @property {(panelName: string) => void} openPanel - Function to open a specific panel.
 * @property {() => void} closePanel - Function to close any currently active panel.
 * @property {(panelName: string) => boolean} isPanelActive - Function to check if a specific panel is currently active.
 * @property {() => number} getActiveLayerId - Function to get the numerical layer ID corresponding to the `activeLayerTab`.
 * @property {Object.<string, number>} tabToLayer - A mapping from tab identifiers to their corresponding layer IDs.
 */

/**
 * Manages the state related to UI panels and layer tabs. It tracks which
 * panel (if any) is currently active, whether the dedicated token selector
 * overlay should be open (specifically when the 'tokens' panel is active),
 * and which layer tab (e.g., for layer controls) is currently selected.
 * Provides functions to toggle/open/close panels and check panel status.
 *
 * @param {string|null} [initialPanel=null] - The identifier of the panel to be initially active.
 * @param {string} [initialLayerTab='tab1'] - The identifier of the initially active layer tab.
 * @returns {PanelState} An object containing the panel and tab state, along with functions to manage them.
 */
export function usePanelState(initialPanel = null, initialLayerTab = 'tab1') {
  const [activePanel, setActivePanel] = useState(initialPanel);
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState(false);
  const [activeLayerTab, setActiveLayerTab] = useState(initialLayerTab);

  // Effect to automatically manage the tokenSelectorOpen state based on activePanel
  useEffect(() => {
    setTokenSelectorOpen(activePanel === "tokens");
  }, [activePanel]);

  /** Toggles a panel's visibility: opens if closed, closes if open. */
  const togglePanel = useCallback(
    (panelName) => {
      const cleanPanelName = panelName === "null" ? null : panelName;
      setActivePanel((current) => (current === cleanPanelName ? null : cleanPanelName));
    },
    [],
  );

  /** Opens a specific panel by its identifier. */
  const openPanel = useCallback((panelName) => {
    setActivePanel(panelName);
  }, []);

  /** Closes any currently active panel. */
  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  /** Checks if a specific panel is currently the active one. */
  const isPanelActive = useCallback(
    (panelName) => {
      return activePanel === panelName;
    },
    [activePanel],
  );

  /**
   * Memoized mapping from tab identifiers to layer IDs.
   * This ensures the object reference is stable across renders unless its dependencies change (none in this case).
   * @type {Object.<string, number>}
   */
  const tabToLayer = useMemo(() => ({
    tab1: 1,
    tab2: 2,
    tab3: 3,
  }), []); // Empty dependency array means it's created once

  /** Gets the numerical layer ID corresponding to the currently active tab. */
  const getActiveLayerId = useCallback(() => {
    return tabToLayer[activeLayerTab] || 1; // Default to layer 1 if tab mapping is missing
  }, [activeLayerTab, tabToLayer]);

  return {
    activePanel,
    tokenSelectorOpen,
    activeLayerTab,
    setActiveLayerTab,
    togglePanel,
    openPanel,
    closePanel,
    isPanelActive,
    getActiveLayerId,
    tabToLayer,
  };
}