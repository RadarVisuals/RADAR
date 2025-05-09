// src/config/fallback-config.js

// No need to import specific images here if using tokenAssignments keys

/**
 * Default configuration object used when no specific profile configuration
 * (named preset or default pointer) is loaded.
 * Defines initial layer parameters and assigns default demo tokens.
 */
export default {
  version: "1.1", // Increment version number if desired
  layers: {
    // Keep the desired visual parameters from the original showcase/fallback
    1: { // Bottom Layer
      enabled: true,
      speed: 0.01,
      size: 4.7,
      xaxis: -629,
      yaxis: -1240,
      drift: 0.4,
      direction: -1,
      angle: -194.21,
      blendMode: "exclusion",
      driftSpeed: 0.3,
      opacity: 0.25,
    },
    2: { // Middle Layer
      enabled: true,
      speed: 0.01,
      size: 2,
      xaxis: 1771,
      yaxis: 1371,
      drift: 0.5,
      direction: -1,
      angle: -90,
      blendMode: "overlay",
      driftSpeed: 0.4,
      opacity: 1,
    },
    3: { // Top Layer
      enabled: true,
      speed: 0.01,
      size: 1.8,
      xaxis: 2229,
      yaxis: 1886,
      drift: 15.4,
      direction: 1,
      angle: 63.385,
      blendMode: "normal",
      driftSpeed: 0.3,
      opacity: 1,
    },
  },
  // --- UPDATED: Use tokenAssignments to specify the default visuals ---
  tokenAssignments: {
    // Assign the key for Layer4.webp to all visual layers
    // Assuming the key in demoAssetMap is "DEMO_LAYER_4"
    1: "DEMO_LAYER_4", // Bottom Layer uses Layer4.webp
    2: "DEMO_LAYER_4", // Middle Layer uses Layer4.webp
    3: "DEMO_LAYER_4", // Top Layer uses Layer4.webp
  },
  // --- REMOVED the potentially confusing 'assets' property ---
  // assets: { ... },
  reactions: {}, // Keep default empty reactions
};