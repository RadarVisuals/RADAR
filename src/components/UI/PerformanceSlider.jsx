// src/components/UI/PerformanceSlider.jsx
import React, { useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * PerformanceSlider (Zero-Render Edition)
 * 
 * This component bypasses React state updates entirely during user interaction.
 * It treats the input as "uncontrolled" during the drag operation, relying
 * on the browser's native UI thread for 60fps handle movement.
 * 
 * It also listens to a custom window event to update itself during external 
 * high-frequency animations (like P-Lock sequencer) without re-rendering.
 */
const PerformanceSlider = ({ 
  name,
  layerId, // NEW: Needed for event filtering
  value, 
  min, 
  max, 
  step, 
  onChange, // Fast update (Pixi)
  onCommit, // Slow update (Store)
  disabled, 
  className,
  ariaLabel 
}) => {
  const inputRef = useRef(null);
  const isDragging = useRef(false);

  // Sync with external React prop changes (e.g. Scene load, Undo/Redo)
  useEffect(() => {
    if (!isDragging.current && inputRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  // Sync with high-frequency Event updates (P-Lock, MIDI)
  useEffect(() => {
    const handleParamUpdate = (e) => {
      const { layerId: targetLayer, param, value: newValue } = e.detail;
      // Update only if this event targets this specific slider instance
      if (targetLayer === String(layerId) && param === name) {
         if (!isDragging.current && inputRef.current) {
             inputRef.current.value = newValue;
         }
      }
    };
    
    window.addEventListener('radar-param-update', handleParamUpdate);
    return () => window.removeEventListener('radar-param-update', handleParamUpdate);
  }, [layerId, name]);

  const handleInput = useCallback((e) => {
    isDragging.current = true;
    const val = parseFloat(e.target.value);
    
    // Direct pass-through to engine. No React Render happens here.
    if (onChange) {
      onChange(name, val);
    }
  }, [name, onChange]);

  const handleCommit = useCallback((e) => {
    isDragging.current = false;
    const val = parseFloat(e.target.value);

    // Commit to Zustand/React State ONLY on release/interaction end
    if (onCommit) {
      onCommit(name, val);
    }
  }, [name, onCommit]);

  return (
    <input
      ref={inputRef}
      type="range"
      name={name}
      min={min}
      max={max}
      step={step}
      defaultValue={value} 
      onInput={handleInput} 
      onPointerUp={handleCommit}
      onKeyUp={handleCommit}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
    />
  );
};

PerformanceSlider.propTypes = {
  name: PropTypes.string.isRequired,
  layerId: PropTypes.string.isRequired, // Ensure this is passed
  value: PropTypes.number,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  onChange: PropTypes.func,
  onCommit: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  ariaLabel: PropTypes.string
};

export default React.memo(PerformanceSlider);