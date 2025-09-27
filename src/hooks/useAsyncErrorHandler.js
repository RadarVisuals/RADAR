// src/hooks/useAsyncErrorHandler.js
import { useToast } from '../context/ToastContext';
import { useCallback } from 'react';

export const useAsyncErrorHandler = () => {
  const { addToast } = useToast();

  const handleAsyncError = useCallback(async (promise, successMessage) => {
    try {
      const result = await promise;
      if (successMessage) {
        addToast(successMessage, 'success');
      }
      return { success: true, data: result };
    } catch (error) {
      console.error("An async error was caught by the handler:", error);
      const userMessage = error.shortMessage || error.message || "An unknown error occurred.";
      addToast(userMessage, 'error');
      return { success: false, error };
    }
  }, [addToast]);

  return { handleAsyncError };
};