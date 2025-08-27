import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import PropTypes from "prop-types";
import { usePresetManagement } from "./PresetManagementContext";

const getDefaultLayerConfigTemplate = () => ({
  enabled: true, blendMode: "normal", opacity: 1.0, size: 1.0, speed: 0.01, drift: 0,
  driftSpeed: 0.1, angle: 0, xaxis: 0, yaxis: 0, direction: 1,
  driftState: { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false },
});

const getDefaultLayerConfigs = () => ({
  "1": getDefaultLayerConfigTemplate(),
  "2": getDefaultLayerConfigTemplate(),
  "3": getDefaultLayerConfigTemplate(),
});

export const defaultVisualConfigContextValue = {
  layerConfigs: getDefaultLayerConfigs(),
  tokenAssignments: {},
  updateLayerConfig: () => {},
  updateTokenAssignment: () => {},
  setLiveConfig: () => {},
};

const VisualConfigContext = createContext(defaultVisualConfigContextValue);

export const VisualConfigProvider = ({ children }) => {
  const { setHasPendingChanges } = usePresetManagement();

  const [layerConfigs, setLayerConfigsInternal] = useState(getDefaultLayerConfigs);
  const [tokenAssignments, setTokenAssignmentsInternal] = useState({});

  const updateLayerConfig = useCallback(
    (layerId, key, value) => {
      setLayerConfigsInternal(prevConfigs => ({
        ...prevConfigs,
        [String(layerId)]: {
          ...(prevConfigs[String(layerId)] || getDefaultLayerConfigTemplate()),
          [key]: value,
        },
      }));
      
      if (setHasPendingChanges) {
        setHasPendingChanges(true);
      }
    },
    [setHasPendingChanges]
  );

  const updateTokenAssignment = useCallback(
    (layerId, tokenId) => {
      setTokenAssignmentsInternal(prevAssignments => ({
        ...prevAssignments,
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
      const finalLayerConfigs = newLayerConfigs || getDefaultLayerConfigs();
      const finalTokenAssignments = newTokenAssignments || {};
      
      setLayerConfigsInternal(finalLayerConfigs);
      setTokenAssignmentsInternal(finalTokenAssignments);
      
      if (setHasPendingChanges) {
        setHasPendingChanges(false);
      }
    },
    [setHasPendingChanges]
  );

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