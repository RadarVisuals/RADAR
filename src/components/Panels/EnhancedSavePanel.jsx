// src/components/Panels/EnhancedSavePanel.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import Panel from "./Panel";
import {
  useProfileSessionState,
  usePresetManagementState,
  useInteractionSettingsState,
  usePendingChangesState,
  useConfigStatusState,
} from "../../hooks/configSelectors";
import { useMIDI } from "../../context/MIDIContext";
import { useVisualConfig } from "../../context/VisualConfigContext.jsx"; // Import useVisualConfig
import "./PanelStyles/EnhancedSavePanel.css";

const formatAddress = (address, length = 6) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x"))
    return "N/A";
  if (address.length <= length * 2 + 2) return address;
  return `${address.substring(0, length + 2)}...${address.substring(address.length - length)}`;
};

const EnhancedSavePanel = ({ onClose }) => {
  const {
    currentProfileAddress, isPreviewMode, isProfileOwner, canSave
  } = useProfileSessionState();

  const {
    currentConfigName, savedConfigList, isLoading: hookIsLoading,
    saveVisualPreset: actualSavePreset, // This is the function from PresetManagementContext
    loadNamedConfig, loadDefaultConfig, loadSavedConfigList, deleteNamedConfig,
  } = usePresetManagementState();

  const { saveGlobalReactions, saveGlobalMidiMap } = useInteractionSettingsState();
  const { hasPendingChanges } = usePendingChangesState();
  const { configServiceInstanceReady } = useConfigStatusState();
  const { isConnected: isMidiConnected } = useMIDI();

  // Get live visual state from VisualConfigContext
  const { layerConfigs: currentLayerConfigs, tokenAssignments: currentTokenAssignments } = useVisualConfig();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [isSavingReactions, setIsSavingReactions] = useState(false);
  const [isSavingMidi, setIsSavingMidi] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingListEffect, setIsLoadingListEffect] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info");
  const [saveStatus, setSaveStatus] = useState("idle");
  const statusTimerRef = useRef(null);
  const saveStatusTimerRef = useRef(null);
  const isMountedRef = useRef(false);

  const [newConfigName, setNewConfigName] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [updateGlobalReactionsOnPresetSave, setUpdateGlobalReactionsOnPresetSave] = useState(false);
  const [updateGlobalMidiOnPresetSave, setUpdateGlobalMidiOnPresetSave] = useState(false);

  const canEdit = canSave;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const listLength = savedConfigList?.length ?? 0;
    const isValidCurrentName = currentConfigName && currentConfigName !== "Default" && currentConfigName !== "None Loaded" && currentConfigName !== "Fallback";
    const baseName = isValidCurrentName
      ? currentConfigName
      : `RADAR.${String(listLength + 1).padStart(3, '0')}`;
    setNewConfigName(baseName);
    setSetAsDefault(false);
    setUpdateGlobalReactionsOnPresetSave(false);
    setUpdateGlobalMidiOnPresetSave(false);
  }, [currentConfigName, savedConfigList]);

  const displayStatus = useCallback((message, type = "success", duration = 4000) => {
    if (!isMountedRef.current) return;
    setStatusMessage(message);
    setStatusType(type);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    if (duration > 0) {
      statusTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setStatusMessage((prev) => (prev === message ? "" : prev));
        statusTimerRef.current = null;
      }, duration);
    }
  }, []);
  
  useEffect(() => {
    const logPrefix = `[EnhancedSavePanel ListLoadEffect Addr:${currentProfileAddress?.slice(0, 6)}]`;
    if (currentProfileAddress && configServiceInstanceReady && isProfileOwner && typeof loadSavedConfigList === "function") {
      setIsLoadingListEffect(true);
      loadSavedConfigList()
        .catch((err) => { if (isMountedRef.current) { console.error(`${logPrefix} Error loading configurations list:`, err); displayStatus("Failed to load configurations list", "error"); } })
        .finally(() => { if (isMountedRef.current) setIsLoadingListEffect(false); });
    } else {
      if (isMountedRef.current) setIsLoadingListEffect(false);
    }
  }, [currentProfileAddress, configServiceInstanceReady, isProfileOwner, loadSavedConfigList, displayStatus]);

  const displaySaveStatus = useCallback((status, message = null, duration = 3000) => {
    if (!isMountedRef.current) return;
    setSaveStatus(status);
    if (message) displayStatus(message, status === 'success' ? 'success' : 'error', duration);

    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    if (status === 'success' || status === 'error') {
      saveStatusTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setSaveStatus('idle');
        saveStatusTimerRef.current = null;
      }, duration);
    }
  }, [displayStatus]);

  const handleSavePreset = useCallback(async () => {
    const nameToSave = newConfigName.trim();
    const logPrefix = `[EnhancedSavePanel handleSavePreset Name:${nameToSave}]`;
    if (!canEdit) { displayStatus("Cannot save: Permissions missing.", "error"); return; }
    if (typeof actualSavePreset !== "function") { displayStatus("Save Preset function not available.", "error"); return; }
    if (!nameToSave) { displayStatus("Preset name cannot be empty.", "warning"); return; }
    if (nameToSave.length > 100) { displayStatus("Preset name is too long (max 100).", "warning"); return; }

    if (savedConfigList?.some(preset => preset.name === nameToSave)) {
      if (!window.confirm(`A preset named "${nameToSave}" already exists. Overwrite it?`)) {
         return;
      }
    }

    setIsProcessing(true); setIsSavingPreset(true); displaySaveStatus('saving');

    try {
      // Pass currentLayerConfigs and currentTokenAssignments to actualSavePreset
      const result = await actualSavePreset(
        nameToSave,
        setAsDefault,
        updateGlobalReactionsOnPresetSave,
        updateGlobalMidiOnPresetSave,
        currentLayerConfigs, // Pass live visual state
        currentTokenAssignments // Pass live visual state
      );
      if (result?.success) {
        let successMsg = `Preset "${nameToSave}" saved.`;
        if (updateGlobalReactionsOnPresetSave) successMsg += " Globals updated.";
        if (setAsDefault) successMsg += " Set as default.";
        displaySaveStatus('success', successMsg);
        setUpdateGlobalReactionsOnPresetSave(false); setUpdateGlobalMidiOnPresetSave(false);
      } else {
        displaySaveStatus('error', `Save Preset failed: ${result?.error || "Unknown error"}`);
        console.error(`${logPrefix} Save failed:`, result?.error);
      }
    } catch (e) {
      console.error(`${logPrefix} Unexpected error during save preset call:`, e);
      displaySaveStatus('error', `Save Preset error: ${e?.message || "Client error occurred"}`);
    } finally {
      if (isMountedRef.current) { setIsProcessing(false); setIsSavingPreset(false); }
    }
  }, [
      canEdit, actualSavePreset, newConfigName, savedConfigList, displayStatus, displaySaveStatus,
      setAsDefault, updateGlobalReactionsOnPresetSave, updateGlobalMidiOnPresetSave,
      currentLayerConfigs, currentTokenAssignments // Added dependencies
  ]);

  // handleSaveGlobalReactions, handleSaveGlobalMidiMap, handleLoadByName, handleLoadDefault, handleDelete remain the same
  const handleSaveGlobalReactions = useCallback(async () => {
    const logPrefix = `[EnhancedSavePanel handleSaveGlobalReactions]`;
    if (!canEdit) { displayStatus("Cannot save: Permissions missing.", "error"); return; }
    if (typeof saveGlobalReactions !== "function") { displayStatus("Save Reactions function not available.", "error"); return; }
    if (!window.confirm("Save current Reaction settings globally? This overwrites previous global settings.")) {
       return;
    }
    setIsProcessing(true); setIsSavingReactions(true); displaySaveStatus('saving');
    try {
      const result = await saveGlobalReactions();
      if (result?.success) {
        displaySaveStatus('success', `Global Reactions saved successfully!`);
      } else {
        displaySaveStatus('error', `Save Reactions failed: ${result?.error || "Unknown error"}`);
        console.error(`${logPrefix} Save failed:`, result?.error);
      }
    } catch (e) {
      console.error(`${logPrefix} Unexpected error during save reactions call:`, e);
      displaySaveStatus('error', `Save Reactions error: ${e?.message || "Client error occurred"}`);
    } finally {
      if (isMountedRef.current) { setIsProcessing(false); setIsSavingReactions(false); }
    }
  }, [canEdit, saveGlobalReactions, displayStatus, displaySaveStatus]);

  const handleSaveGlobalMidiMap = useCallback(async () => {
    const logPrefix = `[EnhancedSavePanel handleSaveGlobalMidiMap]`;
    if (!canEdit) { displayStatus("Cannot save: Permissions missing.", "error"); return; }
    if (!isMidiConnected) { displayStatus("Cannot save MIDI Map: No MIDI device connected.", "warning"); return; }
    if (typeof saveGlobalMidiMap !== "function") { displayStatus("Save MIDI Map function not available.", "error"); return; }
    if (!window.confirm("Save current MIDI Map settings globally? This overwrites previous global settings.")) {
       return;
    }
    setIsProcessing(true); setIsSavingMidi(true); displaySaveStatus('saving');
    try {
      const result = await saveGlobalMidiMap();
      if (result?.success) {
        displaySaveStatus('success', `Global MIDI Map saved successfully!`);
      } else {
        displaySaveStatus('error', `Save MIDI Map failed: ${result?.error || "Unknown error"}`);
        console.error(`${logPrefix} Save failed:`, result?.error);
      }
    } catch (e) {
      console.error(`${logPrefix} Unexpected error during save MIDI call:`, e);
      displaySaveStatus('error', `Save MIDI Map error: ${e?.message || "Client error occurred"}`);
    } finally {
      if (isMountedRef.current) { setIsProcessing(false); setIsSavingMidi(false); }
    }
  }, [canEdit, saveGlobalMidiMap, displayStatus, displaySaveStatus, isMidiConnected]);

  const handleLoadByName = useCallback(async (name) => {
    const logPrefix = `[EnhancedSavePanel handleLoadByName Name:${name}]`;
    if (!currentProfileAddress) { displayStatus("Cannot load: No profile.", "warning"); return; }
    if (!name) { displayStatus("Cannot load: Invalid name.", "warning"); return; }
    if (typeof loadNamedConfig !== "function") { displayStatus("Load function not available.", "error"); return; }
    if (hasPendingChanges && !window.confirm("You have unsaved changes that will be lost. Load preset anyway?")) {
       return;
    }
    setIsProcessing(true); displayStatus(`Loading preset "${name}"...`, "info", 0);
    try {
      const result = await loadNamedConfig(name);
      if (result?.success) {
        displayStatus(`Preset "${name}" loaded`, "success");
        onClose();
      } else {
        displayStatus(`Load failed: ${result?.error || "Configuration not found or invalid"}`, "error");
        console.error(`${logPrefix} Load failed:`, result?.error);
      }
    } catch (e) {
      console.error(`${logPrefix} Unexpected error during load call:`, e);
      displayStatus(`Load error: ${e?.message || "Client error occurred"}`, "error");
    } finally {
      if (isMountedRef.current) setIsProcessing(false);
    }
  }, [currentProfileAddress, loadNamedConfig, hasPendingChanges, displayStatus, onClose]);

  const handleLoadDefault = useCallback(async () => {
    const logPrefix = `[EnhancedSavePanel handleLoadDefault]`;
    if (!currentProfileAddress) { displayStatus("Cannot load default: No profile.", "warning"); return; }
    if (typeof loadDefaultConfig !== "function") { displayStatus("Load Default function not available.", "error"); return; }
    if (hasPendingChanges && !window.confirm("You have unsaved changes that will be lost. Load default anyway?")) {
       return;
    }
    setIsProcessing(true); displayStatus(`Loading default configuration...`, "info", 0);
    try {
      const result = await loadDefaultConfig();
      if (result?.success) {
        const loadedName = result.config?.name;
        displayStatus(loadedName ? `Default preset "${loadedName}" loaded` : "Default configuration loaded", "success");
        onClose();
      } else {
        if (result?.error?.includes("No default")) {
          displayStatus(`Load default failed: No default preset set for this profile.`, "warning");
          console.warn(`${logPrefix} Load failed: No default preset set.`);
        } else {
          displayStatus(`Load default failed: ${result?.error || "Could not load default"}`, "error");
          console.error(`${logPrefix} Load failed:`, result?.error);
        }
      }
    } catch (e) {
      console.error(`${logPrefix} Unexpected error during load default call:`, e);
      displayStatus(`Load default error: ${e?.message || "Client error occurred"}`, "error");
    } finally {
      if (isMountedRef.current) setIsProcessing(false);
    }
  }, [currentProfileAddress, loadDefaultConfig, hasPendingChanges, displayStatus, onClose]);

  const handleDelete = useCallback(async (name) => {
    const logPrefix = `[EnhancedSavePanel handleDelete Name:${name}]`;
    if (!canEdit) { displayStatus("Cannot delete: Permissions missing.", "error"); return; }
    if (!name) { displayStatus("Cannot delete: Invalid name.", "warning"); return; }
    if (typeof deleteNamedConfig !== "function") { displayStatus("Delete function not available.", "error"); return; }
    if (!window.confirm(`DELETE preset "${name}" permanently? This action cannot be undone.`)) {
       return;
    }
    setIsProcessing(true); setIsDeleting(true); displayStatus(`Deleting preset "${name}"...`, "info", 0);
    try {
      const result = await deleteNamedConfig(name);
      if (result?.success) {
        displayStatus(`Preset "${name}" deleted successfully`, "success");
        if (currentConfigName === name) {
            if (loadDefaultConfig) await loadDefaultConfig();
        }
      } else {
        displayStatus(`Delete failed: ${result?.error || "Unknown error"}`, "error");
        console.error(`${logPrefix} Delete failed:`, result?.error);
      }
    } catch (e) {
      console.error(`${logPrefix} Unexpected error during delete call:`, e);
      displayStatus(`Delete error: ${e?.message || "Client error occurred"}`, "error");
    } finally {
      if (isMountedRef.current) { setIsProcessing(false); setIsDeleting(false); }
    }
  }, [canEdit, deleteNamedConfig, displayStatus, currentConfigName, loadDefaultConfig]);


  const getPanelTitle = () => {
    if (isPreviewMode) return "VISITOR PREVIEW";
    if (!currentProfileAddress) return "CONNECT PROFILE";
    return canEdit ? "MY PROFILE - SAVE & MANAGE" : `VIEWING PROFILE (${formatAddress(currentProfileAddress)})`;
  };

  const isDisabledBase = isProcessing || hookIsLoading || !configServiceInstanceReady;
  const isDisabledWrite = isDisabledBase || !canEdit;

  const isSavePresetDisabled = isDisabledWrite || !newConfigName.trim() || isSavingPreset;
  const isSaveReactionsDisabled = isDisabledWrite || isSavingReactions;
  const isSaveMidiDisabled = isDisabledWrite || !isMidiConnected || isSavingMidi;
  const isLoadOrDeleteDisabled = isDisabledBase || isLoadingListEffect || isDeleting;

  const renderStatusIndicator = () => {
    if (saveStatus === 'success') return <div className="status-indicator success">Configuration Saved</div>;
    if (saveStatus === 'error') return <div className="status-indicator error">Save Failed</div>;
    if (saveStatus === 'saving') return <div className="status-indicator saving">Saving...</div>;
    if (hasPendingChanges) return <div className="status-indicator pending">Unsaved changes active</div>;
    return <div className="status-indicator idle">No changes detected</div>;
  };

  return (
    <Panel
      title={getPanelTitle()}
      onClose={onClose}
      className="panel-from-toolbar enhanced-save-panel"
    >
      {statusMessage && (
        <div className={`status-message ${statusType}`}>{statusMessage}</div>
      )}

      {renderStatusIndicator()}

      {canEdit && currentProfileAddress && (
        <div className="config-section save-preset-section">
          <h3>Save Visual Preset As</h3>
          <div className="form-group">
            <label htmlFor="preset-name" className="sr-only">Preset Name</label>
            <input
              id="preset-name"
              type="text"
              value={newConfigName}
              onChange={(e) => setNewConfigName(e.target.value)}
              className="form-control"
              placeholder="Visual Preset Name"
              disabled={isDisabledWrite || isSavingPreset}
              maxLength={100}
              aria-describedby="save-preset-help-text"
              required
            />
          </div>

          <div className="checkbox-options-group">
            <div className="checkbox-group">
              <input id="update-global-reactions" type="checkbox" checked={updateGlobalReactionsOnPresetSave} onChange={(e) => setUpdateGlobalReactionsOnPresetSave(e.target.checked)} disabled={isDisabledWrite || isSavingPreset} />
              <label htmlFor="update-global-reactions">Also update global Reactions?</label>
            </div>
            <div className="checkbox-group">
              <input id="update-global-midi" type="checkbox" checked={updateGlobalMidiOnPresetSave} onChange={(e) => setUpdateGlobalMidiOnPresetSave(e.target.checked)} disabled={isDisabledWrite || !isMidiConnected || isSavingPreset} />
              <label htmlFor="update-global-midi" className={(isDisabledWrite || !isMidiConnected || isSavingPreset) ? 'disabled-label' : ''}>
                Also update global MIDI Map? { !isMidiConnected && "(MIDI Disconnected)"}
              </label>
            </div>
            <div className="checkbox-group">
              <input id="set-default-preset" type="checkbox" checked={setAsDefault} onChange={(e) => setSetAsDefault(e.target.checked)} disabled={isDisabledWrite || isSavingPreset} />
              <label htmlFor="set-default-preset">Set as Default preset for this profile</label>
            </div>
          </div>

          <p id="save-preset-help-text" className="form-help-text">
            Saves current visual layers & tokens. Optionally updates global Reactions/MIDI map too.
          </p>

          {typeof actualSavePreset === "function" ? (
            <button className="btn btn-block btn-save btn-save-preset" onClick={handleSavePreset} disabled={isSavePresetDisabled} aria-live="polite">
              {isSavingPreset ? "SAVING PRESET..." : `SAVE PRESET "${newConfigName.trim() || "..."}"`}
            </button>
          ) : ( <p className="error">Save Preset action is unavailable.</p> )}
        </div>
      )}

      {canEdit && currentProfileAddress && (
        <div className="config-section save-global-section">
          <h3>Update Global Settings Only</h3>
          <p className="form-help-text">
            Saves only the current Reactions or MIDI map globally. Does not create a named visual preset.
          </p>
          <div className="global-save-buttons">
            {typeof saveGlobalReactions === "function" ? (
              <button className="btn btn-secondary btn-save-global" onClick={handleSaveGlobalReactions} disabled={isSaveReactionsDisabled} aria-live="polite">
                {isSavingReactions ? "SAVING..." : "Save Global Reactions"}
              </button>
            ) : ( <p className="error">Save Reactions action is unavailable.</p> )}
            {typeof saveGlobalMidiMap === "function" ? (
              <button
                className="btn btn-secondary btn-save-global"
                onClick={handleSaveGlobalMidiMap}
                disabled={isSaveMidiDisabled}
                aria-live="polite"
                title={!isMidiConnected ? "Connect MIDI device to save map" : "Save current MIDI map globally"}
              >
                {isSavingMidi ? "SAVING..." : "Save Global MIDI Map"}
              </button>
            ) : ( <p className="error">Save MIDI Map action is unavailable.</p> )}
          </div>
        </div>
      )}

      {currentProfileAddress && !isPreviewMode && (
        <div className="config-section load-section">
          <h3>Load / Delete Presets</h3>
          <div className="load-actions-group">
            {typeof loadDefaultConfig === "function" && (
              <button className="btn btn-secondary" onClick={handleLoadDefault} disabled={isLoadOrDeleteDisabled} title={isLoadOrDeleteDisabled ? "Wait for current operation..." : "Load the default preset for this profile"}>
                {hookIsLoading && !currentConfigName ? "LOADING..." : "Load Default"}
              </button>
            )}
            {typeof loadSavedConfigList === "function" && (
              <button className="btn btn-secondary btn-outline" onClick={() => { if (!isLoadOrDeleteDisabled) loadSavedConfigList(); }} disabled={isLoadOrDeleteDisabled} title={isLoadOrDeleteDisabled ? "Wait..." : "Refresh the list of saved presets"} aria-live="polite">
                {hookIsLoading ? "REFRESHING..." : "Refresh List"}
              </button>
            )}
          </div>

          {isLoadingListEffect || (hookIsLoading && savedConfigList.length === 0) ? (
            <p className="loading-list-message">Loading presets...</p>
          ) : savedConfigList?.length > 0 ? (
            <ul className="config-list">
              {Array.isArray(savedConfigList) && savedConfigList.map((preset) => (
                <li key={preset.name} className={preset.name === currentConfigName ? "active" : ""}>
                  {typeof loadNamedConfig === "function" ? (
                    <button className="btn-link config-name" onClick={() => { if (!isLoadOrDeleteDisabled) handleLoadByName(preset.name); }} disabled={isLoadOrDeleteDisabled} title={isLoadOrDeleteDisabled ? "Wait..." : `Load preset "${preset.name}"`}>
                      {preset.name}
                    </button>
                  ) : ( <span className="config-name-noload">{preset.name}</span> )}
                  {canEdit && typeof deleteNamedConfig === "function" && (
                    <button className="btn-icon delete-config" onClick={() => { if (!isLoadOrDeleteDisabled) handleDelete(preset.name); }} disabled={isLoadOrDeleteDisabled || isDeleting} title={isLoadOrDeleteDisabled ? "Wait..." : `Delete preset "${preset.name}"`} aria-label={`Delete preset ${preset.name}`}>
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : ( <p className="no-configs-message">No saved visual presets found for this profile.</p> )}
        </div>
      )}

      {!currentProfileAddress && (
        <div className="save-info connection-warning">
          <p><strong>No Profile Connected</strong></p>
          <p>Connect your Universal Profile wallet to save or load configurations.</p>
        </div>
      )}
      {isPreviewMode && (
        <div className="save-info preview-banner">
          <span aria-hidden="true">👁️</span>
          <div>
            <div className="title">Preview Mode</div>
            <div className="desc">Saving configurations is disabled in this mode. Exit preview to manage your profile's settings.</div>
          </div>
        </div>
      )}
      {!isProfileOwner && currentProfileAddress && !isPreviewMode && (
        <div className="save-info visitor-banner">
          <span aria-hidden="true">👤</span>
          <div>
            <div className="title">Viewing Mode</div>
            <div className="desc">Saving is disabled when viewing another profile or in visitor mode.</div>
          </div>
        </div>
      )}
    </Panel>
  );
};

EnhancedSavePanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default EnhancedSavePanel;