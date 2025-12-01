// src/context/SceneContext.jsx
import React, { createContext, useContext } from 'react';
import { useWorkspaceContext } from './WorkspaceContext';

const SceneContext = createContext();

export const SceneProvider = ({ children }) => {
    // We simply pass the WorkspaceContext value down, 
    // because WorkspaceContext now includes all the Scene logic via the Store.
    const workspaceCtx = useWorkspaceContext();
    
    return (
        <SceneContext.Provider value={workspaceCtx}>
            {children}
        </SceneContext.Provider>
    );
};

export const useSceneContext = () => {
    // Redirect to WorkspaceContext, which now holds the consolidated store data
    const context = useContext(SceneContext);
    if (!context) {
        // Fallback if accessed outside provider (shouldn't happen in tree)
        throw new Error("useSceneContext must be used within a SceneProvider");
    }
    return context;
};