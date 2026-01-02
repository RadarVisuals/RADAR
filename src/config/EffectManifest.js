// src/config/EffectManifest.js
import { generateEffectManifest } from '../effects/shader-library/ShaderRegistry';

export const LAYER_PARAMS_DEF = {
    speed:      { label: 'SPEED',       type: 'float', min: 0.001, max: 0.1,   step: 0.001, default: 0.01, formatDecimals: 3, hardMin: 0.0, hardMax: 0.5 },
    size:       { label: 'SIZE',        type: 'float', min: 0.1,   max: 8.0,   step: 0.01,  default: 1.0,  formatDecimals: 1, hardMin: 0.01, hardMax: 20.0 },
    opacity:    { label: 'OPACITY',     type: 'float', min: 0,     max: 1,     step: 0.001, default: 1.0,  formatDecimals: 2, hardMin: 0.0, hardMax: 1.0 },
    drift:      { label: 'DRIFT',       type: 'float', min: 0,     max: 100,   step: 0.001, default: 0.0,  formatDecimals: 1, hardMin: 0.0, hardMax: 500.0 },
    driftSpeed: { label: 'DRIFT SPEED', type: 'float', min: 0,     max: 1,     step: 0.001, default: 0.0,  formatDecimals: 1, hardMin: 0.0, hardMax: 5.0 },
    xaxis:      { label: 'X POS',       type: 'float', min: -10000, max: 10000, step: 1,     default: 0.0,  formatDecimals: 0, hardMin: -50000, hardMax: 50000 },
    yaxis:      { label: 'Y POS',       type: 'float', min: -10000, max: 10000, step: 1,     default: 0.0,  formatDecimals: 0, hardMin: -50000, hardMax: 50000 },
    angle:      { label: 'ANGLE',       type: 'float', min: -90,   max: 90,    step: 0.1,   default: 0.0,  formatDecimals: 1, hardMin: -3600, hardMax: 3600 },
};

const generateLayerParams = (layerNum) => {
    const params = {};
    for (const [key, def] of Object.entries(LAYER_PARAMS_DEF)) {
        params[`l${layerNum}_${key}`] = {
            id: `layer.${layerNum}.${key}`,
            label: `L${layerNum} ${def.label}`,
            type: def.type,
            min: def.min,
            max: def.max,
            hardMin: def.hardMin,
            hardMax: def.hardMax,
            default: 0.0 
        };
    }
    return params;
};

const CORE_PHYSICS = {
    layer1: { label: 'Layer 1 Physics', params: generateLayerParams(1) },
    layer2: { label: 'Layer 2 Physics', params: generateLayerParams(2) },
    layer3: { label: 'Layer 3 Physics', params: generateLayerParams(3) },
};

// Infinity Trails is technically a "System" not a "Shader", so we keep its config here manually for now.
const SYSTEM_EFFECTS = {
    feedback: {
        label: 'Infinity Trails (Feedback)',
        params: {
            enabled:  { id: 'feedback.enabled',  label: 'Active',   type: 'bool',  min: 0, max: 1,    default: 0 },
            amount:   { id: 'feedback.amount',   label: 'Decay',    type: 'float', min: 0.5, max: 0.99, default: 0.9, hardMin: 0.0, hardMax: 0.999 },
            scale:    { id: 'feedback.scale',    label: 'Tunnel Zoom', type: 'float', min: 0.8, max: 1.2,  default: 1.01, hardMin: 0.1, hardMax: 2.0 }, 
            rotation: { id: 'feedback.rotation', label: 'Spin',     type: 'float', min: -1.0, max: 1.0, default: 0.0, hardMin: -5.0, hardMax: 5.0 },
            xOffset:  { id: 'feedback.xOffset',  label: 'Shift X',  type: 'float', min: -50, max: 50,   default: 0.0, hardMin: -500, hardMax: 500 },
            yOffset:  { id: 'feedback.yOffset',  label: 'Shift Y',  type: 'float', min: -50, max: 50,   default: 0.0, hardMin: -500, hardMax: 500 },
            renderOnTop: { id: 'feedback.renderOnTop', label: 'Trails on Top', type: 'bool', min: 0, max: 1, default: 0 },
            hueShift: { id: 'feedback.hueShift', label: 'Rainbow',  type: 'float', min: 0, max: 1.0, default: 0.0, hardMin: 0, hardMax: 1.0 },
            satShift: { id: 'feedback.satShift', label: 'Fried Color', type: 'float', min: -1.0, max: 1.0, default: 0.0, hardMin: -5.0, hardMax: 5.0 },
            contrast: { id: 'feedback.contrast', label: 'Deep Fry', type: 'float', min: 0, max: 1.0, default: 0.0, hardMin: 0, hardMax: 2.0 },
            invert:   { id: 'feedback.invert',   label: 'Strobe',   type: 'bool',  min: 0, max: 1, default: 0 },
            sway:     { id: 'feedback.sway',     label: 'Snake/Sway', type: 'float', min: 0, max: 50.0, default: 0.0, hardMin: 0, hardMax: 500.0 },
            chroma:   { id: 'feedback.chroma',   label: 'Warp (RGB)', type: 'float', min: 0, max: 10.0, default: 0.0, hardMin: -50, hardMax: 50.0 },
        }
    },
};

export const EFFECT_MANIFEST = generateEffectManifest({
    ...CORE_PHYSICS,
    ...SYSTEM_EFFECTS
});

export const getAllParamIds = () => {
    const ids = [];
    Object.values(EFFECT_MANIFEST).forEach(effect => {
        if (effect.params) {
            Object.values(effect.params).forEach(param => {
                ids.push(param.id);
            });
        }
    });
    return ids;
};

export const getParamDefinition = (id) => {
    for (const effect of Object.values(EFFECT_MANIFEST)) {
        if (effect.params) {
            for (const param of Object.values(effect.params)) {
                if (param.id === id) return param;
            }
        }
    }
    return null;
};