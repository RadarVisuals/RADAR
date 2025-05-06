import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './PresetSelectorBar.css';

const ITEMS_PER_PAGE = 5;
const SLIDE_ANIMATION_DURATION_MS = 300; // Match --slide-duration in CSS

/**
 * PresetSelectorBar: Displays a paginated list of saved configuration presets
 * as numbered buttons. Allows users to load presets and navigate through pages.
 * Highlights the currently active preset.
 */
const PresetSelectorBar = ({
  savedConfigList = [],
  currentConfigName,
  onPresetSelect,
  isLoading, // Disables buttons during loading/transitions
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [paginationDirection, setPaginationDirection] = useState(null); // 'prev', 'next', or null

  // Sort presets numerically based on name (e.g., "RADAR.001")
  const sortedList = useMemo(() => {
    const validList = savedConfigList.filter(
      (item) => item && typeof item.name === 'string'
    );
    return [...validList].sort((a, b) => {
      const numA = parseInt(a.name.split('.')[1] || '0', 10);
      const numB = parseInt(b.name.split('.')[1] || '0', 10);
      const valA = isNaN(numA) ? Infinity : numA;
      const valB = isNaN(numB) ? Infinity : numB;
      return valA - valB;
    });
  }, [savedConfigList]);

  // Effect to sync the current page when the active preset changes externally
  useEffect(() => {
    if (currentConfigName && sortedList.length > 0) {
      const currentIndex = sortedList.findIndex(p => p.name === currentConfigName);
      if (currentIndex !== -1) {
        const targetPage = Math.floor(currentIndex / ITEMS_PER_PAGE);
        setCurrentPage(prevPage => {
            if (prevPage !== targetPage) {
                setPaginationDirection(null); // Reset animation on sync
                return targetPage;
            }
            return prevPage; // No change needed
        });
      }
    } else if (sortedList.length === 0) {
        // Reset to page 0 if the list becomes empty
        setCurrentPage(prevPage => {
            if (prevPage !== 0) {
                setPaginationDirection(null);
                return 0;
            }
            return prevPage;
        });
    }
  }, [currentConfigName, sortedList]);

  // Effect to reset slide animation direction after animation completes
  useEffect(() => {
    let timer;
    if (paginationDirection) {
      timer = setTimeout(() => {
        setPaginationDirection(null);
      }, SLIDE_ANIMATION_DURATION_MS);
    }
    return () => clearTimeout(timer);
  }, [paginationDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(sortedList.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const visiblePresets = useMemo(() => sortedList.slice(startIndex, endIndex), [sortedList, startIndex, endIndex]);

  // Extracts the numeric part of the preset name for display
  const getPresetNumber = (name) => {
    if (!name || typeof name !== 'string') return '?';
    const nameParts = name.split('.');
    if (nameParts.length > 1) {
        const numStr = nameParts[1];
        const num = parseInt(numStr, 10);
        if (!isNaN(num)) {
            return num.toString();
        }
        // Fallback if second part isn't a number
        return nameParts.slice(1).join('.');
    }
    return name.substring(0, 3); // Fallback for names without '.'
  };

  // Pagination Handlers
  const handlePrev = () => {
    if (currentPage > 0) {
      setPaginationDirection('prev');
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      setPaginationDirection('next');
      setCurrentPage((prev) => prev + 1);
    }
  };

  // Don't render if no presets
  if (!sortedList || sortedList.length === 0) {
    return null;
  }

  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;

  // Determine animation class based on pagination direction
  const animationClass = paginationDirection === 'next' ? 'slide-in-left' :
                         paginationDirection === 'prev' ? 'slide-in-right' : '';

  return (
    <div className="preset-selector-bar">
      <button
        className="pagination-button"
        onClick={handlePrev}
        disabled={!canGoPrev || isLoading || !!paginationDirection}
        aria-label="Previous presets"
        title="Previous presets"
      >
        {'<'}
      </button>

      <div className={`preset-buttons-container ${animationClass}`}>
        {visiblePresets.map((preset) => {
          const isActive = preset.name === currentConfigName;
          return (
            <button
              key={preset.name}
              className={`preset-selector-button ${isActive ? 'active' : ''}`}
              onClick={() => onPresetSelect(preset.name)}
              disabled={isLoading} // Disable during loading/transitions
              title={`Load ${preset.name}`}
            >
              {getPresetNumber(preset.name)}
            </button>
          );
        })}
      </div>

      <button
        className="pagination-button"
        onClick={handleNext}
        disabled={!canGoNext || isLoading || !!paginationDirection}
        aria-label="Next presets"
        title="Next presets"
      >
        {'>'}
      </button>
    </div>
  );
};

PresetSelectorBar.propTypes = {
  savedConfigList: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    })
  ),
  currentConfigName: PropTypes.string,
  onPresetSelect: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

PresetSelectorBar.defaultProps = {
  savedConfigList: [],
  currentConfigName: null,
  isLoading: false,
};

export default PresetSelectorBar;