// src/components/Panels/PLockController.jsx
import React from 'react';
import PropTypes from 'prop-types';
import './PanelStyles/PLockController.css';

const PLockController = ({
  pLockState = 'idle',
  loopProgress = 0,
  hasLockedParams = false,
  pLockSpeed = 'medium',
  onSetPLockSpeed,
  onTogglePLock,
  onMapMidi,
  isMidiLearning,
  midiMappingText,
}) => {
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
              className="plock-progress-bar"
              style={{
                transform: pLockState === 'playing' ? `scaleX(${loopProgress})` : 'scaleX(1)',
                backgroundColor: getProgressBarColor(),
                animation: pLockState === 'armed' ? 'plock-pulse-bar 1.5s infinite' : 'none',
                transition: 'background-color 0.2s ease',
              }}
            />
          )}
        </div>
      </div>
      <div className="plock-midi-map">
        <span className="midi-mapping-text" title={`Current mapping: ${midiMappingText}`}>{midiMappingText}</span>
        <button
          className={`midi-btn small-action-button ${isMidiLearning ? "learning" : ""}`}
          onClick={onMapMidi}
          disabled={isMidiLearning || isButtonDisabled}
          title="Map MIDI to P-Lock Toggle"
        >
          {isMidiLearning ? "..." : "Map"}
        </button>
      </div>
    </>
  );
};

PLockController.propTypes = {
  pLockState: PropTypes.oneOf(['idle', 'armed', 'playing', 'stopping']),
  loopProgress: PropTypes.number,
  hasLockedParams: PropTypes.bool,
  pLockSpeed: PropTypes.string,
  onSetPLockSpeed: PropTypes.func,
  onTogglePLock: PropTypes.func,
  onMapMidi: PropTypes.func,
  isMidiLearning: PropTypes.bool,
  midiMappingText: PropTypes.string,
};

export default React.memo(PLockController);