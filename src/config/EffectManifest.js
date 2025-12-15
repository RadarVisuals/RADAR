// src/config/EffectManifest.js

// --- MASTER DEFINITION FOR LAYER PHYSICS ---
// This is the Single Source of Truth for UI Sliders, MIDI, and Physics limits.
export const LAYER_PARAMS_DEF = {
    speed:      { label: 'SPEED',       type: 'float', min: 0.001, max: 0.1,   step: 0.001, default: 0.01, formatDecimals: 3 },
    size:       { label: 'SIZE',        type: 'float', min: 0.1,   max: 8.0,   step: 0.01,  default: 1.0,  formatDecimals: 1 },
    opacity:    { label: 'OPACITY',     type: 'float', min: 0,     max: 1,     step: 0.001, default: 1.0,  formatDecimals: 2 },
    drift:      { label: 'DRIFT',       type: 'float', min: 0,     max: 100,   step: 0.001, default: 0.0,  formatDecimals: 1 },
    driftSpeed: { label: 'DRIFT SPEED', type: 'float', min: 0,     max: 1,     step: 0.001, default: 0.0,  formatDecimals: 1 },
    xaxis:      { label: 'X POS',       type: 'float', min: -10000, max: 10000, step: 1,     default: 0.0,  formatDecimals: 0 },
    yaxis:      { label: 'Y POS',       type: 'float', min: -10000, max: 10000, step: 1,     default: 0.0,  formatDecimals: 0 },
    angle:      { label: 'ANGLE',       type: 'float', min: -90,   max: 90,    step: 0.1,   default: 0.0,  formatDecimals: 1 },
};

// Helper to generate fully qualified IDs for the Matrix (e.g., 'layer.1.speed')
// Note: We set defaults to 0.0 here for the Matrix, because Modulation is ADDITIVE relative to the Scene Config.
const generateLayerParams = (layerNum) => {
    const params = {};
    for (const [key, def] of Object.entries(LAYER_PARAMS_DEF)) {
        params[`l${layerNum}_${key}`] = {
            id: `layer.${layerNum}.${key}`,
            label: `L${layerNum} ${def.label}`,
            type: def.type,
            min: def.min,
            max: def.max,
            default: 0.0 // Matrix modulation offset starts at 0
        };
    }
    return params;
};

