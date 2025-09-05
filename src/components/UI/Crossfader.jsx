// src/components/UI/Crossfader.jsx
import React from 'react';
import PropTypes from 'prop-types';
import './Crossfader.css';

const Crossfader = ({ value, onInput, onChange }) => {
  const handleOnInput = (e) => {
    // onInput fires continuously while the user is dragging the slider.
    if (onInput) {
      onInput(e.target.valueAsNumber);
    }
  };

  const handleOnChange = (e) => {
    // onChange typically fires only when the user releases the mouse.
    if (onChange) {
      onChange(e.target.valueAsNumber);
    }
  };

  return (
    <div className="crossfader-container">
      <input
        type="range"
        min="0"
        max="1"
        step="0.001" // A reasonable step for high fidelity without event flooding.
        value={value}
        onInput={handleOnInput}   // Use onInput for live, real-time updates.
        onChange={handleOnChange} // Use onChange for the final, committed value.
        className="crossfader-slider"
      />
    </div>
  );
};

Crossfader.propTypes = {
  value: PropTypes.number.isRequired,
  onInput: PropTypes.func, // The new handler for real-time updates.
  onChange: PropTypes.func.isRequired,
};

export default Crossfader;