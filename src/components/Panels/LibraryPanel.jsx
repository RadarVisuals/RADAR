// src/components/Panels/LibraryPanel.jsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Panel from "./Panel";
import { useUserSession } from "../../context/UserSessionContext";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useAssetContext } from "../../context/AssetContext";
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

const CollectionCard = ({ collection, onRemove, canRemove }) => {
    const renderImage = () => {
        const imgTag = (
            <img 
                src={collection.imageUrl || `https://via.placeholder.com/80/252525/00f3ff.png?text=${collection.name?.charAt(0)?.toUpperCase() || "?"}`} 
                alt={collection.name || "Collection"} 
            />
        );

        if (collection.linkUrl) {
            return (
                <a 
                    href={collection.linkUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="collection-link"
                    title={`Visit ${collection.name}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {imgTag}
                </a>
            );
        }
        return imgTag;
    };

    return (
        <div className="collection-card">
            <div className={`collection-image ${collection.linkUrl ? 'is-clickable' : ''}`}>
                {renderImage()}
            </div>
            <div className="collection-info">
                <h4 className="collection-name" title={collection.name}>{collection.name || "Unnamed"}</h4>
                <div className="collection-address" title={collection.address}>{formatAddress(collection.address)}</div>
            </div>
            {canRemove && (
                <button className="remove-button btn-icon" onClick={() => onRemove(collection.address)} title={`Remove ${collection.name}`} disabled={!canRemove}>✕</button>
            )}
        </div>
    );
};

CollectionCard.propTypes = {
  collection: PropTypes.object.isRequired,
  onRemove: PropTypes.func,
  canRemove: PropTypes.bool,
};

const LibraryPanel = ({ onClose }) => {
  const { isRadarProjectAdmin, isHostProfileOwner } = useUserSession();
  const {
    stagedSetlist,
    addCollectionToPersonalLibrary,
    removeCollectionFromPersonalLibrary,
    configServiceRef,
  } = useWorkspaceContext();
  const { officialWhitelist, refreshOfficialWhitelist } = useAssetContext();
  const { addToast } = useToast();
  
  const userLibrary = useMemo(() => stagedSetlist?.personalCollectionLibrary || [], [stagedSetlist]);

  const [newUserCollection, setNewUserCollection] = useState({ address: "", name: "", imageUrl: "" });
  const [userError, setUserError] = useState("");
  const userStatusTimerRef = useRef(null);
  
  const [stagedAdminWhitelist, setStagedAdminWhitelist] = useState([]);
  const [hasAdminChanges, setHasAdminChanges] = useState(false);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [newAdminCollection, setNewAdminCollection] = useState({ address: "", name: "", imageUrl: "", linkUrl: "" });
  const adminStatusTimerRef = useRef(null);

  useEffect(() => {
    if (isRadarProjectAdmin) {
      setStagedAdminWhitelist(officialWhitelist || []);
      setHasAdminChanges(false);
    }
  }, [officialWhitelist, isRadarProjectAdmin]);

  const displayUserError = useCallback((message, duration = 4000) => {
    setUserError(message);
    if (userStatusTimerRef.current) clearTimeout(userStatusTimerRef.current);
    if (duration > 0) userStatusTimerRef.current = setTimeout(() => setUserError(""), duration);
  }, []);

  const handleUserInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewUserCollection((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleAddUserCollection = useCallback(() => {
    const addressToAdd = newUserCollection.address.trim();
    const nameToAdd = newUserCollection.name.trim();

    if (!addressToAdd || !nameToAdd) { displayUserError("Address and Name are required."); return; }
    if (!isAddress(addressToAdd)) { displayUserError("Invalid address format."); return; }
    
    const isAlreadyInOfficial = officialWhitelist.some(c => c.address.toLowerCase() === addressToAdd.toLowerCase());
    const isAlreadyInUser = userLibrary.some(c => c.address.toLowerCase() === addressToAdd.toLowerCase());
    
    if (isAlreadyInOfficial || isAlreadyInUser) {
        displayUserError("This collection is already in a library.");
        return;
    }
    
    addCollectionToPersonalLibrary({
      address: addressToAdd,
      name: nameToAdd,
      imageUrl: newUserCollection.imageUrl.trim() || null,
    });
    setNewUserCollection({ address: "", name: "", imageUrl: "" });
  }, [newUserCollection, userLibrary, officialWhitelist, addCollectionToPersonalLibrary, displayUserError]);

  const displayAdminError = useCallback((message, duration = 4000) => {
    setAdminError(message);
    if (adminStatusTimerRef.current) clearTimeout(adminStatusTimerRef.current);
    if (duration > 0) adminStatusTimerRef.current = setTimeout(() => setAdminError(""), duration);
  }, []);
  
  const handleAdminInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewAdminCollection((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleAdminAddCollection = useCallback(() => {
    const addressToAdd = newAdminCollection.address.trim();
    const nameToAdd = newAdminCollection.name.trim();

    if (!addressToAdd || !nameToAdd) { displayAdminError("Address and Name are required."); return; }
    if (!isAddress(addressToAdd)) { displayAdminError("Invalid address format."); return; }
    if (stagedAdminWhitelist.some(c => c.address.toLowerCase() === addressToAdd.toLowerCase())) {
        displayAdminError("This collection is already in the whitelist.");
        return;
    }
    
    setStagedAdminWhitelist(prev => [...prev, {
      address: addressToAdd,
      name: nameToAdd,
      imageUrl: newAdminCollection.imageUrl.trim() || null,
      linkUrl: newAdminCollection.linkUrl.trim() || null,
    }]);
    setNewAdminCollection({ address: "", name: "", imageUrl: "", linkUrl: "" });
    setHasAdminChanges(true);
  }, [newAdminCollection, stagedAdminWhitelist, displayAdminError]);

  const handleAdminRemoveCollection = useCallback((addressToRemove) => {
    setStagedAdminWhitelist(prev => prev.filter(c => c.address.toLowerCase() !== addressToRemove.toLowerCase()));
    setHasAdminChanges(true);
  }, []);

  const handleSaveWhitelist = async () => {
    if (!isRadarProjectAdmin || isSavingAdmin) return;
    setIsSavingAdmin(true);
    addToast("Saving official whitelist...", "info");
    try {
        const service = configServiceRef.current;
        if (!service || !service.checkReadyForWrite()) throw new Error("Configuration Service is not ready for writing.");
        const newCid = await uploadJsonToPinata(stagedAdminWhitelist, 'RADAR_OfficialWhitelist');
        const newIpfsUri = `ipfs://${newCid}`;
        const valueHex = stringToHex(newIpfsUri);
        await service.saveDataToKey(RADAR_OFFICIAL_ADMIN_ADDRESS, OFFICIAL_WHITELIST_KEY, valueHex);
        await refreshOfficialWhitelist();
        addToast("Official whitelist saved successfully!", "success");
        setHasAdminChanges(false);
        onClose(); 
    } catch (error) {
        console.error("Failed to save whitelist:", error);
        addToast(`Error: ${error.message}`, "error");
    } finally {
        setIsSavingAdmin(false);
    }
  };

  useEffect(() => {
    return () => {
        if (userStatusTimerRef.current) clearTimeout(userStatusTimerRef.current);
        if (adminStatusTimerRef.current) clearTimeout(adminStatusTimerRef.current);
    }
  }, []);

  return (
    <Panel title="Collections Library" onClose={onClose} className="panel-from-toolbar library-panel events-panel-custom-scroll">
      
      {isHostProfileOwner && (
        <div className="add-collection-section section-box">
          <h3 className="section-title">Add to My Library</h3>
          {userError && <div className="status-message error">{userError}</div>}
          <div className="form-group">
            <label htmlFor="user-address">Collection Address*</label>
            <input type="text" id="user-address" name="address" className="form-control" value={newUserCollection.address} onChange={handleUserInputChange} placeholder="0x..." aria-required="true" />
          </div>
          <div className="form-group">
            <label htmlFor="user-name">Collection Name*</label>
            <input type="text" id="user-name" name="name" className="form-control" value={newUserCollection.name} onChange={handleUserInputChange} placeholder="Name of the Collection" aria-required="true" />
          </div>
          <div className="form-group">
            <label htmlFor="user-imageUrl">Image URL</label>
            <input type="text" id="user-imageUrl" name="imageUrl" className="form-control" value={newUserCollection.imageUrl} onChange={handleUserInputChange} placeholder="https://... (optional)"/>
          </div>
          <button className="btn btn-block btn-secondary" onClick={handleAddUserCollection} disabled={!newUserCollection.address.trim() || !newUserCollection.name.trim() || !isAddress(newUserCollection.address.trim())}>
            Add to My Library
          </button>
          <p className="form-help-text">Add an LSP7 or LSP8 collection. Changes must be saved via the main Save panel.</p>
        </div>
      )}

      <div className="collections-section section-box">
        <h3 className="section-title">{isHostProfileOwner ? 'My Library' : 'Personal Library'}</h3>
        {userLibrary.length > 0 ? (
          <div className="collections-grid">
            {userLibrary.map(collection => (
              <CollectionCard key={collection.address} collection={collection} onRemove={removeCollectionFromPersonalLibrary} canRemove={isHostProfileOwner} />
            ))}
          </div>
        ) : (
          <div className="empty-message">This user's personal library is empty.</div>
        )}
      </div>

      <div className="collections-section section-box">
        <h3 className="section-title">Official Collections</h3>
        {officialWhitelist.length > 0 ? (
          <div className="collections-grid">
            {officialWhitelist.map((collection) => (
              <CollectionCard key={collection.address} collection={collection} canRemove={false} />
            ))}
          </div>
        ) : (
          <div className="empty-message">No official collections found.</div>
        )}
      </div>

      {isRadarProjectAdmin && (
        <div className="admin-section-wrapper">
          <div className="admin-header">
            <div className="admin-badge">Admin Mode</div>
            <p className="admin-description">Manage the global official whitelist. Changes here affect all users.</p>
          </div>
          {adminError && <div className="status-message error">{adminError}</div>}
          <div className="add-collection-section section-box">
            <h3 className="section-title">Add New Official Collection</h3>
            <div className="form-group">
              <label htmlFor="admin-address">Collection Address*</label>
              <input type="text" id="admin-address" name="address" className="form-control" value={newAdminCollection.address} onChange={handleAdminInputChange} placeholder="0x..." disabled={isSavingAdmin} aria-required="true" />
            </div>
            <div className="form-group">
              <label htmlFor="admin-name">Collection Name*</label>
              <input type="text" id="admin-name" name="name" className="form-control" value={newAdminCollection.name} onChange={handleAdminInputChange} placeholder="Name of the Collection" disabled={isSavingAdmin} aria-required="true" />
            </div>
            <div className="form-group">
              <label htmlFor="admin-imageUrl">Image URL</label>
              <input type="text" id="admin-imageUrl" name="imageUrl" className="form-control" value={newAdminCollection.imageUrl} onChange={handleAdminInputChange} placeholder="https://... (optional)" disabled={isSavingAdmin}/>
            </div>
            <div className="form-group">
              <label htmlFor="admin-linkUrl">Link URL</label>
              <input type="text" id="admin-linkUrl" name="linkUrl" className="form-control" value={newAdminCollection.linkUrl} onChange={handleAdminInputChange} placeholder="https://... (optional, e.g., for minting)" disabled={isSavingAdmin}/>
            </div>
            <button className="btn btn-block btn-secondary" onClick={handleAdminAddCollection} disabled={isSavingAdmin || !newAdminCollection.address.trim() || !newAdminCollection.name.trim() || !isAddress(newAdminCollection.address.trim())}>
              Add to Staged List
            </button>
          </div>
          <div className="collections-section section-box">
            <h3 className="section-title">Staged Official Whitelist</h3>
            {stagedAdminWhitelist.length > 0 ? (
              <div className="collections-grid">
                {stagedAdminWhitelist.map((collection) => (
                  <CollectionCard key={collection.address} collection={collection} onRemove={handleAdminRemoveCollection} canRemove={!isSavingAdmin} />
                ))}
              </div>
            ) : <div className="empty-message">Official whitelist is empty.</div>}
          </div>
          <div className="config-section save-workspace-section">
            {hasAdminChanges && <div className="status-indicator pending">Official whitelist has unsaved changes</div>}
            <button className="btn btn-block btn-primary" onClick={handleSaveWhitelist} disabled={isSavingAdmin || !hasAdminChanges}>
              {isSavingAdmin ? "SAVING..." : "Save Official Whitelist"}
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
};

LibraryPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default React.memo(LibraryPanel);