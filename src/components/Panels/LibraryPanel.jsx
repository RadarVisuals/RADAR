// src/components/Panels/LibraryPanel.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import Panel from "./Panel";
import { useUserSession } from "../../context/UserSessionContext";
import { usePresetManagement } from "../../context/PresetManagementContext";
import { useToast } from "../../context/ToastContext";
import { isAddress, stringToHex } from "viem";
import { uploadJsonToPinata } from "../../services/PinataService";
import { RADAR_OFFICIAL_ADMIN_ADDRESS } from "../../config/global-config";
import { keccak256, stringToBytes } from "viem";
import "./PanelStyles/LibraryPanel.css";

const OFFICIAL_WHITELIST_KEY = keccak256(stringToBytes("RADAR.OfficialWhitelist"));

const formatAddress = (address, length = 4) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) return "N/A";
  const displayLength = Math.max(2, Math.min(10, length));
  if (address.length <= displayLength * 2 + 2) return address;
  return `${address.substring(0, displayLength + 2)}...${address.substring(address.length - displayLength)}`;
};

const LibraryPanel = ({ onClose }) => {
  const { isRadarProjectAdmin } = useUserSession();
  const { officialWhitelist, configServiceRef, refreshOfficialWhitelist } = usePresetManagement();
  const { addToast } = useToast();

  const [stagedWhitelist, setStagedWhitelist] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newCollection, setNewCollection] = useState({ address: "", name: "", imageUrl: "" });
  const [error, setError] = useState("");
  const statusTimerRef = useRef(null);

  useEffect(() => {
    setStagedWhitelist(officialWhitelist || []);
    setHasChanges(false);
  }, [officialWhitelist]);

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

    if (!addressToAdd || !nameToAdd) { displayError("Address and Name are required."); return; }
    if (!isAddress(addressToAdd)) { displayError("Invalid address format."); return; }
    if ((stagedWhitelist || []).some(c => c.address.toLowerCase() === addressToAdd.toLowerCase())) {
        displayError("This collection is already in the whitelist.");
        return;
    }
    
    setStagedWhitelist(prev => [...(prev || []), {
      address: addressToAdd,
      name: nameToAdd,
      imageUrl: newCollection.imageUrl.trim() || null,
    }]);
    setNewCollection({ address: "", name: "", imageUrl: "" });
    setHasChanges(true);
  }, [newCollection, stagedWhitelist, displayError]);

  const handleRemoveCollection = useCallback((addressToRemove) => {
    setStagedWhitelist(prev => (prev || []).filter(c => c.address.toLowerCase() !== addressToRemove.toLowerCase()));
    setHasChanges(true);
  }, []);

  const handleSaveWhitelist = async () => {
    if (!isRadarProjectAdmin || isSaving) return;
    
    setIsSaving(true);
    addToast("Saving whitelist...", "info");

    try {
        const service = configServiceRef.current;
        if (!service || !service.checkReadyForWrite()) {
            throw new Error("Configuration Service is not ready for writing.");
        }

        const newCid = await uploadJsonToPinata(stagedWhitelist, 'RADAR_OfficialWhitelist');
        const newIpfsUri = `ipfs://${newCid}`;
        const valueHex = stringToHex(newIpfsUri);

        await service.saveDataToKey(RADAR_OFFICIAL_ADMIN_ADDRESS, OFFICIAL_WHITELIST_KEY, valueHex);
        
        await refreshOfficialWhitelist();
        
        addToast("Official whitelist saved successfully!", "success");
        setHasChanges(false);
        onClose(); 

    } catch (error) {
        console.error("Failed to save whitelist:", error);
        addToast(`Error: ${error.message}`, "error");
    } finally {
        setIsSaving(false);
    }
  };
  
  if (!isRadarProjectAdmin) {
    return (
        <Panel title="Collections" onClose={onClose} className="panel-from-toolbar library-panel">
            <div className="collections-section section-box">
                <h3 className="section-title">Official Collections</h3>
                {(officialWhitelist || []).length > 0 ? (
                  <div className="collections-grid">
                    {(officialWhitelist || []).map((collection) => (
                      <div key={collection.address} className="collection-card">
                        <div className="collection-image">
                          <img src={collection.imageUrl || `https://via.placeholder.com/80/252525/00f3ff.png?text=${collection.name?.charAt(0)?.toUpperCase() || "?"}`} alt={collection.name || "Collection"}/>
                        </div>
                        <div className="collection-info">
                          <h4 className="collection-name" title={collection.name}>{collection.name || "Unnamed"}</h4>
                          <div className="collection-address" title={collection.address}>{formatAddress(collection.address)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-message">No official collections have been whitelisted yet.</div>
                )}
            </div>
        </Panel>
    );
  }

  // Admin View:
  return (
    <Panel
      title="Manage Whitelist"
      onClose={onClose}
      className="panel-from-toolbar library-panel events-panel-custom-scroll"
    >
      <div className="admin-header">
        <div className="admin-badge">Admin Mode</div>
        <p className="admin-description">
          Add or remove collections from the official RADAR whitelist. Changes here will affect all users after saving.
        </p>
      </div>

      {error && <div className="status-message error">{error}</div>}

      <div className="add-collection-section section-box">
        <h3 className="section-title">Add New Collection</h3>
        <div className="form-group">
          <label htmlFor="address">Collection Address*</label>
          <input type="text" id="address" name="address" className="form-control" value={newCollection.address} onChange={handleInputChange} placeholder="0x..." disabled={isSaving} aria-required="true" />
        </div>
        <div className="form-group">
          <label htmlFor="name">Collection Name*</label>
          <input type="text" id="name" name="name" className="form-control" value={newCollection.name} onChange={handleInputChange} placeholder="Name of the Collection" disabled={isSaving} aria-required="true" />
        </div>
        <div className="form-group">
          <label htmlFor="imageUrl">Image URL</label>
          <input type="text" id="imageUrl" name="imageUrl" className="form-control" value={newCollection.imageUrl} onChange={handleInputChange} placeholder="https://... (optional)" disabled={isSaving}/>
        </div>
        <button className="btn btn-block btn-secondary" onClick={handleAddCollection} disabled={isSaving || !newCollection.address.trim() || !newCollection.name.trim() || !isAddress(newCollection.address.trim())}>
          Add to Staged List
        </button>
      </div>

      <div className="collections-section section-box">
        <h3 className="section-title">Staged Whitelist</h3>
        {(stagedWhitelist || []).length === 0 && <div className="empty-message">The whitelist is currently empty.</div>}
        
        {(stagedWhitelist || []).length > 0 && (
          <div className="collections-grid">
            {(stagedWhitelist || []).map((collection) => (
              <div key={collection.address} className="collection-card">
                <div className="collection-image">
                  <img src={collection.imageUrl || `https://via.placeholder.com/80/252525/00f3ff.png?text=${collection.name?.charAt(0)?.toUpperCase() || "?"}`} alt={collection.name || "Collection"}/>
                </div>
                <div className="collection-info">
                  <h4 className="collection-name" title={collection.name}>{collection.name || "Unnamed"}</h4>
                  <div className="collection-address" title={collection.address}>{formatAddress(collection.address)}</div>
                </div>
                <button className="remove-button btn-icon" onClick={() => handleRemoveCollection(collection.address)} title="Remove from Whitelist" disabled={isSaving}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="config-section save-workspace-section">
        {hasChanges && <div className="status-indicator pending">Whitelist has unsaved changes</div>}
        <button className="btn btn-block btn-primary" onClick={handleSaveWhitelist} disabled={isSaving || !hasChanges}>
          {isSaving ? "SAVING..." : "Save Official Whitelist"}
        </button>
      </div>
    </Panel>
  );
};

LibraryPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default React.memo(LibraryPanel);