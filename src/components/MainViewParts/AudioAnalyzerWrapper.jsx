// src/components/Audio/AudioAnalyzerWrapper.jsx (Assuming path based on context)
import React from 'react';
import PropTypes from 'prop-types';

import AudioAnalyzer from '../Audio/AudioAnalyzer'; // Local component

// Assuming styles for "hidden-audio-analyzer" are defined elsewhere or globally,
// or that this class primarily serves as a semantic hook rather than for direct styling.
// e.g., import './AudioStyles.css';

/**
 * @typedef {object} AudioAnalyzerWrapperProps
 * @property {boolean} isAudioActive - If true, the audio analysis process is active and the `AudioAnalyzer` component will be rendered.
 * @property {boolean} managersReady - Indicates if the canvas managers (which might consume audio data for visual effects) are ready. The wrapper might choose not to render the analyzer if managers aren't ready.
 * @property {(data: import('../../hooks/useAudioVisualizer').RawAudioAnalyzerData) => void} handleAudioDataUpdate - Callback function invoked by `AudioAnalyzer` with new audio analysis data (e.g., level, frequency bands).
 * @property {import('../../context/VisualConfigContext').AllLayerConfigs} layerConfigs - Current configurations for all visual layers, potentially used by `AudioAnalyzer` if it needs to adapt analysis based on layer settings.
 * @property {import('../../hooks/useAudioVisualizer').AudioVisualizerSettings} audioSettings - Current settings for audio processing and analysis (e.g., intensity, smoothing).
 * @property {number} configLoadNonce - A nonce that changes when a new global configuration (preset) is loaded. This can be used by `AudioAnalyzer` to reset or re-initialize if its behavior depends on preset data.
 * @property {React.RefObject<Object.<string, import('../../utils/CanvasManager').default>>} managerInstancesRef - Ref to the canvas manager instances, potentially for direct interaction if `AudioAnalyzer` needs it (though typically data flows via `handleAudioDataUpdate`).
 */

/**
 * AudioAnalyzerWrapper: A simple wrapper component that conditionally renders the `AudioAnalyzer`.
 * It only renders the `AudioAnalyzer` if audio processing is active (`isAudioActive`) and
 * if the canvas managers are ready (`managersReady`), ensuring that audio analysis
 * doesn't run unnecessarily or before its consumers are prepared.
 * The wrapper itself is styled to be hidden, as `AudioAnalyzer` is typically a non-visual,
 * data-processing component.
 *
 * @param {AudioAnalyzerWrapperProps} props - The component's props.
 * @returns {JSX.Element | null} The rendered AudioAnalyzer within a hidden div, or null if conditions are not met.
 */
const AudioAnalyzerWrapper = ({
  isAudioActive,
  managersReady,
  handleAudioDataUpdate,
  layerConfigs,
  audioSettings,
  configLoadNonce,
  managerInstancesRef,
}) => {
  // Do not render the AudioAnalyzer if audio is not active or managers are not ready.
  // This prevents unnecessary processing.
  if (!isAudioActive || !managersReady) {
    return null;
  }

  return (
    // The "hidden-audio-analyzer" class suggests this wrapper is not meant to be visible.
    // Its purpose is to conditionally mount/unmount the AudioAnalyzer component.
    <div className="hidden-audio-analyzer" aria-hidden="true">
      <AudioAnalyzer
        isActive={isAudioActive} // Pass down the active state
        onAudioData={handleAudioDataUpdate} // Callback for processed audio data
        layerConfigs={layerConfigs} // Current layer configurations
        audioSettings={audioSettings} // Settings for the audio analysis
        configLoadNonce={configLoadNonce} // To react to preset changes
        managerInstancesRef={managerInstancesRef} // Ref to canvas managers
      />
    </div>
  );
};

AudioAnalyzerWrapper.propTypes = {
  /** If true, audio analysis is active and the analyzer is rendered. */
  isAudioActive: PropTypes.bool.isRequired,
  /** If true, indicates that canvas managers (consumers of audio data) are ready. */
  managersReady: PropTypes.bool.isRequired,
  /** Callback function invoked with new audio analysis data. */
  handleAudioDataUpdate: PropTypes.func.isRequired,
  /** Current configurations for all visual layers. */
  layerConfigs: PropTypes.object.isRequired, // More specific shape can be added if known
  /** Current settings for audio processing and analysis. */
  audioSettings: PropTypes.object.isRequired, // More specific shape can be added if known
  /** A nonce that changes when a new preset is loaded. */
  configLoadNonce: PropTypes.number.isRequired,
  /** Ref to the canvas manager instances. */
  managerInstancesRef: PropTypes.object.isRequired, // Typically a React.RefObject
};

// Default export is standard for React components.
// Consider React.memo if props are complex and might not change frequently,
// though for a simple wrapper like this, it might be unnecessary unless AudioAnalyzer itself is expensive.
export default AudioAnalyzerWrapper;