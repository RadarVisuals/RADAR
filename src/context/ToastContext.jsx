import React, { createContext, useState, useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';

// Default context value including functions and state structure
const ToastContext = createContext({
  addToast: () => {},
  removeToast: () => {},
  toasts: [],
});

let idCounter = 0; // Simple counter for unique toast IDs

/**
 * ToastProvider: Manages the state for displaying toast notifications.
 * Provides functions to add and remove toasts, and exposes the current list of toasts.
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Function to remove a toast by its ID
  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []); // Stable callback

  // Function to add a new toast
  const addToast = useCallback((content, type = 'info', duration = 5000) => {
    const id = idCounter++;
    setToasts((prevToasts) => [...prevToasts, { id, content, type, duration }]);

    // Set a timer to automatically remove the toast if a duration is provided
    if (duration) {
      setTimeout(() => {
        removeToast(id); // Call the stable removeToast function
      }, duration);
    }
  }, [removeToast]); // Depends on the stable removeToast callback

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(() => ({ addToast, removeToast, toasts }), [addToast, removeToast, toasts]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  );
};

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Hook to consume the ToastContext.
 * Provides access to the `addToast`, `removeToast` functions and the `toasts` array.
 * Throws an error if used outside of a ToastProvider.
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) { // Check if context exists
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};