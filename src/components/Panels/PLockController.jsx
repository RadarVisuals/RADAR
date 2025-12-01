// src/components/Panels/PLockController.jsx
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './PanelStyles/PLockController.css';

const PLockController = ({
  pLockState = 'idle',
  // REMOVED: loopProgress prop
  hasLockedParams = false,
  pLockSpeed = 'medium',
  onSetPLockSpeed,
  onTogglePLock,
}) => {
  // NEW: Ref to directly manipulate the DOM bar
  const progressBarRef = useRef(null);

  // NEW: Listen for the high-frequency progress event
  useEffect(() => {
    const handleProgress = (e) => {
        if (progressBarRef.current) {
            // Apply scale directly to transform
            progressBarRef.current.style.transform = `scaleX(${e.detail})`;
        }
    };
    
    // Subscribe
    window.addEventListener('plock-progress', handleProgress);
    return () => window.removeEventListener('plock-progress', handleProgress);
  }, []);

  // Handle static states (reset/full) via effect when React state changes
  useEffect(() => {
      if (progressBarRef.current) {
          if (pLockState === 'armed') {
              progressBarRef.current.style.transform = 'scaleX(1)';
          } else if (pLockState === 'idle') {
              progressBarRef.current.style.transform = 'scaleX(0)';
          }
      }
  }, [pLockState]);

  const getRecordButtonText = () => {
    switch (pLockState) {
      case 'armed': return 'ARM ●';
      case 'playing': return 'STOP ■';
      case 'stopping': return '...';
      default: return 'REC';
    }
  };

  const getRecordButtonTitle = () => {
    switch (pLockState) {
      case 'armed': return 'Press again to capture snapshot and start playback.';
      case 'playing': return 'Stop playback and rest at the final recorded position.';
      case 'stopping': return 'Stopping and setting parameters to their final state...';
      default: return 'Arm sequencer to record parameter changes. Clears any previous recording.';
    }
  };

  const getProgressBarColor = () => {
    if (pLockState === 'armed') return 'var(--color-error)';
    if (pLockState === 'playing') return 'var(--color-primary)';
    if (pLockState === 'stopping') return 'var(--color-warning)';
    return 'transparent';
  };
  
  const isButtonDisabled = pLockState === 'stopping';

  return (
    <>
      <div className="speed-selector">
        <button disabled={pLockState !== 'idle'} className={`speed-button ${pLockSpeed === 'fast' ? 'active' : ''}`} onClick={() => onSetPLockSpeed('fast')} title="Fast Loop (4 seconds)">F</button>
        <button disabled={pLockState !== 'idle'} className={`speed-button ${pLockSpeed === 'medium' ? 'active' : ''}`} onClick={() => onSetPLockSpeed('medium')} title="Medium Loop (8 seconds)">M</button>
        <button disabled={pLockState !== 'idle'} className={`speed-button ${pLockSpeed === 'slow' ? 'active' : ''}`} onClick={() => onSetPLockSpeed('slow')} title="Slow Loop (12 seconds)">S</button>
      </div>
      <div className="plock-controls-container">
        <button className={`plock-button plock-record-button ${pLockState}`} onClick={onTogglePLock} title={getRecordButtonTitle()} disabled={isButtonDisabled}>
          {getRecordButtonText()}
        </button>
        <div className="plock-progress-bar-container">
          {(pLockState === 'playing' || pLockState === 'armed' || pLockState === 'stopping') && (
            <div
              ref={progressBarRef} // Added REF
              className="plock-progress-bar"
              style={{
                // transform is now handled by JS logic above
                transform: pLockState === 'armed' ? 'scaleX(1)' : undefined, // Initial render safety
                backgroundColor: getProgressBarColor(),
                animation: pLockState === 'armed' ? 'plock-pulse-bar 1.5s infinite' : 'none',
                transition: 'background-color 0.2s ease',
              }}
            />
          )}
        </div>
      </div>
    </>
  );
};

PLockController.propTypes = {
  pLockState: PropTypes.oneOf(['idle', 'armed', 'playing', 'stopping']),
  // loopProgress: PropTypes.number, // Removed
  hasLockedParams: PropTypes.bool,
  pLockSpeed: PropTypes.string,
  onSetPLockSpeed: PropTypes.func,
  onTogglePLock: PropTypes.func,
};

export default React.memo(PLockController);