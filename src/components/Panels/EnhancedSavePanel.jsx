// src/components/Panels/EnhancedSavePanel.jsx
import React, { useCallback } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import { useSetManagement } from "../../context/SetManagementContext";
import { useUserSession } from "../../context/UserSessionContext";

import "./PanelStyles/EnhancedSavePanel.css";

const formatAddress = (address) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) return "N/A";
  if (address.length <= 11) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const EnhancedSavePanel = ({ onClose }) => {
  const { hostProfileAddress, isPreviewMode, isHostProfileOwner, canSaveToHostProfile } = useUserSession();
  const {
    activeWorkspaceName,
    saveChanges,
    duplicateActiveWorkspace,
    isLoading: isWorkspaceLoading,
    isSaving,
    hasPendingChanges,
  } = useSetManagement();
  
  const canSave = canSaveToHostProfile;
  const isFirstSave = !activeWorkspaceName;

  const handleDuplicateWorkspace = useCallback(async () => {
    if (!canSave || isSaving) return;
    const newName = window.prompt("Enter a name for the duplicated workspace:");
    if (newName && newName.trim()) {
      const result = await duplicateActiveWorkspace(newName.trim());
      if (result.success) {
        onClose();
      }
    }
  }, [canSave, isSaving, duplicateActiveWorkspace, onClose]);

  const handleSaveChanges = useCallback(async () => {
    if (!canSave || isSaving) return;

    if (isFirstSave) {
      // On a first save, the action is more like creating than duplicating.
      const newName = window.prompt("Enter a name for your first workspace:");
      if (newName && newName.trim()) {
        const result = await duplicateActiveWorkspace(newName.trim()); // It duplicates the "blank" state
        if (result.success) {
          onClose();
        }
      }
      return;
    }

    const result = await saveChanges();
    if (result.success) {
      onClose();
    }
  }, [canSave, isSaving, saveChanges, onClose, isFirstSave, duplicateActiveWorkspace]);

  const getPanelTitle = () => {
    if (isPreviewMode) return "VISITOR PREVIEW";
    if (!hostProfileAddress) return "CONNECT PROFILE";
    if (canSave) return "SAVE MANAGEMENT";
    return `VIEWING PROFILE (${formatAddress(hostProfileAddress)})`;
  };

  const renderStatusIndicator = () => {
    if (isSaving) return <div className="status-indicator saving">Saving Changes...</div>;
    if (hasPendingChanges && canSave) return <div className="status-indicator pending">Unsaved changes</div>;
    if (!canSave && hostProfileAddress && !isPreviewMode) return <div className="status-indicator idle">Viewing mode. Changes are not saved.</div>;
    return <div className="status-indicator idle">Workspace is in sync</div>;
  };

  const isUpdateDisabled = !hasPendingChanges || isSaving || !canSave || isWorkspaceLoading;
  const isSaveAsDisabled = isSaving || !canSave || isWorkspaceLoading;

  return (
    <Panel title={getPanelTitle()} onClose={onClose} className="panel-from-toolbar enhanced-save-panel">
      {canSave && hostProfileAddress && (
        <>
          <div className="config-section save-workspace-section">
            {renderStatusIndicator()}
            <button className="btn btn-block btn-primary" onClick={handleSaveChanges} disabled={isUpdateDisabled}>
              {isSaving ? "SAVING..." : (isFirstSave ? "Save Workspace..." : "Update Current Workspace")}
            </button>
            <p className="form-help-text">
              {isFirstSave
                ? "Save your current scenes and settings as your first workspace."
                : "Commit all changes in the current workspace (scenes, MIDI maps, etc.) to your profile."}
            </p>
          </div>
          <div className="config-section">
            <button className="btn btn-block btn-secondary" onClick={handleDuplicateWorkspace} disabled={isSaveAsDisabled}>
              Duplicate Workspace...
            </button>
            <p className="form-help-text">
              Saves a copy of the current workspace with a new name in your Setlist.
            </p>
          </div>
        </>
      )}
      {!isHostProfileOwner && hostProfileAddress && (
        <div className="save-info visitor-banner">
            <span aria-hidden="true">👤</span>
            <div>
              <div className="title">Viewing Mode</div>
              <div className="desc">
                You are viewing another user's profile. You can load and experiment with their scenes. Saving is disabled.
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

export default EnhancedSavePanel;