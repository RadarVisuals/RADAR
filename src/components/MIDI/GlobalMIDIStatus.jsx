// src/components/MIDI/GlobalMIDIStatus.jsx
import React from 'react';
import { useEngineStore } from '../../store/useEngineStore';
import { midiIcon } from '../../assets';
import './MIDIStyles/GlobalMIDIStatus.css';

/**
 * GlobalMIDIStatus: Displays the current MIDI connection status.
 * Directly consumes useEngineStore state and actions.
 */
const GlobalMIDIStatus = () => {
  const isConnected = useEngineStore(s => s.isConnected);
  const isConnecting = useEngineStore(s => s.isConnecting);
  const midiError = useEngineStore(s => s.midiError);
  const midiLearning = useEngineStore(s => s.midiLearning);
  const learningLayer = useEngineStore(s => s.learningLayer);
  
  const connectMIDI = useEngineStore(s => s.connectMIDI);
  const disconnectMIDI = useEngineStore(s => s.disconnectMIDI);

  const handleConnectionClick = () => {
    if (isConnected) {
      disconnectMIDI();
    } else if (!isConnecting) {
      connectMIDI().catch(err => {
        console.error("[GlobalMIDIStatus] Connect failed:", err);
      });
    }
  };

  const buttonTitle = midiError ? `MIDI Error: ${midiError}`
                     : isConnecting ? "Connecting MIDI..."
                     : isConnected ? "MIDI Connected - Click to Disconnect"
                     : "MIDI Disconnected - Click to Connect";

  const buttonClass = `toolbar-icon ${midiError ? 'error' : isConnected ? 'connected' : 'disconnected'} ${isConnecting ? 'connecting' : ''}`;

  return (
    <div className="global-midi-status">
      <button
        className={buttonClass}
        onClick={handleConnectionClick}
        disabled={isConnecting && !isConnected}
        title={buttonTitle}
      >
        {midiError ? (
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
            <span>Mapping: {midiLearning.param || midiLearning.control}</span>
          ) : (
            <span>Mapping: Layer {learningLayer}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalMIDIStatus;