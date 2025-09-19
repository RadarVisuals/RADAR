// src/hooks/useUIState.js
import { useState, useCallback, useMemo } from 'react';

import { usePanelState } from './usePanelState'; // Local hook

/**
 * @typedef {object} UIState
 * @property {boolean} isUiVisible - Whether the main UI elements (toolbars, panels) are visible.
 * @property {boolean} infoOverlayOpen - Whether the informational overlay is currently open.
 * @property {boolean} whitelistPanelOpen - Whether the whitelist management panel is currently open.
 * @property {string|null} activePanel - The identifier of the currently open side panel (e.g., 'controls', 'notifications'), or null if none are open. Managed by the integrated `usePanelState`.
 * @property {string|null} animatingPanel - The identifier of the panel currently undergoing an open/close animation (e.g., 'controls', 'closing'), or null. Managed by the integrated `usePanelState`.
 * @property {string} activeLayerTab - The identifier of the active layer control tab (e.g., 'tab1').
 * @property {() => void} toggleUiVisibility - Function to toggle the visibility of the main UI elements.
 * @property {() => void} toggleInfoOverlay - Function to toggle the visibility of the informational overlay.
 * @property {() => void} toggleWhitelistPanel - Function to toggle the visibility of the whitelist panel.
 * @property {(panelName: string) => void} openPanel - Function to open a specific side panel by its identifier. This is sourced from `usePanelState`.
 * @property {() => void} closePanel - Function to close the currently active side panel. This is sourced from `usePanelState`.
 * @property {(panelName: string) => void} toggleSidePanel - Function to toggle a specific side panel's visibility. This is sourced from `usePanelState`.
 * @property {React.Dispatch<React.SetStateAction<string>>} setActiveLayerTab - Function to directly set the active layer control tab identifier.
 * @property {() => number} getActiveLayerId - Function to get the numerical layer ID corresponding to the `activeLayerTab`.
 */

export function useUIState(initialLayerTab = 'tab1') {
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [infoOverlayOpen, setInfoOverlayOpen] = useState(false);
  const [whitelistPanelOpen, setWhitelistPanelOpen] = useState(false);
  
  const {
    activePanel,
    animatingPanel,
    openPanel,
    closePanel,
    togglePanel: toggleSidePanel,
    activeLayerTab,
    setActiveLayerTab,
    getActiveLayerId
  } = usePanelState(null, initialLayerTab);

  const toggleUiVisibility = useCallback(() => {
    setIsUiVisible((prev) => !prev);
  }, []);

  const toggleInfoOverlay = useCallback(() => {
    setInfoOverlayOpen((prev) => !prev);
  }, []);
  
  const toggleWhitelistPanel = useCallback(() => {
    toggleSidePanel('whitelist');
  }, [toggleSidePanel]);

  return useMemo(() => ({
    isUiVisible,
    infoOverlayOpen,
    whitelistPanelOpen,
    activePanel,
    animatingPanel,
    activeLayerTab,
    toggleUiVisibility,
    toggleInfoOverlay,
    toggleWhitelistPanel,
    openPanel,
    closePanel,
    toggleSidePanel,
    setActiveLayerTab,
    getActiveLayerId,
  }), [
    isUiVisible, infoOverlayOpen, whitelistPanelOpen,
    activePanel, animatingPanel, activeLayerTab,
    toggleUiVisibility, toggleInfoOverlay, toggleWhitelistPanel,
    openPanel, closePanel, toggleSidePanel, setActiveLayerTab,
    getActiveLayerId,
  ]);
}