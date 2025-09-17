// src/utils/imagePreloader.js

// IMPORTANT: You will need to import your demoAssetMap here for resolveImageUrl to work correctly.
import { demoAssetMap } from '../assets/DemoLayers/initLayers';

/**
 * Triggers the browser to fetch and cache an array of image URLs.
 * This is a "fire and forget" operation. The browser handles caching internally.
 * @param {string[]} urls - An array of image URLs to preload.
 */
export const preloadImages = (urls) => {
  if (!Array.isArray(urls)) return;

  urls.forEach(url => {
    if (typeof url === 'string' && url.length > 0) {
      // Creating a new Image object and setting its src is the standard
      // way to trigger a browser fetch for an image without adding it to the DOM.
      const img = new Image();
      img.src = url;
    }
  });
};

/**
 * Resolves a token assignment object or string into a fetchable image URL.
 * NOTE: This logic should be consistent with how it's resolved elsewhere in your app.
 * @param {object|string} assignment - The token assignment from a preset.
 * @returns {string|null} The resolved image URL or null.
 */
export const resolveImageUrl = (assignment) => {
  // Check for a demo asset string (e.g., "DEMO_LAYER_4")
  if (typeof assignment === 'string' && assignment.startsWith("DEMO_LAYER_")) {
    // This requires the `demoAssetMap` to be imported and available in this scope.
    // return demoAssetMap[assignment] || null; 
    
    // As a placeholder until you import demoAssetMap:
    console.warn("[resolveImageUrl] Demo asset resolution needs the demoAssetMap to be imported here.");
    return null;
  }
  // Check for the standard object format { id: '...', src: '...' }
  if (typeof assignment === 'object' && assignment !== null && assignment.src) {
    return assignment.src;
  }
  return null;
};