import React from 'react';
import { useUIStore } from '../../store/useUIStore';
import Toast from './Toast';
import './ToastStyles.css';

const ToastContainer = () => {
  // Selector ensures this component ONLY re-renders when toasts change
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          content={toast.content}
          type={toast.type}
          duration={toast.duration}
          onDismiss={removeToast}
        />
      ))}
    </div>
  );
};

export default ToastContainer;