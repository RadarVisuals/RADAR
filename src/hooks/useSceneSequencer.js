// src/hooks/useSceneSequencer.js
import { useEffect, useRef, useCallback } from 'react';
import { useEngineStore } from '../store/useEngineStore';
import { useSetManagementState } from './configSelectors';
import { useVisualEngine } from './useVisualEngine'; 
import { useToast } from './useToast';

export const useSceneSequencer = (crossfadeDurationMs) => {
    const { addToast } = useToast();
    
    const active = useEngineStore(s => s.sequencerState.active);
    const intervalMs = useEngineStore(s => s.sequencerState.intervalMs);
    const nextIndex = useEngineStore(s => s.sequencerState.nextIndex);
    
    const setSequencerActive = useEngineStore(s => s.setSequencerActive);
    const setNextIndex = useEngineStore(s => s.setSequencerNextIndex);
    
    const { fullSceneList, activeSceneName } = useSetManagementState();
    const { handleSceneSelect, isAutoFading } = useVisualEngine();

    const timeoutRef = useRef(null);

    const advanceScene = useCallback(() => {
        if (!fullSceneList || fullSceneList.length === 0) {
            setSequencerActive(false);
            return;
        }

        const actualIndex = nextIndex % fullSceneList.length;
        const nextScene = fullSceneList[actualIndex];

        if (nextScene?.name) {
            handleSceneSelect(nextScene.name, crossfadeDurationMs);
            setNextIndex(actualIndex + 1);
        }
    }, [fullSceneList, nextIndex, crossfadeDurationMs, handleSceneSelect, setNextIndex, setSequencerActive]);

    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (active && !isAutoFading) {
            timeoutRef.current = setTimeout(advanceScene, intervalMs);
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [active, isAutoFading, intervalMs, advanceScene]);

    const toggleSequencer = useCallback(() => {
        const willActivate = !active;
        setSequencerActive(willActivate);

        if (willActivate) {
            addToast(`Sequencer started (${(intervalMs/1000).toFixed(1)}s).`, 'info', 2000);
            
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
        setSequencerInterval: useEngineStore.getState().setSequencerInterval 
    };
};