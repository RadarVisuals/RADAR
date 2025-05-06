// src/components/MIDI/GlobalMIDIStatus.jsx
import React from 'react'; // Removed unused useState, useEffect
import { useMIDI } from '../../context/MIDIContext';
import './MIDIStyles/GlobalMIDIStatus.css';
import { midiIcon } from '../../assets';

/**
 * GlobalMIDIStatus: Displays the current MIDI connection status (Disconnected, Connecting, Connected, Error)
 * as an icon in the toolbar. Allows initiating connection, retrying on error, or toggling
 * the mini MIDI monitor when connected. Also shows a small indicator when MIDI learn mode is active.
 */
const GlobalMIDIStatus = () => {
  const {
    isConnected,
    isConnecting,
    connectMIDI,
    error: midiError,
    midiMonitorData,
    midiLearning,
    learningLayer,
    setShowMidiMonitor,
    showMidiMonitor
  } = useMIDI();

  const hasCriticalError = !!midiError;

  const handleConnectionClick = () => {
    if (isConnected) {
      setShowMidiMonitor(!showMidiMonitor);
      return;
    }
    if (isConnecting) {
      // Connection already in progress via context
      return;
    }

    connectMIDI()
      .then((access) => {
        if (!access) {
           // Log removed - context state reflects connection success/failure
        }
      })
      .catch(err => {
        // Keep error log for critical API failure
        console.error("[GlobalMIDIStatus] connectMIDI promise rejected:", err);
      });
  };

  const buttonTitle = hasCriticalError ? `MIDI Error: ${midiError?.message || 'Click to retry'}`
                     : isConnecting ? "Connecting MIDI..."
                     : isConnected ? "MIDI Connected - Click to toggle monitor"
                     : "MIDI Disconnected - Click to connect";

  const buttonClass = `toolbar-icon ${hasCriticalError ? 'error' : isConnected ? 'connected' : 'disconnected'} ${isConnecting ? 'connecting' : ''}`;

  const recentMessages = midiMonitorData.slice(-5);

  return (
    <div className="global-midi-status">
      <button
        className={buttonClass}
        onClick={handleConnectionClick}
        disabled={isConnecting}
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

      {isConnected && showMidiMonitor && (
        <div className="mini-midi-monitor">
          <div className="monitor-header">
            <h4>Recent MIDI Activity</h4>
            <button
              className="close-monitor"
              onClick={() => setShowMidiMonitor(false)}
            >×</button>
          </div>
          <div className="monitor-content">
            {recentMessages.length === 0 ? (
              <div className="no-activity">No recent MIDI activity</div>
            ) : (
              recentMessages.map((msg, index) => (
                <div key={index} className="midi-message">
                  <span className="msg-type">{msg.type}</span>
                  <span className="msg-channel">Ch {msg.channel + 1}</span>
                  <span className="msg-data">{msg.data1}:{msg.data2}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalMIDIStatus;