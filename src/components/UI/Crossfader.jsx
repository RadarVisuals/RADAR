// src/components/UI/Crossfader.jsx
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import SignalBus from '../../utils/SignalBus';
import './Crossfader.css';

/**
 * Crossfader: Zero-Snap Smooth Animation Edition
 * 
 * This component remains uncontrolled to prevent React-loop snapping,
 * but listens to the High-Frequency 'crossfader:update' signal to 
 * animate smoothly during auto-fades and scene transitions.
 */
const Crossfader = ({ value, onInput, onChange, disabled = false }) => {
  const inputRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastInteractionTimeRef = useRef(0);
  
  // How long to ignore store updates after a manual MIDI/Mouse event (ms)
  const AUTHORITY_WINDOW = 1000;

  /**
   * STORE SYNC (Slow Path)
   * Only allows the Store to move the slider if we haven't touched it 
   * via MIDI or Mouse recently. This prevents the "Tug-of-war" snap.
   */
  useEffect(() => {
    if (!inputRef.current) return;

    const now = performance.now();
    const timeSinceInteraction = now - lastInteractionTimeRef.current;

    // 1. If we are dragging with a mouse, ignore store props
    if (isDraggingRef.current) return;

    // 2. If we touched this via MIDI in the last second, ignore store props
    if (timeSinceInteraction < AUTHORITY_WINDOW) {
        return;
    }

    // 3. Otherwise, allow external resets (like Workspace loads)
    inputRef.current.value = value;
  }, [value]);

  /**
   * SIGNAL BUS LISTENERS (Fast Path)
   */
  useEffect(() => {
    // 1. Handle Frame-by-Frame Updates (For smooth animation during auto-fades)
    const handleUpdate = (val) => {
      if (!inputRef.current) return;

      // Crucial: Only animate the handle if the user isn't physically fighting it
      if (!isDraggingRef.current) {
        inputRef.current.value = val;
      }
    };

    // 2. Handle Absolute Set Commands (For instant snaps/resets)
    const handleSet = (val) => {
      if (!inputRef.current) return;
      
      // Update authority timestamp so incoming props don't override this jump
      lastInteractionTimeRef.current = performance.now();

      if (!isDraggingRef.current) {
        inputRef.current.value = val;
      }
    };
    
    // Listen for high-frequency frames from CrossfaderSystem.js
    const unsubUpdate = SignalBus.on('crossfader:update', handleUpdate);
    // Listen for absolute jumps from MidiManager or Logic
    const unsubSet = SignalBus.on('crossfader:set', handleSet);
    
    return () => {
        unsubUpdate();
        unsubSet();
    };
  }, []);

  const handleOnInput = (e) => {
    isDraggingRef.current = true;
    lastInteractionTimeRef.current = performance.now();
    if (onInput) {
      onInput(e.target.valueAsNumber);
    }
  };

  const handleOnChange = (e) => {
    isDraggingRef.current = false;
    lastInteractionTimeRef.current = performance.now();
    if (onChange) {
      onChange(e.target.valueAsNumber);
    }
  };

  return (
    <div className="crossfader-container">
      <input
        ref={inputRef}
        type="range"
        min="0"
        max="1"
        step="0.001"
        defaultValue={value} // Keep uncontrolled to prevent React re-render snapping
        onInput={handleOnInput}
        onChange={handleOnChange} 
        onPointerUp={handleOnChange} 
        className="crossfader-slider"
        disabled={disabled}
      />
    </div>
  );
};

Crossfader.propTypes = {
  value: PropTypes.number.isRequired,
  onInput: PropTypes.func,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
};

export default React.memo(Crossfader);