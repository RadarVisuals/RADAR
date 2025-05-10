import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import Panel from "./Panel";
import { useUserSession } from "../../context/UserSessionContext"; // Import useUserSession
import { useConfig } from "../../context/ConfigContext"; // Import useConfig for service access
import { RADAR_WHITELIST_KEY } from "../../config/global-config";
import { isAddress, stringToHex, hexToString } from "viem";
import "./PanelStyles/WhitelistCollectionsPanel.css";

const formatAddress = (address, length = 4) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x"))
    return "N/A";
  if (address.length <= length * 2 + 2) return address;
  return `${address.substring(0, length + 2)}...${address.substring(address.length - length)}`;
};

const WhitelistCollectionsPanel = ({ isOpen, onClose }) => {
  const { hostProfileAddress, isAdminOfHostProfile } = useUserSession();
  const { configServiceInstanceReady, configServiceRef } = useConfig();

  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newCollection, setNewCollection] = useState({ address: "", name: "", description: "", imageUrl: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const displayStatus = useCallback(
    (message, type = "error", duration = 4000) => {
      setError(type === "error" ? message : "");
      setSuccess(type === "success" ? message : "");
      if (duration > 0) {
        setTimeout(() => {
          setError("");
          setSuccess("");
        }, duration);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isOpen || !configServiceInstanceReady || !configServiceRef?.current || !hostProfileAddress) {
      if (!isOpen) { setCollections([]); setError(""); setSuccess(""); }
      return;
    }

    const loadCollections = async () => {
      setIsLoading(true);
      setError("");
      setSuccess("");
      const logPrefix = `[WhitelistPanel Load Addr:${hostProfileAddress.slice(0,6)}]`;

      try {
        const service = configServiceRef.current;
        const whitelistDataStringHex = await service.loadDataFromKey(hostProfileAddress, RADAR_WHITELIST_KEY);

        let parsedCollections = [];
        if (whitelistDataStringHex) {
          try {
            const decodedJsonString = hexToString(whitelistDataStringHex);
            parsedCollections = JSON.parse(decodedJsonString);
            if (!Array.isArray(parsedCollections)) {
              parsedCollections = [];
            } else {
              parsedCollections = parsedCollections.map((c) => ({ ...c, id: c.id || c.address }));
            }
          } catch (decodeOrParseError) {
            console.error(`${logPrefix} Error decoding/parsing whitelist hex/JSON:`, decodeOrParseError);
            setError("Failed to parse existing whitelist data.");
            parsedCollections = [];
          }
        }
        setCollections(parsedCollections);
      } catch (error) {
        console.error(`${logPrefix} Error loading whitelist:`, error);
        setError(`Failed to load collections: ${error.message}`);
        setCollections([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadCollections();
  }, [isOpen, configServiceInstanceReady, configServiceRef, hostProfileAddress, displayStatus]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCollection((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddCollection = async () => {
    if (!isAdminOfHostProfile) return displayStatus("Permission Denied.", "error");
    if (!configServiceInstanceReady || !configServiceRef.current) return displayStatus("Service not ready.", "error");

    const targetSaveAddress = hostProfileAddress;
    if (!targetSaveAddress) return displayStatus("Cannot determine target profile.", "error");

    const addressToAdd = newCollection.address.trim();
    const nameToAdd = newCollection.name.trim();

    if (!addressToAdd || !nameToAdd) return displayStatus("Address and Name are required.", "error");
    if (!isAddress(addressToAdd)) return displayStatus("Invalid collection address format.", "error");
    if (collections.some((c) => c.address?.toLowerCase() === addressToAdd.toLowerCase())) {
      return displayStatus("Collection address already exists in the whitelist.", "error");
    }

    setIsLoading(true); setError(""); setSuccess("");

    try {
      const service = configServiceRef.current;
      const collectionToAdd = { address: addressToAdd, name: nameToAdd, description: newCollection.description.trim(), imageUrl: newCollection.imageUrl.trim() || null, id: addressToAdd, addedAt: Date.now(), };
      const updatedCollections = [...collections, collectionToAdd];
      const jsonString = JSON.stringify(updatedCollections);
      const valueHex = stringToHex(jsonString);

      await service.saveDataToKey(targetSaveAddress, RADAR_WHITELIST_KEY, valueHex);

      setCollections(updatedCollections);
      setNewCollection({ address: "", name: "", description: "", imageUrl: "" });
      displayStatus("Collection added successfully!", "success");
    } catch (error) {
      console.error("Error adding collection:", error);
      displayStatus(`Failed to add collection: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCollection = async (collectionIdToRemove) => {
    if (!isAdminOfHostProfile) return displayStatus("Permission Denied.", "error");
    if (!configServiceInstanceReady || !configServiceRef.current) return displayStatus("Service not ready.", "error");

    const targetSaveAddress = hostProfileAddress;
     if (!targetSaveAddress) return displayStatus("Cannot determine target profile.", "error");

    if (!collectionIdToRemove) return;
    if (!window.confirm(`Remove collection "${collectionIdToRemove}" from the whitelist?`)) return;

    setIsLoading(true); setError(""); setSuccess("");

    try {
      const service = configServiceRef.current;
      const updatedCollections = collections.filter((c) => (c.id || c.address) !== collectionIdToRemove);
      const jsonString = JSON.stringify(updatedCollections);
      const valueHex = stringToHex(jsonString);

      await service.saveDataToKey(targetSaveAddress, RADAR_WHITELIST_KEY, valueHex);

      setCollections(updatedCollections);
      displayStatus("Collection removed successfully!", "success");
    } catch (error) {
      console.error("Error removing collection:", error);
      displayStatus(`Failed to remove collection: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Panel
      title={isAdminOfHostProfile ? "Manage Approved Collections" : "Approved Collections"}
      onClose={onClose}
      className="whitelist-panel"
      width="450px"
    >
      <div className="whitelist-panel-content">
        {isAdminOfHostProfile && (
          <>
            <div className="admin-header">
              <div className="admin-badge">Admin Mode</div>
              <p className="admin-description">
                Add or remove LSP7/LSP8 collection addresses allowed in the Token Selector. Changes apply to the profile being viewed.
              </p>
            </div>
            {error && <div className="status-message error">{error}</div>}
            {success && <div className="status-message success">{success}</div>}
            <div className="add-collection-section">
              <h3 className="section-title">Add New Collection</h3>
              <div className="form-group">
                <label htmlFor="address">Collection Address*</label>
                <input type="text" id="address" name="address" className="form-control" value={newCollection.address} onChange={handleInputChange} placeholder="0x..." disabled={isLoading} />
              </div>
              <div className="form-group">
                <label htmlFor="name">Collection Name*</label>
                <input type="text" id="name" name="name" className="form-control" value={newCollection.name} onChange={handleInputChange} placeholder="Enter collection name" disabled={isLoading} />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" className="form-control" value={newCollection.description} onChange={handleInputChange} placeholder="Brief description (optional)" rows="2" disabled={isLoading}/>
              </div>
              <div className="form-group">
                <label htmlFor="imageUrl">Image URL</label>
                <input type="text" id="imageUrl" name="imageUrl" className="form-control" value={newCollection.imageUrl} onChange={handleInputChange} placeholder="https://... (optional)" disabled={isLoading}/>
              </div>
              <button className="btn btn-block" onClick={handleAddCollection} disabled={isLoading || !newCollection.address || !newCollection.name || !isAddress(newCollection.address.trim())}>
                {isLoading ? "Adding..." : "Add to Whitelist"}
              </button>
            </div>
          </>
        )}

        <div className="collections-section">
          <h3 className="section-title">Current Whitelist</h3>
          {isLoading && collections.length === 0 && (<div className="loading-message">Loading...</div>)}
          {!isLoading && collections.length === 0 && (<div className="empty-message">No collections whitelisted for this profile yet.</div>)}
          {collections.length > 0 && (
            <div className="collections-grid">
              {collections.map((collection) => (
                <div key={collection.id || collection.address} className="collection-card">
                  <div className="collection-image">
                    <img src={ collection.imageUrl || `https://via.placeholder.com/80/252525/00f3ff.png?text=${collection.name?.charAt(0) || "?"}` } alt={collection.name || "Collection"}/>
                  </div>
                  <div className="collection-info">
                    <h4 className="collection-name" title={collection.name}> {collection.name || "Unnamed"} </h4>
                    <div className="collection-address" title={collection.address}> {formatAddress(collection.address)} </div>
                    {collection.description && ( <div className="collection-description"> {collection.description} </div> )}
                  </div>
                  {isAdminOfHostProfile && (
                    <button className="remove-button" onClick={() => handleRemoveCollection( collection.id || collection.address )} title="Remove from Whitelist" disabled={isLoading}> ✕ </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
};

WhitelistCollectionsPanel.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default WhitelistCollectionsPanel;