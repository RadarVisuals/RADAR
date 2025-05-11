import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './PresetSelectorBar.css';

const ITEMS_PER_PAGE = 5;
const SLIDE_ANIMATION_DURATION_MS = 300;

/**
 * PresetSelectorBar displays a paginated list of saved configuration presets
 * as numbered buttons. It allows users to load presets by clicking these buttons
 * and navigate through pages of presets if the total number exceeds `ITEMS_PER_PAGE`.
 * The currently active preset is visually highlighted.
 *
 * @param {object} props - Component props.
 * @param {Array<{name: string}>} [props.savedConfigList=[]] - An array of saved preset objects, each expected to have a `name` property.
 * @param {string|null} [props.currentConfigName=null] - The name of the currently active/loaded preset.
 * @param {(presetName: string) => void} props.onPresetSelect - Callback function invoked when a preset button is clicked, passing the preset's name.
 * @param {boolean} [props.isLoading=false] - Indicates if presets are currently being loaded or a transition is in progress, used to disable controls.
 * @returns {JSX.Element|null} The rendered PresetSelectorBar component, or null if no presets are available.
 */
const PresetSelectorBar = ({
  savedConfigList = [],
  currentConfigName,
  onPresetSelect,
  isLoading,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [paginationDirection, setPaginationDirection] = useState(null); // 'prev', 'next', or null

  const sortedList = useMemo(() => {
    const validList = savedConfigList.filter(
      (item) => item && typeof item.name === 'string'
    );
    // Sort by the numeric part of the preset name (e.g., "RADAR.001")
    return [...validList].sort((a, b) => {
      const numA = parseInt(a.name.split('.')[1] || '0', 10);
      const numB = parseInt(b.name.split('.')[1] || '0', 10);
      const valA = isNaN(numA) ? Infinity : numA; // Handle non-standard names
      const valB = isNaN(numB) ? Infinity : numB;
      return valA - valB;
    });
  }, [savedConfigList]);

  // Effect to synchronize currentPage with currentConfigName
  useEffect(() => {
    if (currentConfigName && sortedList.length > 0) {
      const currentIndex = sortedList.findIndex(p => p.name === currentConfigName);
      if (currentIndex !== -1) {
        const targetPage = Math.floor(currentIndex / ITEMS_PER_PAGE);
        setCurrentPage(prevPage => {
            if (prevPage !== targetPage) {
                setPaginationDirection(null); // Reset animation direction
                return targetPage;
            }
            return prevPage;
        });
      }
    } else if (sortedList.length === 0) {
        setCurrentPage(prevPage => {
            if (prevPage !== 0) {
                setPaginationDirection(null);
                return 0;
            }
            return prevPage;
        });
    }
  }, [currentConfigName, sortedList]);

  // Effect to clear pagination animation direction after animation duration
  useEffect(() => {
    let timer;
    if (paginationDirection) {
      timer = setTimeout(() => {
        setPaginationDirection(null);
      }, SLIDE_ANIMATION_DURATION_MS);
    }
    return () => clearTimeout(timer);
  }, [paginationDirection]);

  const totalPages = Math.ceil(sortedList.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  const visiblePresets = useMemo(() => {
    return sortedList.slice(startIndex, endIndex);
  }, [sortedList, startIndex, endIndex]); // Correct: Depends on startIndex and endIndex

  /**
   * Extracts a displayable number or short identifier from the preset name.
   * @param {string} name - The full preset name.
   * @returns {string} The displayable number or a fallback.
   */
  const getPresetNumber = (name) => {
    if (!name || typeof name !== 'string') return '?';
    const nameParts = name.split('.');
    if (nameParts.length > 1) {
        const numStr = nameParts[1];
        const num = parseInt(numStr, 10);
        if (!isNaN(num)) { return num.toString(); }
        return nameParts.slice(1).join('.'); // Fallback for non-numeric part
    }
    return name.substring(0, 3); // Fallback for names without a dot
  };

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

  if (!sortedList || sortedList.length === 0) {
    return null;
  }

  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;
  const animationClass = paginationDirection === 'next' ? 'slide-in-left' :
                         paginationDirection === 'prev' ? 'slide-in-right' : '';

  return (
    <div className="preset-selector-bar">
      <button
        type="button"
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
              type="button"
              key={preset.name}
              className={`preset-selector-button ${isActive ? 'active' : ''}`}
              onClick={() => onPresetSelect(preset.name)}
              disabled={isLoading}
              title={`Load ${preset.name}`}
            >
              {getPresetNumber(preset.name)}
            </button>
          );
        })}
      </div>
      <button
        type="button"
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