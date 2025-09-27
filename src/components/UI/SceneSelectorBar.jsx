// src/components/UI/SceneSelectorBar.jsx
import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './SceneSelectorBar.css';

const ITEMS_PER_PAGE = 5;
const SLIDE_ANIMATION_DURATION_MS = 300;
const MAX_BUTTON_LABEL_LENGTH = 3;

const getSceneDisplayLabel = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return '?';

  const nameParts = fullName.split('.');

  if (nameParts.length > 1) {
    const identifier = nameParts.slice(1).join('.');

    if (/^\d+$/.test(identifier)) {
      const num = parseInt(identifier, 10);
      return num.toString();
    } else {
      return identifier.substring(0, MAX_BUTTON_LABEL_LENGTH).toUpperCase();
    }
  } else {
    return fullName.substring(0, MAX_BUTTON_LABEL_LENGTH).toUpperCase();
  }
};

const SceneSelectorBar = ({
  savedSceneList = [],
  currentSceneName = null,
  onSceneSelect,
  isLoading = false,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [paginationDirection, setPaginationDirection] = useState(null);

  const sortedList = useMemo(() => {
    return savedSceneList.filter(
      (item) => item && typeof item.name === 'string'
    );
  }, [savedSceneList]);

  useEffect(() => {
    if (currentSceneName && sortedList.length > 0) {
      const currentIndex = sortedList.findIndex(p => p.name === currentSceneName);
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
  }, [currentSceneName, sortedList]);

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

  const visibleScenes = useMemo(() => {
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
    <div className="scene-selector-bar">
      <button
        type="button"
        className="pagination-button"
        onClick={handlePrev}
        disabled={!canGoPrev || isLoading || !!paginationDirection}
        aria-label="Previous scenes"
        title="Previous scenes"
      >
        {'<'}
      </button>
      <div className={`scene-buttons-container ${animationClass}`}>
        {visibleScenes.map((scene) => {
          const isActive = scene.name === currentSceneName;
          const displayLabel = getSceneDisplayLabel(scene.name);
          return (
            <button
              type="button"
              key={scene.name}
              className={`scene-selector-button ${isActive ? 'active' : ''}`}
              onClick={() => onSceneSelect(scene.name)}
              disabled={isLoading}
              title={`Load: ${scene.name}`}
            >
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
        aria-label="Next scenes"
        title="Next scenes"
      >
        {'>'}
      </button>
    </div>
  );
};

SceneSelectorBar.propTypes = {
  savedSceneList: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    })
  ),
  currentSceneName: PropTypes.string,
  onSceneSelect: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default SceneSelectorBar;