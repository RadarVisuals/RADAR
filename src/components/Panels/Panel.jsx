// src/components/Panels/Panel.jsx
import React from "react";
import PropTypes from "prop-types";
import "./PanelStyles/PanelStyles.css"; // Local styles

/**
 * @typedef {object} PanelProps
 * @property {string} title - The title to be displayed in the panel header.
 * @property {(() => void)} [onClose] - Optional callback function to handle the close action. If provided, a close button will be rendered.
 * @property {React.ReactNode} children - The content to be rendered within the panel's body.
 * @property {string} [className=""] - Optional additional CSS class names to apply to the panel's root element for custom styling.
 * @property {string | null} [width=null] - Optional CSS width override for the panel (e.g., "300px", "50%"). If null, it defaults to a CSS variable `--panel-width`.
 */

/**
 * Base Panel component used by all panel types in the application.
 * It provides a consistent structure with a header (containing a title and an optional close button)
 * and a content area for child elements. The panel's width can be customized.
 *
 * @param {PanelProps} props - The component's props.
 * @returns {JSX.Element} The rendered Panel component.
 */
const Panel = ({ title, onClose, children, className = "", width = null }) => {
  return (
    <div
      className={`panel ${className}`} // Apply base class and any additional classes
      style={{ width: width || "var(--panel-width)" }} // Allow overriding default width via prop, fallback to CSS variable
      role="dialog" // Assuming panels are dialog-like; adjust if not always modal
      aria-labelledby="panel-title-id" // Link to title for accessibility
      // aria-modal={!!onClose} // Consider if it's always modal when closable
    >
      <div className="panel-header">
        <h2 className="panel-title" id="panel-title-id">{title}</h2>
        {onClose && ( // Conditionally render close button if onClose callback is provided
          <button
            className="close-button" // Standard class for styling
            onClick={onClose}
            aria-label={`Close ${title} panel`} // More specific accessible name
            title="Close" // Tooltip
          >
            ✕ {/* Standard multiplication sign for 'close' */}
          </button>
        )}
      </div>

      <div className="panel-content">
        {children}
      </div>
    </div>
  );
};

Panel.propTypes = {
  title: PropTypes.string.isRequired,
  onClose: PropTypes.func,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  width: PropTypes.string,
};

// Default export is standard for React components.
export default Panel;