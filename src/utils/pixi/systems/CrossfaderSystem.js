// src/utils/pixi/systems/CrossfaderSystem.js
import { lerp, lerpAngle } from '../../helpers';
import { useEngineStore } from '../../../store/useEngineStore';
import SignalBus from '../../SignalBus';

export class CrossfaderSystem {
    constructor(layerManager, audioReactor) {
        this.layerManager = layerManager;
        this.audioReactor = audioReactor;
        this.crossfadeValue = 0.0;
        this.transitionMode = 'crossfade';
        this.autoFadeState = { active: false, startValue: 0, targetValue: 0, startTime: 0, duration: 0, onComplete: null };
        this.parallaxOffset = { x: 0, y: 0 };
        this.renderedParallaxOffset = { x: 0, y: 0 };
        this.parallaxFactors = { '1': 10, '2': 25, '3': 50 };
        this.init();
    }

    init() {
        const state = useEngineStore.getState();
        this.crossfadeValue = state.renderedCrossfader;
        SignalBus.on('crossfader:set', (val) => { if (!this.autoFadeState.active) this.crossfadeValue = Math.max(0, Math.min(1, val)); });
    }

    fadeTo(targetValue, duration, onComplete) {
        this.autoFadeState = { active: true, startValue: this.crossfadeValue, targetValue: Math.max(0, Math.min(1, targetValue)), startTime: performance.now(), duration, onComplete };
    }

    cancelFade() { this.autoFadeState.active = false; this.autoFadeState.onComplete = null; }
    setParallax(x, y) { this.parallaxOffset = { x, y }; }

    update(deltaTime, now, screen) {
        // 1. Handle Auto-Fade Animation
        if (this.autoFadeState.active) {
            const elapsed = now - this.autoFadeState.startTime;
            const progress = this.autoFadeState.duration > 0 ? Math.min(elapsed / this.autoFadeState.duration, 1.0) : 1.0;
            const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            this.crossfadeValue = lerp(this.autoFadeState.startValue, this.autoFadeState.targetValue, ease);
            SignalBus.emitIfChanged('crossfader:update', this.crossfadeValue);
            if (progress >= 1.0) {
                this.crossfadeValue = this.autoFadeState.targetValue;
                this.autoFadeState.active = false;
                if (this.autoFadeState.onComplete) this.autoFadeState.onComplete();
            }
        } else {
            SignalBus.emitIfChanged('crossfader:update', this.crossfadeValue);
        }

        this.renderedParallaxOffset.x += (this.parallaxOffset.x - this.renderedParallaxOffset.x) * 0.05;
        this.renderedParallaxOffset.y += (this.parallaxOffset.y - this.renderedParallaxOffset.y) * 0.05;

        const t = this.crossfadeValue;
        const angleProgress = t * 1.570796;
        const opacityA = Math.cos(angleProgress);
        const opacityB = Math.sin(angleProgress);

        const layerList = this.layerManager.layerList;
        for (let i = 0; i < layerList.length; i++) {
            const layerObj = layerList[i];
            const beatFactor = this.audioReactor.getCombinedBeatFactor(layerObj.id);

            // Step individual deck interpolators (Size, X, Y, etc.)
            layerObj.deckA.stepPhysics(deltaTime);
            layerObj.deckB.stepPhysics(deltaTime);

            const stateA = layerObj.deckA.resolveRenderState();
            const stateB = layerObj.deckB.resolveRenderState();

            // PHYSICS SYNC FIX: 
            // We interpolate the Speed/Drivers, NOT the resulting angle.
            // This prevents "Unwinding" rotations during crossfades.
            const effectiveSpeed = lerp(stateA.speed, stateB.speed, t);
            const effectiveDrift = lerp(stateA.drift, stateB.drift, t);
            const effectiveDriftSpeed = lerp(stateA.driftSpeed, stateB.driftSpeed, t);
            const effectiveDirection = t < 0.5 ? stateA.direction : stateB.direction;

            // Step the Master Physics clock for this layer
            this.layerManager.stepLayerSharedPhysics(
                layerObj.id, 
                effectiveSpeed, 
                effectiveDirection, 
                effectiveDrift, 
                effectiveDriftSpeed, 
                deltaTime
            );

            // Blend visual properties for the final render
            const morph = {
                size: lerp(stateA.size, stateB.size, t),
                opacity: lerp(stateA.opacity, stateB.opacity, t),
                xaxis: lerp(stateA.xaxis, stateB.xaxis, t),
                yaxis: lerp(stateA.yaxis, stateB.yaxis, t),
                angle: lerpAngle(stateA.angle, stateB.angle, t),
                enabled: t < 0.5 ? stateA.enabled : stateB.enabled,
                blendMode: t < 0.5 ? stateA.blendMode : stateB.blendMode
            };

            // Apply shared physics state to both decks
            layerObj.deckA.applyRenderState(morph, layerObj.physics, opacityA, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
            layerObj.deckB.applyRenderState(morph, layerObj.physics, opacityB, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
        }
    }
}