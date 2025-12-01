// src/components/Panels/TokenGrid.jsx
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import './PanelStyles/TokenSelectorOverlay.css';

const TokenGrid = ({ tokens, renderTokenItem, hasMore, onLoadMore, isLoading, scrollContainerRef }) => {
  const sentinelRef = useRef(null);
  const onLoadMoreRef = useRef(onLoadMore);

  // Keep the onLoadMore callback ref up to date
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  // This effect sets up the IntersectionObserver to watch the sentinel
  useEffect(() => {
    // Don't run if no more data, or refs are missing
    if (!hasMore || !sentinelRef.current || !scrollContainerRef?.current) return;

    const options = {
      root: scrollContainerRef.current, 
      rootMargin: '200px', // Pre-fetch when within 200px of bottom
      threshold: 0.01,
    };

    const observer = new IntersectionObserver(
      (entries) => {
        // Trigger load if sentinel is visible and we aren't currently loading
        if (entries[0].isIntersecting && !isLoading && onLoadMoreRef.current) {
          onLoadMoreRef.current();
        }
      },
      options
    );

    const currentSentinel = sentinelRef.current;
    observer.observe(currentSentinel);

    return () => {
      observer.unobserve(currentSentinel);
      observer.disconnect();
    };
    
    // --- FIX: Added tokens.length and isLoading to dependencies ---
    // This ensures that if new tokens load but don't fill the screen,
    // the observer resets, re-checks, and triggers the next page immediately.
  }, [hasMore, scrollContainerRef, tokens.length, isLoading]);

  if (tokens.length === 0 && !hasMore && !isLoading) {
    return <p className="no-items-message">No tokens found in this collection.</p>;
  }

  return (
    <div className="tokens-grid">
      {tokens.map((token) => (
        <React.Fragment key={token.id}>
          {renderTokenItem(token)}
        </React.Fragment>
      ))}
      
      {/* Sentinel: The invisible line at the bottom we watch for */}
      {hasMore && (
        <div 
            ref={sentinelRef} 
            style={{ 
                height: '20px', 
                width: '100%', 
                gridColumn: '1 / -1', 
                pointerEvents: 'none' 
            }} 
        />
      )}
      
      {isLoading && (
        <div className="loading-message" style={{ gridColumn: '1 / -1' }}>
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
};

TokenGrid.propTypes = {
  tokens: PropTypes.array.isRequired,
  renderTokenItem: PropTypes.func.isRequired,
  hasMore: PropTypes.bool.isRequired,
  onLoadMore: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  scrollContainerRef: PropTypes.object,
};

export default React.memo(TokenGrid);