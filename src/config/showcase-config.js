import {
  layer1Image,
  layer2Image,
  layer3Image,
  entityLogo,
} from "../assets/DemoLayers/initLayers";

/**
 * Default configuration object used for the showcase/demo mode
 * when no specific profile configuration is loaded.
 * Defines initial layer parameters and associated assets.
 */
export default {
  version: "1.0",
  layers: {
    1: {
      enabled: true,
      speed: 0.05,
      size: 3,
      xaxis: 165,
      yaxis: -1240,
      drift: 0.3,
      direction: -1,
      angle: -194.21,
      blendMode: "color-dodge",
      driftSpeed: 0.3,
      opacity: 1,
    },
    2: {
      enabled: true,
      speed: 0.07,
      size: 1.5,
      xaxis: 2107,
      yaxis: 1047,
      drift: 0.5,
      direction: -1,
      angle: -90,
      blendMode: "overlay",
      driftSpeed: 0.4,
      opacity: 1,
    },
    3: {
      enabled: true,
      speed: 0.075,
      size: 1.6,
      xaxis: 2210,
      yaxis: 1920,
      drift: 0.2,
      direction: 1,
      angle: 63.385,
      blendMode: "normal",
      driftSpeed: 0.3,
      opacity: 1,
    },
  },
  tokenAssignments: {}, // No specific tokens assigned by default
  reactions: {}, // No specific reactions assigned by default
  assets: {
    LAYER_1: layer1Image,
    LAYER_2: layer2Image,
    LAYER_3: layer3Image,
    ENTITY_LOGO: entityLogo,
  },
};