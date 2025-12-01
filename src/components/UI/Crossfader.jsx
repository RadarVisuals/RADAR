// src/components/UI/Crossfader.jsx
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './Crossfader.css';

const Crossfader = ({ value, onInput, onChange, disabled = false }) => {
  const inputRef = useRef(null);
  const isDragging = useRef(false);

  // 1. Listen for high-frequency updates from VisualEngineContext (Zero-Render)
  useEffect(() => {
    const handleUpdate = (e) => {
      // Only update DOM if user isn't currently dragging the handle
      if (!isDragging.current && inputRef.current) {
        inputRef.current.value = e.detail;
      }
    };
    window.addEventListener('radar-crossfader-update', handleUpdate);
    return () => window.removeEventListener('radar-crossfader-update', handleUpdate);
  }, []);

  // 2. Sync with initial/low-frequency React prop updates (e.g. on load)
  useEffect(() => {
    if (!isDragging.current && inputRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleOnInput = (e) => {
    isDragging.current = true;
    if (onInput) {
      // Pass value directly to engine
      onInput(e.target.valueAsNumber);
    }
  };

  const handleOnChange = (e) => {
    isDragging.current = false;
    if (onChange) {
      // Commit final value
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
        defaultValue={value} 
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