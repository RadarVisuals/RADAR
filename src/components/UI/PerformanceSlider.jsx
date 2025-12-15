// src/components/UI/PerformanceSlider.jsx
import React, { useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import SignalBus from '../../utils/SignalBus';

/**
 * PerformanceSlider (Zero-Render Edition)
 * 
 * Bypasses React state updates entirely during user interaction.
 * Treats input as "uncontrolled" during drag.
 * Listens to SignalBus for high-frequency external updates (P-Lock).
 */
const PerformanceSlider = ({ 
  name,
  layerId, 
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
  const isMountedRef = useRef(false);

  useEffect(() => {
      isMountedRef.current = true;
      return () => { isMountedRef.current = false; };
  }, []);

  // Sync with external React prop changes (e.g. Scene load, Undo/Redo)
  useEffect(() => {
    if (!isDragging.current && inputRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  // Sync with high-frequency Event updates (P-Lock, MIDI) via SIGNAL BUS
  useEffect(() => {
    const handleParamUpdate = (data) => {
      // Safety check for unmounted component
      if (!isMountedRef.current || !inputRef.current) return;

      const { layerId: targetLayer, param, value: newValue } = data;
      // Update only if this event targets this specific slider instance
      if (targetLayer === String(layerId) && param === name) {
         if (!isDragging.current) {
             inputRef.current.value = newValue;
         }
      }
    };
    
    const unsubscribe = SignalBus.on('param:update', handleParamUpdate);
    return () => unsubscribe();
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
    if (!isMountedRef.current) return;

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
  layerId: PropTypes.string.isRequired, 
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