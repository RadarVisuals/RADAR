import React, {
  createContext,
  useContext,
  useState,
  useEffect, // Keep useEffect
  useCallback,
  useMemo,
} from "react";
import PropTypes from "prop-types";
import useConfigState from "../hooks/useConfigState";
import { useUpProvider } from "./UpProvider";
import { isAddress } from "viem";

// Define the default shape and values for the context
const defaultConfigContext = {
  isConfigLoading: true,
  configLoadNonce: 0,
  isInitiallyResolved: false,
  hasPendingChanges: false,
  setHasPendingChanges: () => {},
  layerConfigs: {},
  tokenAssignments: {},
  savedReactions: {},
  midiMap: {},
  updateMidiMap: () => {},
  isParentAdmin: false,
  isProfileOwner: false,
  isVisitor: true,
  isParentProfile: false,
  currentProfileAddress: null,
  visitorUPAddress: null,
  currentConfigName: null,
  isPreviewMode: false,
  canSave: false,
  saveVisualPreset: async () => ({ success: false, error: "Provider not initialized" }),
  saveGlobalReactions: async () => ({ success: false, error: "Provider not initialized" }),
  saveGlobalMidiMap: async () => ({ success: false, error: "Provider not initialized" }),
  loadNamedConfig: async () => ({ success: false, error: "Provider not initialized" }),
  loadDefaultConfig: async () => ({ success: false, error: "Provider not initialized" }),
  loadSavedConfigList: async () => ({ success: false, error: "Provider not initialized" }),
  deleteNamedConfig: async () => ({ success: false, error: "Provider not initialized" }),
  updateLayerConfig: () => {},
  updateTokenAssignment: () => {},
  updateSavedReaction: () => {},
  deleteSavedReaction: () => {},
  togglePreviewMode: () => {},
  upInitializationError: null,
  upFetchStateError: null,
  loadError: null,
  saveError: null,
  isSaving: false,
  saveSuccess: false,
  savedConfigList: [],
  configServiceRef: { current: null },
  configServiceInstanceReady: false,
};

const ConfigContext = createContext(defaultConfigContext);

/**
 * Provides the configuration state and management functions to the application tree.
 * Determines user roles (owner, visitor) based on connected accounts and the profile being viewed.
 * Manages preview mode state.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components to wrap with the provider.
 */
export const ConfigProvider = ({ children }) => {
  const {
    accounts,
    contextAccounts,
    initializationError: upInitializationError,
    fetchStateError: upFetchStateError,
  } = useUpProvider();

  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Determine Addresses
  const currentProfileAddress = useMemo(() => {
    const addr = contextAccounts && contextAccounts.length > 0 && isAddress(contextAccounts[0]) ? contextAccounts[0] : null;
    return addr;
  }, [contextAccounts]);

  const visitorUPAddress = useMemo(() => {
    const addr = accounts && accounts.length > 0 && isAddress(accounts[0]) ? accounts[0] : null;
    return addr;
  }, [accounts]);

  // Determine User Roles
  const currentProfileAddressLower = useMemo(() => currentProfileAddress?.toLowerCase(), [currentProfileAddress]);
  const visitorUPAddressLower = useMemo(() => visitorUPAddress?.toLowerCase(), [visitorUPAddress]);
  const isProfileOwner = useMemo(() => {
      return !!visitorUPAddressLower && !!currentProfileAddressLower && visitorUPAddressLower === currentProfileAddressLower;
  }, [visitorUPAddressLower, currentProfileAddressLower]);
  const isVisitor = !isProfileOwner;
  const isParentProfile = false; // Placeholder

  // Initialize Core Config State
  const configState = useConfigState(currentProfileAddress);
  // Destructure loadDefaultConfig here for use in the effect
  const { loadDefaultConfig } = configState;

  // Toggle Preview Mode State
  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode((prevIsPreview) => !prevIsPreview);
  }, []); // Stable: only uses setter

  // Effect to load default config when entering preview mode
  useEffect(() => {
    // Only trigger if entering preview mode
    if (isPreviewMode) {
      // Check if loadDefaultConfig is available *on the current configState*
      if (configState.loadDefaultConfig && typeof configState.loadDefaultConfig === 'function') {
        configState.loadDefaultConfig().catch((err) => console.error("Error loading default config on preview enter:", err));
      } else {
        // This might happen on the very first render if configState isn't fully ready
        console.warn("loadDefaultConfig not available when trying to load on preview enter (inside effect).");
      }
    }
    // --- UPDATED DEPENDENCIES ---
    // Depend on isPreviewMode to trigger the check, and configState to ensure
    // we have the latest function references from the hook.
  }, [isPreviewMode, configState]);
  // -----------------------------

  // --- Derived Flags ---
  const isParentAdmin = false; // Placeholder
  const canSave = useMemo(
    () => isProfileOwner && !isPreviewMode,
    [isProfileOwner, isPreviewMode],
  );

  // --- Build Context Value ---
  const contextValue = useMemo(
    () => ({
      // Values directly from configState hook
      ...configState,

      // Values derived or managed within ConfigProvider
      isParentAdmin,
      isProfileOwner,
      isVisitor,
      isParentProfile,
      currentProfileAddress,
      visitorUPAddress,
      isPreviewMode,
      canSave,
      togglePreviewMode, // Include the stable toggle function
      upInitializationError,
      upFetchStateError,
    }),
    [
      configState, // Primary dependency
      isParentAdmin, isProfileOwner, isVisitor, isParentProfile,
      currentProfileAddress, visitorUPAddress,
      isPreviewMode, canSave,
      togglePreviewMode, // Stable callback
      upInitializationError, upFetchStateError,
    ]
  );

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
};

ConfigProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

/**
 * Custom hook to easily consume the ConfigContext.
 * Throws an error if used outside of a ConfigProvider.
 * @returns {object} The configuration context value.
 */
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined || context === defaultConfigContext) {
    const err = new Error("useConfig must be used within a ConfigProvider component.");
    console.error("useConfig context details:", context, err.stack);
    throw err;
  }
  return context;
};