// src/context/VisualConfigContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import PropTypes from "prop-types";
import { useSetManagement } from "./SetManagementContext";
// --- FIX START: Import fallback config for initial state ---
import fallbackConfig from "../config/fallback-config.js";

// This function now only provides a template for NEW layers, not for initial state.
const getDefaultLayerConfigTemplate = () => ({
  enabled: true, blendMode: "normal", opacity: 1.0, size: 1.0, speed: 0.01, drift: 0,
  driftSpeed: 0.1, angle: 0, xaxis: 0, yaxis: 0, direction: 1,
  driftState: { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false },
});

export const defaultVisualConfigContextValue = {
  layerConfigs: fallbackConfig.layers, // Use fallback for default
  tokenAssignments: fallbackConfig.tokenAssignments, // Use fallback for default
  updateLayerConfig: () => {},
  updateTokenAssignment: () => {},
  setLiveConfig: () => {},
};

const VisualConfigContext = createContext(defaultVisualConfigContextValue);

export const VisualConfigProvider = ({ children }) => {
  const { setHasPendingChanges } = useSetManagement();

  // --- FIX: Initialize state with fallbackConfig instead of null ---
  const [layerConfigs, setLayerConfigsInternal] = useState(fallbackConfig.layers);
  const [tokenAssignments, setTokenAssignmentsInternal] = useState(fallbackConfig.tokenAssignments);

  const updateLayerConfig = useCallback(
    (layerId, key, value) => {
      setLayerConfigsInternal(prevConfigs => {
        const newConfigs = prevConfigs ? JSON.parse(JSON.stringify(prevConfigs)) : {};
        if (!newConfigs[String(layerId)]) {
          newConfigs[String(layerId)] = getDefaultLayerConfigTemplate();
        }
        newConfigs[String(layerId)][key] = value;
        return newConfigs;
      });
      
      if (setHasPendingChanges) {
        setHasPendingChanges(true);
      }
    },
    [setHasPendingChanges]
  );

  const updateTokenAssignment = useCallback(
    (layerId, tokenId) => {
      setTokenAssignmentsInternal(prevAssignments => ({
        ...(prevAssignments || {}),
        [String(layerId)]: tokenId,
      }));

      if (setHasPendingChanges) {
        setHasPendingChanges(true);
      }
    },
    [setHasPendingChanges]
  );

  const setLiveConfig = useCallback(
    (newLayerConfigs, newTokenAssignments) => {
      // If null is passed (e.g., on disconnect), revert to fallback.
      const safeLayerConfigs = newLayerConfigs ? JSON.parse(JSON.stringify(newLayerConfigs)) : fallbackConfig.layers;
      const safeTokenAssignments = newTokenAssignments ? JSON.parse(JSON.stringify(newTokenAssignments)) : fallbackConfig.tokenAssignments;

      setLayerConfigsInternal(safeLayerConfigs);
      setTokenAssignmentsInternal(safeTokenAssignments);
      
      if (setHasPendingChanges) {
        setHasPendingChanges(false);
      }
    },
    [setHasPendingChanges]
  );
  // --- FIX END ---

  const contextValue = useMemo(
    () => ({
      layerConfigs,
      tokenAssignments,
      updateLayerConfig,
      updateTokenAssignment,
      setLiveConfig,
    }),
    [
      layerConfigs,
      tokenAssignments,
      updateLayerConfig,
      updateTokenAssignment,
      setLiveConfig,
    ]
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

export const useVisualConfig = () => {
  const context = useContext(VisualConfigContext);
  if (context === undefined) {
    throw new Error(
      "useVisualConfig must be used within a VisualConfigProvider"
    );
  }
  return context;
};