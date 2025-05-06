import React, { useState, useCallback, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Panel from "./Panel";
import "./PanelStyles/EventsPanel.css";
import { EVENT_TYPE_MAP } from "../../config/global-config";
import { useToast } from "../../context/ToastContext";

// Helper function moved outside component for stability
const generateEventOptions = () => {
    const optionsMap = new Map();
    Object.keys(EVENT_TYPE_MAP).forEach((key) => {
        if (!optionsMap.has(key)) {
            optionsMap.set(key, {
                value: key,
                label: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
            });
        }
    });
    const manualTypes = [
        { value: "lyx_sent", label: "LYX Sent" },
        { value: "token_received", label: "Token Received" },
        { value: "token_sent", label: "Token Sent" },
        { value: "follower_gained", label: "Follower Gained" },
        { value: "follower_lost", label: "Follower Lost" },
        { value: "lsp7_received", label: "LSP7 Received" },
        { value: "lsp8_received", label: "LSP8 Received" },
    ];
    manualTypes.forEach(opt => {
        if (!optionsMap.has(opt.value)) {
            optionsMap.set(opt.value, opt);
        }
    });
    return Array.from(optionsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
};

/**
 * EventsPanel: Allows users to configure visual reactions triggered by specific
 * blockchain events (received via LSP1). Users can select an event type,
 * choose a visual effect (currently Color Overlay Pulse), configure its parameters
 * (color, duration, pulse count), preview the effect, and stage the reaction locally.
 * Staged reactions are listed and must be saved globally via the Save Panel.
 */
const EventsPanel = ({
  onSaveReaction,
  // onRemoveReaction, // Removed as it's unused
  reactions = {},
  onClose,
  readOnly = false,
  onPreviewEffect,
}) => {
  const { addToast } = useToast();
  const allEventOptions = useMemo(() => generateEventOptions(), []);

  const [selectedEvent, setSelectedEvent] = useState(allEventOptions[0]?.value || "");
  const [selectedEffect, setSelectedEffect] = useState("color_overlay");
  const [effectConfig, setEffectConfig] = useState({
    color: "rgba(255, 165, 0, 0.4)", pulseCount: 2, duration: 2500,
    r: 255, g: 165, b: 0, a: 0.4,
  });
  const [previewStatus, setPreviewStatus] = useState("");

  // Effect to load existing config when event type changes
  useEffect(() => {
    const existingReaction = reactions[selectedEvent];
    if (existingReaction) {
      setSelectedEffect(existingReaction.effect || "color_overlay");
      if (existingReaction.effect === "color_overlay" && existingReaction.config) {
        const rgbaMatch = existingReaction.config.color?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        const [r, g, b, a] = rgbaMatch ? [ parseInt(rgbaMatch[1]), parseInt(rgbaMatch[2]), parseInt(rgbaMatch[3]), parseFloat(rgbaMatch[4] ?? 1) ] : [255, 165, 0, 0.4];
        setEffectConfig({
          color: existingReaction.config.color || "rgba(255, 165, 0, 0.4)",
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

  const handleEventChange = (e) => setSelectedEvent(e.target.value);

  const handleEffectChange = (e) => {
    const newEffectType = e.target.value;
    setSelectedEffect(newEffectType);
    if (newEffectType === "color_overlay") {
      setEffectConfig({ color: "rgba(255, 165, 0, 0.4)", pulseCount: 2, duration: 2500, r: 255, g: 165, b: 0, a: 0.4 });
    } else {
      setEffectConfig({});
    }
  };

  const handleColorChange = useCallback((component, value) => {
    setEffectConfig((prevConfig) => {
      const updatedConfig = { ...prevConfig };
      updatedConfig[component] = value;
      const { r = 0, g = 0, b = 0, a = 1 } = updatedConfig;
      updatedConfig.color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a).toFixed(2)})`;
      return updatedConfig;
    });
  }, []);

  const handleConfigChange = useCallback((field, value) => {
    const numericValue = ["pulseCount", "duration"].includes(field) ? parseInt(value, 10) : value;
    setEffectConfig((prev) => ({ ...prev, [field]: numericValue }));
  }, []);

  // Handle saving/updating the reaction LOCALLY
  const handleSave = useCallback(() => {
    if (readOnly) { addToast("Read-only mode", "warning"); return; }
    if (!onSaveReaction) { addToast("Error: Save function unavailable", "error"); return; }
    if (!selectedEvent) { addToast("Please select an event type.", "warning"); return; }

    const reactionId = selectedEvent; // Use event type as the unique ID for staging
    const reactionConfig = {
      event: selectedEvent,
      layer: "global", // Effects currently apply globally
      effect: selectedEffect,
      config: selectedEffect === "color_overlay" ? {
          color: effectConfig.color,
          pulseCount: effectConfig.pulseCount,
          duration: effectConfig.duration,
        } : {},
    };

    try {
      onSaveReaction(reactionId, reactionConfig);
      addToast(`Reaction for '${selectedEvent}' staged locally. Save globally via Save Panel.`, "success");
    } catch (error) {
      console.error("Error during onSaveReaction call:", error); // Keep error log
      addToast(`Error staging reaction: ${error.message || "Unknown error"}`, "error");
    }
  }, [ readOnly, selectedEvent, selectedEffect, effectConfig, onSaveReaction, addToast ]);

  // Handle Preview Action
  const handlePreview = useCallback(() => {
    setPreviewStatus("");
    if (!onPreviewEffect) {
      setPreviewStatus("Preview unavailable.");
      setTimeout(() => setPreviewStatus(""), 3000);
      return;
    }
    const effectToPreview = {
      layer: "global", // Effects apply globally for preview
      type: selectedEffect,
      config: selectedEffect === "color_overlay" ? {
          color: effectConfig.color,
          pulseCount: effectConfig.pulseCount,
          duration: effectConfig.duration,
        } : {},
      previewId: `preview_${Date.now()}`,
    };
    onPreviewEffect(effectToPreview)
      .then((effectId) => {
        setPreviewStatus(effectId ? "Preview triggered!" : "Preview failed.");
        setTimeout(() => setPreviewStatus(""), 2000);
      })
      .catch((error) => {
        console.error("[EventsPanel] Error triggering preview effect:", error); // Keep error log
        setPreviewStatus("Preview error.");
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
        <h3 className="section-title">Configure New Reaction / Edit</h3>
        <p className="form-help-text">
          Select an event type to configure its reaction. Click "Stage Locally"
          then use the main Save Panel to persist all staged changes.
        </p>
        <div className="form-group">
          <label htmlFor="event-select">Event Type</label>
          <select id="event-select" value={selectedEvent} onChange={handleEventChange} className="custom-select" disabled={readOnly} >
            {allEventOptions.map((opt) => (
              <option key={opt.value} value={opt.value}> {opt.label} </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="effect-select">Visual Effect</label>
          <select id="effect-select" value={selectedEffect} onChange={handleEffectChange} className="custom-select" disabled={readOnly} >
            <option value="color_overlay">Color Overlay Pulse</option>
            {/* Add other effect options here */}
          </select>
        </div>

        {selectedEffect === "color_overlay" && (
          <div className="color-config-section">
            <h4 className="config-section-title"> Effect Settings: Color Overlay </h4>
            <div className="color-preview-container">
              <span className="color-preview-label">Preview:</span>
              <div className="color-preview" style={{ backgroundColor: effectConfig.color }} title={`Current color: ${effectConfig.color}`} ></div>
            </div>
            <div className="slider-group">
              <div className="slider-container">
                <div className="slider-header"> <span className="slider-label">Red</span> <span className="slider-value">{effectConfig.r || 0}</span> </div>
                <input type="range" min="0" max="255" step="1" value={effectConfig.r || 0} onChange={(e) => handleColorChange("r", parseInt(e.target.value))} className="color-slider red-slider" disabled={readOnly} />
              </div>
              <div className="slider-container">
                <div className="slider-header"> <span className="slider-label">Green</span> <span className="slider-value">{effectConfig.g || 0}</span> </div>
                <input type="range" min="0" max="255" step="1" value={effectConfig.g || 0} onChange={(e) => handleColorChange("g", parseInt(e.target.value))} className="color-slider green-slider" disabled={readOnly} />
              </div>
              <div className="slider-container">
                <div className="slider-header"> <span className="slider-label">Blue</span> <span className="slider-value">{effectConfig.b || 0}</span> </div>
                <input type="range" min="0" max="255" step="1" value={effectConfig.b || 0} onChange={(e) => handleColorChange("b", parseInt(e.target.value))} className="color-slider blue-slider" disabled={readOnly} />
              </div>
              <div className="slider-container">
                <div className="slider-header"> <span className="slider-label">Opacity</span> <span className="slider-value">{(effectConfig.a || 0).toFixed(2)}</span> </div>
                <input type="range" min="0" max="1" step="0.01" value={effectConfig.a || 0} onChange={(e) => handleColorChange("a", parseFloat(e.target.value))} className="color-slider alpha-slider" disabled={readOnly} />
              </div>
            </div>
            <div className="slider-group">
              <div className="slider-container">
                <div className="slider-header"> <span className="slider-label">Pulse Count</span> <span className="slider-value">{effectConfig.pulseCount || 1}</span> </div>
                <input type="range" min="1" max="10" step="1" value={effectConfig.pulseCount || 1} onChange={(e) => handleConfigChange("pulseCount", e.target.value)} disabled={readOnly} />
              </div>
              <div className="slider-container">
                <div className="slider-header"> <span className="slider-label">Total Duration (ms)</span> <span className="slider-value">{effectConfig.duration || 500}</span> </div>
                <input type="range" min="500" max="10000" step="100" value={effectConfig.duration || 500} onChange={(e) => handleConfigChange("duration", e.target.value)} disabled={readOnly} />
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-secondary btn-preview" onClick={handlePreview} disabled={!onPreviewEffect} title="Trigger a preview of the current effect settings" > PREVIEW EFFECT </button>
          <button className="btn btn-primary btn-save-reaction" onClick={handleSave} disabled={readOnly || !onSaveReaction} title={ readOnly ? "Cannot save in read-only mode" : "Stage this reaction locally (must save globally via Save Panel)" } > STAGE LOCALLY </button>
        </div>

        {previewStatus && ( <div className="status-message preview-status">{previewStatus}</div> )}
      </div>

      <div className="active-reactions section-box">
        <h3 className="section-title">Locally Staged Reactions</h3>
        {Object.keys(reactions).length === 0 ? (
          <div className="no-reactions">No reactions staged yet.</div>
        ) : (
          <div className="reactions-list">
            {Object.entries(reactions).map(([eventType, reaction]) => (
              <div key={eventType} className="reaction-item" id={`reaction-${eventType}`} >
                <div className="reaction-details">
                  <span className="reaction-event">
                    {allEventOptions.find((opt) => opt.value === reaction.event)?.label || reaction.event.replace(/_/g, " ")}
                  </span>
                  <span className="reaction-effect-type"> ({reaction.effect === "color_overlay" ? "Color Pulse" : reaction.effect}) </span>
                  {reaction.effect === "color_overlay" && reaction.config?.color && (
                      <span className="color-pill" style={{ backgroundColor: reaction.config.color }} title={`Color: ${reaction.config.color}`} ></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!readOnly && ( <p className="save-hint"> Use the main Save Panel to persist staged changes to your profile. </p> )}
        {readOnly && ( <p className="read-only-hint">Viewing in read-only mode.</p> )}
      </div>
    </Panel>
  );
};

EventsPanel.propTypes = {
  onSaveReaction: PropTypes.func,
  // onRemoveReaction: PropTypes.func, // Removed unused prop
  reactions: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  readOnly: PropTypes.bool,
  onPreviewEffect: PropTypes.func,
};

export default EventsPanel;