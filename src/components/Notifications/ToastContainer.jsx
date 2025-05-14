// src/components/Toast/ToastContainer.jsx
import React from 'react';
// Removed PropTypes as it's not used in this specific file

import { useToast } from '../../context/ToastContext'; // Local context
import Toast from './Toast'; // Local component

import './ToastStyles.css'; // Local styles

/**
 * ToastContainer: A component responsible for rendering a list of active toast notifications.
 * It retrieves the current list of toasts and the `removeToast` function from the `ToastContext`.
 * Each toast is rendered using the `Toast` component. If there are no active toasts,
 * the container itself is not rendered to avoid an empty DOM element.
 *
 * @returns {JSX.Element | null} The rendered ToastContainer with active toasts, or null if no toasts are present.
 */
const ToastContainer = () => {
  const { toasts, removeToast } = useToast(); // Consume from ToastContext

  // Don't render the container at all if there are no toasts to display.
  // This keeps the DOM cleaner.
  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container" role="status" aria-live="polite" aria-atomic="true">
      {/*
        Map over the active toasts and render a Toast component for each.
        - `key` is essential for React's list rendering.
        - `onDismiss` is passed down to allow individual toasts to trigger their removal.
      */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id} // Pass id for the Toast component to use with onDismiss
          content={toast.content}
          type={toast.type}
          duration={toast.duration} // Duration is for information or if Toast handles its own timer
          onDismiss={removeToast} // Pass the removeToast function from context
        />
      ))}
    </div>
  );
};

// No PropTypes needed for ToastContainer itself as it takes no props.
// Default export is standard for React components.
export default ToastContainer;