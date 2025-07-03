// src/components/Panels/EnhancedSavePanel.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import { usePresetManagement } from "../../context/PresetManagementContext";
import { useUserSession } from "../../context/UserSessionContext";
import { useVisualConfig } from "../../context/VisualConfigContext";

import "./PanelStyles/EnhancedSavePanel.css";

const formatAddress = (address) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) return "N/A";
  if (address.length <= 11) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const EnhancedSavePanel = ({ onClose }) => {
  const { hostProfileAddress, isPreviewMode, isHostProfileOwner, canSaveToHostProfile } = useUserSession();
  const { getLiveConfig } = useVisualConfig();
  const {
    stagedWorkspace,
    savedConfigList,
    currentConfigName,
    saveWorkspace,
    loadNamedConfig,
    addNewPresetToStagedWorkspace,
    deletePresetFromStagedWorkspace,
    setDefaultPresetInStagedWorkspace,
    isLoading: isWorkspaceLoading,
    isSaving,
    hasPendingChanges,
  } = usePresetManagement();

  const [newPresetName, setNewPresetName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info");
  const statusTimerRef = useRef(null);
  const isMountedRef = useRef(false);
  const canSave = canSaveToHostProfile;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const displayStatus = useCallback((message, type = "success", duration = 4000) => {
    if (!isMountedRef.current) return;
    setStatusMessage(message);
    setStatusType(type);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    if (duration > 0) {
      statusTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setStatusMessage((prev) => (prev === message ? "" : prev));
      }, duration);
    }
  }, []);

  const handleCreatePreset = useCallback(() => {
    const name = newPresetName.trim();
    if (!name) {
      displayStatus("Preset name cannot be empty.", "warning");
      return;
    }
    if (savedConfigList.some(p => p.name === name)) {
      if (!window.confirm(`A preset named "${name}" already exists. Do you want to overwrite it?`)) {
        return;
      }
    }

    const { layerConfigs, tokenAssignments } = getLiveConfig();
    
    console.log(
      `%c[EnhancedSavePanel] handleCreatePreset CLICKED. Capturing state via getLiveConfig():`,
      "background: #222; color: #bada55",
      {
        name,
        layerConfigs: JSON.parse(JSON.stringify(layerConfigs)),
        tokenAssignments: JSON.parse(JSON.stringify(tokenAssignments)),
      }
    );

    const newPreset = { name, ts: Date.now(), layers: layerConfigs, tokenAssignments };
    addNewPresetToStagedWorkspace(name, newPreset);
    displayStatus(`Preset "${name}" created and staged for saving.`, "info");
    setNewPresetName("");
  }, [
    newPresetName,
    savedConfigList,
    getLiveConfig,
    addNewPresetToStagedWorkspace,
    displayStatus
  ]);

  const handleDeletePreset = useCallback((nameToDelete) => {
    if (!window.confirm(`Are you sure you want to delete the preset "${nameToDelete}"? This will be staged for the next save.`)) return;
    deletePresetFromStagedWorkspace(nameToDelete);
    displayStatus(`Preset "${nameToDelete}" was deleted. Save workspace to confirm.`, "info");
  }, [deletePresetFromStagedWorkspace, displayStatus]);

  const handleSetDefault = useCallback((nameToSetAsDefault) => {
    setDefaultPresetInStagedWorkspace(nameToSetAsDefault);
  }, [setDefaultPresetInStagedWorkspace]);

  const handleSaveWorkspace = useCallback(async () => {
    if (!canSave || isSaving) return;
    await saveWorkspace();
  }, [canSave, isSaving, saveWorkspace]);

  const handleLoad = useCallback(async (name) => {
    if (hasPendingChanges && canSave) {
      if (!window.confirm("You have unsaved changes that will be lost. Are you sure you want to load a different preset?")) {
        return;
      }
    }
    await loadNamedConfig(name);
    displayStatus(`Loaded preset "${name}".`, "success");
    onClose();
  }, [loadNamedConfig, onClose, hasPendingChanges, canSave, displayStatus]);

  const handleMintPreset = (presetName) => {
    console.log('Initiating mint process for preset:', presetName);
    alert(`The minting workflow for "${presetName}" is not yet implemented.`);
  };

  const getPanelTitle = () => {
    if (isPreviewMode) return "VISITOR PREVIEW";
    if (!hostProfileAddress) return "CONNECT PROFILE";
    if (canSave) return "WORKSPACE MANAGEMENT";
    return `VIEWING PROFILE (${formatAddress(hostProfileAddress)})`;
  };

  const renderStatusIndicator = () => {
    if (isSaving) return <div className="status-indicator saving">Saving Workspace...</div>;
    if (hasPendingChanges && canSave) return <div className="status-indicator pending">Unsaved changes</div>;
    if (!canSave && hostProfileAddress && !isPreviewMode) return <div className="status-indicator idle">Viewing mode. Changes are not saved.</div>;
    return <div className="status-indicator idle">Workspace is in sync</div>;
  };

  const isSaveDisabled = !hasPendingChanges || isSaving || !canSave || isWorkspaceLoading;
  const isCreateDisabled = isSaving || !canSave || !newPresetName.trim();
  const presets = savedConfigList;

  return (
    <Panel title={getPanelTitle()} onClose={onClose} className="panel-from-toolbar enhanced-save-panel">
      {statusMessage && <div className={`status-message ${statusType}`}>{statusMessage}</div>}
      {canSave && hostProfileAddress && (
        <>
          <div className="config-section save-workspace-section">
            {renderStatusIndicator()}
            <button className="btn btn-block btn-primary" onClick={handleSaveWorkspace} disabled={isSaveDisabled}>
              {isSaving ? "SAVING..." : "Save Workspace"}
            </button>
            <p className="form-help-text">
              Commit all staged changes (new presets, deletions, and default settings) to your profile.
            </p>
          </div>
          <div className="config-section">
            <h3>Create New Preset</h3>
            <div className="form-group">
              <label htmlFor="preset-name" className="sr-only">New Preset Name</label>
              <input id="preset-name" type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} className="form-control" placeholder="My Awesome Preset" disabled={isSaving || !canSave} maxLength={100} required />
            </div>
            <button className="btn btn-block btn-secondary" onClick={handleCreatePreset} disabled={isCreateDisabled}>
              Create & Stage Preset
            </button>
            <p className="form-help-text">
              Creates a preset with the current visual settings. It will appear in the list below, staged to be saved.
            </p>
          </div>
        </>
      )}
      {hostProfileAddress && !isPreviewMode && (
        <div className="config-section">
          <h3>Workspace Presets</h3>
          {isWorkspaceLoading && !stagedWorkspace ? (
            <p className="loading-list-message">Loading presets...</p>
          ) : presets.length > 0 ? (
            <ul className="config-list">
              {presets.map((preset) => (
                <li key={preset.name} className={preset.name === currentConfigName ? "active" : ""}>
                  <div className="preset-main-content">
                    <button className="btn-link config-name" onClick={() => handleLoad(preset.name)} disabled={isSaving} title={`Load "${preset.name}"`}>
                      {preset.name}
                    </button>
                    {stagedWorkspace?.defaultPresetName === preset.name && (<span className="default-preset-tag">(Default)</span>)}
                  </div>
                  <div className="preset-actions">
                     {canSave && (
                        <button className="btn-icon" onClick={() => handleSetDefault(preset.name)} disabled={isSaving || stagedWorkspace?.defaultPresetName === preset.name} title="Set as Default">★</button>
                     )}
                     <button className="btn-icon" onClick={() => handleMintPreset(preset.name)} disabled={isSaving} title={`Mint "${preset.name}" as NFT`}>💎</button>
                     {canSave && (
                       <button className="btn-icon delete-config" onClick={() => handleDeletePreset(preset.name)} disabled={isSaving} title={`Delete "${preset.name}"`}>×</button>
                     )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-configs-message">No saved presets found. Create one to get started!</p>
          )}
        </div>
      )}
      {!isHostProfileOwner && hostProfileAddress && (
        <div className="save-info visitor-banner">
            <span aria-hidden="true">👤</span>
            <div>
              <div className="title">Viewing Mode</div>
              <div className="desc">
                You are viewing another user's profile. You can load and experiment with their presets. Saving and minting are disabled.
              </div>
            </div>
          </div>
      )}
    </Panel>
  );
};

EnhancedSavePanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default React.memo(EnhancedSavePanel);