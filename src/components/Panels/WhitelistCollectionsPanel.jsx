// src/components/Panels/WhitelistCollectionsPanel.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel"; // Local component
import { useUserSession } from "../../context/UserSessionContext"; // Local context
import { useConfig } from "../../context/ConfigContext"; // Local context

import { RADAR_WHITELIST_KEY } from "../../config/global-config"; // Local config

import { isAddress, stringToHex, hexToString } from "viem"; // Third-party utilities

import "./PanelStyles/WhitelistCollectionsPanel.css"; // Local styles

/**
 * Formats an Ethereum address for display by showing the beginning and end.
 * Returns "N/A" if the input is invalid.
 * @param {string | null | undefined} address - The address string.
 * @param {number} [length=4] - The number of characters to show from the start and end (excluding "0x" and "...").
 * @returns {string} The formatted address or "N/A".
 */
const formatAddress = (address, length = 4) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) {
    return "N/A";
  }
  // Ensure length is reasonable for typical address display
  const displayLength = Math.max(2, Math.min(10, length));
  if (address.length <= displayLength * 2 + 2) return address; // Return full address if it's short
  return `${address.substring(0, displayLength + 2)}...${address.substring(address.length - displayLength)}`;
};

/**
 * @typedef {object} WhitelistCollection
 * @property {string} address - The collection contract address.
 * @property {string} name - The name of the collection.
 * @property {string} [description] - An optional description for the collection.
 * @property {string | null} [imageUrl] - An optional URL for the collection's image.
 * @property {string} id - A unique identifier for the collection, typically the address.
 * @property {number} [addedAt] - Timestamp when the collection was added.
 */

/**
 * @typedef {object} WhitelistCollectionsPanelProps
 * @property {boolean} isOpen - Controls whether the panel is currently open or closed.
 * @property {() => void} onClose - Callback function invoked when the panel requests to be closed.
 */

/**
 * WhitelistCollectionsPanel: A UI component for viewing and managing a whitelist of
 * LSP7/LSP8 token collections. If the current user is an admin for the viewed profile,
 * they can add new collections to or remove existing ones from the whitelist.
 * The whitelist data is stored on the Universal Profile using ERC725Y.
 *
 * @param {WhitelistCollectionsPanelProps} props - The component's props.
 * @returns {JSX.Element | null} The rendered WhitelistCollectionsPanel, or null if not `isOpen`.
 */
