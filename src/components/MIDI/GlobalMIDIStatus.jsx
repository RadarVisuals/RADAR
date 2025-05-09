// src/components/MIDI/GlobalMIDIStatus.jsx
import React from 'react';
import { useMIDI } from '../../context/MIDIContext';
import './MIDIStyles/GlobalMIDIStatus.css';
import { midiIcon } from '../../assets';

/**
 * GlobalMIDIStatus: Displays the current MIDI connection status.
 * Allows initiating connection, disconnecting, or retrying on error.
 * Also shows a small indicator when MIDI learn mode is active.
 */
const GlobalMIDIStatus = () => {
  const {
    isConnected,
    isConnecting,
    connectMIDI,
    disconnectMIDI, // Get disconnectMIDI from context
    error: midiError,
    midiLearning,
    learningLayer,
  } = useMIDI();

  const hasCriticalError = !!midiError;

  const handleConnectionClick = () => {
    if (isConnected) {
      // If connected, disconnect MIDI entirely
      disconnectMIDI(true); // Pass true for a user-initiated full disconnect
    } else if (!isConnecting) {
      // If disconnected and not currently connecting, try to connect
      connectMIDI()
        .catch(err => {
          console.error("[GlobalMIDIStatus] connectMIDI promise rejected:", err);
        });
    }
    // If isConnecting, do nothing (connection already in progress)
  };

  const buttonTitle = hasCriticalError ? `MIDI Error: ${midiError?.message || 'Click to retry connection'}`
                     : isConnecting ? "Connecting MIDI..."
                     : isConnected ? "MIDI Connected - Click to Disconnect"
                     : "MIDI Disconnected - Click to Connect";

  const buttonClass = `toolbar-icon ${hasCriticalError ? 'error' : isConnected ? 'connected' : 'disconnected'} ${isConnecting ? 'connecting' : ''}`;

  return (
    <div className="global-midi-status">
      <button
        className={buttonClass}
        onClick={handleConnectionClick}
        disabled={isConnecting && !isConnected} // Disable only if connecting and not yet connected
        title={buttonTitle}
      >
        {hasCriticalError ? (
           <span style={{color: 'var(--color-error, red)', fontSize: '1.2em', fontWeight: 'bold'}}>!</span>
        ) : isConnecting ? (
           <div className="connecting-spinner"></div>
        ) : (
          <img src={midiIcon} alt="MIDI" className="midi-icon" />
        )}
      </button>

      {(midiLearning || learningLayer !== null) && (
        <div className="midi-learning-indicator">
          {midiLearning ? (
            <span>Mapping: {midiLearning.param}</span>
          ) : (
            <span>Mapping: Layer {learningLayer}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalMIDIStatus;