// src/components/MainViewParts/AudioAnalyzerWrapper.jsx
import React from 'react';
import PropTypes from 'prop-types';

import AudioAnalyzer from '../Audio/AudioAnalyzer'; 

const AudioAnalyzerWrapper = ({
  isAudioActive,
  managersReady,
  layerConfigs, 
  audioSettings,
  configLoadNonce,
  managerInstancesRef,
}) => {
  // Do not render the AudioAnalyzer if audio is not active, managers are not ready,
  // or if the layerConfigs haven't been loaded yet.
  if (!isAudioActive || !managersReady || !layerConfigs) {
    return null;
  }

  return (
    <div className="hidden-audio-analyzer" aria-hidden="true">
      <AudioAnalyzer
        isActive={isAudioActive}
        // onAudioData removed as it's now handled via event dispatch
        layerConfigs={layerConfigs}
        audioSettings={audioSettings}
        configLoadNonce={configLoadNonce}
        managerInstancesRef={managerInstancesRef}
      />
    </div>
  );
};

AudioAnalyzerWrapper.propTypes = {
  isAudioActive: PropTypes.bool.isRequired,
  managersReady: PropTypes.bool.isRequired,
  layerConfigs: PropTypes.object,
  audioSettings: PropTypes.object.isRequired,
  configLoadNonce: PropTypes.number.isRequired,
  managerInstancesRef: PropTypes.object.isRequired,
};

export default AudioAnalyzerWrapper;