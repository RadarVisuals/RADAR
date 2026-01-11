// src/utils/imageDecoder.js

import { demoAssetMap } from '../assets/DemoLayers/initLayers';
import { loadAssetsWithRetries } from './RobustLoader'; // <-- Import your new tool

/**
 * LRU Cache Configuration
 * 60 items is a safe balance. Assuming roughly 1024x1024 textures (~4MB each),
 * this caps usage at approx ~240MB of VRAM for cached assets.
 */
const MAX_CACHE_SIZE = 60;

/**
 * Custom LRU Cache implementation for ImageBitmaps.
 * Ensures we call .close() on evicted items to free GPU memory.
 */
class ImageBitmapCache {
  constructor(limit) {
    this.limit = limit;
    this.map = new Map(); // Maps URL -> ImageBitmap
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    
    // Refresh item: remove and re-insert at the end (newest)
    const val = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key, val) {
    // If it exists, update it and move to end
    if (this.map.has(key)) {
      this.map.delete(key);
    } 
    // If cache is full, evict the oldest (first item in Map)
    else if (this.map.size >= this.limit) {
      const oldestKey = this.map.keys().next().value;
      this.evict(oldestKey);
    }
    
    this.map.set(key, val);
  }

  has(key) {
    return this.map.has(key);
  }

  evict(key) {
    const val = this.map.get(key);
    if (val) {
      // CRITICAL: Release GPU memory immediately
      // ImageBitmap.close() is essential for WebGL performance stability
      try {
        if (typeof val.close === 'function') {
          val.close();
        }
      } catch (e) {
        // Ignore errors if already closed or not supported
        if (import.meta.env.DEV) console.warn("Error closing ImageBitmap:", e);
      }
      
      this.map.delete(key);
      if (import.meta.env.DEV) {
        console.log(`[ImageDecoder] Evicted & Closed texture: ${key.slice(-20)}`);
      }
    }
  }
}

// Singleton Cache Instance
const decodedImageCache = new ImageBitmapCache(MAX_CACHE_SIZE);

/**
 * Resolves a token assignment into a fetchable image URL.
 * @param {object|string} assignment - The token assignment from a preset.
 * @returns {string|null} The resolved image URL or null.
 */
export const resolveImageUrl = (assignment) => {
  if (typeof assignment === 'string' && assignment.startsWith("DEMO_LAYER_")) {
    return demoAssetMap[assignment] || null;
  }
  if (typeof assignment === 'object' && assignment !== null && assignment.src) {
    return assignment.src;
  }
  return null;
};

/**
 * Fetches an image and creates an ImageBitmap, which is optimized for rendering.
 * Returns the ImageBitmap object, ready for immediate drawing.
 * @param {string} src The URL of the image to preload and decode.
 * @returns {Promise<ImageBitmap>} A promise that resolves with the GPU-ready ImageBitmap object.
 */
export const getDecodedImage = (src) => {
  // Check LRU Cache first
  if (decodedImageCache.has(src)) {
    return Promise.resolve(decodedImageCache.get(src));
  }

  // Use a temporary Image element to fetch the blob
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Allow cross-origin for IPFS gateways/external sources
    img.crossOrigin = "Anonymous";

    img.src = src;

    img.onload = async () => {
      try {
        // createImageBitmap is much faster than standard texture uploads and doesn't block the main thread as much
        const imageBitmap = await createImageBitmap(img);
        decodedImageCache.set(src, imageBitmap); // Store in LRU
        resolve(imageBitmap);
      } catch (bitmapError) {
        console.error(`[ImageDecoder] Failed to create ImageBitmap for: ${src}`, bitmapError);
        reject(bitmapError);
      }
    };

    img.onerror = (error) => {
      // Don't log error here, let RobustLoader handle retries first.
      // We reject so RobustLoader knows it failed.
      reject(new Error(`Failed to load image: ${src}`));
    };
  });
};

/**
 * Preloads and decodes an array of image URLs into ImageBitmaps using RobustLoader.
 * 
 * - Limits concurrency to 6 (browser limit per domain is usually 6, avoids queue blocking)
 * - Retries failed downloads 3 times with backoff
 * 
 * @param {string[]} urls - An array of image URLs to preload.
 * @returns {Promise<void>} A promise that resolves when all images have been attempted.
 */
export const preloadImages = async (urls) => {
  if (!Array.isArray(urls)) return;

  // Filter out duplicates and already cached items to save bandwidth
  const uniqueUrls = [...new Set(urls)].filter(url => 
    typeof url === 'string' && url.length > 0 && !decodedImageCache.has(url)
  );

  if (uniqueUrls.length === 0) return;

  // Map URLs to objects with an 'id' for the loader
  const assetsToLoad = uniqueUrls.map(url => ({ id: url }));

  // Use the RobustLoader to handle the queue
  await loadAssetsWithRetries(
    assetsToLoad,
    (item) => getDecodedImage(item.id), // The task to run
    6, // Concurrency (Parallel downloads)
    3  // Retries per image
  );
  
  if (import.meta.env.DEV) {
    console.log(`[ImageDecoder] Preload complete for ${uniqueUrls.length} assets.`);
  }
};