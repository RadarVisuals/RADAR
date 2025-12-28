// src/utils/PixiEngine.js
import { Application, Container } from 'pixi.js';
import { PixiEffectsManager } from './pixi/PixiEffectsManager';
import { useEngineStore } from '../store/useEngineStore'; 
import SignalBus from '../utils/SignalBus';

import { AudioReactor } from './pixi/systems/AudioReactor';
import { FeedbackSystem } from './pixi/systems/FeedbackSystem';
import { LayerManager } from './pixi/systems/LayerManager';
import { CrossfaderSystem } from './pixi/systems/CrossfaderSystem.js';
import { LogicController } from './LogicController';

/**
 * PixiEngine
 * The central orchestrator for the RADAR visual synthesizer.
 * Coordinates logic, physics, audio reactivity, and output routing.
 */
export default class PixiEngine {
  constructor(canvasElement) {
    this.app = new Application();
    this.canvas = canvasElement;
    this.isReady = false;
    this._isDestroyed = false;

    // Core Logic Systems
    this.logic = new LogicController();
    this.effectsManager = new PixiEffectsManager();
    this.audioReactor = new AudioReactor();
    
    // Scenograph structure
    this.rootContainer = new Container(); // The visual "Engine"
    this.layerManager = null; 
    this.feedbackSystem = null; 
    this.crossfaderSystem = null; 

    this._resizeHandler = this.handleResize.bind(this);
    this._updateLoop = this.update.bind(this);
    
    // Global Event Listener
    this._onEventTrigger = (data) => {
        if(this.logic) this.logic.triggerEvent(data.type);
    };
  }

  /**
   * Initializes the WebGL context and all visual subsystems
   */
  async init() {
    if (this.isReady || this._isDestroyed) return;
    
    const maxRes = 1.5; 
    const resolution = Math.min(window.devicePixelRatio || 1, maxRes);
    
    await this.app.init({
      canvas: this.canvas,
      resizeTo: this.canvas.parentElement, 
      backgroundAlpha: 0,
      antialias: true,
      resolution: resolution,
      autoDensity: true,
      powerPreference: 'high-performance', 
      preference: 'webgl',
    });

    if (this._isDestroyed) {
        this.app.destroy(true);
        return;
    }

    this.app.stage.addChild(this.rootContainer);

    // Initialize Subsystems
    this.effectsManager.init(this.app.screen);
    this.layerManager = new LayerManager(this.app, this.effectsManager);
    this.feedbackSystem = new FeedbackSystem(this.app, this.rootContainer); 
    this.crossfaderSystem = new CrossfaderSystem(this.layerManager, this.audioReactor);

    // Setup Render Hooks
    this.app.renderer.on('resize', this._resizeHandler);
    this.handleResize(); 
    this.app.ticker.add(this._updateLoop);
    
    // Connect Global Bus
    SignalBus.on('event:trigger', this._onEventTrigger);
    
    // Hydrate Logic with current store state
    const state = useEngineStore.getState();
    if (state.baseValues) {
        Object.entries(state.baseValues).forEach(([id, val]) => {
            this.logic.setBaseValue(id, val);
        });
    }
    if (state.patches) {
        state.patches.forEach(patch => {
            this.logic.addPatch(patch.source, patch.target, patch.amount);
        });
    }

    this.isReady = true;
    console.log("[PixiEngine] ✅ Rendering Pipeline Online.");
  }

  handleResize() {
    if (this._isDestroyed || !this.app || !this.app.renderer) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    
    if (this.feedbackSystem) this.feedbackSystem.resize(w, h);
    if (this.layerManager) this.layerManager.resize();
  }

  // --- External Control Proxies ---
  fadeTo(target, duration, onComplete) { 
      if (this.crossfaderSystem) this.crossfaderSystem.fadeTo(target, duration, onComplete); 
  }
  cancelFade() { if (this.crossfaderSystem) this.crossfaderSystem.cancelFade(); }
  setRenderedCrossfade(value) { if (this.crossfaderSystem) this.crossfaderSystem.crossfadeValue = value; }
  setModulationValue(paramId, value) { this.logic.setBaseValue(paramId, value); }
  addModulationPatch(source, target, amount) { this.logic.addPatch(source, target, amount); }
  removeModulationPatch(patchId) { this.logic.removePatch(patchId); }
  clearModulationPatches() { this.logic.clearPatches(); }
  get modulationEngine() { return this.logic.modulationEngine; }
  get lfo() { return this.logic.lfo; }

