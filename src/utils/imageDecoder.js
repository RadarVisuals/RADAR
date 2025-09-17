// src/utils/imageDecoder.js

import { demoAssetMap } from '../assets/DemoLayers/initLayers';

// In-memory cache for GPU-ready ImageBitmap objects
const decodedImageCache = new Map();

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
  if (decodedImageCache.has(src)) {
    return Promise.resolve(decodedImageCache.get(src));
  }

  // Use a temporary Image element to fetch the blob
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src.startsWith('http') && !src.startsWith(window.location.origin)) {
      img.crossOrigin = "Anonymous";
    }

    img.src = src;

    img.onload = async () => {
      try {
        const imageBitmap = await createImageBitmap(img);
        decodedImageCache.set(src, imageBitmap);
        resolve(imageBitmap);
      } catch (bitmapError) {
        console.error(`[ImageDecoder] Failed to create ImageBitmap for: ${src}`, bitmapError);
        reject(bitmapError);
      }
    };

    img.onerror = (error) => {
      console.error(`[ImageDecoder] Failed to load image blob for bitmap creation: ${src}`, error);
      reject(error);
    };
  });
};

/**
 * Preloads and decodes an array of image URLs into ImageBitmaps.
 * This is now an async function that returns a Promise which resolves when all images are processed.
 * @param {string[]} urls - An array of image URLs to preload.
 * @returns {Promise<void>} A promise that resolves when all images have been attempted.
 */
export const preloadImages = async (urls) => {
  if (!Array.isArray(urls)) return;

  const preloadPromises = urls.map(url => {
    if (typeof url === 'string' && url.length > 0 && !decodedImageCache.has(url)) {
      return getDecodedImage(url).catch(() => {
        // Errors are already logged in getDecodedImage. We catch here so one failed image doesn't stop all others.
      });
    }
    return Promise.resolve();
  });

  // Wait for all image decoding promises to settle (either resolve or reject).
  await Promise.allSettled(preloadPromises);
};