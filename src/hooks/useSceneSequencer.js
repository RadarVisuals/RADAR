// src/hooks/useSceneSequencer.js
import { useEffect, useRef, useCallback } from 'react';
import { useEngineStore } from '../store/useEngineStore';
import { useSetManagementState } from './configSelectors';
import { useVisualEngineContext } from '../context/VisualEngineContext';
import { useToast } from './useToast';

export const useSceneSequencer = (crossfadeDurationMs) => {
    const { addToast } = useToast();
    
    // 1. Get State from Stores
    const active = useEngineStore(s => s.sequencerState.active);
    const intervalMs = useEngineStore(s => s.sequencerState.intervalMs);
    const nextIndex = useEngineStore(s => s.sequencerState.nextIndex);
    
    const setSequencerActive = useEngineStore(s => s.setSequencerActive);
    const setNextIndex = useEngineStore(s => s.setSequencerNextIndex);
    
    const { fullSceneList, activeSceneName } = useSetManagementState();
    const { handleSceneSelect, isAutoFading } = useVisualEngineContext();

    const timeoutRef = useRef(null);

    // 2. The Logic to Advance Scene
    const advanceScene = useCallback(() => {
        if (!fullSceneList || fullSceneList.length === 0) {
            setSequencerActive(false);
            return;
        }

        // Calculate next scene based on stored index
        // We use the stored index to ensure stability if the list changes
        const actualIndex = nextIndex % fullSceneList.length;
        const nextScene = fullSceneList[actualIndex];

        if (nextScene?.name) {
            // Trigger the visual engine
            handleSceneSelect(nextScene.name, crossfadeDurationMs);
            
            // Advance index for next time
            setNextIndex(actualIndex + 1);
        }
    }, [fullSceneList, nextIndex, crossfadeDurationMs, handleSceneSelect, setNextIndex, setSequencerActive]);

    // 3. The Timer Loop
    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (active && !isAutoFading) {
            timeoutRef.current = setTimeout(advanceScene, intervalMs);
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [active, isAutoFading, intervalMs, advanceScene]);

    // 4. Toggle Action (To be used by UI buttons)
    const toggleSequencer = useCallback(() => {
        const willActivate = !active;
        setSequencerActive(willActivate);

        if (willActivate) {
            addToast(`Sequencer started (${(intervalMs/1000).toFixed(1)}s).`, 'info', 2000);
            
            // Sync index to current scene so we don't jump randomly
            if (fullSceneList && fullSceneList.length > 0) {
                const currentIndex = fullSceneList.findIndex(p => p.name === activeSceneName);
                setNextIndex(currentIndex === -1 ? 0 : currentIndex + 1);
            }
        } else {
            addToast('Sequencer stopped.', 'info', 2000);
        }
    }, [active, intervalMs, fullSceneList, activeSceneName, setSequencerActive, setNextIndex, addToast]);

    return {
        isSequencerActive: active,
        sequencerIntervalMs: intervalMs,
        toggleSequencer,
        setSequencerInterval: useEngineStore.getState().setSequencerInterval // Direct action
    };
};