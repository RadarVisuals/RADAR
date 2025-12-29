// src/components/UI/WorkspaceSelectorDots.jsx
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import './WorkspaceSelectorDots.css';
import { useVisualEngine } from '../../hooks/useVisualEngine';

const WorkspaceSelectorDots = ({
  workspaces = [],
  activeWorkspaceName,
  onSelectWorkspace,
  isLoading,
}) => {
  // Use new hook to get preloading logic
  const { preloadWorkspace } = useVisualEngine();

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