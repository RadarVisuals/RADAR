// src/context/ConfigContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import PropTypes from "prop-types";
import useConfigState from "../hooks/useConfigState"; // Assuming this hook is well-maintained
import { useUpProvider } from "./UpProvider";
import { isAddress } from "viem";

// Define the default shape and values for the context
// This helps with autocompletion and understanding the context structure.
const defaultConfigContext = {
  // --- Flags indicating loading/resolution states ---
  isConfigLoading: true, // True if any configuration aspect is currently being fetched/processed.
  isInitiallyResolved: false, // True once the very first attempt to load profile/fallback config is done.
  configServiceInstanceReady: false, // True if ConfigurationService is instantiated and has its clients.

  // --- Core Configuration Data ---
  layerConfigs: {}, // Holds the visual parameters for each layer {1: {...}, 2: {...}, 3: {...}}
  tokenAssignments: {}, // Maps layer IDs to assigned token identifiers or image URLs.
  savedReactions: {}, // Holds user-defined reactions to blockchain events.
  midiMap: {}, // Holds the user's global MIDI controller mappings.
  currentConfigName: null, // Name of the currently loaded visual preset (e.g., "RADAR.001", "Fallback").
  savedConfigList: [], // Array of {name: string} for saved visual presets.
  configLoadNonce: 0, // Increments each time a new configuration is successfully applied.

  // --- User & Profile Context ---
  currentProfileAddress: null, // Address of the Universal Profile being viewed/interacted with.
  visitorUPAddress: null, // Address of the visitor's Universal Profile (if connected).
  isProfileOwner: false, // True if visitorUPAddress matches currentProfileAddress.
  isVisitor: true, // True if not the profile owner.
  isParentAdmin: false, // Placeholder: True if currentProfileAddress is the app's admin.
  isParentProfile: false, // Placeholder: True if currentProfileAddress is the showcase/parent profile.

  // --- UI & Interaction State ---
  isPreviewMode: false, // True if the app is in a special preview/demo mode.
  canSave: false, // True if the current user has permissions to save changes to the currentProfileAddress.
  hasPendingChanges: false, // True if local configuration differs from the last saved state.

  // --- Action Stubs & Error/Status Flags ---
  upInitializationError: null, // Error from UpProvider initialization.
  upFetchStateError: null, // Error from UpProvider fetching its state.
  loadError: null, // Error from the last configuration load attempt.
  saveError: null, // Error from the last configuration save attempt.
  isSaving: false, // True if a save operation is in progress.
  saveSuccess: false, // True if the last save operation was successful.

  // --- Function Stubs (to be replaced by actual functions from useConfigState & ConfigProvider) ---
  setHasPendingChanges: () => {},
  updateMidiMap: () => {},
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
  configServiceRef: { current: null }, // Ref to the ConfigurationService instance.
};

const ConfigContext = createContext(defaultConfigContext);

/**
 * ConfigProvider component.
 * Provides configuration state and management functions to its children.
 * It determines user roles (owner, visitor), manages preview mode, and integrates
 * with `useUpProvider` for blockchain account information and `useConfigState`
 * for detailed configuration logic.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components that will consume the context.
 */
export const ConfigProvider = ({ children }) => {
  const {
    accounts,
    contextAccounts,
    initializationError: upInitializationError,
    fetchStateError: upFetchStateError,
  } = useUpProvider();

  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const currentProfileAddress = useMemo(() => {
    const addr = contextAccounts && contextAccounts.length > 0 && isAddress(contextAccounts[0]) ? contextAccounts[0] : null;
    return addr;
  }, [contextAccounts]);

  const visitorUPAddress = useMemo(() => {
    const addr = accounts && accounts.length > 0 && isAddress(accounts[0]) ? accounts[0] : null;
    return addr;
  }, [accounts]);

  const currentProfileAddressLower = useMemo(() => currentProfileAddress?.toLowerCase(), [currentProfileAddress]);
  const visitorUPAddressLower = useMemo(() => visitorUPAddress?.toLowerCase(), [visitorUPAddress]);

  const isProfileOwner = useMemo(() => {
      return !!visitorUPAddressLower && !!currentProfileAddressLower && visitorUPAddressLower === currentProfileAddressLower;
  }, [visitorUPAddressLower, currentProfileAddressLower]);

  const isVisitor = !isProfileOwner;
  const isParentProfile = false; // Placeholder, to be implemented if needed

  const configState = useConfigState(currentProfileAddress);
  const { loadDefaultConfig } = configState; // Destructure for use in useEffect

  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode((prevIsPreview) => !prevIsPreview);
  }, []);

  useEffect(() => {
    if (isPreviewMode) {
      // Use the destructured loadDefaultConfig directly
      if (loadDefaultConfig && typeof loadDefaultConfig === 'function') {
        loadDefaultConfig().catch((err) => console.error("Error loading default config on preview enter:", err));
      } else {
        console.warn("loadDefaultConfig not available when trying to load on preview enter (inside effect). This might happen if configState is not fully ready.");
      }
    }
  // --- MODIFIED: Only depend on isPreviewMode and loadDefaultConfig ---
  // configState is too broad and can cause unnecessary re-runs if other parts of it change.
  // loadDefaultConfig from useConfigState should be stable.
  }, [isPreviewMode, loadDefaultConfig]);
  // --- END MODIFICATION ---

  const isParentAdmin = false; // Placeholder, to be implemented if needed
  const canSave = useMemo(
    () => isProfileOwner && !isPreviewMode,
    [isProfileOwner, isPreviewMode],
  );

  const contextValue = useMemo(
    () => ({
      ...configState,
      isParentAdmin,
      isProfileOwner,
      isVisitor,
      isParentProfile,
      currentProfileAddress,
      visitorUPAddress,
      isPreviewMode,
      canSave,
      togglePreviewMode,
      upInitializationError,
      upFetchStateError,
    }),
    [
      configState,
      isParentAdmin, isProfileOwner, isVisitor, isParentProfile,
      currentProfileAddress, visitorUPAddress,
      isPreviewMode, canSave,
      togglePreviewMode,
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
 * Custom hook `useConfig` to consume `ConfigContext`.
 * Provides easy access to the application's configuration state and management functions.
 * It ensures that it's used within a `ConfigProvider` to prevent runtime errors.
 *
 * @returns {defaultConfigContext} The configuration context value, conforming to the defaultConfigContext shape.
 * @throws {Error} If used outside of a `ConfigProvider`.
 */
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) { // Standard check for context availability
    const err = new Error("useConfig must be used within a ConfigProvider component.");
    console.error("useConfig context details: Attempted to use context but found undefined.", err.stack);
    throw err;
  }
  return context;
};