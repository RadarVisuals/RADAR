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
        
        // Physics Helpers
        this.parallaxOffset = { x: 0, y: 0 };
        this.renderedParallaxOffset = { x: 0, y: 0 };
        this.parallaxFactors = { '1': 10, '2': 25, '3': 50 };
        this._morphedState = {}; 

        this.init();
    }

    init() {
        // Sync initial state
        const state = useEngineStore.getState();
        this.crossfadeValue = state.renderedCrossfader;
        this.transitionMode = state.transitionMode;

        // Listen for high-frequency updates from UI/Sequencer
        SignalBus.on('crossfader:update', (val) => { this.crossfadeValue = val; });
    }

    // Legacy support method (can be removed, but kept to prevent PixiEngine crash if called)
    setIndustrialConfig(config) {
        // No-op: Industrial config is now handled by ModulationEngine
    }

    setParallax(x, y) {
        this.parallaxOffset = { x, y };
    }

    update(deltaTime, now, screen) {
        // Update transition mode from store (low frequency check)
        this.transitionMode = useEngineStore.getState().transitionMode;

        // Effective crossfade is just the current value
        // (Modulation logic will handle automated movement in the future via SignalBus)
        const effectiveCrossfade = this.crossfadeValue;

        // Direction detection for Flythrough mode
        if (effectiveCrossfade >= 0.999) this.flythroughSequence = 'B->A';
        else if (effectiveCrossfade <= 0.001) this.flythroughSequence = 'A->B';

        // Smooth Parallax Interpolation
        this.renderedParallaxOffset.x += (this.parallaxOffset.x - this.renderedParallaxOffset.x) * 0.05;
        this.renderedParallaxOffset.y += (this.parallaxOffset.y - this.renderedParallaxOffset.y) * 0.05;

        // Iterate Layers
        const layerList = this.layerManager.layerList;
        for (let i = 0; i < layerList.length; i++) {
            const layerObj = layerList[i];
            const combinedBeatFactor = this.audioReactor.getCombinedBeatFactor(layerObj.id);

            // Determine Visibility based on Transition Mode
            let renderA = true;
            let renderB = true;

            if (this.transitionMode === 'crossfade') {
                if (effectiveCrossfade > 0.999) renderA = false;
                if (effectiveCrossfade < 0.001) renderB = false;
            }

            // Step Physics
            if (renderA) layerObj.deckA.stepPhysics(deltaTime, now);
            if (renderB) layerObj.deckB.stepPhysics(deltaTime, now);

            // Resolve States
            const stateA = renderA ? layerObj.deckA.resolveRenderState() : null;
            const stateB = renderB ? layerObj.deckB.resolveRenderState() : null;

            // Apply Transition Logic
            if (this.transitionMode === 'flythrough') {
                this._applyFlythrough(layerObj, stateA, stateB, renderA, renderB, combinedBeatFactor, screen, effectiveCrossfade);
            } else {
                this._applyCrossfade(layerObj, stateA, stateB, renderA, renderB, combinedBeatFactor, screen, effectiveCrossfade);
            }
        }
    }

    _applyFlythrough(layerObj, stateA, stateB, renderA, renderB, beatFactor, screen, t) {
        const SIDEWAYS_FORCE = -25000;
        const VERTICAL_FORCE = -8000;

        if (this.flythroughSequence === 'A->B') {
            const easeOut = t * t * t * t;
            
            if (renderA) {
                const scaleMultA = 1.0 + (59.0) * easeOut;
                stateA.driftX += easeOut * SIDEWAYS_FORCE;
                stateA.driftY += easeOut * VERTICAL_FORCE;
                
                let alphaMultA = 1.0;
                const fadeStart = layerObj.id === '1' ? 1.1 : (layerObj.id === '2' ? 1.5 : 3.0);
                const fadeEnd = layerObj.id === '1' ? 4.0 : (layerObj.id === '2' ? 8.0 : 20.0);
                
                if (scaleMultA > fadeStart) {
                    alphaMultA = Math.max(0, 1.0 - (scaleMultA - fadeStart) / (fadeEnd - fadeStart));
                }
                
                stateA.size *= scaleMultA;
                layerObj.deckA.applyRenderState(stateA, alphaMultA, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
            } else {
                layerObj.deckA.container.visible = false;
            }

            if (renderB) {
                const scaleMultB = t;
                const alphaMultB = Math.min(1.0, t * 5.0);
                stateB.size *= scaleMultB;
                layerObj.deckB.applyRenderState(stateB, alphaMultB, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
            } else {
                layerObj.deckB.container.visible = false;
            }

            layerObj.container.setChildIndex(layerObj.deckB.container, 0);
            layerObj.container.setChildIndex(layerObj.deckA.container, 1);

        } else {
            const rt = 1.0 - t;
            const easeOut = rt * rt * rt * rt;

            if (renderB) {
                const scaleMultB = 1.0 + (59.0) * easeOut;
                stateB.driftX += easeOut * SIDEWAYS_FORCE;
                stateB.driftY += easeOut * VERTICAL_FORCE;
                
                let alphaMultB = 1.0;
                const fadeStart = layerObj.id === '1' ? 1.1 : (layerObj.id === '2' ? 1.5 : 3.0);
                const fadeEnd = layerObj.id === '1' ? 4.0 : (layerObj.id === '2' ? 8.0 : 20.0);

                if (scaleMultB > fadeStart) {
                    alphaMultB = Math.max(0, 1.0 - (scaleMultB - fadeStart) / (fadeEnd - fadeStart));
                }

                stateB.size *= scaleMultB;
                layerObj.deckB.applyRenderState(stateB, alphaMultB, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
            } else {
                layerObj.deckB.container.visible = false;
            }

            if (renderA) {
                const scaleMultA = rt;
                const alphaMultA = Math.min(1.0, rt * 5.0);
                stateA.size *= scaleMultA;
                layerObj.deckA.applyRenderState(stateA, alphaMultA, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
            } else {
                layerObj.deckA.container.visible = false;
            }

            layerObj.container.setChildIndex(layerObj.deckA.container, 0);
            layerObj.container.setChildIndex(layerObj.deckB.container, 1);
        }
    }

    _applyCrossfade(layerObj, stateA, stateB, renderA, renderB, beatFactor, screen, t) {
        // Opacity crossfade curve (Sin/Cos for smoother blend)
        const angle = t * 1.570796;
        const opacityA = Math.cos(angle);
        const opacityB = Math.sin(angle);

        if (renderA && renderB) {
            const ms = this._morphedState;
            
            // --- Spatial Morphing ---
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
            
            const currentContinuous = lerp(layerObj.deckA.continuousAngle, layerObj.deckB.continuousAngle, t);
            ms.totalAngleRad = (ms.angle + currentContinuous) * 0.01745329251;

            // Apply to Deck A
            ms.blendMode = stateA.blendMode;
            ms.enabled = stateA.enabled;
            layerObj.deckA.applyRenderState(ms, opacityA, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);

            // Apply to Deck B
            ms.blendMode = stateB.blendMode;
            ms.enabled = stateB.enabled;
            layerObj.deckB.applyRenderState(ms, opacityB, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);

        } else {
            if (renderA) layerObj.deckA.applyRenderState(stateA, opacityA, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
            else layerObj.deckA.container.visible = false;

            if (renderB) layerObj.deckB.applyRenderState(stateB, opacityB, beatFactor, this.renderedParallaxOffset, this.parallaxFactors[layerObj.id], screen);
            else layerObj.deckB.container.visible = false;
        }
    }
}