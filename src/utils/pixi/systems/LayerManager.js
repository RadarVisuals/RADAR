// src/utils/pixi/systems/LayerManager.js
import { Container } from 'pixi.js';
import { PixiLayerDeck } from '../PixiLayerDeck'; 

export class LayerManager {
    constructor(app, effectsManager) {
        this.app = app;
        this.effectsManager = effectsManager;
        this.mainLayerGroup = new Container();
        this.layers = {};
        this.layerList = [];
        this.deckModulations = { '1': {}, '2': {}, '3': {} };
        this.init();
    }

    init() {
        ['1', '2', '3'].forEach(id => {
            const container = new Container();
            const deckA = new PixiLayerDeck(id, 'A');
            const deckB = new PixiLayerDeck(id, 'B');
            
            container.addChild(deckA.container);
            container.addChild(deckB.container);
            
            this.layers[id] = { 
                id, 
                container, 
                deckA, 
                deckB,
                physics: {
                    continuousAngle: 0,
                    driftX: 0,
                    driftY: 0,
                    driftPhase: Math.random() * Math.PI * 2
                }
            };
            this.layerList.push(this.layers[id]);
            this.mainLayerGroup.addChild(container);
        });

        this.app.stage.addChild(this.mainLayerGroup);
    }

    stepLayerSharedPhysics(layerId, speed, direction, drift, driftSpeed, deltaTime) {
        const p = this.layers[layerId].physics;

        if (Math.abs(speed) > 0.00001) {
            p.continuousAngle += (speed * direction * deltaTime * 600);
        }

        if (drift > 0) {
            p.driftPhase += deltaTime * driftSpeed * 1.0;
            p.driftX = Math.sin(p.driftPhase) * drift * 1.5;
            p.driftY = Math.cos(p.driftPhase * 0.7 + 0.785) * drift * 1.5;
        } else {
            p.driftX *= 0.95;
            p.driftY *= 0.95;
        }
    }

    applyModulations(allParams) {
        this.deckModulations['1'] = {};
        this.deckModulations['2'] = {};
        this.deckModulations['3'] = {};

        for (const fullKey in allParams) {
            if (fullKey.startsWith('layer.')) {
                const parts = fullKey.split('.');
                if (parts.length === 3) {
                    const layerId = parts[1];
                    const param = parts[2];
                    if (this.deckModulations[layerId]) {
                        this.deckModulations[layerId][param] = allParams[fullKey];
                    }
                }
            }
        }

        ['1', '2', '3'].forEach(id => {
            if (this.layers[id]) {
                const mods = this.deckModulations[id];
                this.layers[id].deckA.setModulatedValues(mods);
                this.layers[id].deckB.setModulatedValues(mods);
            }
        });
    }

    resize() {
        this.mainLayerGroup.filterArea = null;
        for (const layer of this.layerList) {
            layer.deckA.resize(this.app.renderer);
            layer.deckB.resize(this.app.renderer);
        }
    }

    updateConfig(layerId, key, value, deckSide = 'A', isManual = false) {
        if (!this.layers[layerId]) return;
        const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
        deck.updateConfig(key, value, isManual);
    }

    snapConfig(layerId, fullConfig, deckSide = 'A', forceSnap = false) {
        if (!this.layers[layerId]) return;
        const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
        
        if (fullConfig.sharedPhysicsContext) {
            const p = this.layers[layerId].physics;
            p.continuousAngle = fullConfig.sharedPhysicsContext.continuousAngle;
            p.driftPhase = fullConfig.sharedPhysicsContext.driftPhase;
        }

        deck.snapConfig(fullConfig, forceSnap);
    }

    async setTexture(layerId, deckSide, imageSrc, tokenId) {
        if (!this.layers[layerId]) return;
        const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
        await deck.setTexture(imageSrc, tokenId);
    }

    getDeck(layerId, deckSide) {
        if (!this.layers[layerId]) return null;
        return deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    }

    destroy() {
        this.mainLayerGroup.destroy({ children: true });
    }
}