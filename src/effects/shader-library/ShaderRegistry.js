// src/effects/shader-library/ShaderRegistry.js
import LiquidEffect from './library/LiquidEffect';
import AdversarialEffect from './library/AdversarialEffect';
import BloomEffect from './library/BloomEffect';
import RGBEffect from './library/RGBEffect';
import VolumetricEffect from './library/VolumetricEffect';
import PixelateEffect from './library/PixelateEffect';
import ZoomBlurEffect from './library/ZoomBlurEffect';
import WaveDistortEffect from './library/WaveDistortEffect';
import KaleidoscopeEffect from './library/KaleidoscopeEffect';
import AsciiEffect from './library/AsciiEffect';
import ShockwaveEffect from './library/ShockwaveEffect';
import CRTEffect from './library/CRTEffect'; // <-- NEW

/**
 * Central registry of all available modular effects.
 * Keys match the ID used in the Engine Store and Logic Controller.
 */
export const SHADER_CLASSES = {
    'liquid': LiquidEffect,
    'adversarial': AdversarialEffect,
    'bloom': BloomEffect,
    'rgb': RGBEffect,
    'volumetric': VolumetricEffect,
    'pixelate': PixelateEffect,
    'zoomBlur': ZoomBlurEffect,
    'waveDistort': WaveDistortEffect,
    'kaleidoscope': KaleidoscopeEffect,
    'ascii': AsciiEffect,
    'shockwave': ShockwaveEffect,
    'crt': CRTEffect // <-- NEW
};

export const generateEffectManifest = (corePhysicsManifest = {}) => {
    const manifest = { ...corePhysicsManifest };

    Object.entries(SHADER_CLASSES).forEach(([key, ClassRef]) => {
        // Only add to manifest if it has visible params
        if (ClassRef.manifest && Object.keys(ClassRef.manifest.params).length > 0) {
            manifest[key] = ClassRef.manifest;
        }
    });

    return manifest;
};