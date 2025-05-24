// src/components/MainViewParts/CriticalErrorDisplay.jsx
import React from 'react';
import PropTypes from 'prop-types';

// Assuming Viem types might be used for prop validation, though not strictly necessary for runtime.
// import { PublicClient, WalletClient } from 'viem';

/**
 * @typedef {object} CriticalErrorDisplayProps
 * @property {Error | null} initializationError - Error from Universal Profile Provider initialization.
 * @property {Error | null} fetchStateError - Error from blockchain client fetching state.
 * @property {object | null} publicClient - Viem PublicClient instance.
 * @property {object | null} walletClient - Viem WalletClient instance.
 */

/**
 * Displays a critical application error message if UP provider or Viem client issues occur.
 * If an error is displayed, this component renders the error UI. Otherwise, it renders null.
 * @param {CriticalErrorDisplayProps} props
 * @returns {JSX.Element | null}
 */
const CriticalErrorDisplay = ({ initializationError, fetchStateError, publicClient, walletClient }) => {
  if (initializationError || (fetchStateError && !publicClient && !walletClient)) {
    const errorSource = initializationError ? "Universal Profile Provider" : "Blockchain Client";
    const errorMessage = initializationError?.message || fetchStateError?.message || `Unknown critical error initialising ${errorSource}.`;

    return (
      <div id="fullscreen-root" className="main-view error-boundary-display" style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a', color: '#fff' }}>
        <div className="error-content" style={{ textAlign: 'center', padding: '20px', border: '1px solid #555', borderRadius: '8px', backgroundColor: '#2a2a2a' }}>
          <p style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#ff6b6b' }}>Critical Application Error</p>
          <p style={{ wordBreak: 'break-word', maxWidth: '400px', margin: '10px auto', color: '#ccc' }}>{errorMessage}</p>
          <p style={{ color: '#aaa' }}>Please ensure your Universal Profile browser extension is enabled and configured correctly, then try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return null; // Render nothing if no critical error condition is met
};

CriticalErrorDisplay.propTypes = {
  initializationError: PropTypes.instanceOf(Error),
  fetchStateError: PropTypes.instanceOf(Error),
  publicClient: PropTypes.object,
  walletClient: PropTypes.object,
};

export default CriticalErrorDisplay;