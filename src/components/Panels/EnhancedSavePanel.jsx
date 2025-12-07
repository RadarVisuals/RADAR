// src/components/Panels/EnhancedSavePanel.jsx
import React, { useCallback } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import { useSetManagementState } from "../../hooks/configSelectors";

import "./PanelStyles/EnhancedSavePanel.css";

const formatAddress = (address) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) return "N/A";
  if (address.length <= 11) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const EnhancedSavePanel = ({ onClose }) => {
  const {
    hostProfileAddress,
    isHostProfileOwner,
    canSaveToHostProfile,
    activeWorkspaceName,
    saveChanges,
    duplicateActiveWorkspace,
    isLoading: isWorkspaceLoading,
    isSaving,
    hasPendingChanges,
  } = useSetManagementState();
  
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

  const canSave = canSaveToHostProfile;
  const isFirstSave = !activeWorkspaceName;

  const handleDuplicateWorkspace = useCallback(async () => {
    if (!canSave || isSaving) return;
    const newName = window.prompt("Enter a name for the duplicated workspace:");
    if (newName && newName.trim()) {
      const result = await duplicateActiveWorkspace(newName.trim());
      // AUDIT FIX: Do not close panel. User must click "Save" to persist the new copy.
      if (result && result.success) {
         // Optional: Add toast here via store if not already added
      }
    }
  }, [canSave, isSaving, duplicateActiveWorkspace]);

  const handleSaveChanges = useCallback(async () => {
    if (!canSave || isSaving) return;
    
    if (isFirstSave) {
      const newName = window.prompt("Enter a name for your first workspace:");
      if (newName && newName.trim()) {
        const result = await duplicateActiveWorkspace(newName.trim());
        // For first save, we might want to keep it open or close it. 
        // Logic consistency: keep it open to be safe, or close if you prefer.
        // Let's stick to the audit advice: User needs to confirm persistence.
        if (result && result.success) {
           // We do NOT close here either, forcing them to click "Update" 
           // might be confusing for "First Save".
           // However, duplicateActiveWorkspace puts us in a "Dirty" state.
           // To actually SAVE to chain, we need saveChanges.
           
           // Actually, for "First Save", the user flow is:
           // 1. Click "Save Workspace..."
           // 2. Enter Name
           // 3. We rename the memory workspace
           // 4. We immediately trigger the chain save?
           
           // Let's trigger the save immediately for the First Save flow:
           await saveChanges(hostProfileAddress);
           onClose();
        }
      }
      return;
    }

    const result = await saveChanges(hostProfileAddress);
    
    if (result && result.success) {
      onClose();
    }
  }, [canSave, isSaving, saveChanges, onClose, isFirstSave, duplicateActiveWorkspace, hostProfileAddress]);

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