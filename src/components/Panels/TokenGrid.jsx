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
    // --- FIX: Don't run the observer if there's no scroll container yet ---
    if (!hasMore || !sentinelRef.current || !scrollContainerRef?.current) return;

    // --- FIX: We now provide the scrollable container as the 'root' for the observer ---
    const options = {
      root: scrollContainerRef.current, // This tells the observer which scroll area to watch
      rootMargin: '200px', // Start loading when the sentinel is 200px away
      threshold: 0.01,
    };

    const observer = new IntersectionObserver(
      (entries) => {
        // isIntersecting is true when the sentinel enters the view of the `root`
        if (entries[0].isIntersecting && onLoadMoreRef.current) {
          onLoadMoreRef.current();
        }
      },
      options
    );

    const currentSentinel = sentinelRef.current;
    observer.observe(currentSentinel);

    return () => {
      observer.unobserve(currentSentinel);
    };
    // --- FIX: Add scrollContainerRef to the dependency array ---
  }, [hasMore, scrollContainerRef]);

  if (tokens.length === 0 && !hasMore && !isLoading) {
    return <p className="no-items-message">No tokens found in this collection.</p>;
  }

  return (
    // --- NOTE: We no longer need the outer scrollable div here, as it's in the parent ---
    <div className="tokens-grid">
      {tokens.map((token) => (
        <React.Fragment key={token.id}>
          {renderTokenItem(token)}
        </React.Fragment>
      ))}
      {hasMore && <div ref={sentinelRef} style={{ height: '1px', width: '100%' }} />}
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
  // --- FIX: Add the new prop for the scroll container ref ---
  scrollContainerRef: PropTypes.object,
};

export default React.memo(TokenGrid);