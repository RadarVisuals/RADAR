import { useUIStore } from '../store/useUIStore';

// Adapter to maintain API compatibility
export const useToast = () => {
  const addToast = useUIStore((state) => state.addToast);
  const removeToast = useUIStore((state) => state.removeToast);
  const toasts = useUIStore((state) => state.toasts);

  return { addToast, removeToast, toasts };
};

// Fake Provider to keep main.jsx happy until we clean it
export const ToastProvider = ({ children }) => children;