// src/context/SceneContext.jsx
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

const SceneContext = createContext();

export const SceneProvider = ({ children }) => {
    // The "Staged" workspace is the in-memory copy the user is editing.
    const [stagedActiveWorkspace, setStagedActiveWorkspace] = useState(null);
    const [activeSceneName, setActiveSceneName] = useState(null);
    
    // A flag to track if the user has made unsaved edits
    const [hasPendingChanges, setHasPendingChanges] = useState(false);

    // Derived list of scenes for the UI
    const fullSceneList = useMemo(() => {
        if (!stagedActiveWorkspace?.presets) return [];
        const validScenes = Object.values(stagedActiveWorkspace.presets).filter(
            (item) => item && typeof item.name === 'string'
        );
        return [...validScenes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }, [stagedActiveWorkspace]);

    // --- Scene CRUD Operations ---

    const addNewSceneToStagedWorkspace = useCallback((newSceneName, newSceneData) => {
        setStagedActiveWorkspace(prev => {
            const newWorkspace = prev ? JSON.parse(JSON.stringify(prev)) : { presets: {}, defaultPresetName: null };
            newWorkspace.presets[newSceneName] = newSceneData;
            return newWorkspace;
        });
        setHasPendingChanges(true);
    }, []);

    const deleteSceneFromStagedWorkspace = useCallback((nameToDelete) => {
        setStagedActiveWorkspace(prev => {
            if (!prev || !prev.presets || !prev.presets[nameToDelete]) return prev;
            const newWorkspace = JSON.parse(JSON.stringify(prev));
            delete newWorkspace.presets[nameToDelete];
            if (newWorkspace.defaultPresetName === nameToDelete) newWorkspace.defaultPresetName = null;
            return newWorkspace;
        });
        setHasPendingChanges(true);
    }, []);

    const setDefaultSceneInStagedWorkspace = useCallback((nameToSet) => {
        setStagedActiveWorkspace(prev => {
            if (!prev || !prev.presets || !prev.presets[nameToSet]) return prev;
            return { ...prev, defaultPresetName: nameToSet };
        });
        setHasPendingChanges(true);
    }, []);

    // --- Metadata/Collections Updates ---
    // (These modify the workspace JSON structure, so they live here)

    const addCollectionToPersonalLibrary = useCallback((collection) => {
        setStagedActiveWorkspace(prev => {
            // Note: In your original code, this was on 'setlist', but logically it belongs to the Workspace 
            // OR the Setlist depending on your data model. 
            // Based on your previous code, 'personalCollectionLibrary' was on the SETLIST.
            // *Correction*: We will keep Setlist-level data in WorkspaceContext, but Scene-level data here.
            return prev; 
        });
        // We will delegate Setlist updates back to WorkspaceContext via a prop or separate logic, 
        // but for now, let's keep SceneContext focused on the "Visual Workspace".
    }, []);

    const contextValue = useMemo(() => ({
        stagedActiveWorkspace,
        setStagedActiveWorkspace, // Exposed for WorkspaceContext to load data IN
        activeSceneName,
        setActiveSceneName,
        fullSceneList,
        hasPendingChanges,
        setHasPendingChanges,
        
        // Actions
        addNewSceneToStagedWorkspace,
        deleteSceneFromStagedWorkspace,
        setDefaultSceneInStagedWorkspace,
    }), [
        stagedActiveWorkspace,
        activeSceneName,
        fullSceneList,
        hasPendingChanges,
        addNewSceneToStagedWorkspace,
        deleteSceneFromStagedWorkspace,
        setDefaultSceneInStagedWorkspace
    ]);

    return (
        <SceneContext.Provider value={contextValue}>
            {children}
        </SceneContext.Provider>
    );
};

SceneProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useSceneContext = () => {
    const context = useContext(SceneContext);
    if (context === undefined) {
        throw new Error("useSceneContext must be used within a SceneProvider");
    }
    return context;
};