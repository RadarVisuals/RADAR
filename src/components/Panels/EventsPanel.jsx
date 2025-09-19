// src/components/Panels/EventsPanel.jsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import { EVENT_TYPE_MAP } from "../../config/global-config";
import { useToast } from "../../context/ToastContext";
import { useAppContext } from "../../context/AppContext";
import { useUserSession } from "../../context/UserSessionContext";

import "./PanelStyles/Eventspanel.css";

const generateEventOptions = () => {
    const optionsMap = new Map();
    Object.keys(EVENT_TYPE_MAP).forEach((readableKey) => {
        const typeId = EVENT_TYPE_MAP[readableKey];
        if (!optionsMap.has(typeId)) {
            optionsMap.set(typeId, {
                value: typeId,
                label: readableKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
            });
        }
    });

    return Array.from(optionsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
};

const EventsPanel = ({
  onClose,
  onPreviewEffect,
}) => {
  const { addToast } = useToast();
  const { canSaveToHostProfile } = useUserSession();
  const {
    stagedActiveWorkspace,
    updateGlobalEventReactions,
    deleteGlobalEventReaction,
  } = useAppContext();

  const readOnly = !canSaveToHostProfile;
  const reactions = useMemo(() => stagedActiveWorkspace?.globalEventReactions || {}, [stagedActiveWorkspace]);
  const onSaveReaction = updateGlobalEventReactions;
  const onRemoveReaction = deleteGlobalEventReaction;

  const allEventOptions = useMemo(() => generateEventOptions(), []);

  const [selectedEvent, setSelectedEvent] = useState(allEventOptions[0]?.value || "");
  const [selectedEffect, setSelectedEffect] = useState("color_overlay");
  const [effectConfig, setEffectConfig] = useState({
    color: "rgba(255, 165, 0, 0.4)", pulseCount: 2, duration: 2500,
    r: 255, g: 165, b: 0, a: 0.4,
  });
  const [previewStatus, setPreviewStatus] = useState("");

  useEffect(() => {
    const existingReaction = reactions[selectedEvent];
    if (existingReaction) {
      setSelectedEffect(existingReaction.effect || "color_overlay");
      if (existingReaction.effect === "color_overlay" && existingReaction.config) {
        const colorString = existingReaction.config.color || "rgba(255, 165, 0, 0.4)";
        const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        const [r, g, b, a] = rgbaMatch
          ? [ parseInt(rgbaMatch[1],10), parseInt(rgbaMatch[2],10), parseInt(rgbaMatch[3],10), parseFloat(rgbaMatch[4] ?? 1) ]
          : [255, 165, 0, 0.4];
        setEffectConfig({
          color: colorString,
          pulseCount: existingReaction.config.pulseCount || 2,
          duration: existingReaction.config.duration || 2500,
          r, g, b, a,
        });
      } else {
        setEffectConfig({ color: "rgba(255, 165, 0, 0.4)", pulseCount: 2, duration: 2500, r: 255, g: 165, b: 0, a: 0.4 });
      }
    } else {
      setSelectedEffect("color_overlay");
      setEffectConfig({ color: "rgba(255, 165, 0, 0.4)", pulseCount: 2, duration: 2500, r: 255, g: 165, b: 0, a: 0.4 });
    }
  }, [selectedEvent, reactions]);

  const handleEventChange = useCallback((e) => setSelectedEvent(e.target.value), []);

  const handleEffectChange = useCallback((e) => {
    const newEffectType = e.target.value;
    setSelectedEffect(newEffectType);
    if (newEffectType === "color_overlay") {
      setEffectConfig({ color: "rgba(255, 165, 0, 0.4)", pulseCount: 2, duration: 2500, r: 255, g: 165, b: 0, a: 0.4 });
    } else {
      setEffectConfig({});
    }
  }, []);

  const handleColorChange = useCallback((component, value) => {
    setEffectConfig((prevConfig) => {
      const updatedConfig = { ...prevConfig, [component]: Number(value) };
      const { r = 0, g = 0, b = 0, a = 1 } = updatedConfig;
      updatedConfig.color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a).toFixed(2)})`;
      return updatedConfig;
    });
  }, []);

  const handleConfigChange = useCallback((field, value) => {
    const numericValue = ["pulseCount", "duration"].includes(field) ? parseInt(value, 10) : value;
    setEffectConfig((prev) => ({ ...prev, [field]: numericValue }));
  }, []);

  const handleStageLocally = useCallback(() => {
    if (readOnly) { addToast("Read-only mode: Cannot stage changes.", "warning"); return; }
    if (typeof onSaveReaction !== "function") { addToast("Error: Staging function unavailable.", "error"); return; }
    if (!selectedEvent) { addToast("Please select an event type.", "warning"); return; }

    const reactionId = selectedEvent;
    const reactionConfigToStage = {
      event: selectedEvent,
      layer: "global",
      effect: selectedEffect,
      config: selectedEffect === "color_overlay" ? {
          color: effectConfig.color,
          pulseCount: Number(effectConfig.pulseCount),
          duration: Number(effectConfig.duration),
        } : {},
    };

    try {
      onSaveReaction(reactionId, reactionConfigToStage);
      const eventLabel = allEventOptions.find(opt => opt.value === selectedEvent)?.label || selectedEvent;
      addToast(`Reaction for '${eventLabel}' staged. Save globally via Save Panel.`, "success");
    } catch (error) {
      if (import.meta.env.DEV) console.error("[EventsPanel] Error during onSaveReaction call:", error);
      addToast(`Error staging reaction: ${error.message || "Unknown error"}`, "error");
    }
  }, [ readOnly, selectedEvent, selectedEffect, effectConfig, onSaveReaction, addToast, allEventOptions ]);

  const handleRemoveStagedReaction = useCallback((typeIdToRemove) => {
    if (readOnly) { addToast("Read-only mode: Cannot unstage changes.", "warning"); return; }
    if (typeof onRemoveReaction !== "function") { addToast("Error: Unstaging function unavailable.", "error"); return; }
    if (!typeIdToRemove) { addToast("No event type specified to unstage.", "warning"); return; }

    const eventLabel = allEventOptions.find(opt => opt.value === typeIdToRemove)?.label || typeIdToRemove;
    if (window.confirm(`Are you sure you want to unstage the reaction for "${eventLabel}"? This will remove it from the current pending changes.`)) {
        try {
            onRemoveReaction(typeIdToRemove);
            addToast(`Reaction for "${eventLabel}" unstaged.`, "info");
            if (selectedEvent === typeIdToRemove) {
                setSelectedEvent(allEventOptions[0]?.value || "");
            }
        } catch (error) {
            if (import.meta.env.DEV) console.error("[EventsPanel] Error during onRemoveReaction call:", error);
            addToast(`Error unstaging reaction: ${error.message || "Unknown error"}`, "error");
        }
    }
  }, [readOnly, onRemoveReaction, addToast, selectedEvent, allEventOptions]);


  const handlePreview = useCallback(() => {
    setPreviewStatus("");
    if (typeof onPreviewEffect !== "function") {
      setPreviewStatus("Preview function unavailable.");
      setTimeout(() => setPreviewStatus(""), 3000);
      return;
    }
    const effectToPreview = {
      layer: "global",
      type: selectedEffect,
      config: selectedEffect === "color_overlay" ? {
          color: effectConfig.color,
          pulseCount: Number(effectConfig.pulseCount),
          duration: Number(effectConfig.duration),
        } : {},
      effectId: `preview_${Date.now()}`,
    };
    onPreviewEffect(effectToPreview)
      .then((effectId) => {
        setPreviewStatus(effectId ? "Preview triggered!" : "Preview failed to apply.");
        setTimeout(() => setPreviewStatus(""), 2000);
      })
      .catch((error) => {
        if (import.meta.env.DEV) console.error("[EventsPanel] Error triggering preview effect:", error);
        setPreviewStatus("Preview error occurred.");
        setTimeout(() => setPreviewStatus(""), 3000);
      });
  }, [onPreviewEffect, selectedEffect, effectConfig]);

  return (
    <Panel
      title="EVENT REACTIONS"
      onClose={onClose}
      className="panel-from-toolbar events-panel-custom-scroll"
    >
      <div className="reaction-form section-box">
        <h3 className="section-title">Configure New Reaction / Edit Existing</h3>
        <p className="form-help-text">
          Select an event to configure its visual reaction. Click "Stage Reaction" to add your changes.
          Finally, use the main Save Panel to persist all staged reactions globally to this profile.
        </p>
        <div className="form-group">
          <label htmlFor="event-select">Event Type</label>
          <select id="event-select" value={selectedEvent} onChange={handleEventChange} className="custom-select" disabled={readOnly} aria-label="Select Event Type">
            {allEventOptions.map((opt) => (
              <option key={opt.value} value={opt.value}> {opt.label} </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="effect-select">Visual Effect</label>
          <select id="effect-select" value={selectedEffect} onChange={handleEffectChange} className="custom-select" disabled={readOnly} aria-label="Select Visual Effect">
            <option value="color_overlay">Color Overlay Pulse</option>
          </select>
        </div>

        {selectedEffect === "color_overlay" && (
          <div className="color-config-section">
            <h4 className="config-section-title">Effect Settings: Color Overlay</h4>
            <div className="color-preview-container">
              <span className="color-preview-label">Preview:</span>
              <div className="color-preview" style={{ backgroundColor: effectConfig.color }} title={`Current color: ${effectConfig.color}`} ></div>
            </div>
            <div className="slider-group">
              <div className="slider-container"><div className="slider-header"> <span className="slider-label">Red</span> <span className="slider-value">{effectConfig.r || 0}</span> </div><input type="range" min="0" max="255" step="1" value={effectConfig.r || 0} onChange={(e) => handleColorChange("r", parseInt(e.target.value,10))} className="color-slider red-slider" disabled={readOnly} aria-label="Red color component"/></div>
              <div className="slider-container"><div className="slider-header"> <span className="slider-label">Green</span> <span className="slider-value">{effectConfig.g || 0}</span> </div><input type="range" min="0" max="255" step="1" value={effectConfig.g || 0} onChange={(e) => handleColorChange("g", parseInt(e.target.value,10))} className="color-slider green-slider" disabled={readOnly} aria-label="Green color component"/></div>
              <div className="slider-container"><div className="slider-header"> <span className="slider-label">Blue</span> <span className="slider-value">{effectConfig.b || 0}</span> </div><input type="range" min="0" max="255" step="1" value={effectConfig.b || 0} onChange={(e) => handleColorChange("b", parseInt(e.target.value,10))} className="color-slider blue-slider" disabled={readOnly} aria-label="Blue color component"/></div>
              <div className="slider-container"><div className="slider-header"> <span className="slider-label">Opacity</span> <span className="slider-value">{(Number(effectConfig.a) || 0).toFixed(2)}</span> </div><input type="range" min="0" max="1" step="0.01" value={effectConfig.a || 0} onChange={(e) => handleColorChange("a", parseFloat(e.target.value))} className="color-slider alpha-slider" disabled={readOnly} aria-label="Color opacity"/></div>
            </div>
            <div className="slider-group">
              <div className="slider-container"><div className="slider-header"> <span className="slider-label">Pulse Count</span> <span className="slider-value">{effectConfig.pulseCount || 1}</span> </div><input type="range" min="1" max="10" step="1" value={effectConfig.pulseCount || 1} onChange={(e) => handleConfigChange("pulseCount", e.target.value)} disabled={readOnly} aria-label="Number of pulses"/></div>
              <div className="slider-container"><div className="slider-header"> <span className="slider-label">Total Duration (ms)</span> <span className="slider-value">{effectConfig.duration || 500}</span> </div><input type="range" min="500" max="10000" step="100" value={effectConfig.duration || 500} onChange={(e) => handleConfigChange("duration", e.target.value)} disabled={readOnly} aria-label="Total effect duration in milliseconds"/></div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-secondary btn-preview" onClick={handlePreview} disabled={typeof onPreviewEffect !== "function"} title="Trigger a preview of the current effect settings" > PREVIEW EFFECT </button>
          <button className="btn btn-primary btn-save-reaction" onClick={handleStageLocally} disabled={readOnly || typeof onSaveReaction !== "function"} title={ readOnly ? "Cannot stage in read-only mode" : "Stage this reaction (must save globally via Save Panel)" } > STAGE REACTION </button>
        </div>

        {previewStatus && ( <div className="status-message preview-status">{previewStatus}</div> )}
      </div>

      <div className="active-reactions section-box">
        <h3 className="section-title">Current Global Event Reactions (Profile)</h3>
        {Object.keys(reactions).length === 0 ? (
          <div className="no-reactions">No global reactions currently saved for this profile.</div>
        ) : (
          <div className="reactions-list">
            {Object.entries(reactions).map(([typeId, reaction]) => {
              const eventLabel = allEventOptions.find((opt) => opt.value === typeId)?.label || typeId.slice(0,10)+"...";
              return (
                <div key={typeId} className="reaction-item" id={'reaction-' + typeId} >
                  <div className="reaction-details">
                    <span className="reaction-event" title={typeId}>
                      {eventLabel}
                    </span>
                    <span className="reaction-effect-type"> ({reaction.effect === "color_overlay" ? "Color Pulse" : reaction.effect}) </span>
                    {reaction.effect === "color_overlay" && reaction.config?.color && (
                        <span className="color-pill" style={{ backgroundColor: reaction.config.color }} title={`Color: ${reaction.config.color}`} ></span>
                    )}
                  </div>
                  {!readOnly && typeof onRemoveReaction === 'function' && (
                      <button
                          className="btn-icon delete-reaction"
                          onClick={() => handleRemoveStagedReaction(typeId)}
                          title={`Unstage reaction for ${eventLabel}`}
                          aria-label={`Unstage reaction for ${eventLabel}`}
                      >
                          ×
                      </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {readOnly && ( <p className="read-only-hint">Viewing in read-only mode. Staging or unstaging reactions is disabled.</p> )}
        {!readOnly && ( <p className="save-hint"> Use the main Save Panel to persist staged changes globally to your profile. </p> )}
      </div>
    </Panel>
  );
};

EventsPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
  onPreviewEffect: PropTypes.func,
};

export default React.memo(EventsPanel);