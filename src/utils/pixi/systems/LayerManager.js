import { Container } from 'pixi.js';
import { PixiLayerDeck } from '../PixiLayerDeck'; 

export class LayerManager {
    constructor(app, effectsManager) {
        this.app = app;
        this.effectsManager = effectsManager;
        this.mainLayerGroup = new Container();
        this.layers = {};
        this.layerList = [];
        
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

        // NOTE: Filters are NOT applied here. They are applied to rootContainer in PixiEngine.
        this.app.stage.addChild(this.mainLayerGroup);
    }

    resize() {
        // FIX: Do NOT set filterArea. It causes crashes when rendering this container 
        // to a RenderTexture (Feedback) because the coordinate systems differ.
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