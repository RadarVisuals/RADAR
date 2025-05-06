import { useState, useCallback, useEffect } from "react";

/**
 * Manages the state related to UI panels and layer tabs. It tracks which
 * panel (if any) is currently active, whether the dedicated token selector
 * overlay should be open (specifically when the 'tokens' panel is active),
 * and which layer tab (e.g., for layer controls) is currently selected.
 * Provides functions to toggle/open/close panels and check panel status.
 *
 * @param {string|null} [initialPanel=null] - The identifier of the panel to be initially active.
 * @param {string} [initialLayerTab='tab1'] - The identifier of the initially active layer tab.
 * @returns {{
 *   activePanel: string | null,
 *   tokenSelectorOpen: boolean,
 *   activeLayerTab: string,
 *   setActiveLayerTab: React.Dispatch<React.SetStateAction<string>>,
 *   togglePanel: (panelName: string | null) => void,
 *   openPanel: (panelName: string) => void,
 *   closePanel: () => void,
 *   isPanelActive: (panelName: string) => boolean,
 *   getActiveLayerId: () => number,
 *   tabToLayer: { [key: string]: number }
 * }} An object containing the panel and tab state, along with functions to manage them.
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
      // Normalize potential null string values
      const cleanPanel = panelName === "null" ? null : panelName;
      setActivePanel((current) => (current === cleanPanel ? null : cleanPanel));
    },
    [], // No dependencies needed as it uses the functional update form of setActivePanel
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

  /** Mapping from tab identifiers to layer IDs (e.g., 'tab1' -> layer 1). */
  const tabToLayer = {
    tab1: 1,
    tab2: 2,
    tab3: 3,
  };

  /** Gets the numerical layer ID corresponding to the currently active tab. */
  const getActiveLayerId = useCallback(() => {
    return tabToLayer[activeLayerTab] || 1; // Default to layer 1 if tab mapping is missing
  }, [activeLayerTab]); // Added tabToLayer to dependency array for correctness, though it's constant

  return {
    activePanel,
    tokenSelectorOpen,
    activeLayerTab,
    setActiveLayerTab, // Expose direct setter for flexibility
    togglePanel,
    openPanel,
    closePanel,
    isPanelActive,
    getActiveLayerId,
    tabToLayer, // Expose the map for potential external use
  };
}