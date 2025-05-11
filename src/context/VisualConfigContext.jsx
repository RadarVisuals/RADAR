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
  import { useConfig } from "./ConfigContext"; 
  import { usePresetManagement } from "./PresetManagementContext"; 
  
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
      phase: Math.random() * Math.PI * 2,
      enabled: false,
    },
  });
  
  const getDefaultLayerConfigs = () => ({
    1: getDefaultLayerConfigTemplate(),
    2: getDefaultLayerConfigTemplate(),
    3: getDefaultLayerConfigTemplate(),
  });
  
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
  
  export const VisualConfigProvider = ({ children }) => {
    const { setHasPendingChanges: setGlobalHasPendingChanges } = useConfig(); 
    const {
      configLoadNonce,
      loadedLayerConfigsFromPreset,
      loadedTokenAssignmentsFromPreset,
    } = usePresetManagement(); 
  
    const [layerConfigs, setLayerConfigsInternal] = useState(() => {
      // Initialize with data from PresetManagement if available on first render
      return loadedLayerConfigsFromPreset || getDefaultLayerConfigs();
    });
  
    const [tokenAssignments, setTokenAssignmentsInternal] = useState(() => {
      // Initialize with data from PresetManagement if available on first render
      return loadedTokenAssignmentsFromPreset || {};
    });
  
    useEffect(() => {
      console.log(`[VisualConfigContext useEffect] Running. Nonce: ${configLoadNonce}.`);
      console.log(`[VisualConfigContext useEffect] Received loadedLayerConfigsFromPreset:`, loadedLayerConfigsFromPreset ? JSON.parse(JSON.stringify(loadedLayerConfigsFromPreset)) : null);
      console.log(`[VisualConfigContext useEffect] Received loadedTokenAssignmentsFromPreset:`, loadedTokenAssignmentsFromPreset ? JSON.parse(JSON.stringify(loadedTokenAssignmentsFromPreset)) : null);

      if (loadedLayerConfigsFromPreset) {
        console.log("[VisualConfigContext useEffect] Setting layerConfigs from preset.");
        setLayerConfigsInternal(loadedLayerConfigsFromPreset);
      } else {
        console.log("[VisualConfigContext useEffect] No loadedLayerConfigsFromPreset, setting to default layers.");
        setLayerConfigsInternal(getDefaultLayerConfigs());
      }
  
      if (loadedTokenAssignmentsFromPreset) {
        console.log("[VisualConfigContext useEffect] Setting tokenAssignments from preset.");
        setTokenAssignmentsInternal(loadedTokenAssignmentsFromPreset);
      } else {
        console.log("[VisualConfigContext useEffect] No loadedTokenAssignmentsFromPreset, setting to {}.");
        setTokenAssignmentsInternal({});
      }
    }, [
      configLoadNonce, // This is the primary trigger
      loadedLayerConfigsFromPreset, // Dependency to get the latest value
      loadedTokenAssignmentsFromPreset, // Dependency to get the latest value
    ]);
  
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
  
  export const useVisualConfig = () => {
    const context = useContext(VisualConfigContext);
    if (context === undefined) {
      throw new Error(
        "useVisualConfig must be used within a VisualConfigProvider",
      );
    }
    return context;
  };