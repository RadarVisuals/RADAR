import React from 'react';
import PropTypes from 'prop-types';

import AudioAnalyzer from '../Audio/AudioAnalyzer'; // Local component

const AudioAnalyzerWrapper = ({
  isAudioActive,
  managersReady,
  handleAudioDataUpdate,
  layerConfigs, // This can now be null initially
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
        onAudioData={handleAudioDataUpdate}
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
  handleAudioDataUpdate: PropTypes.func.isRequired,
  // --- THIS IS THE FIX: Changed from .isRequired to .object ---
  layerConfigs: PropTypes.object,
  // -----------------------------------------------------------
  audioSettings: PropTypes.object.isRequired,
  configLoadNonce: PropTypes.number.isRequired,
  managerInstancesRef: PropTypes.object.isRequired,
};

export default AudioAnalyzerWrapper;