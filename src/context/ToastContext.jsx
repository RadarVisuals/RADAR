// src/context/ToastContext.jsx
import React, { createContext, useState, useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * @typedef {'info' | 'success' | 'warning' | 'error'} ToastType - The type of the toast, influencing its appearance.
 */

/**
 * @typedef {object} ToastMessage
 * @property {number} id - Unique identifier for the toast message.
 * @property {string | React.ReactNode} content - The content of the toast message. Can be a string or a React node.
 * @property {ToastType} type - The type of the toast (e.g., 'info', 'success').
 * @property {number | null} duration - The duration in milliseconds for which the toast should be visible. If null, it remains until manually dismissed.
 */

/**
 * @typedef {object} ToastContextValue
 * @property {(content: string | React.ReactNode, type?: ToastType, duration?: number | null) => void} addToast - Function to add a new toast notification.
 * @property {(id: number) => void} removeToast - Function to remove a toast notification by its ID.
 * @property {Array<ToastMessage>} toasts - An array of the currently active toast notifications.
 */

/**
 * Default context value for ToastContext.
 * Provides no-op functions and an empty toasts array if used outside a provider.
 * @type {ToastContextValue}
 */
const defaultToastContextValue = {
  addToast: (content, type, duration) => {
    if (import.meta.env.DEV) {
      console.warn("addToast called on default ToastContext. Ensure ToastProvider is an ancestor.", { content, type, duration });
    }
  },
  removeToast: (id) => {
    if (import.meta.env.DEV) {
      console.warn("removeToast called on default ToastContext. Ensure ToastProvider is an ancestor.", { id });
    }
  },
  toasts: [],
};

const ToastContext = createContext(defaultToastContextValue);

/** @type {number} Simple counter to generate unique IDs for toast messages. */
let idCounter = 0;

/**
 * ToastProvider: Manages the state for displaying toast notifications.
 * It provides functions to add and remove toasts, and exposes the current list of toasts
 * to consuming components. Toasts can have a type, content, and an optional auto-dismiss duration.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components that will have access to this context.
 * @returns {JSX.Element} The ToastProvider component.
 */
export const ToastProvider = ({ children }) => {
  /** @type {[Array<ToastMessage>, React.Dispatch<React.SetStateAction<Array<ToastMessage>>>]} */
  const [toasts, setToasts] = useState([]);

  /**
   * Removes a toast notification from the list by its unique ID.
   * This function is memoized for stability.
   * @param {number} id - The ID of the toast to remove.
   */
  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []); // setToasts is stable

  /**
   * Adds a new toast notification to the list.
   * If a `duration` is provided, the toast will automatically be removed after that time.
   * This function is memoized and depends on the stable `removeToast` callback.
   * @param {string | React.ReactNode} content - The message or React node to display in the toast.
   * @param {ToastType} [type='info'] - The type of the toast, affecting its style.
   * @param {number | null} [duration=5000] - The duration in milliseconds for the toast to be visible.
   *                                         Pass `null` or `0` for a toast that does not auto-dismiss.
   */
  const addToast = useCallback((content, type = 'info', duration = 5000) => {
    const id = idCounter++; // Generate a new unique ID
    setToasts((prevToasts) => [...prevToasts, { id, content, type, duration }]);

    // Set a timer to automatically remove the toast if a positive duration is provided
    if (duration && duration > 0) {
      setTimeout(() => {
        removeToast(id); // Call the stable removeToast function
      }, duration);
    }
  }, [removeToast]); // Depends on the stable removeToast callback

  // Memoize the context value to prevent unnecessary re-renders of consumers
  // when the provider's parent re-renders but these specific values haven't changed.
  const contextValue = useMemo(() => ({
    addToast,
    removeToast,
    toasts
  }), [addToast, removeToast, toasts]);

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
 * Custom hook to consume the `ToastContext`.
 * Provides access to the `addToast` and `removeToast` functions, and the `toasts` array.
 * It ensures that the hook is used within a `ToastProvider` and throws an error if not.
 *
 * @returns {ToastContextValue} The current value of the ToastContext.
 * @throws {Error} If the hook is not used within a `ToastProvider`.
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) { // Standard check for missing provider
    const err = new Error('useToast must be used within a ToastProvider component.');
    if (import.meta.env.DEV) {
        console.error("useToast context details: Attempted to use context but found undefined. This usually means ToastProvider is missing as an ancestor of the component calling useToast.", err.stack);
    }
    throw err;
  }
  return context;
};