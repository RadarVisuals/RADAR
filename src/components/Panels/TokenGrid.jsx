// src/components/Panels/TokenGrid.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import './PanelStyles/TokenSelectorOverlay.css';

const ITEM_WIDTH = 106; // Approx. token item width (90px) + gap (16px)
const ITEM_HEIGHT = 106; // Approx. token item height (90px) + gap (16px)
const VIRTUALIZATION_THRESHOLD = 40; // Use virtualization for lists larger than this
const OVERSCAN_ROWS = 3; // Render a few extra rows above and below the viewport

const TokenGrid = ({ tokens, renderTokenItem }) => {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  const shouldVirtualize = tokens.length > VIRTUALIZATION_THRESHOLD;

  // Observe container for size changes
  useEffect(() => {
    const containerElement = containerRef.current;
    if (!containerElement) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    resizeObserver.observe(containerElement);
    return () => resizeObserver.disconnect();
  }, []);

  // Handle scroll for virtualization
  const handleScroll = useCallback((e) => {
    if (shouldVirtualize) {
      setScrollTop(e.target.scrollTop);
    }
  }, [shouldVirtualize]);

  // Memoized calculations for virtualization
  const { virtualItems, totalHeight, paddingTop } = useMemo(() => {
    if (!shouldVirtualize || containerSize.width === 0) {
      // If not virtualizing, render all items with no special layout
      return { virtualItems: tokens, totalHeight: 'auto', paddingTop: 0 };
    }

    const itemsPerRow = Math.max(1, Math.floor(containerSize.width / ITEM_WIDTH));
    const totalRows = Math.ceil(tokens.length / itemsPerRow);
    const calculatedTotalHeight = totalRows * ITEM_HEIGHT;

    const visibleRows = Math.ceil(containerSize.height / ITEM_HEIGHT);
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN_ROWS) * itemsPerRow;
    const endIndex = Math.min(tokens.length, (Math.floor(scrollTop / ITEM_HEIGHT) + visibleRows + OVERSCAN_ROWS) * itemsPerRow);
    
    const calculatedPaddingTop = Math.max(0, Math.floor(startIndex / itemsPerRow) * ITEM_HEIGHT);

    return {
      virtualItems: tokens.slice(startIndex, endIndex),
      totalHeight: calculatedTotalHeight,
      paddingTop: calculatedPaddingTop,
    };
  }, [shouldVirtualize, tokens, containerSize, scrollTop]);

  if (tokens.length === 0) {
    return null;
  }

  // The container for the grid now uses the `token-display-area` class for consistent styling
  return (
    <div
      ref={containerRef}
      className="token-display-area"
      onScroll={handleScroll}
      style={{ overflowY: 'auto' }} // Ensure scrolling is enabled
    >
      <div style={{ height: totalHeight, paddingTop: paddingTop, position: 'relative' }}>
        <div className="tokens-grid">
          {virtualItems.map(token => (
            <React.Fragment key={token.id}>
              {renderTokenItem(token)}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

TokenGrid.propTypes = {
  tokens: PropTypes.array.isRequired,
  renderTokenItem: PropTypes.func.isRequired,
};

export default React.memo(TokenGrid);