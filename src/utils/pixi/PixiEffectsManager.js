// src/utils/pixi/PixiEffectsManager.js
import { SHADER_CLASSES } from '../../effects/shader-library/ShaderRegistry';
import { lerp } from '../helpers';

export class PixiEffectsManager {
    constructor() {
        // Map<string, AbstractShaderEffect>
        this.modularEffects = new Map();
        
        // Track one-shot effects (explosions, flashes)
        this._activeOneShotEffects = [];
        
        this.screen = null;
        this.res = 1.0; 
    }

    init(screen) {
        this.screen = screen;
        // Force 1.0 resolution for performance consistency across High-DPI screens
        this.res = 1.0; 

        // Initialize all modular effects from registry
        Object.entries(SHADER_CLASSES).forEach(([key, EffectClass]) => {
            const instance = new EffectClass(key);
            const filter = instance.init(this.res);
            filter.enabled = false; 
            this.modularEffects.set(key, instance);
        });
    }

    /**
     * Bulk apply parameter updates from the Logic Controller
     * @param {Object} values - Key/Value pairs (e.g. 'bloom.intensity': 0.5)
     */
    applyValues(values) {
        Object.entries(values).forEach(([fullId, value]) => {
            const [effectName, param] = fullId.split('.');
            this.updateConfig(effectName, param, value);
        });
    }

    updateConfig(effectName, param, value) {
        // Feedback is handled by a separate System, skip it here
        if (effectName === 'feedback') return;

        const effect = this.modularEffects.get(effectName);
        if (effect) {
            effect.setParam(param, value);
        }
    }

    /**
     * Returns list of PIXI.Filters to apply to the main container
     */
    getFilterList() {
        return Array.from(this.modularEffects.values())
            .filter(e => e.active && e.filter)
            .map(e => e.filter);
    }

    update(ticker, renderer) {
        const now = performance.now();
        
        // 1. Update all active modular effects
        this.modularEffects.forEach(effect => {
            if (effect.active) {
                // Handle special case for effects needing screen size (e.g. Kaleidoscope)
                if (typeof effect.setScreenSize === 'function') {
                    effect.setScreenSize(renderer.screen.width, renderer.screen.height);
                }
                // Handle special case for effects needing center point (e.g. ZoomBlur)
                if (typeof effect.setCenter === 'function') {
                    effect.setCenter(renderer.screen.width / 2, renderer.screen.height / 2);
                }
                
                effect.update(ticker.deltaTime, now); 
            }
        });

        // 2. Update One-Shots (Shockwave / BloomFlash)
        this._updateOneShots(now);
    }

    triggerOneShot(type, config, screen) {
        const now = performance.now();
        
        if (type === 'shockwave') {
            const effect = this.modularEffects.get('shockwave');
            if (effect && effect.filter) {
                const f = effect.filter;
                f.center = { x: Math.random() * screen.width, y: Math.random() * screen.height };
                f.time = 0;
                f.radius = -1;
                f.amplitude = config.amplitude || 30;
                f.wavelength = config.wavelength || 160;
                
                const duration = config.duration || 1000;
                const maxRadius = Math.max(screen.width, screen.height) * 1.5;
                
                effect.active = true;
                effect.filter.enabled = true;
                
                this._activeOneShotEffects.push({ 
                    type: 'shockwave', 
                    startTime: now, 
                    duration, 
                    maxRadius, 
                    effect 
                });
            }
        }
        else if (type === 'bloomFlash') {
            const effect = this.modularEffects.get('bloom');
            if (effect && effect.filter) {
                // If bloom wasn't already active, track it so we can disable it after the flash
                if (!effect.active) {
                    effect.active = true;
                    effect.filter.enabled = true;
                    effect._wasDisabled = true;
                }
                const baseIntensity = effect.filter.bloomScale;
                this._activeOneShotEffects.push({ 
                    type: 'bloomFlash', 
                    startTime: now, 
                    duration: config.duration || 500, 
                    baseIntensity, 
                    peakIntensity: config.intensity || 6.0, 
                    effect 
                });
            }
        }
    }

    _updateOneShots(now) {
        if (this._activeOneShotEffects.length === 0) return;
        
        this._activeOneShotEffects = this._activeOneShotEffects.filter(shot => {
            const elapsed = now - shot.startTime;
            const progress = Math.max(0, Math.min(elapsed / shot.duration, 1.0));
            
            if (shot.type === 'shockwave') {
                shot.effect.filter.radius = shot.maxRadius * progress;
                if (progress > 0.8) {
                    // Fade out amplitude at the end
                    const fade = (1.0 - progress) / 0.2;
                    shot.effect.filter.amplitude = fade * 30;
                }
            }
            else if (shot.type === 'bloomFlash') {
                const current = lerp(shot.peakIntensity, shot.baseIntensity, progress);
                shot.effect.filter.bloomScale = current;
                
                if (progress >= 1.0 && shot.effect._wasDisabled) {
                    shot.effect.active = false;
                    shot.effect.filter.enabled = false;
                    delete shot.effect._wasDisabled;
                }
            }
            
            // Cleanup when finished
            if (progress >= 1.0) {
                if (shot.type !== 'bloomFlash') {
                    shot.effect.active = false;
                    shot.effect.filter.enabled = false;
                }
                return false;
            }
            return true;
        });
    }
}