// src/hooks/useUIState.js
import { useState, useCallback, useMemo } from 'react';

import { usePanelManager } from './usePanelManager'; // Local hook

/**
 * @typedef {object} UIState
 * @property {boolean} isUiVisible - Whether the main UI elements (toolbars, panels) are visible.
 * @property {boolean} infoOverlayOpen - Whether the informational overlay is currently open.
 * @property {boolean} whitelistPanelOpen - Whether the whitelist management panel is currently open.
 * @property {string|null} activePanel - The identifier of the currently open side panel (e.g., 'controls', 'notifications'), or null if none are open. Managed by the integrated `usePanelManager`.
 * @property {string|null} animatingPanel - The identifier of the panel currently undergoing an open/close animation (e.g., 'controls', 'closing'), or null. Managed by the integrated `usePanelManager`.
 * @property {string} activeLayerTab - The identifier of the active layer control tab (e.g., 'tab1').
 * @property {() => void} toggleUiVisibility - Function to toggle the visibility of the main UI elements.
 * @property {() => void} toggleInfoOverlay - Function to toggle the visibility of the informational overlay.
 * @property {() => void} toggleWhitelistPanel - Function to toggle the visibility of the whitelist panel.
 * @property {(panelName: string) => void} openPanel - Function to open a specific side panel by its identifier. This is sourced from `usePanelManager`.
 * @property {() => void} closePanel - Function to close the currently active side panel. This is sourced from `usePanelManager`.
 * @property {(panelName: string) => void} toggleSidePanel - Function to toggle a specific side panel's visibility. This is sourced from `usePanelManager`.
 * @property {React.Dispatch<React.SetStateAction<string>>} setActiveLayerTab - Function to directly set the active layer control tab identifier.
 */

/**
 * Consolidates management of various UI states including overall UI visibility,
 * modal-like overlays (Info, Whitelist), side panel visibility and animations
 * (by integrating `usePanelManager`), and the currently selected layer tab for controls.
 *
 * @param {string} [initialLayerTab='tab1'] - The identifier for the layer tab that should be active initially.
 * @returns {UIState} An object containing the current UI state values and functions to modify them.
 */
export function useUIState(initialLayerTab = 'tab1') {
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [infoOverlayOpen, setInfoOverlayOpen] = useState(false);
  const [whitelistPanelOpen, setWhitelistPanelOpen] = useState(false);
  const [activeLayerTab, setActiveLayerTab] = useState(initialLayerTab);

  // Integrate usePanelManager for side panel state and animations
  const {
    activePanel,
    animatingPanel,
    openPanel,    // Renamed from openPanelInternal for clarity
    closePanel,   // Renamed from closePanelInternal for clarity
    togglePanel: toggleSidePanel // Renamed to avoid conflict if a general togglePanel was added here
  } = usePanelManager(null); // Start with no active panel

  /** Toggles the visibility of the main UI elements. */
  const toggleUiVisibility = useCallback(() => {
    setIsUiVisible((prev) => !prev);
  }, []); // setIsUiVisible is stable

  /** Toggles the visibility of the informational overlay. */
  const toggleInfoOverlay = useCallback(() => {
    setInfoOverlayOpen((prev) => !prev);
  }, []); // setInfoOverlayOpen is stable

  /** Toggles the visibility of the whitelist panel. */
  const toggleWhitelistPanel = useCallback(() => {
    setWhitelistPanelOpen((prev) => !prev);
  }, []); // setWhitelistPanelOpen is stable

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
    setActiveLayerTab, // Direct state setter from useState
  }), [
    isUiVisible, infoOverlayOpen, whitelistPanelOpen,
    activePanel, animatingPanel, activeLayerTab,
    toggleUiVisibility, toggleInfoOverlay, toggleWhitelistPanel,
    openPanel, closePanel, toggleSidePanel, setActiveLayerTab
  ]);
}