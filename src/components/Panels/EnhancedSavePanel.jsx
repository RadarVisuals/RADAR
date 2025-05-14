// src/components/Panels/EnhancedSavePanel.jsx
import React, { useState, useEffect, useCallback, useRef } from "react"; // Removed useMemo
import PropTypes from "prop-types";

import Panel from "./Panel"; // Local component
import {
  useProfileSessionState,
  usePresetManagementState,
  useInteractionSettingsState,
  usePendingChangesState,
  useConfigStatusState,
} from "../../hooks/configSelectors"; // Local hooks
import { useMIDI } from "../../context/MIDIContext"; // Local context
import { useVisualConfig } from "../../context/VisualConfigContext.jsx"; // Local context

import "./PanelStyles/EnhancedSavePanel.css"; // Local styles

/**
 * Formats an Ethereum address for display by showing the beginning and end.
 * @param {string | null | undefined} address - The address string.
 * @param {number} [length=6] - The number of characters to show from the start and end.
 * @returns {string} The formatted address or "N/A".
 */
const formatAddress = (address, length = 6) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) {
    return "N/A";
  }
  if (address.length <= length * 2 + 2) return address; // Return full address if it's short
  return `${address.substring(0, length + 2)}...${address.substring(address.length - length)}`;
};

const MAX_BUTTON_LABEL_LENGTH_PREVIEW = 3;
/**
 * Generates a short display label for a preset button, typically from a numeric or short part of the full name.
 * This mirrors logic from PresetSelectorBar for consistency in how preset names are abbreviated.
 * @param {string | null | undefined} fullName - The full name of the preset.
 * @returns {string} A short display label (e.g., "1", "ABC") or "?" if input is invalid.
 */
const getPresetDisplayLabelForPreview = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return '?';
  const nameParts = fullName.split('.'); // Assuming names like "RADAR.001" or "MyPreset.ABC"
  if (nameParts.length > 1) {
    const identifier = nameParts.slice(1).join('.');
    if (/^\d+$/.test(identifier)) { // If the part after the first dot is purely numeric
      const num = parseInt(identifier, 10);
      return num.toString(); // Use the number directly
    } else {
      // Use the first few chars of the identifier part
      return identifier.substring(0, MAX_BUTTON_LABEL_LENGTH_PREVIEW).toUpperCase();
    }
  } else {
    // If no dot, use the first few chars of the full name
    return fullName.substring(0, MAX_BUTTON_LABEL_LENGTH_PREVIEW).toUpperCase();
  }
};

/**
 * @typedef {object} EnhancedSavePanelProps
 * @property {() => void} onClose - Callback function to close the panel.
 */

/**
 * EnhancedSavePanel: A UI component for saving and managing visual presets and global settings.
 * It allows users to save the current visual configuration as a named preset, update global
 * event reactions and MIDI mappings, load existing presets, and delete presets.
 * The panel's functionality and available actions are contingent on user permissions
 * (e.g., profile ownership, admin status) and application mode (e.g., preview mode).
 *
 * @param {EnhancedSavePanelProps} props - The component's props.
 * @returns {JSX.Element} The rendered EnhancedSavePanel component.
 */
