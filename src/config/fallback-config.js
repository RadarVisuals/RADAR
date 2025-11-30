// src/config/fallback-config.js

// No need to import specific images here if using tokenAssignments keys

/**
 * Default configuration object used when no specific profile configuration
 * (named scene or default pointer) is loaded.
 * Defines initial layer parameters and assigns default demo tokens.
 */
export default {
  version: "1.2", // Incremented version
  layers: {
    1: { // Bottom Layer
      enabled: true,
      speed: 0.010,
      size: 1.0,
      xaxis: -1500,
      yaxis: -1240,
      drift: 0.4,
      direction: -1,
      angle: -194.2,
      blendMode: "exclusion",
      driftSpeed: 0.3,
      opacity: 0.25,
    },
    2: { // Middle Layer
      enabled: true,
      speed: 0.010,
      size: 1.0,
      xaxis: 1083,
      yaxis: 583,
      drift: 0.5,
      direction: -1,
      angle: -90.0,
      blendMode: "overlay",
      driftSpeed: 0.4,
      opacity: 0.30,
    },
    3: { // Top Layer
      enabled: true,
      speed: 0.010,
      size: 0.6,
      xaxis: -667,
      yaxis: 833,
      drift: 15.4,
      direction: 1,
      angle: 63.4,
      blendMode: "normal",
      driftSpeed: 0.3,
      opacity: 1.00,
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