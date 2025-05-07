// src/context/ConfigContext.jsx (Cleaned)
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import useConfigState from "../hooks/useConfigState";
import { useUpProvider } from "./UpProvider";
import { USER_ROLES } from "../config/global-config";

// Default context value structure
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
  userRole: USER_ROLES.VISITOR,
  isParentAdmin: false,
  isProfileOwner: false,
  isVisitor: true,
  isParentProfile: false,
  currentProfileAddress: null,
  currentConfigName: null,
  isPreviewMode: false,
  isPureVisitorMode: false,
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
  togglePureVisitorMode: () => {},
  upInitializationError: null,
  upFetchStateError: null,
  loadError: null,
  saveError: null,
  isSaving: false,
  saveSuccess: false,
  savedConfigList: [],
  configServiceRef: { current: null },
};

const ConfigContext = createContext(defaultConfigContext);

/**
 * ConfigProvider: Manages and provides application configuration state,
 * including layer settings, token assignments, reactions, MIDI maps,
 * user roles, permissions, and interaction modes (preview, pure visitor).
 * It integrates with UpProvider to determine user context and uses
 * useConfigState hook for managing persistent configuration data.
 */
export const ConfigProvider = ({ children }) => {
  const {
    contextAccounts,
    accounts,
    initializationError: upInitializationError,
    fetchStateError: upFetchStateError,
  } = useUpProvider();

  const [userRole, setUserRole] = useState(USER_ROLES.VISITOR);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isPureVisitorMode, setIsPureVisitorMode] = useState(false);
  const [pureModeFromUrl, setPureModeFromUrl] = useState(false);

  const profileAddress = useMemo(
    () =>
      contextAccounts && contextAccounts.length > 0 ? contextAccounts[0] : null,
    [contextAccounts],
  );
  const profileAddressLower = useMemo(
    () => profileAddress?.toLowerCase(),
    [profileAddress],
  );

  const isParentProfile = false;

  const configState = useConfigState(profileAddress);
  const {
    loadDefaultConfig, midiMap, updateMidiMap,
    hasPendingChanges, setHasPendingChanges, isLoading: isConfigLoading,
    configLoadNonce, isInitiallyResolved, layerConfigs, tokenAssignments,
    savedReactions, saveVisualPreset, saveGlobalReactions, saveGlobalMidiMap,
    loadNamedConfig, loadSavedConfigList, deleteNamedConfig, updateLayerConfig,
    updateTokenAssignment, updateSavedReaction, deleteSavedReaction, loadError,
    saveError, isSaving, saveSuccess, savedConfigList, configServiceRef,
    currentConfigName,
  } = configState;

  // Determine user role based on connected accounts and viewed profile
  useEffect(() => {
    if (upInitializationError || upFetchStateError) {
      setUserRole(USER_ROLES.VISITOR); return;
    }
    if (!accounts || accounts.length === 0) {
      setUserRole(USER_ROLES.VISITOR); return;
    }
    const userAddressLower = accounts[0]?.toLowerCase();
    if (!userAddressLower) {
      setUserRole(USER_ROLES.VISITOR); return;
    }
    if (profileAddressLower && userAddressLower === profileAddressLower) {
      setUserRole(USER_ROLES.PROFILE_OWNER);
    } else {
      setUserRole(USER_ROLES.VISITOR);
    }
  }, [accounts, profileAddressLower, upInitializationError, upFetchStateError]);

  // Handle pure visitor mode based on URL parameter or user role
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isPureFromUrl = urlParams.get("pure") === "true";
    if (isPureFromUrl) {
      setPureModeFromUrl(true);
      setIsPureVisitorMode(true);
    }
  }, []);

  useEffect(() => {
    const shouldBeAutoPureVisitor = userRole === USER_ROLES.VISITOR && !isParentProfile;
    if (!pureModeFromUrl) {
      setIsPureVisitorMode(shouldBeAutoPureVisitor);
    }
  }, [userRole, isParentProfile, pureModeFromUrl]);

  const togglePureVisitorMode = useCallback(() => {
    if (pureModeFromUrl) return;
    setIsPureVisitorMode((prev) => !prev);
  }, [pureModeFromUrl]);

  // Callback to toggle preview mode (loads default config on enter)
  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode((prevIsPreview) => {
      const enteringPreview = !prevIsPreview;
      if (enteringPreview) {
        if (loadDefaultConfig) {
          loadDefaultConfig().catch((err) => console.error("Error loading default config on preview enter:", err)); // Keep Error
        } else {
          console.error("loadDefaultConfig function not available in ConfigContext."); // Keep Error
        }
      }
      return enteringPreview;
    });
  }, [loadDefaultConfig]);

  // Derived flags and permissions
  const isParentAdmin = false;
  const isProfileOwner = userRole === USER_ROLES.PROFILE_OWNER;
  const isVisitor = userRole === USER_ROLES.VISITOR;
  const canSave = useMemo(
    () => isProfileOwner && !isPreviewMode && !isPureVisitorMode,
    [isProfileOwner, isPreviewMode, isPureVisitorMode],
  );

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      isConfigLoading, configLoadNonce, isInitiallyResolved,
      hasPendingChanges, setHasPendingChanges, layerConfigs, tokenAssignments,
      savedReactions, midiMap, updateMidiMap, saveVisualPreset,
      saveGlobalReactions, saveGlobalMidiMap, loadNamedConfig, loadDefaultConfig,
      loadSavedConfigList, deleteNamedConfig, updateLayerConfig, updateTokenAssignment,
      updateSavedReaction, deleteSavedReaction, loadError, saveError, isSaving,
      saveSuccess, savedConfigList, configServiceRef, currentConfigName,
      userRole, isParentAdmin, isProfileOwner, isVisitor, isParentProfile,
      currentProfileAddress: profileAddress,
      isPreviewMode, isPureVisitorMode,
      canSave,
      togglePreviewMode, togglePureVisitorMode,
      upInitializationError, upFetchStateError,
    }),
    [
      isConfigLoading, configLoadNonce, isInitiallyResolved,
      hasPendingChanges, setHasPendingChanges, layerConfigs, tokenAssignments,
      savedReactions, midiMap, updateMidiMap, saveVisualPreset,
      saveGlobalReactions, saveGlobalMidiMap, loadNamedConfig, loadDefaultConfig,
      loadSavedConfigList, deleteNamedConfig, updateLayerConfig, updateTokenAssignment,
      updateSavedReaction, deleteSavedReaction, loadError, saveError, isSaving,
      saveSuccess, savedConfigList, configServiceRef, currentConfigName,
      userRole, isParentAdmin, isProfileOwner, isVisitor, isParentProfile,
      profileAddress, isPreviewMode, isPureVisitorMode, canSave, togglePreviewMode,
      togglePureVisitorMode, upInitializationError, upFetchStateError,
    ],
  );

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
};

/**
 * Hook to consume the ConfigContext.
 * Provides access to configuration state, user roles, permissions,
 * and functions to interact with the configuration service.
 * Throws an error if used outside of a ConfigProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === null || context === defaultConfigContext) {
    console.error("useConfig context details:", context); // Keep Error
    throw new Error(
      "useConfig must be used within a ConfigProvider component. Context is null or still default.",
    );
  }
  return context;
};