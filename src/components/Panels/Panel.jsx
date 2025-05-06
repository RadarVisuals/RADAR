// src/components/Panel.jsx
import React from "react";
import PropTypes from "prop-types";
import "./PanelStyles/PanelStyles.css";

/**
 * Base Panel component used by all panel types in the application.
 * Provides a consistent header with title and close button, and a content area.
 */
const Panel = ({ title, onClose, children, className = "", width = null }) => {
  return (
    <div
      className={`panel ${className}`}
      style={{ width: width || "var(--panel-width)" }} // Allow overriding default width
    >
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        {onClose && ( // Conditionally render close button
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close panel"
          >
            ✕
          </button>
        )}
      </div>

      <div className="panel-content">{children}</div>
    </div>
  );
};

Panel.propTypes = {
  title: PropTypes.string.isRequired,
  onClose: PropTypes.func, // Optional close handler
  children: PropTypes.node.isRequired,
  className: PropTypes.string, // Optional additional CSS classes
  width: PropTypes.string, // Optional width override
};

export default Panel;