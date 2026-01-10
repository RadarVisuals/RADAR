// src/components/UI/PerformanceSlider.jsx
import React, { useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import SignalBus from '../../utils/SignalBus';
import { useProjectStore } from '../../store/useProjectStore';

const PerformanceSlider = ({ 
  name,
  layerId, 
  value, 
  min, 
  max, 
  step, 
  onChange, 
  onCommit, 
  disabled, 
  className,
  ariaLabel 
}) => {
  const inputRef = useRef(null);
  const isMountedRef = useRef(false);
  const activeSceneName = useProjectStore(s => s.activeSceneName);
  const lastProcessedSceneRef = useRef(activeSceneName);

  useEffect(() => {
      isMountedRef.current = true;
      return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!inputRef.current) return;
    if (activeSceneName !== lastProcessedSceneRef.current) {
        inputRef.current.value = value;
        lastProcessedSceneRef.current = activeSceneName;
    }
  }, [value, activeSceneName]);

  useEffect(() => {
    const handleSmoothUpdate = (smoothedValue) => {
      if (!isMountedRef.current || !inputRef.current) return;
      inputRef.current.value = smoothedValue;
    };

    const eventName = `ui:smooth_update:${layerId}:${name}`;
    const unsubscribe = SignalBus.on(eventName, handleSmoothUpdate);
    
    return () => unsubscribe();
  }, [layerId, name]);

  const handleInput = useCallback((e) => {
    const val = parseFloat(e.target.value);
    if (onChange) onChange(name, val);
  }, [name, onChange]);

  const handleCommit = useCallback((e) => {
    if (!isMountedRef.current) return;
    const val = parseFloat(e.target.value);
    if (onCommit) onCommit(name, val);
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