const WhitelistCollectionsPanel = ({ isOpen, onClose }) => {
  // hostProfileAddress is the UP being viewed, isAdminOfHostProfile checks if visitor is admin of *that* UP.
  // For this panel, we typically want to check if the *visitor* is the RADAR_OFFICIAL_ADMIN_ADDRESS
  // and if they are viewing their *own* profile to manage its whitelist, or if they are the global admin
  // managing another profile's whitelist (if that's a feature).
  // The current `isAdminOfHostProfile` might be misleading if it means "is visitor the owner of host AND admin".
  // Assuming `isAdminOfHostProfile` correctly reflects the permission to edit the *hostProfileAddress*'s whitelist.
  const { hostProfileAddress, isRadarProjectAdmin } = useUserSession(); // Using isRadarProjectAdmin for global admin check
  const { configServiceInstanceReady, configServiceRef } = useConfig();

  /** @type {[Array<WhitelistCollection>, React.Dispatch<React.SetStateAction<Array<WhitelistCollection>>>]} */
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newCollection, setNewCollection] = useState({ address: "", name: "", description: "", imageUrl: "" });
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} */
  const [error, setError] = useState("");
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} */
  const [success, setSuccess] = useState("");

  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const statusTimerRef = useRef(null);
  /** @type {React.RefObject<boolean>} */
  const isMountedRef = useRef(false);

  // Determine if the current logged-in user can edit this whitelist.
  // For this panel, typically only the RADAR_OFFICIAL_ADMIN_ADDRESS can manage whitelists.
  // The `hostProfileAddress` is the target for saving the whitelist.
  const canAdministerWhitelist = isRadarProjectAdmin; // Simplified: only global admin can manage any whitelist.

  const displayStatus = useCallback(
    (message, type = "error", duration = 4000) => {
      if (!isMountedRef.current) return;
      setError(type === "error" ? message : "");
      setSuccess(type === "success" ? message : "");
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      if (duration > 0) {
        statusTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setError("");
            setSuccess("");
          }
          statusTimerRef.current = null;
        }, duration);
      }
    },
    [], // No dependencies as it uses refs and setters
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  // Load collections when the panel is opened or relevant dependencies change
  useEffect(() => {
    if (!isOpen || !configServiceInstanceReady || !configServiceRef?.current || !hostProfileAddress) {
      if (!isOpen) { // Reset state if panel is closed
        setCollections([]);
        setError("");
        setSuccess("");
      }
      return;
    }

    const loadCollections = async () => {
      setIsLoading(true);
      setError(""); // Clear previous errors
      setSuccess(""); // Clear previous success messages
      const logPrefix = `[WhitelistPanel Load Addr:${hostProfileAddress.slice(0,6)}]`;

      try {
        const service = configServiceRef.current;
        if (!service) {
            throw new Error("Configuration service is not available.");
        }
        const whitelistDataStringHex = await service.loadDataFromKey(hostProfileAddress, RADAR_WHITELIST_KEY);

        let parsedCollections = [];
        if (whitelistDataStringHex && whitelistDataStringHex !== "0x") {
          try {
            const decodedJsonString = hexToString(/** @type {`0x${string}`} */ (whitelistDataStringHex));
            const tempParsed = JSON.parse(decodedJsonString);
            if (Array.isArray(tempParsed)) {
              // Ensure each collection has a unique `id`, defaulting to address if missing
              parsedCollections = tempParsed.map((c) => ({ ...c, id: c.id || c.address }));
            } else if (import.meta.env.DEV) {
              console.warn(`${logPrefix} Parsed whitelist data is not an array. Data:`, tempParsed);
            }
          } catch (decodeOrParseError) {
            if (import.meta.env.DEV) {
                console.error(`${logPrefix} Error decoding/parsing whitelist hex/JSON:`, decodeOrParseError);
            }
            displayStatus("Failed to parse existing whitelist data.", "error");
          }
        }
        setCollections(parsedCollections);
      } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} Error loading whitelist:`, error);
        }
        displayStatus(`Failed to load collections: ${error.message}`, "error");
        setCollections([]); // Reset to empty on error
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };

    loadCollections();
  }, [isOpen, configServiceInstanceReady, configServiceRef, hostProfileAddress, displayStatus]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewCollection((prev) => ({ ...prev, [name]: value }));
  }, []); // setNewCollection is stable

  const handleAddCollection = useCallback(async () => {
    if (!canAdministerWhitelist) { displayStatus("Permission Denied. Only project admin can manage whitelists.", "error"); return; }
    if (!configServiceInstanceReady || !configServiceRef.current) { displayStatus("Service not ready.", "error"); return; }

    const targetSaveAddress = hostProfileAddress; // Whitelist is saved on the profile being viewed
    if (!targetSaveAddress) { displayStatus("Cannot determine target profile to save whitelist.", "error"); return; }

    const addressToAdd = newCollection.address.trim();
    const nameToAdd = newCollection.name.trim();

    if (!addressToAdd || !nameToAdd) { displayStatus("Collection Address and Name are required.", "error"); return; }
    if (!isAddress(addressToAdd)) { displayStatus("Invalid collection address format.", "error"); return; }
    if (collections.some((c) => c.address?.toLowerCase() === addressToAdd.toLowerCase())) {
      displayStatus("Collection address already exists in the whitelist.", "error");
      return;
    }

    setIsLoading(true); setError(""); setSuccess("");

    try {
      const service = configServiceRef.current;
      if (!service) throw new Error("Configuration service became unavailable.");

      const collectionToAdd = {
        address: addressToAdd,
        name: nameToAdd,
        description: newCollection.description.trim(),
        imageUrl: newCollection.imageUrl.trim() || null,
        id: addressToAdd, // Use address as ID for simplicity
        addedAt: Date.now(),
      };
      const updatedCollections = [...collections, collectionToAdd];
      const jsonString = JSON.stringify(updatedCollections);
      const valueHex = stringToHex(jsonString);

      await service.saveDataToKey(targetSaveAddress, RADAR_WHITELIST_KEY, valueHex);

      if (isMountedRef.current) {
        setCollections(updatedCollections);
        setNewCollection({ address: "", name: "", description: "", imageUrl: "" }); // Reset form
        displayStatus("Collection added successfully!", "success");
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error("[WhitelistPanel] Error adding collection:", error);
      if (isMountedRef.current) displayStatus(`Failed to add collection: ${error.message}`, "error");
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [canAdministerWhitelist, configServiceInstanceReady, configServiceRef, hostProfileAddress, newCollection, collections, displayStatus]);

  const handleRemoveCollection = useCallback(async (collectionIdToRemove) => {
    if (!canAdministerWhitelist) { displayStatus("Permission Denied. Only project admin can manage whitelists.", "error"); return; }
    if (!configServiceInstanceReady || !configServiceRef.current) { displayStatus("Service not ready.", "error"); return; }

    const targetSaveAddress = hostProfileAddress;
     if (!targetSaveAddress) { displayStatus("Cannot determine target profile for whitelist update.", "error"); return; }

    if (!collectionIdToRemove) return;
    if (!window.confirm(`Are you sure you want to remove collection "${collectionIdToRemove}" from the whitelist for this profile?`)) return;

    setIsLoading(true); setError(""); setSuccess("");

    try {
      const service = configServiceRef.current;
      if (!service) throw new Error("Configuration service became unavailable.");

      const updatedCollections = collections.filter((c) => (c.id || c.address) !== collectionIdToRemove);
      const jsonString = JSON.stringify(updatedCollections);
      const valueHex = stringToHex(jsonString);

      await service.saveDataToKey(targetSaveAddress, RADAR_WHITELIST_KEY, valueHex);

      if (isMountedRef.current) {
        setCollections(updatedCollections);
        displayStatus("Collection removed successfully!", "success");
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error("[WhitelistPanel] Error removing collection:", error);
      if (isMountedRef.current) displayStatus(`Failed to remove collection: ${error.message}`, "error");
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [canAdministerWhitelist, configServiceInstanceReady, configServiceRef, hostProfileAddress, collections, displayStatus]);

  if (!isOpen) return null; // Don't render if panel is not open

  return (
    <Panel
      title={canAdministerWhitelist ? "Manage Approved Collections" : "Approved Collections"}
      onClose={onClose}
      className="whitelist-panel"
      width="450px" // Example width, can be adjusted
    >
      <div className="whitelist-panel-content">
        {canAdministerWhitelist && hostProfileAddress && ( // Show admin section only if admin and a profile is being viewed
          <>
            <div className="admin-header">
              <div className="admin-badge">Admin Mode</div>
              <p className="admin-description">
                Add or remove LSP7/LSP8 collection addresses allowed in the Token Selector.
                Changes apply to the whitelist stored on the profile: {formatAddress(hostProfileAddress)}.
              </p>
            </div>
            {error && <div className="status-message error">{error}</div>}
            {success && <div className="status-message success">{success}</div>}
            <div className="add-collection-section section-box"> {/* Added section-box */}
              <h3 className="section-title">Add New Collection</h3>
              <div className="form-group">
                <label htmlFor="address">Collection Address*</label>
                <input type="text" id="address" name="address" className="form-control" value={newCollection.address} onChange={handleInputChange} placeholder="0x..." disabled={isLoading} aria-required="true" />
              </div>
              <div className="form-group">
                <label htmlFor="name">Collection Name*</label>
                <input type="text" id="name" name="name" className="form-control" value={newCollection.name} onChange={handleInputChange} placeholder="Enter collection name" disabled={isLoading} aria-required="true" />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" className="form-control" value={newCollection.description} onChange={handleInputChange} placeholder="Brief description (optional)" rows={2} disabled={isLoading}/>
              </div>
              <div className="form-group">
                <label htmlFor="imageUrl">Image URL</label>
                <input type="text" id="imageUrl" name="imageUrl" className="form-control" value={newCollection.imageUrl} onChange={handleInputChange} placeholder="https://... (optional)" disabled={isLoading}/>
              </div>
              <button className="btn btn-block btn-primary" onClick={handleAddCollection} disabled={isLoading || !newCollection.address.trim() || !newCollection.name.trim() || !isAddress(newCollection.address.trim())}>
                {isLoading ? "Adding..." : "Add to Whitelist"}
              </button>
            </div>
          </>
        )}

        <div className="collections-section section-box"> {/* Added section-box */}
          <h3 className="section-title">Current Whitelist {hostProfileAddress ? `on ${formatAddress(hostProfileAddress)}` : ""}</h3>
          {isLoading && collections.length === 0 && (<div className="loading-message">Loading whitelisted collections...</div>)}
          {!isLoading && collections.length === 0 && hostProfileAddress && (<div className="empty-message">No collections whitelisted for this profile yet.</div>)}
          {!hostProfileAddress && (<div className="empty-message">No profile loaded to view whitelist.</div>)}
          
          {collections.length > 0 && (
            <div className="collections-grid">
              {collections.map((collection) => (
                <div key={collection.id || collection.address} className="collection-card">
                  <div className="collection-image">
                    <img
                        src={ collection.imageUrl || `https://via.placeholder.com/80/252525/00f3ff.png?text=${collection.name?.charAt(0)?.toUpperCase() || "?"}` }
                        alt={collection.name || "Collection visual identifier"}
                        onError={(e) => { // Fallback for broken image URLs
                            e.target.onerror = null; // Prevent infinite loop
                            e.target.src = `https://via.placeholder.com/80/252525/00f3ff.png?text=${collection.name?.charAt(0)?.toUpperCase() || "?"}`;
                        }}
                    />
                  </div>
                  <div className="collection-info">
                    <h4 className="collection-name" title={collection.name}> {collection.name || "Unnamed Collection"} </h4>
                    <div className="collection-address" title={collection.address}> {formatAddress(collection.address)} </div>
                    {collection.description && ( <div className="collection-description"> {collection.description} </div> )}
                  </div>
                  {canAdministerWhitelist && hostProfileAddress && ( // Show remove button only if admin and profile loaded
                    <button
                        className="remove-button btn-icon" /* Added btn-icon for consistency */
                        onClick={() => handleRemoveCollection( collection.id || collection.address )}
                        title="Remove from Whitelist"
                        aria-label={`Remove ${collection.name || 'this collection'} from Whitelist`}
                        disabled={isLoading}
                    >
                        ✕
                    </button>
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
  /** Controls whether the panel is currently open or closed. */
  isOpen: PropTypes.bool.isRequired,
  /** Callback function invoked when the panel requests to be closed. */
  onClose: PropTypes.func.isRequired,
};

export default React.memo(WhitelistCollectionsPanel);