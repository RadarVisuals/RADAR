import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './PresetSelectorBar.css';

const ITEMS_PER_PAGE = 5;
const SLIDE_ANIMATION_DURATION_MS = 300;
const MAX_BUTTON_LABEL_LENGTH = 3; // Max characters for the button label

/**
 * Generates a concise display label for a preset button.
 * - If name is "Prefix.Number" (e.g., "RADAR.001"), displays the number (e.g., "1").
 * - If name is "Prefix.Text" (e.g., "MyProject.Scene"), displays the first MAX_BUTTON_LABEL_LENGTH chars of "Text" in uppercase (e.g., "SCE").
 * - If name is "TextOnly" (e.g., "Kalyuga"), displays the first MAX_BUTTON_LABEL_LENGTH chars in uppercase (e.g., "KAL").
 * @param {string} fullName - The full preset name.
 * @returns {string} The generated display label.
 */
const getPresetDisplayLabel = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return '?';

  const nameParts = fullName.split('.');

  if (nameParts.length > 1) {
    // Case 1: "Prefix.Identifier"
    const identifier = nameParts.slice(1).join('.'); // Get everything after the first dot

    if (/^\d+$/.test(identifier)) { // If identifier is purely numeric (e.g., "001", "123")
      const num = parseInt(identifier, 10);
      return num.toString(); // Display "1", "123"
    } else {
      // If identifier is text (e.g., "Kal", "My Scene")
      return identifier.substring(0, MAX_BUTTON_LABEL_LENGTH).toUpperCase();
    }
  } else {
    // Case 2: "FullNameOnly" (no dots)
    return fullName.substring(0, MAX_BUTTON_LABEL_LENGTH).toUpperCase();
  }
};


/**
 * PresetSelectorBar displays a paginated list of saved configuration presets
 * as numbered/labeled buttons. It allows users to load presets by clicking these buttons
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
    // The list from the context is now pre-sorted.
    // We just filter to ensure all items are valid before rendering.
    return savedConfigList.filter(
      (item) => item && typeof item.name === 'string'
    );
  }, [savedConfigList]);

  useEffect(() => {
    if (currentConfigName && sortedList.length > 0) {
      const currentIndex = sortedList.findIndex(p => p.name === currentConfigName);
      if (currentIndex !== -1) {
        const targetPage = Math.floor(currentIndex / ITEMS_PER_PAGE);
        setCurrentPage(prevPage => {
            if (prevPage !== targetPage) {
                setPaginationDirection(null);
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
  }, [sortedList, startIndex, endIndex]);

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
          const displayLabel = getPresetDisplayLabel(preset.name);
          return (
            <button
              type="button"
              key={preset.name}
              className={`preset-selector-button ${isActive ? 'active' : ''}`}
              onClick={() => onPresetSelect(preset.name)}
              disabled={isLoading}
              title={`Load: ${preset.name}`}
            >
              {/* Shortened label on button */}
              {displayLabel}
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