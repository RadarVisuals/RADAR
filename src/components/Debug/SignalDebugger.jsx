// src/components/Debug/SignalDebugger.jsx
import React, { useEffect, useRef, useState } from 'react';
import SignalBus from '../../utils/SignalBus';

// Inline styles for zero-dependency implementation
const styles = {
  container: {
    position: 'fixed',
    bottom: '10px',
    left: '10px',
    width: '220px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '8px',
    zIndex: 9999,
    fontFamily: 'monospace',
    fontSize: '10px',
    color: '#00f3ff',
    backdropFilter: 'blur(4px)',
    pointerEvents: 'auto', // Allow clicking the toggle
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
    borderBottom: '1px solid #333',
    paddingBottom: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '2px',
    height: '14px',
  },
  label: {
    width: '70px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    color: '#aaa',
  },
  track: {
    flexGrow: 1,
    height: '6px',
    backgroundColor: '#222',
    position: 'relative',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: '#00f3ff',
    width: '0%',
    position: 'absolute',
    left: '0',
    transition: 'none', // Critical for 60fps updates
  },
  barBipolar: {
    height: '100%',
    backgroundColor: '#ff9000',
    width: '0%',
    position: 'absolute',
    left: '50%',
    transition: 'none',
  },
  value: {
    width: '30px',
    textAlign: 'right',
    color: '#fff',
    marginLeft: '4px',
  }
};

const SignalRow = ({ signalKey, containerRef }) => {
  const barRef = useRef(null);
  const valueRef = useRef(null);

  // Store refs in the parent map for the high-frequency updater
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current[signalKey] = { bar: barRef.current, value: valueRef.current };
    }
    return () => {
      if (containerRef.current) delete containerRef.current[signalKey];
    };
  }, [signalKey, containerRef]);

  // Determine if likely bipolar (LFOs) or unipolar (Audio/Events)
  const isLfo = signalKey.startsWith('lfo');
  const barStyle = isLfo ? styles.barBipolar : styles.bar;

  return (
    <div style={styles.row}>
      <span style={styles.label} title={signalKey}>{signalKey.replace(/^(audio\.|lfo\.)/, '')}</span>
      <div style={styles.track}>
        <div ref={barRef} style={barStyle}></div>
        {/* Center line for bipolar */}
        {isLfo && <div style={{position: 'absolute', left:'50%', top:0, bottom:0, width:'1px', background:'#444'}}></div>}
      </div>
      <span ref={valueRef} style={styles.value}>0.0</span>
    </div>
  );
};

const SignalDebugger = () => {
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default
  const [activeKeys, setActiveKeys] = useState([]);
  
  // Map of signalKey -> { bar: HTMLElement, value: HTMLElement }
  const refsMap = useRef({}); 

  // 1. Initial listener to discover keys (Lazy discovery)
  useEffect(() => {
    const handleInitial = (signals) => {
      const keys = Object.keys(signals).sort();
      // Only update state if keys change to avoid re-renders
      setActiveKeys(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(keys)) return keys;
        return prev;
      });
    };
    
    // Subscribe once just to get keys, then let the loop handle values
    const unsub = SignalBus.on('signals:update', handleInitial);
    return () => unsub();
  }, []);

  // 2. High-frequency update loop
  useEffect(() => {
    if (!isExpanded) return;

    const handleUpdate = (signals) => {
      for (const [key, val] of Object.entries(signals)) {
        const domRefs = refsMap.current[key];
        if (!domRefs) continue;

        // Visualize!
        if (domRefs.value) {
            domRefs.value.innerText = val.toFixed(2);
        }

        if (domRefs.bar) {
            if (key.startsWith('lfo') || key.startsWith('chaos')) {
                // Bipolar (-1 to 1) -> Map to width/left relative to center
                // 0 -> left: 50%, width: 0
                // 1 -> left: 50%, width: 50%
                // -1 -> left: 0%, width: 50%
                const pct = val * 50; // -50 to 50
                if (pct > 0) {
                    domRefs.bar.style.left = '50%';
                    domRefs.bar.style.width = `${pct}%`;
                } else {
                    domRefs.bar.style.left = `${50 + pct}%`; // e.g. 50 + -20 = 30%
                    domRefs.bar.style.width = `${Math.abs(pct)}%`;
                }
            } else {
                // Unipolar (0 to 1)
                domRefs.bar.style.width = `${Math.max(0, Math.min(1, val)) * 100}%`;
            }
        }
      }
    };

    const unsub = SignalBus.on('signals:update', handleUpdate);
    return () => unsub();
  }, [isExpanded]);

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <span>SIGNAL DEBUG MONITOR</span>
        <span>{isExpanded ? '▼' : '▲'}</span>
      </div>
      
      {isExpanded && (
        <div>
          {activeKeys.map(key => (
            <SignalRow key={key} signalKey={key} containerRef={refsMap} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SignalDebugger;