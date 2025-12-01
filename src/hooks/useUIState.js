import { useUIStore } from '../store/useUIStore';

// This makes useUIState a direct proxy to the store
export function useUIState(initialLayerTab = 'tab1') {
  const state = useUIStore();
  
  // Backward compatibility alias
  return {
    ...state,
    toggleSidePanel: state.togglePanel, 
  };
}