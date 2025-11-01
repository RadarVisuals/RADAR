// src/components/Panels/EnhancedSavePanel.jsx
import React, { useCallback } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useUserSession } from "../../context/UserSessionContext";

import "./PanelStyles/EnhancedSavePanel.css";

const formatAddress = (address) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) return "N/A";
  if (address.length <= 11) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const EnhancedSavePanel = ({ onClose }) => {
  const { hostProfileAddress, isHostProfileOwner, canSaveToHostProfile } = useUserSession();
  const {
    activeWorkspaceName,
    saveChanges,
    duplicateActiveWorkspace,
    isLoading: isWorkspaceLoading,
    isSaving,
    hasPendingChanges,
  } = useWorkspaceContext();
  
  // If the current user is a visitor, display a read-only message and nothing else.
  if (!isHostProfileOwner) {
    return (
      <Panel title="VIEWING MODE" onClose={onClose} className="panel-from-toolbar enhanced-save-panel">
          <div className="save-info visitor-banner">
              <span aria-hidden="true">👤</span>
              <div>
                <div className="title">Viewing {formatAddress(hostProfileAddress)}'s Profile</div>
                <div className="desc">
                  You are viewing another user's profile. You can load and experiment with their scenes. Saving is disabled.
                </div>
              </div>
            </div>
      </Panel>
    );
  }

  // The remainder of the component is for the profile owner.
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
      const newName = window.prompt("Enter a name for your first workspace:");
      if (newName && newName.trim()) {
        const result = await duplicateActiveWorkspace(newName.trim());
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
    if (!hostProfileAddress) return "CONNECT PROFILE";
    return "SAVE MANAGEMENT";
  };

  const renderStatusIndicator = () => {
    if (isSaving) return <div className="status-indicator saving">Saving Changes...</div>;
    if (hasPendingChanges) return <div className="status-indicator pending">Unsaved changes</div>;
    return <div className="status-indicator idle">Workspace is in sync</div>;
  };

  const isUpdateDisabled = !hasPendingChanges || isSaving || !canSave || isWorkspaceLoading;
  const isSaveAsDisabled = isSaving || !canSave || isWorkspaceLoading;

  return (
    <Panel title={getPanelTitle()} onClose={onClose} className="panel-from-toolbar enhanced-save-panel">
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
    </Panel>
  );
};

EnhancedSavePanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default EnhancedSavePanel;