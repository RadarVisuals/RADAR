// src/components/Panels/LazyLoadImage.jsx
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

const observerOptions = {
  root: null, // observes intersections relative to the viewport
  rootMargin: '0px 0px 200px 0px', // Start loading images 200px before they enter the viewport
  threshold: 0.01, // Trigger as soon as a tiny part is visible
};

const LazyLoadImage = ({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const currentRef = imgRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  const imageSource = isVisible ? src : '';

  return (
    <div ref={imgRef} className={`lazy-image-container ${isLoaded ? 'loaded' : ''}`}>
      {/* === START OF FIX === */}
      {/* Only render the img tag if there is a valid, non-empty imageSource */}
      {imageSource ? (
        <img
          src={imageSource}
          alt={alt}
          className={className}
          onLoad={() => setIsLoaded(true)}
          style={{ opacity: isLoaded ? 1 : 0 }}
          draggable="false"
          decoding="async"
        />
      ) : null}
      {/* === END OF FIX === */}

      {/* This placeholder will now correctly remain visible if imageSource is empty */}
      {!isLoaded && <div className="placeholder-shimmer"></div>}
    </div>
  );
};

LazyLoadImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default LazyLoadImage;