// src/hooks/useAudioVisualizer.js
import { useEngineStore } from '../store/useEngineStore';
import { useMemo } from 'react';

/**
 * Bridge Hook: Adapts the new Zustand store to the old hook API.
 * This keeps all UI components working without changes.
 */
export function useAudioVisualizer() {
  const isAudioActive = useEngineStore(state => state.isAudioActive);
  const audioSettings = useEngineStore(state => state.audioSettings);
  const analyzerData = useEngineStore(state => state.analyzerData);
  
  const setIsAudioActive = useEngineStore(state => state.setIsAudioActive);
  const setAudioSettings = useEngineStore(state => state.setAudioSettings);
  
  // handleAudioDataUpdate is no longer needed by UI, but we provide a no-op 
  // for compatibility if any legacy component calls it.
  const handleAudioDataUpdate = () => {};

  return useMemo(() => ({
    isAudioActive,
    setIsAudioActive,
    audioSettings,
    setAudioSettings,
    analyzerData,
    handleAudioDataUpdate,
  }), [
    isAudioActive,
    audioSettings,
    analyzerData,
    setIsAudioActive,
    setAudioSettings
  ]);
}