  async setTexture(layerId, deckSide, imageSrc, tokenId) {
      if (this.layerManager) await this.layerManager.setTexture(layerId, deckSide, imageSrc, tokenId);
  }
  updateConfig(layerId, key, value, deckSide = 'A') {
      if (this.layerManager) this.layerManager.updateConfig(layerId, key, value, deckSide);
  }
  snapConfig(layerId, fullConfig, deckSide = 'A') {
      if (this.layerManager) this.layerManager.snapConfig(layerId, fullConfig, deckSide);
  }
  getState(layerId, deckSide) {
      const deck = this.layerManager?.getDeck(layerId, deckSide);
      return deck ? deck.getState() : null;
  }
  setAudioFactors(factors) { this.audioReactor.setAudioFactors(factors); }
  triggerBeatPulse(factor, duration) { this.audioReactor.triggerBeatPulse(factor, duration); }
  setParallax(x, y) { if (this.crossfaderSystem) this.crossfaderSystem.setParallax(x, y); }

  applyPlaybackValue(layerId, key, value) { 
      const deckA = this.layerManager?.getDeck(layerId, 'A');
      const deckB = this.layerManager?.getDeck(layerId, 'B');
      if (deckA) deckA.playbackValues[key] = value;
      if (deckB) deckB.playbackValues[key] = value;
  }

  clearPlaybackValues() { 
      this.layerManager?.layerList.forEach(l => {
          l.deckA.playbackValues = {};
          l.deckB.playbackValues = {};
      });
  }

  syncDeckPhysics(layerId, targetDeckSide) {
      const deckTarget = this.layerManager?.getDeck(layerId, targetDeckSide);
      const deckSource = this.layerManager?.getDeck(layerId, targetDeckSide === 'A' ? 'B' : 'A');
      if (deckTarget && deckSource) {
          deckTarget.continuousAngle = deckSource.continuousAngle;
          deckTarget.syncPhysicsFrom(deckSource);
      }
  }

  update(ticker) {
    if (this._isDestroyed || !this.isReady) return;

    try {
        const now = performance.now();
        const deltaTime = ticker.deltaTime; 

        // 1. UPDATE BRAIN
        const audioData = this.audioReactor.getAudioData();
        const finalParams = this.logic.update(deltaTime, audioData);

        // 2. APPLY PARAMETERS
        this.effectsManager.applyValues(finalParams);
        if (this.layerManager) this.layerManager.applyModulations(finalParams);
        
        // 3. CONFIGURE FEEDBACK
        let isFeedbackOn = false;
        if (this.feedbackSystem) {
            if (finalParams['feedback.enabled'] !== undefined) { 
                this.feedbackSystem.updateConfig('enabled', finalParams['feedback.enabled'] > 0.5); 
            }
            ['amount', 'scale', 'rotation', 'xOffset', 'yOffset', 'hueShift', 'satShift', 'contrast', 'sway', 'chroma', 'invert', 'renderOnTop'].forEach(p => {
                if (finalParams[`feedback.${p}`] !== undefined) this.feedbackSystem.updateConfig(p, finalParams[`feedback.${p}`]);
            });
            isFeedbackOn = this.feedbackSystem.config.enabled;
        }

        // 4. STEP WORLD PHYSICS
        this.effectsManager.update(ticker, this.app.renderer);
        this.crossfaderSystem.update(deltaTime * 0.01666, now, this.app.screen);

        // 5. RENDER PREPARATION
        if (this.layerManager) {
            const mainGroup = this.layerManager.mainLayerGroup;
            this.rootContainer.filters = this.effectsManager.getFilterList();
            
            if (mainGroup.parent !== this.rootContainer) this.rootContainer.addChildAt(mainGroup, 0);

            if (isFeedbackOn) {
                this.feedbackSystem.render(mainGroup);
                mainGroup.visible = false; 
                this.feedbackSystem.displaySprite.visible = true;
                if (this.feedbackSystem.displaySprite.parent !== this.rootContainer) {
                    this.rootContainer.addChild(this.feedbackSystem.displaySprite);
                }
            } else {
                mainGroup.visible = true; 
                if (this.feedbackSystem.displaySprite.parent) {
                    this.feedbackSystem.displaySprite.visible = false;
                }
            }
        }

    } catch (e) {
        if (import.meta.env.DEV) console.error("[PixiEngine] Update Loop Failed:", e);
    }
  }

  destroy() { 
      this._isDestroyed = true;
      this.isReady = false; 

      SignalBus.off('event:trigger', this._onEventTrigger);
      
      if (this.audioReactor) this.audioReactor.destroy();
      if (this.layerManager) this.layerManager.destroy();
      if (this.feedbackSystem) this.feedbackSystem.destroy();
      
      this.rootContainer.destroy({ children: false });

      if (this.app) {
          if (this.app.renderer) { 
              this.app.renderer.off('resize', this._resizeHandler); 
          }
          this.app.ticker.remove(this._updateLoop);
          this.app.destroy(true, { children: true, texture: true }); 
      }
  }
}