const EnhancedSavePanel = ({ onClose }) => {
  const {
    currentProfileAddress,
    visitorUPAddress, // Used to determine if viewing own profile or another's
    isPreviewMode,
    isProfileOwner,
    canSave, // Derived: isProfileOwner && !isPreviewMode
  } = useProfileSessionState();

  const {
    currentConfigName, // Name of the currently loaded preset
    savedConfigList,   // List of {name: string} objects
    isLoading: presetHookIsLoading, // Loading state from preset management
    saveVisualPreset: actualSavePreset, // Function to save a visual preset
    loadNamedConfig,
    loadDefaultConfig,
    loadSavedConfigList,
    deleteNamedConfig,
  } = usePresetManagementState();

  const { saveGlobalReactions, saveGlobalMidiMap } = useInteractionSettingsState();
  const { hasPendingChanges } = usePendingChangesState();
  const { configServiceInstanceReady } = useConfigStatusState();
  const { isConnected: isMidiConnected } = useMIDI(); // MIDI device connection status

  // Current visual state to be saved
  const { layerConfigs: currentLayerConfigs, tokenAssignments: currentTokenAssignments } = useVisualConfig();

  // Local component state for UI and processing flags
  const [isProcessing, setIsProcessing] = useState(false); // General async operation flag
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [isSavingReactions, setIsSavingReactions] = useState(false);
  const [isSavingMidi, setIsSavingMidi] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingListEffect, setIsLoadingListEffect] = useState(false); // Specific for list refresh

  const [statusMessage, setStatusMessage] = useState("");
  /** @type {['info' | 'success' | 'warning' | 'error', React.Dispatch<React.SetStateAction<'info' | 'success' | 'warning' | 'error'>>]} */
  const [statusType, setStatusType] = useState("info");
  /** @type {['idle' | 'saving' | 'success' | 'error', React.Dispatch<React.SetStateAction<'idle' | 'saving' | 'success' | 'error'>>]} */
  const [saveStatus, setSaveStatus] = useState("idle"); // For the main status indicator

  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const statusTimerRef = useRef(null);
  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const saveStatusTimerRef = useRef(null);
  /** @type {React.RefObject<boolean>} */
  const isMountedRef = useRef(false);

  // Form state for saving a new preset
  const [newConfigName, setNewConfigName] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [updateGlobalReactionsOnPresetSave, setUpdateGlobalReactionsOnPresetSave] = useState(false);
  const [updateGlobalMidiOnPresetSave, setUpdateGlobalMidiOnPresetSave] = useState(false);

  const canEdit = canSave; // User can edit/save if they have save permissions

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  // Effect to pre-fill the new config name input based on current state
  useEffect(() => {
    const listLength = savedConfigList?.length ?? 0;
    const isValidCurrentName = currentConfigName && currentConfigName !== "Default" && currentConfigName !== "None Loaded" && currentConfigName !== "Fallback" && currentConfigName !== "ErrorState";
    const baseName = isValidCurrentName
      ? currentConfigName // Suggest current name if it's a loaded user preset
      : `RADAR.${String(listLength + 1).padStart(3, '0')}`; // Suggest new name otherwise
    setNewConfigName(baseName);
    // Reset checkboxes when currentConfigName or list changes significantly
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
        if (isMountedRef.current) setStatusMessage((prev) => (prev === message ? "" : prev)); // Clear only if it's the same message
        statusTimerRef.current = null;
      }, duration);
    }
  }, []); // isMountedRef is a ref, not a dependency

  // Effect to load the list of saved configurations when the panel mounts or profile changes
  useEffect(() => {
    const logPrefix = `[EnhancedSavePanel ListLoadEffect Addr:${currentProfileAddress?.slice(0, 6) ?? 'N/A'}]`;
    if (currentProfileAddress && configServiceInstanceReady && !isPreviewMode && typeof loadSavedConfigList === "function") {
      setIsLoadingListEffect(true);
      loadSavedConfigList()
        .catch((err) => {
            if (isMountedRef.current) {
                if (import.meta.env.DEV) console.error(`${logPrefix} Error loading configurations list:`, err);
                displayStatus("Failed to load configurations list", "error");
            }
        })
        .finally(() => { if (isMountedRef.current) setIsLoadingListEffect(false); });
    } else {
      if (isMountedRef.current) setIsLoadingListEffect(false); // Ensure loading state is reset if conditions not met
    }
  }, [currentProfileAddress, configServiceInstanceReady, isPreviewMode, loadSavedConfigList, displayStatus]);

  const displaySaveStatus = useCallback((status, message = null, duration = 3000) => {
    if (!isMountedRef.current) return;
    setSaveStatus(status);
    if (message) displayStatus(message, status === 'success' ? 'success' : 'error', duration);

    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    if (status === 'success' || status === 'error') { // Auto-clear success/error save status
      saveStatusTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setSaveStatus('idle');
        saveStatusTimerRef.current = null;
      }, duration);
    }
  }, [displayStatus]); // displayStatus is memoized

  const handleSavePreset = useCallback(async () => {
    const nameToSave = newConfigName.trim();
    const logPrefix = `[EnhancedSavePanel handleSavePreset Name:${nameToSave}]`;
    if (!canEdit) { displayStatus("Cannot save: Permissions missing.", "error"); return; }
    if (typeof actualSavePreset !== "function") { displayStatus("Save Preset function not available.", "error"); return; }
    if (!nameToSave) { displayStatus("Preset name cannot be empty.", "warning"); return; }
    if (nameToSave.length > 100) { displayStatus("Preset name is too long (max 100 characters).", "warning"); return; }

    if (savedConfigList?.some(preset => preset.name === nameToSave)) {
      if (!window.confirm(`A preset named "${nameToSave}" already exists. Do you want to overwrite it?`)) {
         return; // User cancelled overwrite
      }
    }

    setIsProcessing(true); setIsSavingPreset(true); displaySaveStatus('saving');

    try {
      const result = await actualSavePreset(
        nameToSave,
        setAsDefault,
        updateGlobalReactionsOnPresetSave,
        updateGlobalMidiOnPresetSave,
        currentLayerConfigs, // From useVisualConfig
        currentTokenAssignments // From useVisualConfig
      );
      if (result?.success) {
        let successMsg = `Preset "${nameToSave}" saved successfully.`;
        if (updateGlobalReactionsOnPresetSave || updateGlobalMidiOnPresetSave) successMsg += " Global settings also updated.";
        if (setAsDefault) successMsg += " Set as default.";
        displaySaveStatus('success', successMsg);
        // Reset checkboxes after successful save
        setUpdateGlobalReactionsOnPresetSave(false);
        setUpdateGlobalMidiOnPresetSave(false);
      } else {
        const errorDetail = result?.error || "Unknown error during save.";
        displaySaveStatus('error', `Save Preset failed: ${errorDetail}`);
        if (import.meta.env.DEV) console.error(`${logPrefix} Save failed:`, errorDetail);
      }
    } catch (e) {
      const errorDetail = e?.message || "A client-side error occurred during save.";
      if (import.meta.env.DEV) console.error(`${logPrefix} Unexpected error during save preset call:`, e);
      displaySaveStatus('error', `Save Preset error: ${errorDetail}`);
    } finally {
      if (isMountedRef.current) { setIsProcessing(false); setIsSavingPreset(false); }
    }
  }, [
      canEdit, actualSavePreset, newConfigName, savedConfigList, displayStatus, displaySaveStatus,
      setAsDefault, updateGlobalReactionsOnPresetSave, updateGlobalMidiOnPresetSave,
      currentLayerConfigs, currentTokenAssignments
  ]);

  const handleSaveGlobalReactions = useCallback(async () => {
    const logPrefix = `[EnhancedSavePanel handleSaveGlobalReactions]`;
    if (!canEdit) { displayStatus("Cannot save: Permissions missing.", "error"); return; }
    if (typeof saveGlobalReactions !== "function") { displayStatus("Save Reactions function not available.", "error"); return; }
    if (!window.confirm("Are you sure you want to save the current Reaction settings globally? This will overwrite any previous global Reaction settings.")) {
       return;
    }
    setIsProcessing(true); setIsSavingReactions(true); displaySaveStatus('saving');
    try {
      const result = await saveGlobalReactions();
      if (result?.success) {
        displaySaveStatus('success', `Global Reactions saved successfully!`);
      } else {
        const errorDetail = result?.error || "Unknown error during save.";
        displaySaveStatus('error', `Save Reactions failed: ${errorDetail}`);
        if (import.meta.env.DEV) console.error(`${logPrefix} Save failed:`, errorDetail);
      }
    } catch (e) {
      const errorDetail = e?.message || "A client-side error occurred.";
      if (import.meta.env.DEV) console.error(`${logPrefix} Unexpected error during save reactions call:`, e);
      displaySaveStatus('error', `Save Reactions error: ${errorDetail}`);
    } finally {
      if (isMountedRef.current) { setIsProcessing(false); setIsSavingReactions(false); }
    }
  }, [canEdit, saveGlobalReactions, displayStatus, displaySaveStatus]);

  const handleSaveGlobalMidiMap = useCallback(async () => {
    const logPrefix = `[EnhancedSavePanel handleSaveGlobalMidiMap]`;
    if (!canEdit) { displayStatus("Cannot save: Permissions missing.", "error"); return; }
    if (!isMidiConnected) { displayStatus("Cannot save MIDI Map: No MIDI device connected.", "warning"); return; }
    if (typeof saveGlobalMidiMap !== "function") { displayStatus("Save MIDI Map function not available.", "error"); return; }
    if (!window.confirm("Are you sure you want to save the current MIDI Map settings globally? This will overwrite any previous global MIDI Map settings.")) {
       return;
    }
    setIsProcessing(true); setIsSavingMidi(true); displaySaveStatus('saving');
    try {
      const result = await saveGlobalMidiMap();
      if (result?.success) {
        displaySaveStatus('success', `Global MIDI Map saved successfully!`);
      } else {
        const errorDetail = result?.error || "Unknown error during save.";
        displaySaveStatus('error', `Save MIDI Map failed: ${errorDetail}`);
        if (import.meta.env.DEV) console.error(`${logPrefix} Save failed:`, errorDetail);
      }
    } catch (e) {
      const errorDetail = e?.message || "A client-side error occurred.";
      if (import.meta.env.DEV) console.error(`${logPrefix} Unexpected error during save MIDI call:`, e);
      displaySaveStatus('error', `Save MIDI Map error: ${errorDetail}`);
    } finally {
      if (isMountedRef.current) { setIsProcessing(false); setIsSavingMidi(false); }
    }
  }, [canEdit, saveGlobalMidiMap, displayStatus, displaySaveStatus, isMidiConnected]);

  const handleLoadByName = useCallback(async (name) => {
    const logPrefix = `[EnhancedSavePanel handleLoadByName Name:${name}]`;
    if (!currentProfileAddress) { displayStatus("Cannot load: No profile active.", "warning"); return; }
    if (!name) { displayStatus("Cannot load: Invalid preset name.", "warning"); return; }
    if (typeof loadNamedConfig !== "function") { displayStatus("Load function not available.", "error"); return; }
    if (hasPendingChanges && canEdit && !window.confirm("You have unsaved changes that will be lost. Are you sure you want to load this preset?")) {
       return;
    }
    setIsProcessing(true); displayStatus(`Loading preset "${name}"...`, "info", 0);
    try {
      const result = await loadNamedConfig(name);
      if (result?.success) {
        displayStatus(`Preset "${name}" loaded successfully.`, "success");
        if (onClose) onClose();
      } else {
        const errorDetail = result?.error || "Configuration not found or is invalid.";
        displayStatus(`Load failed: ${errorDetail}`, "error");
        if (import.meta.env.DEV) console.error(`${logPrefix} Load failed:`, errorDetail);
      }
    } catch (e) {
      const errorDetail = e?.message || "A client-side error occurred during load.";
      if (import.meta.env.DEV) console.error(`${logPrefix} Unexpected error during load call:`, e);
      displayStatus(`Load error: ${errorDetail}`, "error");
    } finally {
      if (isMountedRef.current) setIsProcessing(false);
    }
  }, [currentProfileAddress, loadNamedConfig, hasPendingChanges, displayStatus, onClose, canEdit]);

  const handleLoadDefault = useCallback(async () => {
    const logPrefix = `[EnhancedSavePanel handleLoadDefault]`;
    if (!currentProfileAddress) { displayStatus("Cannot load default: No profile active.", "warning"); return; }
    if (typeof loadDefaultConfig !== "function") { displayStatus("Load Default function not available.", "error"); return; }
    if (hasPendingChanges && canEdit && !window.confirm("You have unsaved changes that will be lost. Are you sure you want to load the default preset?")) {
       return;
    }
    setIsProcessing(true); displayStatus(`Loading default configuration...`, "info", 0);
    try {
      const result = await loadDefaultConfig();
      if (result?.success) {
        const loadedName = result.config?.name;
        displayStatus(loadedName ? `Default preset "${loadedName}" loaded.` : "Default configuration loaded.", "success");
        if (onClose) onClose();
      } else {
        const errorDetail = result?.error || "Could not load default configuration.";
        if (errorDetail.includes("No default")) {
          displayStatus(`Load default failed: No default preset is set for this profile.`, "warning");
          if (import.meta.env.DEV) console.warn(`${logPrefix} Load failed: No default preset set.`);
        } else {
          displayStatus(`Load default failed: ${errorDetail}`, "error");
          if (import.meta.env.DEV) console.error(`${logPrefix} Load failed:`, errorDetail);
        }
      }
    } catch (e) {
      const errorDetail = e?.message || "A client-side error occurred.";
      if (import.meta.env.DEV) console.error(`${logPrefix} Unexpected error during load default call:`, e);
      displayStatus(`Load default error: ${errorDetail}`, "error");
    } finally {
      if (isMountedRef.current) setIsProcessing(false);
    }
  }, [currentProfileAddress, loadDefaultConfig, hasPendingChanges, displayStatus, onClose, canEdit]);

  const handleDelete = useCallback(async (name) => {
    const logPrefix = `[EnhancedSavePanel handleDelete Name:${name}]`;
    if (!canEdit) { displayStatus("Cannot delete: Permissions missing.", "error"); return; }
    if (!name) { displayStatus("Cannot delete: Invalid preset name.", "warning"); return; }
    if (typeof deleteNamedConfig !== "function") { displayStatus("Delete function not available.", "error"); return; }
    if (!window.confirm(`Are you sure you want to DELETE the preset "${name}" permanently? This action cannot be undone.`)) {
       return;
    }
    setIsProcessing(true); setIsDeleting(true); displayStatus(`Deleting preset "${name}"...`, "info", 0);
    try {
      const result = await deleteNamedConfig(name);
      if (result?.success) {
        displayStatus(`Preset "${name}" deleted successfully.`, "success");
        if (currentConfigName === name && typeof loadDefaultConfig === 'function') {
            await loadDefaultConfig();
        }
      } else {
        const errorDetail = result?.error || "Unknown error during delete.";
        displayStatus(`Delete failed: ${errorDetail}`, "error");
        if (import.meta.env.DEV) console.error(`${logPrefix} Delete failed:`, errorDetail);
      }
    } catch (e) {
      const errorDetail = e?.message || "A client-side error occurred.";
      if (import.meta.env.DEV) console.error(`${logPrefix} Unexpected error during delete call:`, e);
      displayStatus(`Delete error: ${errorDetail}`, "error");
    } finally {
      if (isMountedRef.current) { setIsProcessing(false); setIsDeleting(false); }
    }
  }, [canEdit, deleteNamedConfig, displayStatus, currentConfigName, loadDefaultConfig]);

  const getPanelTitle = () => {
    if (isPreviewMode) return "VISITOR PREVIEW";
    if (!currentProfileAddress) return "CONNECT PROFILE";
    if (canEdit) return "MY PROFILE - SAVE & MANAGE";
    return `VIEWING PROFILE (${formatAddress(currentProfileAddress)})`;
  };

  const isDisabledBaseReadOrWrite = isProcessing || presetHookIsLoading || !configServiceInstanceReady;
  const isDisabledWriteOperations = isDisabledBaseReadOrWrite || !canEdit;
  const isSavePresetDisabled = isDisabledWriteOperations || !newConfigName.trim() || isSavingPreset;
  const isSaveReactionsDisabled = isDisabledWriteOperations || isSavingReactions;
  const isSaveMidiDisabled = isDisabledWriteOperations || !isMidiConnected || isSavingMidi;
  const isGenericLoadDisabled = isDisabledBaseReadOrWrite || isDeleting;
  const isRefreshListDisabled = isDisabledBaseReadOrWrite || isLoadingListEffect || isDeleting;
  const isDeleteButtonDisabled = isDisabledWriteOperations || isDeleting;

  const renderStatusIndicator = () => {
    if (saveStatus === 'success' && canEdit) return <div className="status-indicator success">Configuration Saved</div>;
    if (saveStatus === 'error' && canEdit) return <div className="status-indicator error">Save Failed</div>;
    if (saveStatus === 'saving' && canEdit) return <div className="status-indicator saving">Saving...</div>;
    if (hasPendingChanges && canEdit) return <div className="status-indicator pending">Unsaved changes active</div>;
    if (!canEdit && currentProfileAddress && !isPreviewMode) return <div className="status-indicator idle">Viewing mode. Changes are not saved.</div>;
    return <div className="status-indicator idle">No unsaved changes detected</div>;
  };

  const renderInformationalBanner = () => {
    if (isPreviewMode) {
      return (
        <div className="save-info preview-banner">
          <span aria-hidden="true">👁️</span>
          <div>
            <div className="title">Preview Mode</div>
            <div className="desc">Saving configurations is disabled in this mode. Exit preview to manage your profile's settings.</div>
          </div>
        </div>
      );
    }
    if (!currentProfileAddress) {
      return (
        <div className="save-info connection-warning">
          <p><strong>No Profile Active</strong></p>
          <p>Connect your Universal Profile to save or load your configurations.</p>
        </div>
      );
    }
    if (!isProfileOwner && visitorUPAddress) {
      return (
        <div className="save-info visitor-banner">
          <span aria-hidden="true">👤</span>
          <div>
            <div className="title">Viewing Mode</div>
            <div className="desc">
              You are viewing another profile. You can load their presets and experiment with controls.
              Saving changes to this profile is disabled.
            </div>
          </div>
        </div>
      );
    }
    if (!isProfileOwner && !visitorUPAddress) {
        return (
          <div className="save-info visitor-banner">
            <span aria-hidden="true">👤</span>
            <div>
              <div className="title">Viewing Another Profile</div>
              <div className="desc">
                You can load this profile's presets and experiment. Connect your own Universal Profile to save your creations.
              </div>
            </div>
          </div>
        );
    }
    return null;
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
            <input id="preset-name" type="text" value={newConfigName} onChange={(e) => setNewConfigName(e.target.value)} className="form-control" placeholder="Visual Preset Name" disabled={isDisabledWriteOperations || isSavingPreset} maxLength={100} aria-describedby="save-preset-help-text preset-name-display-tip" required />
            {newConfigName.trim() && (
                <p id="preset-name-display-tip" className="form-help-text preset-name-display-tip">
                    Button will show: <strong>{getPresetDisplayLabelForPreview(newConfigName.trim())}</strong>
                    <br/>
                    (Full name "{newConfigName.trim()}" shown on hover)
                </p>
            )}
          </div>
          <div className="checkbox-options-group">
            <div className="checkbox-group"><input id="update-global-reactions" type="checkbox" checked={updateGlobalReactionsOnPresetSave} onChange={(e) => setUpdateGlobalReactionsOnPresetSave(e.target.checked)} disabled={isDisabledWriteOperations || isSavingPreset} /><label htmlFor="update-global-reactions">Also update global Reactions?</label></div>
            <div className="checkbox-group"><input id="update-global-midi" type="checkbox" checked={updateGlobalMidiOnPresetSave} onChange={(e) => setUpdateGlobalMidiOnPresetSave(e.target.checked)} disabled={isDisabledWriteOperations || !isMidiConnected || isSavingPreset} /><label htmlFor="update-global-midi" className={(isDisabledWriteOperations || !isMidiConnected || isSavingPreset) ? 'disabled-label' : ''}>Also update global MIDI Map? { !isMidiConnected && "(MIDI Disconnected)"}</label></div>
            <div className="checkbox-group"><input id="set-default-preset" type="checkbox" checked={setAsDefault} onChange={(e) => setSetAsDefault(e.target.checked)} disabled={isDisabledWriteOperations || isSavingPreset} /><label htmlFor="set-default-preset">Set as Default preset for this profile</label></div>
          </div>
          <p id="save-preset-help-text" className="form-help-text">Saves current visual layers & tokens. Optionally updates global Reactions/MIDI map too.</p>
          {typeof actualSavePreset === "function" ? (<button className="btn btn-block btn-save btn-save-preset" onClick={handleSavePreset} disabled={isSavePresetDisabled} aria-live="polite">{isSavingPreset ? "SAVING PRESET..." : `SAVE PRESET "${newConfigName.trim() || "..."}"`}</button>) : ( <p className="error-message">Save Preset action is unavailable.</p> )}
        </div>
      )}

      {canEdit && currentProfileAddress && (
        <div className="config-section save-global-section">
          <h3>Update Global Settings Only</h3>
          <p className="form-help-text">Saves only the current Reactions or MIDI map globally. Does not create a named visual preset.</p>
          <div className="global-save-buttons">
            {typeof saveGlobalReactions === "function" ? (<button className="btn btn-secondary btn-save-global" onClick={handleSaveGlobalReactions} disabled={isSaveReactionsDisabled} aria-live="polite">{isSavingReactions ? "SAVING..." : "Save Global Reactions"}</button>) : ( <p className="error-message">Save Reactions action is unavailable.</p> )}
            {typeof saveGlobalMidiMap === "function" ? (<button className="btn btn-secondary btn-save-global" onClick={handleSaveGlobalMidiMap} disabled={isSaveMidiDisabled} aria-live="polite" title={!isMidiConnected ? "Connect MIDI device to save map" : "Save current MIDI map globally"}>{isSavingMidi ? "SAVING..." : "Save Global MIDI Map"}</button>) : ( <p className="error-message">Save MIDI Map action is unavailable.</p> )}
          </div>
        </div>
      )}

      {currentProfileAddress && !isPreviewMode && (
        <div className="config-section load-section">
          <h3>Load / Delete Presets</h3>
          <div className="load-actions-group">
            {typeof loadDefaultConfig === "function" && (<button className="btn btn-secondary" onClick={handleLoadDefault} disabled={isGenericLoadDisabled} title={isGenericLoadDisabled ? "Processing..." : "Load default preset"}>{(presetHookIsLoading && !currentConfigName) ? "LOADING..." : "Load Default"}</button>)}
            {typeof loadSavedConfigList === "function" && (<button className="btn btn-secondary btn-outline" onClick={() => { if (!isRefreshListDisabled) loadSavedConfigList(); }} disabled={isRefreshListDisabled} title={isRefreshListDisabled ? "Processing..." : "Refresh preset list"} aria-live="polite">{isLoadingListEffect || (presetHookIsLoading && savedConfigList.length === 0) ? "REFRESHING..." : "Refresh List"}</button>)}
          </div>
          {isLoadingListEffect || (presetHookIsLoading && savedConfigList.length === 0 && currentProfileAddress) ? (
            <p className="loading-list-message">Loading presets...</p>
          ) : savedConfigList?.length > 0 ? (
            <ul className="config-list">
              {Array.isArray(savedConfigList) && savedConfigList.map((preset) => (
                <li key={preset.name} className={preset.name === currentConfigName ? "active" : ""}>
                  {typeof loadNamedConfig === "function" ? (<button className="btn-link config-name" onClick={() => { if (!isGenericLoadDisabled) handleLoadByName(preset.name); }} disabled={isGenericLoadDisabled} title={isGenericLoadDisabled ? "Processing..." : `Load "${preset.name}"`}>{preset.name}</button>) : ( <span className="config-name-noload">{preset.name}</span> )}
                  {canEdit && typeof deleteNamedConfig === "function" && (<button className="btn-icon delete-config" onClick={() => { if (!isDeleteButtonDisabled) handleDelete(preset.name); }} disabled={isDeleteButtonDisabled} title={isDeleteButtonDisabled ? "Processing..." : `Delete "${preset.name}"`} aria-label={`Delete preset ${preset.name}`}>×</button>)}
                </li>
              ))}
            </ul>
          ) : ( currentProfileAddress && <p className="no-configs-message">No saved visual presets found for this profile.</p> )}
        </div>
      )}

      {renderInformationalBanner()}
    </Panel>
  );
};

EnhancedSavePanel.propTypes = {
  /** Callback function to close the panel. */
  onClose: PropTypes.func.isRequired,
};

export default React.memo(EnhancedSavePanel);