import React from 'react';
import PropTypes from 'prop-types';
import AudioAnalyzer from '../Audio/AudioAnalyzer'; // Corrected Path

const AudioAnalyzerWrapper = ({
  isAudioActive,
  managersReady,
  handleAudioDataUpdate,
  layerConfigs,
  audioSettings,
  configLoadNonce,
  managerInstancesRef,
}) => {
  if (!isAudioActive || !managersReady) {
    return null;
  }

  return (
    <div className="hidden-audio-analyzer">
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
  layerConfigs: PropTypes.object.isRequired,
  audioSettings: PropTypes.object.isRequired,
  configLoadNonce: PropTypes.number.isRequired,
  managerInstancesRef: PropTypes.object.isRequired,
};

export default AudioAnalyzerWrapper;