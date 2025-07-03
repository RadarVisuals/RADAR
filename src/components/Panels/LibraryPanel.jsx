// src/components/Panels/LibraryPanel.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import Panel from "./Panel";
import { useUserSession } from "../../context/UserSessionContext";
import { usePresetManagement } from "../../context/PresetManagementContext";
import { isAddress } from "viem";
import "./PanelStyles/LibraryPanel.css";

const formatAddress = (address, length = 4) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) return "N/A";
  const displayLength = Math.max(2, Math.min(10, length));
  if (address.length <= displayLength * 2 + 2) return address;
  return `${address.substring(0, displayLength + 2)}...${address.substring(address.length - displayLength)}`;
};

const LibraryPanel = ({ onClose }) => {
  const { isHostProfileOwner } = useUserSession();
  const {
    personalCollectionLibrary: collections,
    addCollectionToStagedLibrary,
    removeCollectionFromStagedLibrary,
    isLoading: isWorkspaceLoading,
  } = usePresetManagement();

  const [newCollection, setNewCollection] = useState({ address: "", name: "", description: "", imageUrl: "" });
  const [error, setError] = useState("");
  const statusTimerRef = useRef(null);

  const displayError = useCallback((message, duration = 4000) => {
    setError(message);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    if (duration > 0) {
      statusTimerRef.current = setTimeout(() => setError(""), duration);
    }
  }, []);

  useEffect(() => () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current) }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewCollection((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleAddCollection = useCallback(() => {
    const addressToAdd = newCollection.address.trim();
    const nameToAdd = newCollection.name.trim();

    if (!addressToAdd || !nameToAdd) { displayError("Collection Address and Name are required."); return; }
    if (!isAddress(addressToAdd)) { displayError("Invalid collection address format."); return; }
    
    addCollectionToStagedLibrary({
      address: addressToAdd,
      name: nameToAdd,
      description: newCollection.description.trim(),
      imageUrl: newCollection.imageUrl.trim() || null,
      id: addressToAdd,
      addedAt: Date.now(),
    });
    setNewCollection({ address: "", name: "", description: "", imageUrl: "" });
  }, [newCollection, addCollectionToStagedLibrary, displayError]);

  const handleRemoveCollection = useCallback((addressToRemove) => {
    if (window.confirm(`Are you sure you want to remove this collection from your library? This change will be staged until you save the workspace.`)) {
      removeCollectionFromStagedLibrary(addressToRemove);
    }
  }, [removeCollectionFromStagedLibrary]);

  return (
    <Panel
      title="My Library"
      onClose={onClose}
      className="panel-from-toolbar library-panel events-panel-custom-scroll"
      /* <-- MODIFICATION: The hardcoded width="450px" prop has been REMOVED to match EventsPanel's width */
    >
      {isHostProfileOwner && (
        /* <-- MODIFICATION: The wrapping React Fragment (<>...</>) was REMOVED from here. */
        /* This allows the CSS 'gap' to correctly space the elements below. */
        <div className="admin-header">
          <div className="admin-badge">Owner Mode</div>
          <p className="admin-description">
            Add or remove collections from your personal library. Changes are staged and applied when you "Save Workspace".
          </p>
        </div>
      )}

      {isHostProfileOwner && error && <div className="status-message error">{error}</div>}

      {isHostProfileOwner && (
        <div className="add-collection-section section-box">
          <h3 className="section-title">Add New Collection</h3>
          <div className="form-group">
            <label htmlFor="address">Collection Address*</label>
            <input type="text" id="address" name="address" className="form-control" value={newCollection.address} onChange={handleInputChange} placeholder="0x..." disabled={isWorkspaceLoading} aria-required="true" />
          </div>
          <div className="form-group">
            <label htmlFor="name">Collection Name*</label>
            <input type="text" id="name" name="name" className="form-control" value={newCollection.name} onChange={handleInputChange} placeholder="My Favorite NFT Collection" disabled={isWorkspaceLoading} aria-required="true" />
          </div>
          <div className="form-group">
            <label htmlFor="imageUrl">Image URL</label>
            <input type="text" id="imageUrl" name="imageUrl" className="form-control" value={newCollection.imageUrl} onChange={handleInputChange} placeholder="https://... (optional)" disabled={isWorkspaceLoading}/>
          </div>
          <button className="btn btn-block btn-primary" onClick={handleAddCollection} disabled={isWorkspaceLoading || !newCollection.address.trim() || !newCollection.name.trim() || !isAddress(newCollection.address.trim())}>
            Add to Library
          </button>
        </div>
      )}

      <div className="collections-section section-box">
        <h3 className="section-title">Current Library Collections</h3>
        {isWorkspaceLoading && collections.length === 0 && <div className="loading-message">Loading library...</div>}
        {!isWorkspaceLoading && collections.length === 0 && <div className="empty-message">Your library is empty. Add a collection to get started!</div>}
        
        {collections.length > 0 && (
          <div className="collections-grid">
            {collections.map((collection) => (
              <div key={collection.id || collection.address} className="collection-card">
                <div className="collection-image">
                  <img src={collection.imageUrl || `https://via.placeholder.com/80/252525/00f3ff.png?text=${collection.name?.charAt(0)?.toUpperCase() || "?"}`} alt={collection.name || "Collection"}/>
                </div>
                <div className="collection-info">
                  <h4 className="collection-name" title={collection.name}>{collection.name || "Unnamed"}</h4>
                  <div className="collection-address" title={collection.address}>{formatAddress(collection.address)}</div>
                </div>
                {isHostProfileOwner && (
                  <button className="remove-button btn-icon" onClick={() => handleRemoveCollection(collection.address)} title="Remove from Library" disabled={isWorkspaceLoading}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
};

LibraryPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default React.memo(LibraryPanel);