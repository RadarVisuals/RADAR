// src/components/MainViewParts/AudioAnalyzerWrapper.jsx
import React from 'react';
import PropTypes from 'prop-types';
import AudioAnalyzer from '../Audio/AudioAnalyzer'; 

const AudioAnalyzerWrapper = ({ isAudioActive, managerInstancesRef }) => {
  // We keep this mounted as long as the toggle is ON.
  // We don't pass changing configs anymore; the child reads them from Store.
  if (!isAudioActive) {
    return null;
  }

  return (
    <div className="hidden-audio-analyzer" aria-hidden="true">
      <AudioAnalyzer managerInstancesRef={managerInstancesRef} />
    </div>
  );
};

AudioAnalyzerWrapper.propTypes = {
  isAudioActive: PropTypes.bool.isRequired,
  managerInstancesRef: PropTypes.object.isRequired,
};

export default React.memo(AudioAnalyzerWrapper);