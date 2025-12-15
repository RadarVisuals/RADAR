// src/config/sliderParams.js
import { LAYER_PARAMS_DEF } from './EffectManifest';

/**
 * Shared configuration for visual layer control sliders.
 * 
 * --- ADAPTER PATTERN ---
 * This file now adapts the Single Source of Truth (EffectManifest.js)
 * into the array format expected by the legacy UI components.
 * 
 * This ensures that changing a range in EffectManifest updates the UI sliders automatically.
 */

// Define the order in which sliders should appear in the UI
const UI_ORDER = [
    'speed', 
    'size', 
    'opacity', 
    'drift', 
    'driftSpeed', 
    'xaxis', 
    'yaxis', 
    'angle'
];

// Placeholder icons map (preserved from original file)
const ICON_MAP = {
    speed: "slidersIcon_placeholder",
    size: "enlargeIcon_placeholder",
    opacity: "eyeIcon_placeholder",
    drift: "wavesIcon_placeholder",
    driftSpeed: "wavezIcon_placeholder",
    xaxis: "horizontalviewIcon_placeholder",
    yaxis: "verticalviewIcon_placeholder",
    angle: "rotateIcon_placeholder"
};

export const sliderParams = UI_ORDER.map(propKey => {
    const def = LAYER_PARAMS_DEF[propKey];
    
    if (!def) {
        console.error(`[sliderParams] Missing definition in EffectManifest for: ${propKey}`);
        return null;
    }

    return {
        prop: propKey,
        label: def.label,
        icon: ICON_MAP[propKey],
        min: def.min,
        max: def.max,
        step: def.step,
        formatDecimals: def.formatDecimals,
        defaultValue: def.default
    };
}).filter(Boolean);