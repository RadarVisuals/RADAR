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
        this.flythroughSequence = 'A->B';
        this.autoFadeState = { active: false, startValue: 0, targetValue: 0, startTime: 0, duration: 0, onComplete: null };
        this._lastDocked = 'A'; 
        this.parallaxOffset = { x: 0, y: 0 };
        this.renderedParallaxOffset = { x: 0, y: 0 };
        this.parallaxFactors = { '1': 10, '2': 25, '3': 50 };
        this._morphedState = {}; 
        this.init();
    }

    init() {
        const state = useEngineStore.getState();
        this.crossfadeValue = state.renderedCrossfader;
        this.transitionMode = state.transitionMode;
        if (this.crossfadeValue <= 0.001) this._lastDocked = 'A';
        else if (this.crossfadeValue >= 0.999) this._lastDocked = 'B';
        SignalBus.on('crossfader:set', (val) => { if (!this.autoFadeState.active) this.crossfadeValue = Math.max(0, Math.min(1, val)); });
    }

    fadeTo(targetValue, duration, onComplete) {
        this.autoFadeState = { active: true, startValue: this.crossfadeValue, targetValue: Math.max(0, Math.min(1, targetValue)), startTime: performance.now(), duration, onComplete };
    }

    cancelFade() { this.autoFadeState.active = false; this.autoFadeState.onComplete = null; }

    setParallax(x, y) { this.parallaxOffset = { x, y }; }

    update(deltaTime, now, screen) {
        this.transitionMode = useEngineStore.getState().transitionMode;
        if (this.autoFadeState.active) {
            const elapsed = now - this.autoFadeState.startTime;
            const progress = this.autoFadeState.duration > 0 ? Math.min(elapsed / this.autoFadeState.duration, 1.0) : 1.0;
            const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            this.crossfadeValue = lerp(this.autoFadeState.startValue, this.autoFadeState.targetValue, ease);
            SignalBus.emitIfChanged('crossfader:update', this.crossfadeValue);
            if (progress >= 1.0) { this.crossfadeValue = this.autoFadeState.targetValue; this.autoFadeState.active = false; if (this.autoFadeState.onComplete) this.autoFadeState.onComplete(); }
        } else {
            SignalBus.emitIfChanged('crossfader:update', this.crossfadeValue);
        }

        const effectiveCrossfade = this.crossfadeValue;
        if (effectiveCrossfade <= 0.0001) { if (this._lastDocked !== 'A') { this._lastDocked = 'A'; SignalBus.emit('crossfader:docked', 'A'); } }
        else if (effectiveCrossfade >= 0.9999) { if (this._lastDocked !== 'B') { this._lastDocked = 'B'; SignalBus.emit('crossfader:docked', 'B'); } }
        else { this._lastDocked = null; }
        
        if (effectiveCrossfade >= 0.999) this.flythroughSequence = 'B->A';
        else if (effectiveCrossfade <= 0.001) this.flythroughSequence = 'A->B';

        this.renderedParallaxOffset.x += (this.parallaxOffset.x - this.renderedParallaxOffset.x) * 0.05;
        this.renderedParallaxOffset.y += (this.parallaxOffset.y - this.renderedParallaxOffset.y) * 0.05;

        const layerList = this.layerManager.layerList;
        for (let i = 0; i < layerList.length; i++) {
            const layerObj = layerList[i];
            const beatFactor = this.audioReactor.getCombinedBeatFactor(layerObj.id);

            // Always update physics for both decks to ensure readiness
            layerObj.deckA.stepPhysics(deltaTime, now);
            layerObj.deckB.stepPhysics(deltaTime, now);

            const stateA = layerObj.deckA.resolveRenderState();
            const stateB = layerObj.deckB.resolveRenderState();

            if (this.transitionMode === 'flythrough') {
                this._applyFlythrough(layerObj, stateA, stateB, beatFactor, screen, effectiveCrossfade);
            } else {
                this._applyCrossfade(layerObj, stateA, stateB, beatFactor, screen, effectiveCrossfade);
            }
        }
    }

    _applyFlythrough(layerObj, stateA, stateB, beatFactor, screen, t) {
        const SIDEWAYS_FORCE = -25000;
        const VERTICAL_FORCE = -8000;
        if (this.flythroughSequence === 'A->B') {
            const easeOut = t * t * t * t;
            const scaleMultA = 1.0 + (59.0) * easeOut;
            stateA.driftX += easeOut * SIDEWAYS_FORCE; stateA.driftY += easeOut * VERTICAL_FORCE;
            let alphaMultA = 1.0;
            const fS = layerObj.id === '1' ? 1.1 : (layerObj.id === '2' ? 1.5 : 3.0);
            const fE = layerObj.id === '1' ? 4.0 : (layerObj.id === '2' ? 8.0 : 20.0);
            if (scaleMultA > fS) alphaMultA = Math.max(0, 1.0 - (scaleMultA - fS) / (fE - fS));
            stateA.size *= scaleMultA;
            layerObj.deckA.applyRenderState(stateA, alphaMultA, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
            const scaleMultB = t; const alphaMultB = Math.min(1.0, t * 5.0);
            stateB.size *= scaleMultB;
            layerObj.deckB.applyRenderState(stateB, alphaMultB, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
            layerObj.container.setChildIndex(layerObj.deckB.container, 0); layerObj.container.setChildIndex(layerObj.deckA.container, 1);
        } else {
            const rt = 1.0 - t; const easeOut = rt * rt * rt * rt;
            const scaleMultB = 1.0 + (59.0) * easeOut;
            stateB.driftX += easeOut * SIDEWAYS_FORCE; stateB.driftY += easeOut * VERTICAL_FORCE;
            let alphaMultB = 1.0;
            const fS = layerObj.id === '1' ? 1.1 : (layerObj.id === '2' ? 1.5 : 3.0);
            const fE = layerObj.id === '1' ? 4.0 : (layerObj.id === '2' ? 8.0 : 20.0);
            if (scaleMultB > fS) alphaMultB = Math.max(0, 1.0 - (scaleMultB - fS) / (fE - fS));
            stateB.size *= scaleMultB;
            layerObj.deckB.applyRenderState(stateB, alphaMultB, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
            const scaleMultA = rt; const alphaMultA = Math.min(1.0, rt * 5.0);
            stateA.size *= scaleMultA;
            layerObj.deckA.applyRenderState(stateA, alphaMultA, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
            layerObj.container.setChildIndex(layerObj.deckA.container, 0); layerObj.container.setChildIndex(layerObj.deckB.container, 1);
        }
    }

    _applyCrossfade(layerObj, stateA, stateB, beatFactor, screen, t) {
        const angleProgress = t * 1.570796;
        const opacityA = Math.cos(angleProgress);
        const opacityB = Math.sin(angleProgress);
        const ms = this._morphedState;
        ms.speed = lerp(stateA.speed, stateB.speed, t);
        ms.size = lerp(stateA.size, stateB.size, t);
        ms.opacity = lerp(stateA.opacity, stateB.opacity, t);
        ms.drift = lerp(stateA.drift, stateB.drift, t);
        ms.driftSpeed = lerp(stateA.driftSpeed, stateB.driftSpeed, t);
        ms.xaxis = lerp(stateA.xaxis, stateB.xaxis, t);
        ms.yaxis = lerp(stateA.yaxis, stateB.yaxis, t);
        ms.angle = lerpAngle(stateA.angle, stateB.angle, t);
        ms.driftX = lerp(stateA.driftX, stateB.driftX, t);
        ms.driftY = lerp(stateA.driftY, stateB.driftY, t);
        const currentContinuous = lerp(stateA.continuousAngle, stateB.continuousAngle, t);
        ms.totalAngleRad = (ms.angle + currentContinuous) * 0.01745329251;
        ms.enabled = t < 0.5 ? stateA.enabled : stateB.enabled;
        ms.blendMode = t < 0.5 ? stateA.blendMode : stateB.blendMode;
        layerObj.deckA.applyRenderState(ms, opacityA, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
        layerObj.deckB.applyRenderState(ms, opacityB, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
    }
}