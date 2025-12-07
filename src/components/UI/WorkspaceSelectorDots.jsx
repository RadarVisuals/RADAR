// src/components/UI/WorkspaceSelectorDots.jsx
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import './WorkspaceSelectorDots.css';
// REFACTORED: Use selector
import { useSetManagementState } from '../../hooks/configSelectors';

const WorkspaceSelectorDots = ({
  workspaces = [],
  activeWorkspaceName,
  onSelectWorkspace,
  isLoading,
}) => {
  // REFACTORED: Get preload function from new hook
  const { preloadWorkspace } = useSetManagementState();

  const sortedWorkspaces = useMemo(() => workspaces, [workspaces]);

  if (workspaces.length <= 1) {
    return null;
  }

  return (
    <div className="workspace-dots-container">
      {sortedWorkspaces.map(({ name }) => (
        <button
          key={name}
          className={`workspace-dot ${name === activeWorkspaceName ? 'active' : ''}`}
          title={`Load Workspace: ${name}`}
          onClick={() => onSelectWorkspace(name)}
          onMouseEnter={() => preloadWorkspace(name)}
          disabled={isLoading || name === activeWorkspaceName}
          aria-label={`Load workspace ${name}`}
        />
      ))}
    </div>
  );
};

WorkspaceSelectorDots.propTypes = {
  workspaces: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeWorkspaceName: PropTypes.string,
  onSelectWorkspace: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default WorkspaceSelectorDots;