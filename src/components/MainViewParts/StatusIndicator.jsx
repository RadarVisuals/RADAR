import React from 'react';
import PropTypes from 'prop-types';
// Assuming Mainview.css contains .status-display, .error-state etc.
// If not, you might need to import or define them here.
// import './StatusIndicator.css'; // Or include specific styles here

const StatusIndicator = ({
  showStatusDisplay,
  isStatusFadingOut,
  renderState,
  loadingStatusMessage,
  showRetryButton,
  onManualRetry,
}) => {
  if (!showStatusDisplay) {
    return null;
  }

  const getStatusDisplayClass = () => {
    if (renderState === 'error') return 'error-state';
    if (renderState === 'prompt_connect') return 'prompt-connect-state';
    return 'info-state';
  };

  const renderStatusContent = () => {
    if (showRetryButton) {
      return (
        <>
          {loadingStatusMessage}
          <button onClick={onManualRetry} className="retry-render-button">
            Retry Render
          </button>
        </>
      );
    }
    return loadingStatusMessage;
  };

  return (
    <div
      className={`status-display ${getStatusDisplayClass()} ${
        isStatusFadingOut ? 'fade-out' : ''
      }`}
    >
      {renderStatusContent()}
    </div>
  );
};

StatusIndicator.propTypes = {
  showStatusDisplay: PropTypes.bool.isRequired,
  isStatusFadingOut: PropTypes.bool.isRequired,
  renderState: PropTypes.string.isRequired,
  loadingStatusMessage: PropTypes.string.isRequired,
  showRetryButton: PropTypes.bool.isRequired,
  onManualRetry: PropTypes.func.isRequired,
};

export default StatusIndicator;