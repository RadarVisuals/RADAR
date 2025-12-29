// src/components/Panels/SetsPanel.jsx
import React, { useState } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import { useSetManagementState, useProfileSessionState } from "../../hooks/configSelectors";
import { useVisualEngine } from "../../hooks/useVisualEngine";

import "./PanelStyles/SetsPanel.css";

const SetsPanel = ({ onClose }) => {
  const { canSaveToHostProfile } = useProfileSessionState();
  const {
    stagedSetlist,
    activeWorkspaceName,
    loadWorkspace,
    createNewWorkspace,
    deleteWorkspaceFromSet,
    renameWorkspaceInSet,
    setDefaultWorkspaceInSet,
    isLoading,
    isSaving,
  } = useSetManagementState();

  const { preloadWorkspace } = useVisualEngine();

  const [editingName, setEditingName] = useState(null);
  const [newName, setNewName] = useState("");
  const canEdit = canSaveToHostProfile;

  const handleCreateClick = () => {
    const name = window.prompt("Enter a name for the new blank workspace:");
    if (name && name.trim()) {
      createNewWorkspace(name.trim());
    }
  };

  const handleRenameClick = (currentName) => {
    setEditingName(currentName);
    setNewName(currentName);
  };

  const handleRenameSubmit = (oldName) => {
    if (newName.trim() && newName.trim() !== oldName) {
      renameWorkspaceInSet(oldName, newName.trim());
    }
    setEditingName(null);
    setNewName("");
  };

  const handleLoadClick = (name) => {
    loadWorkspace(name);
    onClose();
  };

  const workspaces = stagedSetlist?.workspaces ? Object.entries(stagedSetlist.workspaces) : [];

  return (
    <Panel title="SETLIST MANAGEMENT" onClose={onClose} className="panel-from-toolbar sets-panel">
      <div className="config-section">
        <h3>Workspaces in this Setlist</h3>
        
        {canEdit && (
          <button 
            id="create-workspace-btn"
            className="btn btn-block" 
            onClick={handleCreateClick} 
            disabled={isLoading || isSaving}
          >
            + Create New Workspace
          </button>
        )}
        
        <p className="form-help-text">
          Manage your collection of workspaces. Load one to start playing, or edit your setlist. Changes must be saved via the Save panel.
        </p>
        
        {workspaces.length > 0 ? (
          <ul className="workspace-list" style={{ marginTop: 'var(--space-md)' }}>
            {workspaces.map(([name, _data]) => (
              <li
                key={name}
                className={name === activeWorkspaceName ? "active" : ""}
                onMouseEnter={() => preloadWorkspace(name)}
              >
                <div className="workspace-main-content">
                  {editingName === name ? (
                    <form className="workspace-rename-form" onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(name); }}>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={() => handleRenameSubmit(name)}
                        autoFocus
                        className="workspace-rename-input"
                      />
                    </form>
                  ) : (
                    <span className="workspace-name">{name}</span>
                  )}
                  {stagedSetlist?.defaultWorkspaceName === name && (
                    <span className="default-workspace-tag">(Default)</span>
                  )}
                </div>
                <div className="workspace-actions">
                  <button onClick={() => handleLoadClick(name)} className="btn-icon" title={`Load "${name}"`} disabled={isLoading || isSaving}>
                    ➔
                  </button>
                  {canEdit && (
                    <>
                      <button onClick={() => handleRenameClick(name)} className="btn-icon" title={`Rename "${name}"`} disabled={isSaving}>
                        ✏️
                      </button>
                      <button onClick={() => setDefaultWorkspaceInSet(name)} className="btn-icon" title="Set as Default" disabled={isSaving || stagedSetlist?.defaultWorkspaceName === name}>
                        ★
                      </button>
                      <button onClick={() => deleteWorkspaceFromSet(name)} className="btn-icon delete-action" title={`Delete "${name}"`} disabled={isSaving || workspaces.length <= 1}>
                        ×
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-workspaces-message" style={{ marginTop: 'var(--space-md)' }}>
            No workspaces found in this setlist.
          </p>
        )}
      </div>
    </Panel>
  );
};

SetsPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default SetsPanel;