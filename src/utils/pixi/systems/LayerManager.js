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
        
        // Temp storage for modulation distribution
        this.deckModulations = {
            '1': {}, '2': {}, '3': {}
        };

        this.init();
    }

    init() {
        ['1', '2', '3'].forEach(id => {
            const container = new Container();
            const deckA = new PixiLayerDeck(id, 'A');
            const deckB = new PixiLayerDeck(id, 'B');
            
            container.addChild(deckA.container);
            container.addChild(deckB.container);
            
            const layerObj = { id, container, deckA, deckB };
            this.layers[id] = layerObj;
            this.layerList.push(layerObj);
            
            this.mainLayerGroup.addChild(container);
        });

        this.app.stage.addChild(this.mainLayerGroup);
    }

    // --- NEW METHOD FOR STEP 2 ---
    applyModulations(allParams) {
        // Reset temp storage
        this.deckModulations['1'] = {};
        this.deckModulations['2'] = {};
        this.deckModulations['3'] = {};

        // Parse and distribute
        for (const fullKey in allParams) {
            if (fullKey.startsWith('layer.')) {
                // Key format: layer.1.speed
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

        // Apply to decks (Both A and B receive modulation equally for now)
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

    updateConfig(layerId, key, value, deckSide = 'A') {
        if (!this.layers[layerId]) return;
        const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
        deck.updateConfig(key, value);
    }

    snapConfig(layerId, fullConfig, deckSide = 'A') {
        if (!this.layers[layerId]) return;
        const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
        deck.snapConfig(fullConfig);
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