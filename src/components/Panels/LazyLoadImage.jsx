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
        // When the placeholder comes into view, set isVisible to true
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Stop observing this element once it's visible
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

  // Only set the src attribute if the component is visible
  const imageSource = isVisible ? src : '';

  return (
    <div ref={imgRef} className={`lazy-image-container ${isLoaded ? 'loaded' : ''}`}>
      <img
        src={imageSource}
        alt={alt}
        className={className}
        onLoad={() => setIsLoaded(true)}
        style={{ opacity: isLoaded ? 1 : 0 }} // Fade in the image when loaded
        draggable="false"
        decoding="async"
      />
      {/* Show a shimmer placeholder while the image is loading */}
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