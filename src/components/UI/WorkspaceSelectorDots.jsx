// src/components/UI/WorkspaceSelectorDots.jsx
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import './WorkspaceSelectorDots.css';
import { useAppContext } from '../../context/AppContext';

const WorkspaceSelectorDots = ({
  workspaces = [],
  activeWorkspaceName,
  onSelectWorkspace,
  isLoading,
}) => {
  const { preloadWorkspace } = useAppContext();

  if (workspaces.length <= 1) {
    return null;
  }

  const sortedWorkspaces = useMemo(() => workspaces, [workspaces]);

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