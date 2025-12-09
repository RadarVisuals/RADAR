import { useUIStore } from '../store/useUIStore';

export const useToast = () => {
  const addToast = useUIStore((state) => state.addToast);
  const removeToast = useUIStore((state) => state.removeToast);
  // We generally don't need 'toasts' array in components consuming this, just the actions
  return { addToast, removeToast };
};