import React from 'react';
import { useToast } from '../../context/ToastContext';
import Toast from './Toast';
import './ToastStyles.css';

/**
 * ToastContainer: Renders a list of active toasts using the Toast component.
 * It retrieves the list of toasts and the removal function from the ToastContext.
 */
const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  // Don't render the container if there are no toasts
  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          content={toast.content}
          type={toast.type}
          duration={toast.duration}
          onDismiss={removeToast} // Pass the remove function from context
        />
      ))}
    </div>
  );
};

export default ToastContainer;