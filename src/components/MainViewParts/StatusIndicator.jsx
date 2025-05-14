// src/components/MainViewParts/StatusIndicator.jsx (Assuming path based on context)
import React from 'react';
import PropTypes from 'prop-types';

// Assuming common styles for status display are in a shared or component-specific CSS file.
// For example: import './StatusIndicator.css';
// Or, if styles are in Mainview.css as hinted, ensure that's loaded by the parent.

/**
 * @typedef {'initializing' | 'waiting_layout' | 'initializing_managers' | 'loading_defaults' | 'resolving_initial_config' | 'fading_out' | 'applying_config' | 'rendered' | 'error' | 'prompt_connect'} RenderStateValue - Possible states of the render lifecycle, influencing the indicator's appearance.
 */

/**
 * @typedef {object} StatusIndicatorProps
 * @property {boolean} showStatusDisplay - Determines if the status indicator should be visible at all.
 * @property {boolean} isStatusFadingOut - If true, applies a fade-out animation class to the indicator.
 * @property {RenderStateValue} renderState - The current rendering lifecycle state, used to determine specific styling (e.g., for errors).
 * @property {string} loadingStatusMessage - The message to display within the indicator (e.g., "Loading...", "Error...", "Connecting...").
 * @property {boolean} showRetryButton - If true, a "Retry Render" button is displayed alongside the status message, typically in recoverable error states.
 * @property {() => void} onManualRetry - Callback function invoked when the "Retry Render" button is clicked.
 */

/**
 * StatusIndicator: A component that displays the current loading status, error messages,
 * or other informational messages related to the application's rendering lifecycle.
 * It can show a retry button in certain error states and supports fade-out animations.
 *
 * @param {StatusIndicatorProps} props - The component's props.
 * @returns {JSX.Element | null} The rendered StatusIndicator component, or null if `showStatusDisplay` is false.
 */
const StatusIndicator = ({
  showStatusDisplay,
  isStatusFadingOut,
  renderState,
  loadingStatusMessage,
  showRetryButton,
  onManualRetry,
}) => {
  // If the indicator should not be shown at all, render nothing.
  if (!showStatusDisplay) {
    return null;
  }

  /**
   * Determines the appropriate CSS class for the status display based on the renderState.
   * @returns {string} CSS class name (e.g., 'error-state', 'prompt-connect-state', 'info-state').
   */
  const getStatusDisplayClass = () => {
    if (renderState === 'error') return 'error-state'; // Specific styling for critical errors
    if (renderState === 'prompt_connect') return 'prompt-connect-state'; // Styling for connection prompts
    return 'info-state'; // Default styling for other informational messages
  };

  /**
   * Renders the content of the status display, which can include the status message
   * and an optional retry button.
   * @returns {JSX.Element} The content to be rendered inside the status display.
   */
  const renderStatusContent = () => {
    if (showRetryButton) {
      return (
        <>
          <span>{loadingStatusMessage}</span> {/* Wrap message in span for better structure */}
          <button onClick={onManualRetry} className="retry-render-button">
            Retry Render
          </button>
        </>
      );
    }
    return <span>{loadingStatusMessage}</span>; // Wrap message in span
  };

  return (
    <div
      className={`status-display ${getStatusDisplayClass()} ${
        isStatusFadingOut ? 'fade-out' : '' // Apply fade-out class for animations
      }`}
      role="status" // Accessibility: Indicates this region's content may change and is a status message
      aria-live="polite" // Accessibility: Announce changes politely
      aria-atomic="true" // Accessibility: Announce the entire region when it changes
    >
      {renderStatusContent()}
    </div>
  );
};

StatusIndicator.propTypes = {
  /** Determines if the status indicator should be visible. */
  showStatusDisplay: PropTypes.bool.isRequired,
  /** If true, applies a fade-out animation class. */
  isStatusFadingOut: PropTypes.bool.isRequired,
  /** The current rendering lifecycle state, influencing styling. */
  renderState: PropTypes.string.isRequired,
  /** The message to display. */
  loadingStatusMessage: PropTypes.string.isRequired,
  /** If true, a "Retry Render" button is displayed. */
  showRetryButton: PropTypes.bool.isRequired,
  /** Callback for the "Retry Render" button. */
  onManualRetry: PropTypes.func.isRequired,
};

// Default export is standard for React components.
export default StatusIndicator;