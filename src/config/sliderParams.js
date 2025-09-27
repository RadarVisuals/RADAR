// src/config/sliderParams.js

/**
 * Shared configuration for visual layer control sliders.
 * This is used across various components and contexts to ensure consistency.
 *
 * @property {string} prop - The key in the layer configuration object.
 * @property {string} label - The display label for the UI.
 * @property {string} icon - Placeholder for a potential future icon identifier.
 * @property {number} min - The minimum value for the slider.
 * @property {number} max - The maximum value for the slider.
 * @property {number} step - The step increment for the slider.
 * @property {number} formatDecimals - The number of decimal places for display formatting.
 * @property {number} [defaultValue=0] - The default value if one is not provided in the configuration.
 */
export const sliderParams = [
  { prop: "speed", label: "SPEED", icon: "slidersIcon_placeholder", min: 0.001, max: 0.1, step: 0.001, formatDecimals: 3 },
  { prop: "size", label: "SIZE", icon: "enlargeIcon_placeholder", min: 0.1, max: 8.0, step: 0.01, formatDecimals: 1 },
  { prop: "opacity", label: "OPACITY", icon: "eyeIcon_placeholder", min: 0, max: 1, step: 0.001, formatDecimals: 2, defaultValue: 1 },
  { prop: "drift", label: "DRIFT", icon: "wavesIcon_placeholder", min: 0, max: 100, step: 0.001, formatDecimals: 1 },
  { prop: "driftSpeed", label: "DRIFT SPEED", icon: "wavezIcon_placeholder", min: 0, max: 1, step: 0.001, formatDecimals: 1 },
  { prop: "xaxis", label: "X POS", icon: "horizontalviewIcon_placeholder", min: -10000, max: 10000, step: 0.001, formatDecimals: 0 },
  { prop: "yaxis", label: "Y POS", icon: "verticalviewIcon_placeholder", min: -10000, max: 10000, step: 0.001, formatDecimals: 0 },
  { prop: "angle", label: "ANGLE", icon: "rotateIcon_placeholder", min: -90, max: 90, step: 0.001, formatDecimals: 1 },
];