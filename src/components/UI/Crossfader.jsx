// src/components/UI/Crossfader.jsx
import React from 'react';
import PropTypes from 'prop-types';
import './Crossfader.css';

const Crossfader = ({ value, onChange }) => {
  const handleOnChange = (e) => {
    onChange(e.target.valueAsNumber);
  };

  return (
    <div className="crossfader-container">
      <input
        type="range"
        min="0"
        max="1"
        step="0.000001"
        value={value}
        onChange={handleOnChange}
        className="crossfader-slider"
      />
    </div>
  );
};

Crossfader.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default Crossfader;