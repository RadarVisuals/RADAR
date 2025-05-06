import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import './ToastStyles.css';

/**
 * Toast: Displays a single notification message that can be dismissed
 * manually or automatically after a specified duration.
 */
const Toast = ({ id, content, type = 'info', duration, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in immediately
    setIsVisible(true);
    let fadeOutTimer = null;

    // Set timer to start fade out before full duration
    if (duration) {
      fadeOutTimer = setTimeout(() => {
        setIsVisible(false);
      }, duration - 300); // Start fade 300ms before removal
    }

    // Cleanup timer on unmount or if duration/id changes
    return () => {
      clearTimeout(fadeOutTimer);
    };
  }, [id, duration]); // Effect runs when the toast instance changes

  // Handle manual dismissal via button click
  const handleDismiss = () => {
    setIsVisible(false); // Start fade out animation
    // Call the actual removal function after the fade animation completes
    setTimeout(() => onDismiss(id), 300);
  };

  return (
    <div className={`toast toast-${type} ${isVisible ? 'visible' : ''}`}>
      <div className="toast-content">{content}</div>
      <button onClick={handleDismiss} className="toast-dismiss-button">
        ×
      </button>
    </div>
  );
};

Toast.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, // Allow string or number IDs
  content: PropTypes.node.isRequired,
  type: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  duration: PropTypes.number,
  onDismiss: PropTypes.func.isRequired,
};

export default Toast;