export const EFFECT_MANIFEST = {
    // --- LAYERS (Physics Offsets) ---
    layer1: { label: 'Layer 1 Physics', params: generateLayerParams(1) },
    layer2: { label: 'Layer 2 Physics', params: generateLayerParams(2) },
    layer3: { label: 'Layer 3 Physics', params: generateLayerParams(3) },

    // --- FEEDBACK / VIDEO ---
    feedback: {
        label: 'Infinity Trails (Feedback)',
        params: {
            enabled:  { id: 'feedback.enabled',  label: 'Active',   type: 'bool',  min: 0, max: 1,    default: 0 },
            amount:   { id: 'feedback.amount',   label: 'Decay',    type: 'float', min: 0.5, max: 0.99, default: 0.9 },
            scale:    { id: 'feedback.scale',    label: 'Zoom',     type: 'float', min: 0.9, max: 1.1,  default: 1.01 },
            rotation: { id: 'feedback.rotation', label: 'Spin',     type: 'float', min: -1.0, max: 1.0, default: 0.0 },
            xOffset:  { id: 'feedback.xOffset',  label: 'Drift X',  type: 'float', min: -10, max: 10,   default: 0.0 },
            yOffset:  { id: 'feedback.yOffset',  label: 'Drift Y',  type: 'float', min: -10, max: 10,   default: 0.0 },
        }
    },

    // --- COLOR & LIGHT ---
    bloom: {
        label: 'Bloom (Glow)',
        params: {
            intensity: { id: 'bloom.intensity', label: 'Intensity', type: 'float', min: 0, max: 5.0, default: 0.0 },
            threshold: { id: 'bloom.threshold', label: 'Threshold', type: 'float', min: 0, max: 1.0, default: 0.5 },
            blur:      { id: 'bloom.blur',      label: 'Blur',      type: 'float', min: 0, max: 20.0, default: 8.0 },
        }
    },

    rgb: {
        label: 'RGB Split (Chromatic)',
        params: {
            amount: { id: 'rgb.amount', label: 'Offset', type: 'float', min: 0, max: 50.0, default: 0.0 },
        }
    },

    colorMatrix: {
        label: 'Video Nasty (Color)',
        params: {
            threshold: { id: 'colorMatrix.threshold', label: '1-Bit Threshold', type: 'float', min: 0, max: 1.0, default: 0.0 },
            invert:    { id: 'colorMatrix.invert',    label: 'Invert',          type: 'bool',  min: 0, max: 1,   default: 0 },
        }
    },

    oldFilm: {
        label: 'Old Film (Vintage)',
        params: {
            sepia:      { id: 'oldFilm.sepia',      label: 'Sepia',      type: 'float', min: 0, max: 1, default: 0.0 },
            noise:      { id: 'oldFilm.noise',      label: 'Grain',      type: 'float', min: 0, max: 1, default: 0.0 },
            scratch:    { id: 'oldFilm.scratch',    label: 'Scratches',  type: 'float', min: 0, max: 1, default: 0.0 },
            vignetting: { id: 'oldFilm.vignetting', label: 'Vignette',   type: 'float', min: 0, max: 1, default: 0.0 },
        }
    },

    volumetric: {
        label: 'Volumetric Light',
        params: {
            exposure:  { id: 'volumetric.exposure',  label: 'Exposure',  type: 'float', min: 0, max: 1.0, default: 0.0 },
            decay:     { id: 'volumetric.decay',     label: 'Decay',     type: 'float', min: 0.5, max: 1.0, default: 0.95 },
            density:   { id: 'volumetric.density',   label: 'Density',   type: 'float', min: 0, max: 1.0, default: 0.8 },
            x:         { id: 'volumetric.x',         label: 'Source X',  type: 'float', min: 0, max: 1.0, default: 0.5 },
            y:         { id: 'volumetric.y',         label: 'Source Y',  type: 'float', min: 0, max: 1.0, default: 0.5 },
        }
    },

    // --- GLITCH & DISTORTION ---
    pixelate: {
        label: 'Pixelate (Bitcrush)',
        params: {
            enabled: { id: 'pixelate.enabled', label: 'Active', type: 'bool', min: 0, max: 1, default: 0 },
            size:    { id: 'pixelate.size',    label: 'Block Size', type: 'int', min: 2, max: 100, default: 10 },
        }
    },

    adversarial: {
        label: 'Data Mosh (Adversarial)', 
        params: {
            enabled:    { id: 'adversarial.enabled',    label: 'Active',      type: 'bool',  min: 0, max: 1,   default: 0 },
            intensity:  { id: 'adversarial.intensity',  label: 'Power',       type: 'float', min: 0, max: 2.0, default: 0.5 },
            bands:      { id: 'adversarial.bands',      label: 'Bands',       type: 'float', min: 1, max: 64,  default: 24 },
            noiseScale: { id: 'adversarial.noiseScale', label: 'Noise Scale', type: 'float', min: 0.1, max: 12, default: 3.0 },
            chromatic:  { id: 'adversarial.chromatic',  label: 'RGB Split',   type: 'float', min: 0, max: 10,  default: 1.5 },
        }
    },

    glitch: {
        label: 'Slice Glitch',
        params: {
            slices:    { id: 'glitch.slices',    label: 'Slices',    type: 'int',   min: 0, max: 20,  default: 0 },
            offset:    { id: 'glitch.offset',    label: 'Offset',    type: 'float', min: 0, max: 100, default: 20 },
            direction: { id: 'glitch.direction', label: 'Direction', type: 'float', min: 0, max: 360, default: 0 },
        }
    },

    twist: {
        label: 'Void Vortex (Twist)',
        params: {
            radius: { id: 'twist.radius', label: 'Radius', type: 'float', min: 100, max: 1000, default: 400 },
            angle:  { id: 'twist.angle',  label: 'Force',  type: 'float', min: -10, max: 10,   default: 0.0 },
            x:      { id: 'twist.x',      label: 'Center X', type: 'float', min: 0,   max: 1.0,  default: 0.5 },
            y:      { id: 'twist.y',      label: 'Center Y', type: 'float', min: 0,   max: 1.0,  default: 0.5 }
        }
    },

    zoomBlur: {
        label: 'Warp Drive (Zoom)',
        params: {
            strength:    { id: 'zoomBlur.strength',    label: 'Strength',  type: 'float', min: 0, max: 0.5, default: 0.0 },
            innerRadius: { id: 'zoomBlur.innerRadius', label: 'Safe Zone', type: 'float', min: 0, max: 200, default: 50 },
        }
    },

    kaleidoscope: {
        label: 'Kaleidoscope',
        params: {
            sides: { id: 'kaleidoscope.sides', label: 'Segments', type: 'int',   min: 0, max: 32,   default: 0 },
            angle: { id: 'kaleidoscope.angle', label: 'Rotation', type: 'float', min: 0, max: 6.28, default: 0 },
        }
    },

    // --- FLUIDS & TEXTURE ---
    liquid: {
        label: 'Liquid Flow',
        params: {
            intensity: { id: 'liquid.intensity', label: 'Amount', type: 'float', min: 0, max: 0.5, default: 0.0 },
            scale:     { id: 'liquid.scale',     label: 'Density', type: 'float', min: 0.1, max: 10, default: 3.0 },
            speed:     { id: 'liquid.speed',     label: 'Speed',   type: 'float', min: 0, max: 5.0, default: 0.5 },
        }
    },

    waveDistort: {
        label: 'Wave Distortion',
        params: {
            intensity: { id: 'waveDistort.intensity', label: 'Amplitude', type: 'float', min: 0, max: 2.0, default: 0.0 },
        }
    },

    crt: {
        label: 'CRT Monitor',
        params: {
            curvature:    { id: 'crt.curvature',    label: 'Curve',       type: 'float', min: 0, max: 10.0, default: 0.0 },
            lineWidth:    { id: 'crt.lineWidth',    label: 'Scanlines',   type: 'float', min: 0, max: 5.0,  default: 0.0 },
            noise:        { id: 'crt.noise',        label: 'Static',      type: 'float', min: 0, max: 1.0,  default: 0.0 },
            vignetting:   { id: 'crt.vignetting',   label: 'Vignette',    type: 'float', min: 0, max: 1.0,  default: 0.0 },
        }
    },

    ascii: {
        label: 'ASCII / Terminal',
        params: {
            enabled:   { id: 'ascii.enabled',   label: 'Active',    type: 'bool',  min: 0, max: 1,  default: 0 },
            size:      { id: 'ascii.size',      label: 'Grid Size', type: 'int',   min: 2, max: 50, default: 10 },
            invert:    { id: 'ascii.invert',    label: 'Invert',    type: 'bool',  min: 0, max: 1,  default: 0 },
            charSet:   { id: 'ascii.charSet',   label: 'Char Set',  type: 'select', min: 0, max: 3, default: 0, options: ['Shapes', 'Data Flow', 'Binary', 'Density'] },
            colorMode: { id: 'ascii.colorMode', label: 'Color',     type: 'select', min: 0, max: 4, default: 0, options: ['Original', 'Matrix', 'Amber', 'Cyan', 'B&W'] },
        }
    },

    // --- GLOBAL ---
    global: {
        label: 'Global Controls',
        params: {
            crossfader: { id: 'global.crossfader', label: 'Crossfader', type: 'float', min: 0, max: 1.0, default: 0.0 },
        }
    }
};

export const getAllParamIds = () => {
    const ids = [];
    Object.values(EFFECT_MANIFEST).forEach(effect => {
        Object.values(effect.params).forEach(param => {
            ids.push(param.id);
        });
    });
    return ids;
};

export const getParamDefinition = (id) => {
    for (const effect of Object.values(EFFECT_MANIFEST)) {
        for (const param of Object.values(effect.params)) {
            if (param.id === id) return param;
        }
    }
    return null;
};