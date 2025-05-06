// src/assets/DemoLayers/initLayers.js - REMOVED entityLogo, EXPANDED to 40 layers

// Import all your demo layer images
import demoLayer1 from './Layer1.webp';
import demoLayer2 from './Layer2.webp';
import demoLayer3 from './Layer3.webp';
import demoLayer4 from './Layer4.webp';
import demoLayer5 from './Layer5.webp';
import demoLayer6 from './Layer6.webp';
import demoLayer7 from './Layer7.webp';
import demoLayer8 from './Layer8.webp';
import demoLayer9 from './Layer9.webp';
import demoLayer10 from './Layer10.webp';
import demoLayer11 from './Layer11.webp';
import demoLayer12 from './Layer12.webp';
import demoLayer13 from './Layer13.webp';
import demoLayer14 from './Layer14.webp';
import demoLayer15 from './Layer15.webp';
import demoLayer16 from './Layer16.webp';
import demoLayer17 from './Layer17.webp';
import demoLayer18 from './Layer18.webp';
import demoLayer19 from './Layer19.webp';
import demoLayer20 from './Layer20.webp';
import demoLayer21 from './Layer21.webp';
import demoLayer22 from './Layer22.webp';
import demoLayer23 from './Layer23.webp';
import demoLayer24 from './Layer24.webp'; // Added
import demoLayer25 from './Layer25.webp'; // Added
import demoLayer26 from './Layer26.webp'; // Added
import demoLayer27 from './Layer27.webp'; // Added
import demoLayer28 from './Layer28.webp'; // Added
import demoLayer29 from './Layer29.webp'; // Added
import demoLayer30 from './Layer30.webp'; // Added
import demoLayer31 from './Layer31.webp'; // Added
import demoLayer32 from './Layer32.webp'; // Added
import demoLayer33 from './Layer33.webp'; // Added
import demoLayer34 from './Layer34.webp'; // Added
import demoLayer35 from './Layer35.webp'; // Added
import demoLayer36 from './Layer36.webp'; // Added
import demoLayer37 from './Layer37.webp'; // Added
import demoLayer38 from './Layer38.webp'; // Added
import demoLayer39 from './Layer39.webp'; // Added
import demoLayer40 from './Layer40.webp'; // Added


// --- REMOVED Logo Import ---
// import entityLogo from './entitylogo.webp';

// --- Create the Mapping ---
// Keys are the identifiers we will save, values are the imported assets
export const demoAssetMap = {
  "DEMO_LAYER_1": demoLayer1,
  "DEMO_LAYER_2": demoLayer2,
  "DEMO_LAYER_3": demoLayer3,
  "DEMO_LAYER_4": demoLayer4,
  "DEMO_LAYER_5": demoLayer5,
  "DEMO_LAYER_6": demoLayer6,
  "DEMO_LAYER_7": demoLayer7,
  "DEMO_LAYER_8": demoLayer8,
  "DEMO_LAYER_9": demoLayer9,
  "DEMO_LAYER_10": demoLayer10,
  "DEMO_LAYER_11": demoLayer11,
  "DEMO_LAYER_12": demoLayer12,
  "DEMO_LAYER_13": demoLayer13,
  "DEMO_LAYER_14": demoLayer14,
  "DEMO_LAYER_15": demoLayer15,
  "DEMO_LAYER_16": demoLayer16,
  "DEMO_LAYER_17": demoLayer17,
  "DEMO_LAYER_18": demoLayer18,
  "DEMO_LAYER_19": demoLayer19,
  "DEMO_LAYER_20": demoLayer20,
  "DEMO_LAYER_21": demoLayer21,
  "DEMO_LAYER_22": demoLayer22,
  "DEMO_LAYER_23": demoLayer23,
  "DEMO_LAYER_24": demoLayer24, // Added
  "DEMO_LAYER_25": demoLayer25, // Added
  "DEMO_LAYER_26": demoLayer26, // Added
  "DEMO_LAYER_27": demoLayer27, // Added
  "DEMO_LAYER_28": demoLayer28, // Added
  "DEMO_LAYER_29": demoLayer29, // Added
  "DEMO_LAYER_30": demoLayer30, // Added
  "DEMO_LAYER_31": demoLayer31, // Added
  "DEMO_LAYER_32": demoLayer32, // Added
  "DEMO_LAYER_33": demoLayer33, // Added
  "DEMO_LAYER_34": demoLayer34, // Added
  "DEMO_LAYER_35": demoLayer35, // Added
  "DEMO_LAYER_36": demoLayer36, // Added
  "DEMO_LAYER_37": demoLayer37, // Added
  "DEMO_LAYER_38": demoLayer38, // Added
  "DEMO_LAYER_39": demoLayer39, // Added
  "DEMO_LAYER_40": demoLayer40, // Added
};

// --- Export individual assets ---
export {
  demoLayer1,
  demoLayer2,
  demoLayer3,
  demoLayer4,
  demoLayer5,
  demoLayer6,
  demoLayer7,
  demoLayer8,
  demoLayer9,
  demoLayer10,
  demoLayer11,
  demoLayer12,
  demoLayer13,
  demoLayer14,
  demoLayer15,
  demoLayer16,
  demoLayer17,
  demoLayer18,
  demoLayer19,
  demoLayer20,
  demoLayer21,
  demoLayer22,
  demoLayer23,
  demoLayer24, // Added
  demoLayer25, // Added
  demoLayer26, // Added
  demoLayer27, // Added
  demoLayer28, // Added
  demoLayer29, // Added
  demoLayer30, // Added
  demoLayer31, // Added
  demoLayer32, // Added
  demoLayer33, // Added
  demoLayer34, // Added
  demoLayer35, // Added
  demoLayer36, // Added
  demoLayer37, // Added
  demoLayer38, // Added
  demoLayer39, // Added
  demoLayer40, // Added
  // --- REMOVED Logo Export ---
  // entityLogo,
};

// --- Helper to get Identifier from Source ---
// This automatically includes the new layers because it's built from demoAssetMap
const reverseDemoAssetMap = Object.fromEntries(
  Object.entries(demoAssetMap).map(([key, value]) => [value, key])
);
export const getDemoIdentifierFromSource = (source) => {
    return reverseDemoAssetMap[source] || null;
}

// --- Export default assets using the map for consistency ---
// Still uses the first three layers as default unless you want to change these
export const defaultLayerImageSources = {
    1: demoLayer1, // Default for Layer 1 (Bottom)
    2: demoLayer2, // Default for Layer 2 (Middle)
    3: demoLayer3, // Default for Layer 3 (Top)
}