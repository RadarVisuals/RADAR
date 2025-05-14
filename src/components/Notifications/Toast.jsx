// src/components/Toast/Toast.jsx
import React, { useEffect, useState, useCallback } from 'react'; // Added useCallback
import PropTypes from 'prop-types';

import './ToastStyles.css'; // Local styles

/**
 * @typedef {'info' | 'success' | 'warning' | 'error'} ToastType - The type of the toast, influencing its appearance.
 */

/**
 * @typedef {object} ToastProps
 * @property {string|number} id - Unique identifier for the toast message.
 * @property {React.ReactNode} content - The content of the toast message. Can be a string or a React node.
 * @property {ToastType} [type='info'] - The type of the toast (e.g., 'info', 'success').
 * @property {number | null} [duration] - Optional: The duration in milliseconds for which the toast should be visible.
 *                                     If provided and positive, the toast will start fading out before this duration ends.
 *                                     If null or 0, it remains until manually dismissed.
 * @property {(id: string|number) => void} onDismiss - Callback function invoked when the toast requests to be dismissed, either manually or after its duration. It receives the toast's `id`.
 */

/**
 * Toast: Displays a single notification message.
 * It manages its own visibility state for fade-in/fade-out animations.
 * It can be dismissed manually via a close button or automatically after a specified `duration`.
 * The actual removal from the list of active toasts is handled by the `onDismiss` callback,
 * which is typically provided by a `ToastProvider` or a similar state management system.
 *
 * @param {ToastProps} props - The component's props.
 * @returns {JSX.Element} The rendered Toast component.
 */
const Toast = ({ id, content, type = 'info', duration, onDismiss }) => {
  // `isVisible` controls the CSS class for fade-in/fade-out animations.
  const [isVisible, setIsVisible] = useState(false);

  // Effect for managing the toast's lifecycle (fade-in and timed fade-out)
  useEffect(() => {
    // Trigger fade-in animation shortly after mount
    const fadeInTimer = setTimeout(() => {
      setIsVisible(true);
    }, 10); // Small delay to ensure CSS transition applies

    let fadeOutTimer = null;
    let dismissTimer = null;

    // If a positive duration is provided, set up automatic fade-out and dismissal
    if (duration && duration > 0) {
      // Start fade-out animation slightly before the full duration to allow for CSS transition
      const fadeOutStartTime = Math.max(0, duration - 300); // Ensure non-negative

      fadeOutTimer = setTimeout(() => {
        setIsVisible(false); // Trigger fade-out animation
      }, fadeOutStartTime);

      // Set timer to call onDismiss after the full duration (allowing fade-out to complete)
      dismissTimer = setTimeout(() => {
        if (typeof onDismiss === 'function') {
          onDismiss(id);
        }
      }, duration);
    }

    // Cleanup function: clear all timers when the component unmounts
    // or if `id` or `duration` changes (which would re-run this effect).
    return () => {
      clearTimeout(fadeInTimer);
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [id, duration, onDismiss]); // `onDismiss` is included as it's part of the effect's logic flow

  /**
   * Handles manual dismissal of the toast via the close button.
   * It first triggers the fade-out animation and then calls the `onDismiss` callback
   * after the animation duration.
   */
  const handleDismiss = useCallback(() => {
    setIsVisible(false); // Start fade-out animation
    // Call the actual removal function (onDismiss) after the fade animation (300ms) completes.
    setTimeout(() => {
      if (typeof onDismiss === 'function') {
        onDismiss(id);
      }
    }, 300); // This duration should match the CSS transition duration for opacity/transform
  }, [id, onDismiss]); // `id` and `onDismiss` are dependencies

  return (
    <div
      className={`toast toast-${type} ${isVisible ? 'visible' : 'hidden'}`}
      role="alert" // Accessibility: Indicates it's an alert
      aria-live="assertive" // Accessibility: Announce changes assertively
      aria-atomic="true"
    >
      <div className="toast-content">{content}</div>
      <button
        onClick={handleDismiss}
        className="toast-dismiss-button"
        aria-label="Dismiss notification" // Accessibility
        title="Dismiss" // Tooltip
      >
        × {/* Standard multiplication sign for 'close' */}
      </button>
    </div>
  );
};

Toast.propTypes = {
  /** Unique identifier for the toast message. */
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  /** The content of the toast message. Can be a string or any renderable React node. */
  content: PropTypes.node.isRequired,
  /** The type of the toast, influencing its visual style (e.g., 'info', 'success', 'warning', 'error'). */
  type: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  /**
   * Optional duration in milliseconds for the toast to be visible.
   * If provided and positive, the toast will auto-dismiss.
   * If null, 0, or not provided, it remains until manually dismissed.
   */
  duration: PropTypes.number,
  /** Callback function invoked when the toast requests to be dismissed (receives toast `id`). */
  onDismiss: PropTypes.func.isRequired,
};

// Default export is standard for React components.
export default Toast;