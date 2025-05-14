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

  import { useConfig } from "./ConfigContext"; // Local context
  import { usePresetManagement } from "./PresetManagementContext"; // Local context

  /**
   * @typedef {object} LayerDriftState
   * @property {number} x - Current x offset for drift.
   * @property {number} y - Current y offset for drift.
   * @property {number} phase - Current phase for drift calculation.
   * @property {boolean} enabled - Whether drift is currently active for this layer.
   */

  /**
   * @typedef {object} LayerConfig
   * @property {boolean} enabled - Whether the layer is enabled for rendering.
   * @property {string} blendMode - The CSS `mix-blend-mode` for the layer.
   * @property {number} opacity - The opacity of the layer (0.0 to 1.0).
   * @property {number} size - The size multiplier for the layer's visual content.
   * @property {number} speed - The speed of continuous rotation or other animations.
   * @property {number} drift - The magnitude of the drift effect.
   * @property {number} driftSpeed - The speed of the drift oscillation.
   * @property {number} angle - The base rotation angle of the layer in degrees.
   * @property {number} xaxis - The base X-axis offset for the layer.
   * @property {number} yaxis - The base Y-axis offset for the layer.
   * @property {number} direction - Direction multiplier for speed (-1 or 1).
   * @property {LayerDriftState} driftState - State object managing the drift effect's current position and phase.
   */

  /**
   * @typedef {Object.<string, LayerConfig>} AllLayerConfigs
   * An object where keys are layer IDs (e.g., "1", "2", "3") and values are `LayerConfig` objects.
   */

  /**
   * @typedef {Object.<string, string | object | null>} TokenAssignments
   * An object where keys are layer IDs and values are the assigned token identifiers or image URLs.
   * The value can be a string (e.g., token address, demo key, direct URL) or an object for more complex assignments.
   */

  /**
   * @typedef {object} VisualConfigContextValue
   * @property {AllLayerConfigs} layerConfigs - The current configurations for all visual layers.
   * @property {TokenAssignments} tokenAssignments - The current token/image assignments for all visual layers.
   * @property {(layerId: string | number, key: keyof LayerConfig, value: any) => void} updateLayerConfig - Function to update a specific property of a layer's configuration.
   * @property {(layerId: string | number, tokenId: string | object | null) => void} updateTokenAssignment - Function to update the token or image assigned to a specific layer.
   */


  /**
   * Returns a default template object for a single visual layer's configuration.
   * This ensures a consistent structure for all layers.
   * @returns {LayerConfig} The default layer configuration template.
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
      phase: Math.random() * Math.PI * 2, // Random initial phase for variety
      enabled: false,
    },
  });

  /**
   * Returns a default configuration object for all layers.
   * @returns {AllLayerConfigs} The default configurations for layers "1", "2", and "3".
   */
  const getDefaultLayerConfigs = () => ({
    "1": getDefaultLayerConfigTemplate(),
    "2": getDefaultLayerConfigTemplate(),
    "3": getDefaultLayerConfigTemplate(),
  });

  /**
   * Default values for the VisualConfigContext.
   * These are used if a component tries to consume the context without a `VisualConfigProvider`.
   * @type {VisualConfigContextValue}
   */
  export const defaultVisualConfigContextValue = { // Renamed for clarity
    layerConfigs: getDefaultLayerConfigs(),
    tokenAssignments: {},
    updateLayerConfig: (layerId, key, value) => {
      if (import.meta.env.DEV) {
        console.warn("VisualConfigContext: updateLayerConfig called on default context.", { layerId, key, value });
      }
    },
    updateTokenAssignment: (layerId, tokenId) => {
      if (import.meta.env.DEV) {
        console.warn("VisualConfigContext: updateTokenAssignment called on default context.", { layerId, tokenId });
      }
    },
  };

  const VisualConfigContext = createContext(defaultVisualConfigContextValue);

  /**
   * Provides context for managing the visual configurations of different layers
   * and their associated token/image assignments. It synchronizes its state with
   * loaded presets from `PresetManagementContext` and signals pending changes
   * to `ConfigContext`.
   *
   * @param {object} props - The component props.
   * @param {React.ReactNode} props.children - Child components that will consume this context.
   * @returns {JSX.Element} The VisualConfigProvider component.
   */
  export const VisualConfigProvider = ({ children }) => {
    const { setHasPendingChanges: setGlobalHasPendingChanges } = useConfig();
    const {
      configLoadNonce, // Used to detect when a new preset has been loaded
      loadedLayerConfigsFromPreset,
      loadedTokenAssignmentsFromPreset,
    } = usePresetManagement();

    /** @type {[AllLayerConfigs, React.Dispatch<React.SetStateAction<AllLayerConfigs>>]} */
    const [layerConfigs, setLayerConfigsInternal] = useState(() => {
      // Initialize with preset data if available, otherwise defaults
      return loadedLayerConfigsFromPreset || getDefaultLayerConfigs();
    });

    /** @type {[TokenAssignments, React.Dispatch<React.SetStateAction<TokenAssignments>>]} */
    const [tokenAssignments, setTokenAssignmentsInternal] = useState(() => {
      return loadedTokenAssignmentsFromPreset || {};
    });

    // Effect to synchronize with loaded preset data from PresetManagementContext
    useEffect(() => {
      if (import.meta.env.DEV) {
        // console.log(`[VisualConfigContext useEffect] Nonce: ${configLoadNonce}. Syncing with PresetManagement.`);
        // console.log(`[VisualConfigContext useEffect] Received loadedLayerConfigsFromPreset:`, loadedLayerConfigsFromPreset ? JSON.parse(JSON.stringify(loadedLayerConfigsFromPreset)) : null);
        // console.log(`[VisualConfigContext useEffect] Received loadedTokenAssignmentsFromPreset:`, loadedTokenAssignmentsFromPreset ? JSON.parse(JSON.stringify(loadedTokenAssignmentsFromPreset)) : null);
      }

      // When a new preset is loaded (indicated by configLoadNonce changing),
      // update the local layerConfigs and tokenAssignments.
      // The PresetManagementContext is responsible for ensuring loadedLayerConfigsFromPreset
      // has a complete structure for each layer.
      if (loadedLayerConfigsFromPreset) {
        if (import.meta.env.DEV) {
            // console.log("[VisualConfigContext useEffect] Setting layerConfigs from preset.");
        }
        setLayerConfigsInternal(loadedLayerConfigsFromPreset);
      } else {
        // This case might occur if PresetManagementContext resets to no loaded preset
        if (import.meta.env.DEV) {
            // console.log("[VisualConfigContext useEffect] No loadedLayerConfigsFromPreset, setting to default layers.");
        }
        setLayerConfigsInternal(getDefaultLayerConfigs());
      }

      if (loadedTokenAssignmentsFromPreset) {
        if (import.meta.env.DEV) {
            // console.log("[VisualConfigContext useEffect] Setting tokenAssignments from preset.");
        }
        setTokenAssignmentsInternal(loadedTokenAssignmentsFromPreset);
      } else {
        if (import.meta.env.DEV) {
            // console.log("[VisualConfigContext useEffect] No loadedTokenAssignmentsFromPreset, setting to {}.");
        }
        setTokenAssignmentsInternal({});
      }
      // configLoadNonce is the primary trigger for this effect.
      // loadedLayerConfigsFromPreset and loadedTokenAssignmentsFromPreset are data associated with that nonce.
    }, [
      configLoadNonce,
      loadedLayerConfigsFromPreset,
      loadedTokenAssignmentsFromPreset,
    ]);

    /**
     * Updates a specific property of a layer's configuration.
     * Also signals that there are pending global changes.
     * @param {string | number} layerId - The ID of the layer to update.
     * @param {keyof LayerConfig} key - The configuration key to update.
     * @param {any} value - The new value for the configuration property.
     */
    const updateLayerConfig = useCallback(
      (layerId, key, value) => {
        setLayerConfigsInternal((prevConfigs) => ({
          ...prevConfigs,
          [String(layerId)]: {
            ...(prevConfigs[String(layerId)] || getDefaultLayerConfigTemplate()), // Ensure layer exists
            [key]: value,
          },
        }));
        if (setGlobalHasPendingChanges) {
          setGlobalHasPendingChanges(true);
        }
      },
      [setGlobalHasPendingChanges], // setGlobalHasPendingChanges is from useConfig, assumed stable
    );

    /**
     * Updates the token or image assigned to a specific layer.
     * Also signals that there are pending global changes.
     * @param {string | number} layerId - The ID of the layer to update.
     * @param {string | object | null} tokenId - The new token identifier, image URL, or null to clear.
     */
    const updateTokenAssignment = useCallback(
      (layerId, tokenId) => {
        setTokenAssignmentsInternal((prevAssignments) => ({
          ...prevAssignments,
          [String(layerId)]: tokenId, // tokenId can be null to clear assignment
        }));
        if (setGlobalHasPendingChanges) {
          setGlobalHasPendingChanges(true);
        }
      },
      [setGlobalHasPendingChanges], // setGlobalHasPendingChanges is from useConfig, assumed stable
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
   * Provides access to the current layer configurations, token assignments,
   * and functions to update them.
   *
   * @returns {VisualConfigContextValue} The visual configuration context value.
   * @throws {Error} If used outside of a `VisualConfigProvider`.
   */
  export const useVisualConfig = () => {
    const context = useContext(VisualConfigContext);
    if (context === undefined) { // Standard check for missing provider
      const err = new Error(
        "useVisualConfig must be used within a VisualConfigProvider"
      );
      if (import.meta.env.DEV) {
        console.error("useVisualConfig context details: Attempted to use context but found undefined. This usually means VisualConfigProvider is missing as an ancestor.", err.stack);
      }
      throw err;
    }
    return context;
  };