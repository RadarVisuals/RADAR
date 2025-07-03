// src/context/VisualConfigContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
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
  getLiveConfig: () => ({
    layerConfigs: getDefaultLayerConfigs(),
    tokenAssignments: {},
  }),
};

const VisualConfigContext = createContext(defaultVisualConfigContextValue);

export const VisualConfigProvider = ({ children }) => {
  const { setHasPendingChanges } = usePresetManagement();

  const [layerConfigs, setLayerConfigsInternal] = useState(getDefaultLayerConfigs);
  const [tokenAssignments, setTokenAssignmentsInternal] = useState({});
  
  const liveStateRef = useRef({ layerConfigs, tokenAssignments });

  // Update ref whenever state changes
  useEffect(() => {
    liveStateRef.current = { layerConfigs, tokenAssignments };
  }, [layerConfigs, tokenAssignments]);

  const updateLayerConfig = useCallback(
    (layerId, key, value) => {
      setLayerConfigsInternal(prevConfigs => {
        const newConfigs = {
          ...prevConfigs,
          [String(layerId)]: {
            ...(prevConfigs[String(layerId)] || getDefaultLayerConfigTemplate()),
            [key]: value,
          },
        };
        
        // Update ref immediately with the new value
        liveStateRef.current = {
          ...liveStateRef.current,
          layerConfigs: newConfigs
        };
        
        console.log(`%c[VisualConfigContext] updateLayerConfig called for L${layerId}, key: ${key}. Ref is now:`, "color: orange;", JSON.parse(JSON.stringify(liveStateRef.current)));
        
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
      setTokenAssignmentsInternal(prevAssignments => {
        const newAssignments = {
          ...prevAssignments,
          [String(layerId)]: tokenId,
        };
        
        // Update ref immediately with the new value
        liveStateRef.current = {
          ...liveStateRef.current,
          tokenAssignments: newAssignments
        };

        console.log(`%c[VisualConfigContext] updateTokenAssignment called for L${layerId}. Ref is now:`, "color: magenta; font-weight: bold;", JSON.parse(JSON.stringify(liveStateRef.current)));

        return newAssignments;
      });

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
      
      // Update ref immediately
      liveStateRef.current = {
        layerConfigs: finalLayerConfigs,
        tokenAssignments: finalTokenAssignments,
      };

      console.log(`%c[VisualConfigContext] setLiveConfig called. Ref has been reset to:`, "color: blue; font-weight: bold;", JSON.parse(JSON.stringify(liveStateRef.current)));

      if (setHasPendingChanges) {
        setHasPendingChanges(false);
      }
    },
    [setHasPendingChanges]
  );

  const getLiveConfig = useCallback(() => {
    // Always return the current ref value which is kept in sync
    console.log(`%c[VisualConfigContext] getLiveConfig called. Returning ref:`, "color: cyan;", JSON.parse(JSON.stringify(liveStateRef.current)));
    return {
      layerConfigs: { ...liveStateRef.current.layerConfigs },
      tokenAssignments: { ...liveStateRef.current.tokenAssignments }
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      layerConfigs,
      tokenAssignments,
      updateLayerConfig,
      updateTokenAssignment,
      setLiveConfig,
      getLiveConfig,
    }),
    [
      layerConfigs,
      tokenAssignments,
      updateLayerConfig,
      updateTokenAssignment,
      setLiveConfig,
      getLiveConfig,
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