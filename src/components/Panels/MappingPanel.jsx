// src/components/Panels/MappingPanel.jsx
import React from 'react';
import PropTypes from 'prop-types';
import Panel from './Panel';
import { useUIStore } from '../../store/useUIStore';
import { syncBridge } from '../../utils/SyncBridge';

const MappingPanel = ({ onClose }) => {
  const config = useUIStore((state) => state.mappingConfig);
  const updateConfig = useUIStore((state) => state.updateMappingConfig);
  const resetConfig = useUIStore((state) => state.resetMappingConfig);
  const toggleProjectorMode = useUIStore((state) => state.toggleProjectorMode);

  const handleSliderChange = (key, value) => {
    const numericVal = parseFloat(value);
    updateConfig(key, numericVal);
    
    // BROADCAST: Sync mapping mask coordinates to the receiver
    syncBridge.sendMappingConfig({
      ...config,
      [key]: numericVal
    });
  };

  const handleEnterProjectorMode = () => {
    const confirmation = window.confirm(
      "ACTIVATE PROJECTOR / RECEIVER MODE?\n\n" +
      "This tab will become a dedicated full-screen render node.\n" +
      "All UI will be hidden. This tab will respond to commands from your other Controller tab.\n\n" +
      "Double-click anywhere on the screen later to reload and exit."
    );

    if (confirmation) {
      syncBridge.setRole('receiver');
      toggleProjectorMode(); // Triggers Fullscreen via Store logic
      onClose();
    }
  };

  return (
    <Panel 
      title="VIDEO MAPPING" 
      onClose={onClose} 
      className="panel-from-toolbar mapping-control-panel"
    >
      <div className="audio-control-content">
        <div className="section-box">
           <div className="toggle-description">
            <h3>Iris Mask Calibration</h3>
            <p style={{fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px'}}>
              Adjust the circle to fit your projection surface. 
              Press <strong>TAB</strong> to hide the interface.
            </p>
          </div>
        </div>

        <div className="sliders-section section-box">
          <div className="slider-group">
            
            <div className="slider-container">
              <div className="slider-header">
                <span className="slider-label">Circle Radius</span>
                <span className="slider-value">{config.radius.toFixed(1)}%</span>
              </div>
              <input 
                type="range" min="1" max="100" step="0.1" 
                value={config.radius} 
                onChange={(e) => handleSliderChange('radius', e.target.value)}
                className="horizontal-slider"
              />
            </div>

            <div className="slider-container">
              <div className="slider-header">
                <span className="slider-label">Edge Softness (Feather)</span>
                <span className="slider-value">{config.feather.toFixed(1)}%</span>
              </div>
              <input 
                type="range" min="0.1" max="25" step="0.1" 
                value={config.feather} 
                onChange={(e) => handleSliderChange('feather', e.target.value)}
                className="horizontal-slider"
              />
            </div>

            <div className="slider-container" style={{marginTop: 'var(--space-sm)'}}>
              <div className="slider-header">
                <span className="slider-label">Horizontal Center (X)</span>
                <span className="slider-value">{config.x.toFixed(1)}%</span>
              </div>
              <input 
                type="range" min="0" max="100" step="0.1" 
                value={config.x} 
                onChange={(e) => handleSliderChange('x', e.target.value)}
                className="horizontal-slider"
              />
            </div>

            <div className="slider-container">
              <div className="slider-header">
                <span className="slider-label">Vertical Center (Y)</span>
                <span className="slider-value">{config.y.toFixed(1)}%</span>
              </div>
              <input 
                type="range" min="0" max="100" step="0.1" 
                value={config.y} 
                onChange={(e) => handleSliderChange('y', e.target.value)}
                className="horizontal-slider"
              />
            </div>

          </div>

          <button 
            className="btn btn-block btn-secondary" 
            style={{marginTop: 'var(--space-md)', fontSize: '10px'}}
            onClick={() => {
                resetConfig();
                syncBridge.sendMappingConfig({ radius: 35.0, feather: 2.0, x: 50.0, y: 50.0 });
            }}
          >
            Reset to Center
          </button>
        </div>

        {/* --- DUAL SCREEN INITIATION --- */}
        <div className="section-box" style={{marginTop: 'var(--space-md)', border: '1px solid var(--color-accent)'}}>
            <h4 style={{color: 'var(--color-accent)', fontSize: '12px', marginBottom: '8px'}}>Dual-Screen Projector Mode</h4>
            <p style={{fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: '1.4'}}>
                Turn this browser tab into a dedicated visual receiver. It will hide all UI and wait for sync data from your Controller tab.
            </p>
            <button 
                className="btn btn-block"
                style={{
                    marginTop: '12px',
                    backgroundColor: 'rgba(255, 215, 0, 0.15)',
                    borderColor: 'var(--color-accent)',
                    color: 'var(--color-accent)',
                    fontWeight: 'bold',
                    fontSize: '11px'
                }}
                onClick={handleEnterProjectorMode}
            >
                ENTER RECEIVER MODE
            </button>
        </div>
      </div>
    </Panel>
  );
};

MappingPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default MappingPanel;