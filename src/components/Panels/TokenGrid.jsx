// src/components/Panels/TokenGrid.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import './PanelStyles/TokenSelectorOverlay.css';

const BATCH_SIZE = 20; // Increased batch size for better performance
const ITEM_WIDTH = 106; // Token item width + gap (90px + 16px gap)
const ITEM_HEIGHT = 126; // Token item height + gap
const VIRTUALIZATION_THRESHOLD = 50; // Use virtualization for 50+ items

const TokenGrid = ({ tokens, renderTokenItem }) => {
  const [displayedTokens, setDisplayedTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  
  const containerRef = useRef(null);
  const animationFrameId = useRef(null);
  const scrollTimeoutRef = useRef(null);

  // Calculate items per row based on container width
  const itemsPerRow = useMemo(() => {
    if (containerWidth === 0) return 5; // Default fallback
    return Math.floor(containerWidth / ITEM_WIDTH) || 1;
  }, [containerWidth]);

  // Determine if we should use virtualization
  const shouldVirtualize = tokens.length > VIRTUALIZATION_THRESHOLD;

  // Calculate visible range for virtualization
  const visibleRange = useMemo(() => {
    if (!shouldVirtualize) return { start: 0, end: tokens.length };
    
    const containerHeight = 400; // Approximate visible height
    const rowsVisible = Math.ceil(containerHeight / ITEM_HEIGHT) + 2; // +2 for buffer
    const startRow = Math.floor(scrollTop / ITEM_HEIGHT);
    const endRow = startRow + rowsVisible;
    
    return {
      start: Math.max(0, startRow * itemsPerRow),
      end: Math.min(tokens.length, endRow * itemsPerRow)
    };
  }, [scrollTop, itemsPerRow, tokens.length, shouldVirtualize]);

  // Get visible tokens for virtualization
  const visibleTokens = useMemo(() => {
    if (!shouldVirtualize) return tokens;
    return tokens.slice(visibleRange.start, visibleRange.end);
  }, [tokens, visibleRange, shouldVirtualize]);

  // Handle container resize
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setContainerWidth(width - 32); // Account for padding
      }
    };

    updateContainerWidth();
    
    const resizeObserver = new ResizeObserver(updateContainerWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Incremental loading for non-virtualized grids
  useEffect(() => {
    const cleanup = () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };

    // If virtualizing, show all visible tokens immediately
    if (shouldVirtualize) {
      setDisplayedTokens(visibleTokens);
      setIsLoading(false);
      return cleanup;
    }

    // For smaller lists, use incremental loading
    if (!tokens || tokens.length === 0) {
      setDisplayedTokens([]);
      setIsLoading(false);
      return cleanup;
    }

    setIsLoading(true);
    setDisplayedTokens([]);
    let currentIndex = 0;

    const renderBatch = () => {
      const nextBatch = tokens.slice(currentIndex, currentIndex + BATCH_SIZE);
      setDisplayedTokens(prev => [...prev, ...nextBatch]);
      currentIndex += BATCH_SIZE;

      if (currentIndex < tokens.length) {
        animationFrameId.current = requestAnimationFrame(renderBatch);
      } else {
        setIsLoading(false);
        animationFrameId.current = null;
      }
    };

    // Delay initial batch to prevent blocking
    animationFrameId.current = requestAnimationFrame(renderBatch);
    return cleanup;
  }, [tokens, visibleTokens, shouldVirtualize]);

  // Handle scroll for virtualization
  const handleScroll = useCallback((e) => {
    if (!shouldVirtualize) return;
    
    // Throttle scroll updates
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      setScrollTop(e.target.scrollTop);
    }, 10);
  }, [shouldVirtualize]);

  // Calculate total height for virtualized grid
  const totalHeight = useMemo(() => {
    if (!shouldVirtualize) return 'auto';
    const totalRows = Math.ceil(tokens.length / itemsPerRow);
    return totalRows * ITEM_HEIGHT;
  }, [tokens.length, itemsPerRow, shouldVirtualize]);

  // Calculate offset for visible items in virtualized grid
  const offsetY = useMemo(() => {
    if (!shouldVirtualize) return 0;
    const startRow = Math.floor(visibleRange.start / itemsPerRow);
    return startRow * ITEM_HEIGHT;
  }, [visibleRange.start, itemsPerRow, shouldVirtualize]);

  const progress = tokens.length > 0 ? (displayedTokens.length / tokens.length) * 100 : 0;

  if (shouldVirtualize) {
    return (
      <div 
        ref={containerRef}
        className="tokens-grid-container virtualized"
        style={{ height: '400px', overflowY: 'auto' }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div 
            className="tokens-grid"
            style={{ 
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0
            }}
          >
            {visibleTokens.map((token, index) => {
              const actualIndex = visibleRange.start + index;
              return (
                <React.Fragment key={`${token.id}-${actualIndex}`}>
                  {renderTokenItem(token)}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tokens-grid-container">
      {isLoading && displayedTokens.length === 0 && (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
        </div>
      )}
      <div className="tokens-grid">
        {displayedTokens.map(token => (
          <React.Fragment key={token.id}>
            {renderTokenItem(token)}
          </React.Fragment>
        ))}
      </div>
      {isLoading && displayedTokens.length > 0 && (
        <div className="loading-more">Loading more tokens...</div>
      )}
    </div>
  );
};

TokenGrid.propTypes = {
  tokens: PropTypes.array.isRequired,
  renderTokenItem: PropTypes.func.isRequired,
};

export default React.memo(TokenGrid);