// src/context/VisualConfigContext.jsx
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
  } from "react";
  import PropTypes from "prop-types";
  import { useConfig } from "./ConfigContext"; // To listen for preset loads
  
  /**
   * Generates a default configuration template for a single layer.
   * This function is used to ensure that layer configurations always have a complete set of properties.
   * @returns {object} Default layer configuration.
   */
  const getDefaultLayerConfigTemplate = () => ({
    enabled: true,
    blendMode: "normal",
    opacity: 1.0,
    size: 1.0,
    speed: 0.01,
    drift: 0,
    driftSpeed: 0.1,
    angle: 0,
    xaxis: 0,
    yaxis: 0,
    direction: 1,
    driftState: {
      x: 0,
      y: 0,
      phase: Math.random() * Math.PI * 2, // Random initial phase for drift
      enabled: false, // Drift is disabled by default if drift amount is 0
    },
  });
  
  /**
   * Generates the default structure for all layer configurations.
   * Used as the initial state or when no preset data is available.
   * @returns {object} Object with default configurations for layers '1', '2', '3'.
   */
  const getDefaultLayerConfigs = () => ({
    1: getDefaultLayerConfigTemplate(),
    2: getDefaultLayerConfigTemplate(),
    3: getDefaultLayerConfigTemplate(),
  });
  
  /**
   * @typedef {object} VisualConfigContextValue
   * @property {object} layerConfigs - Current configurations for visual layers (e.g., size, speed, opacity for layers '1', '2', '3').
   * @property {object} tokenAssignments - Current mapping of layer IDs ('1', '2', '3') to token identifiers (e.g., asset addresses, demo token keys).
   * @property {(layerId: string | number, key: string, value: any) => void} updateLayerConfig - Function to update a specific property (key) of a given layer's (layerId) configuration with a new value.
   * @property {(layerId: string | number, tokenId: string | object | null) => void} updateTokenAssignment - Function to update the token assigned to a specific layer (layerId). `tokenId` can be a string identifier or null to clear.
   */
  
  /**
   * Default values for `VisualConfigContext`.
   * Provides an initial state structure and stub functions.
   * @type {VisualConfigContextValue}
   */
  export const defaultVisualConfigContext = {
    layerConfigs: getDefaultLayerConfigs(),
    tokenAssignments: {},
    updateLayerConfig: () => {
      console.warn("VisualConfigContext: updateLayerConfig called on default context");
    },
    updateTokenAssignment: () => {
      console.warn("VisualConfigContext: updateTokenAssignment called on default context");
    },
  };
  
  const VisualConfigContext = createContext(defaultVisualConfigContext);
  
  /**
   * Provider component for managing the visual configuration state (layers and tokens).
   * It listens to `ConfigContext` for loaded preset data and updates its internal state accordingly.
   * It also signals pending changes to `ConfigContext` when its own state is modified.
   * @param {object} props
   * @param {React.ReactNode} props.children - Child components.
   * @returns {JSX.Element} The `VisualConfigProvider` component.
   */
  export const VisualConfigProvider = ({ children }) => {
    const {
      configLoadNonce,
      loadedLayerConfigsFromPreset,
      loadedTokenAssignmentsFromPreset,
      setHasPendingChanges: setGlobalHasPendingChanges,
    } = useConfig();
  
    // Initialize state, attempting to use loaded preset data if available on mount,
    // otherwise falling back to defaults.
    const [layerConfigs, setLayerConfigsInternal] = useState(() => {
      return loadedLayerConfigsFromPreset || getDefaultLayerConfigs();
    });
  
    const [tokenAssignments, setTokenAssignmentsInternal] = useState(() => {
      return loadedTokenAssignmentsFromPreset || {};
    });
  
    // Effect to synchronize with loaded preset data from ConfigContext
    useEffect(() => {
      // This effect runs when a preset is loaded (indicated by configLoadNonce change)
      // or when the component mounts and ConfigContext provides initial preset data.
      if (loadedLayerConfigsFromPreset) {
        setLayerConfigsInternal(loadedLayerConfigsFromPreset);
      } else {
        // Fallback to default if no preset layers are provided (e.g., initial state or error)
        setLayerConfigsInternal(getDefaultLayerConfigs());
      }
  
      if (loadedTokenAssignmentsFromPreset) {
        setTokenAssignmentsInternal(loadedTokenAssignmentsFromPreset);
      } else {
        // Fallback to empty assignments if no preset tokens are provided
        setTokenAssignmentsInternal({});
      }
      // When a preset is loaded, any pending changes specific to visual config are effectively cleared
      // because the state is reset to the loaded preset's state.
      // The global `hasPendingChanges` flag in ConfigContext is reset by its own logic upon successful load.
    }, [
      configLoadNonce,
      loadedLayerConfigsFromPreset,
      loadedTokenAssignmentsFromPreset,
    ]);
  
    /**
     * Updates a specific property of a layer's configuration.
     * Also signals to `ConfigContext` that there are pending (unsaved) changes.
     */
    const updateLayerConfig = useCallback(
      (layerId, key, value) => {
        setLayerConfigsInternal((prevConfigs) => ({
          ...prevConfigs,
          [String(layerId)]: {
            ...(prevConfigs[String(layerId)] || getDefaultLayerConfigTemplate()),
            [key]: value,
          },
        }));
        if (setGlobalHasPendingChanges) {
          setGlobalHasPendingChanges(true);
        }
      },
      [setGlobalHasPendingChanges],
    );
  
    /**
     * Updates the token assigned to a specific layer.
     * Also signals to `ConfigContext` that there are pending (unsaved) changes.
     */
    const updateTokenAssignment = useCallback(
      (layerId, tokenId) => {
        setTokenAssignmentsInternal((prevAssignments) => ({
          ...prevAssignments,
          [String(layerId)]: tokenId,
        }));
        if (setGlobalHasPendingChanges) {
          setGlobalHasPendingChanges(true);
        }
      },
      [setGlobalHasPendingChanges],
    );
  
    const contextValue = useMemo(
      () => ({
        layerConfigs,
        tokenAssignments,
        updateLayerConfig,
        updateTokenAssignment,
      }),
      [layerConfigs, tokenAssignments, updateLayerConfig, updateTokenAssignment],
    );
  
    return (
      <VisualConfigContext.Provider value={contextValue}>
        {children}
      </VisualConfigContext.Provider>
    );
  };
  
  VisualConfigProvider.propTypes = {
    children: PropTypes.node.isRequired,
  };
  
  /**
   * Custom hook to consume the `VisualConfigContext`.
   * Provides access to `layerConfigs`, `tokenAssignments`, and their respective update functions.
   * @returns {VisualConfigContextValue} The visual configuration context value.
   * @throws {Error} If used outside of a `VisualConfigProvider`.
   */
  export const useVisualConfig = () => {
    const context = useContext(VisualConfigContext);
    if (context === undefined) {
      throw new Error(
        "useVisualConfig must be used within a VisualConfigProvider",
      );
    }
    return context;
  };