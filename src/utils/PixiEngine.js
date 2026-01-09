// src/utils/PixiEngine.js

import { Application, Container } from 'pixi.js';
import { PixiEffectsManager } from './pixi/PixiEffectsManager';
import SignalBus from '../utils/SignalBus';
import { sliderParams } from '../config/sliderParams';

import { AudioReactor } from './pixi/systems/AudioReactor';
import { FeedbackSystem } from './pixi/systems/FeedbackSystem';
import { LayerManager } from './pixi/systems/LayerManager';
import { CrossfaderSystem } from './pixi/systems/CrossfaderSystem.js';
import { LogicController } from './LogicController';

export default class PixiEngine {
  constructor(canvasElement) {
    this.app = null;
    this.canvas = canvasElement;
    this.isReady = false;
    this._isDestroyed = false;
    this.bootstrapped = false;

    this.logic = new LogicController();
    this.effectsManager = new PixiEffectsManager();
    this.audioReactor = new AudioReactor();
    
    this.rootContainer = new Container(); 
    this.layerManager = null; 
    this.feedbackSystem = null; 
    this.crossfaderSystem = null; 

    this._resizeHandler = this.handleResize.bind(this);
    this._updateLoop = this.update.bind(this);
    this._fullscreenHandler = this.handleFullscreenChange.bind(this);
    
    this._onEventTrigger = (data) => {
        if(this.logic) this.logic.triggerEvent(data.type);
    };

    this._onParamUpdate = (data) => {
        const { layerId, param, value, isNormalized } = data;
        if (!this.layerManager || !this.crossfaderSystem) return;

        let finalValue = value;
        if (isNormalized) {
            const config = sliderParams.find(p => p.prop === param);
            if (config) {
                finalValue = config.min + (value * (config.max - config.min));
            }
        }

        const activeDeck = this.crossfaderSystem.crossfadeValue < 0.5 ? 'A' : 'B';
        this.layerManager.updateConfig(layerId, param, finalValue, activeDeck);
    };
  }

  async init() {
    if (this.isReady || this._isDestroyed || this.app) return;
    
    this.app = new Application();
    
    try {
      /**
       * MACBOOK M4 PRO PERFORMANCE TUNING:
       * 1. Resolution: On Retina displays, 1.0 resolution is still massive.
       *    We use 0.75 on high-DPI screens to save fill-rate during crossfades.
       * 2. roundPixels: true. This prevents sub-pixel interpolation, a major source of 
       *    MacBook Pro stuttering during rotation/scaling.
       * 3. powerPreference: 'high-performance' hints to the M4 Pro to stay in high-gear.
       */
      const optimalResolution = window.devicePixelRatio > 1 ? 0.75 : 1.0;

      await this.app.init({
        canvas: this.canvas,
        resizeTo: this.canvas.parentElement, 
        backgroundAlpha: 0,
        antialias: false, 
        resolution: optimalResolution, 
        autoDensity: true,
        roundPixels: true, 
        powerPreference: 'high-performance', 
        preference: 'webgl',
        hello: false
      });

      if (this._isDestroyed) {
          this.app.destroy(true);
          return;
      }

      this.app.stage.addChild(this.rootContainer);

      this.effectsManager.init(this.app.screen);
      this.layerManager = new LayerManager(this.app, this.effectsManager);
      this.feedbackSystem = new FeedbackSystem(this.app, this.rootContainer); 
      this.crossfaderSystem = new CrossfaderSystem(this.layerManager, this.audioReactor);

      this.app.renderer.on('resize', this._resizeHandler);
      window.addEventListener('resize', this._resizeHandler);
      document.addEventListener('fullscreenchange', this._fullscreenHandler);
      document.addEventListener('webkitfullscreenchange', this._fullscreenHandler);

      this.handleResize(); 
      this.app.ticker.add(this._updateLoop);
      
      SignalBus.on('event:trigger', this._onEventTrigger);
      SignalBus.on('param:update', this._onParamUpdate);
      
      this.isReady = true;
    } catch (e) {
      console.error("[PixiEngine] Critical Init Error:", e);
    }
  }

  handleFullscreenChange() {
      setTimeout(() => this.handleResize(), 100);
      setTimeout(() => this.handleResize(), 600); 
  }

  handleResize() {
    if (this._isDestroyed || !this.app || !this.app.renderer) return;
    const w = this.app.renderer.screen.width;
    const h = this.app.renderer.screen.height;
    if (w <= 0 || h <= 0) return;
    this.rootContainer.filterArea = this.app.screen; 
    if (this.feedbackSystem) this.feedbackSystem.resize(w, h);
    if (this.layerManager) this.layerManager.resize();
  }

  fadeTo(target, duration, onComplete) { if (this.crossfaderSystem) this.crossfaderSystem.fadeTo(target, duration, onComplete); }
  cancelFade() { if (this.crossfaderSystem) this.crossfaderSystem.cancelFade(); }
  setRenderedCrossfade(value) { if (this.crossfaderSystem) this.crossfaderSystem.crossfadeValue = value; }
  setModulationValue(paramId, value) { this.logic.setBaseValue(paramId, value); }
  addModulationPatch(source, target, amount) { this.logic.addPatch(source, target, amount); }
  removeModulationPatch(patchId) { this.logic.removePatch(patchId); }
  clearModulationPatches() { this.logic.clearPatches(); }
  get modulationEngine() { return this.logic.modulationEngine; }
  get lfo() { return this.logic.lfo; }
  async setTexture(layerId, deckSide, imageSrc, tokenId) { if (this.layerManager) await this.layerManager.setTexture(layerId, deckSide, imageSrc, tokenId); }
  updateConfig(layerId, key, value, deckSide = 'A') { if (this.layerManager) this.layerManager.updateConfig(layerId, key, value, deckSide); }
  snapConfig(layerId, fullConfig, deckSide = 'A') { if (this.layerManager) { this.bootstrapped = true; this.layerManager.snapConfig(layerId, fullConfig, deckSide); } }
  setAudioFactors(factors) { this.audioReactor.setAudioFactors(factors); }
  triggerBeatPulse(factor, duration) { this.audioReactor.triggerBeatPulse(factor, duration); }
  setParallax(x, y) { if (this.crossfaderSystem) this.crossfaderSystem.setParallax(x, y); }
  
  applyPlaybackValue(layerId, key, value) { 
      const deckA = this.layerManager?.getDeck(layerId, 'A');
      const deckB = this.layerManager?.getDeck(layerId, 'B');
      if (deckA) deckA.playbackValues[key] = value;
      if (deckB) deckB.playbackValues[key] = value;
  }
  
  clearPlaybackValues() { this.layerManager?.layerList.forEach(l => { l.deckA.playbackValues = {}; l.deckB.playbackValues = {}; }); }
  
  syncDeckPhysics(layerId, targetDeckSide) {
      const deckTarget = this.layerManager?.getDeck(layerId, targetDeckSide);
      const deckSource = this.layerManager?.getDeck(layerId, targetDeckSide === 'A' ? 'B' : 'A');
      if (deckTarget && deckSource) {
          deckTarget.syncPhysicsFrom(deckSource);
      }
  }

  update(ticker) {
    if (this._isDestroyed || !this.isReady) return;

    try {
        const now = performance.now();
        // Clamping deltaTime to prevent huge jumps if a frame drops
        const deltaTime = Math.min(ticker.deltaTime, 1.5); 

        const audioData = this.audioReactor.getAudioData();
        const finalParams = this.logic.update(deltaTime, audioData);

        this.effectsManager.applyValues(finalParams);
        if (this.layerManager) this.layerManager.applyModulations(finalParams);
        
        if (this.layerManager && this.bootstrapped) {
            const activeDeckSide = this.crossfaderSystem.crossfadeValue < 0.5 ? 'A' : 'B';
            ['1', '2', '3'].forEach(layerId => {
                const deck = this.layerManager.getDeck(layerId, activeDeckSide);
                if (deck) {
                    for (const prop in deck.interpolators) {
                        const smoothedValue = deck.interpolators[prop].currentValue;
                        SignalBus.emit(`ui:smooth_update:${layerId}:${prop}`, smoothedValue);
                    }
                }
            });
        }

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

        if (this.bootstrapped) {
            this.effectsManager.update(ticker, this.app.renderer);
            this.crossfaderSystem.update(deltaTime * 0.01666, now, this.app.screen);
        }

        if (this.layerManager) {
            const mainGroup = this.layerManager.mainLayerGroup;
            this.rootContainer.filters = this.effectsManager.getFilterList();
            
            if (mainGroup.parent !== this.rootContainer) {
                this.rootContainer.addChildAt(mainGroup, 0); 
            }

            if (isFeedbackOn) {
                this.feedbackSystem.render(this.rootContainer);
                this.rootContainer.visible = false; 
                this.feedbackSystem.displaySprite.visible = true;
                if (this.feedbackSystem.displaySprite.parent !== this.app.stage) {
                    this.app.stage.addChild(this.feedbackSystem.displaySprite);
                }
            } else {
                this.rootContainer.visible = true;
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
      
      window.removeEventListener('resize', this._resizeHandler);
      document.removeEventListener('fullscreenchange', this._fullscreenHandler);
      document.removeEventListener('webkitfullscreenchange', this._fullscreenHandler);

      SignalBus.off('event:trigger', this._onEventTrigger);
      SignalBus.off('param:update', this._onParamUpdate);
      if (this.audioReactor) this.audioReactor.destroy();
      if (this.layerManager) this.layerManager.destroy();
      if (this.feedbackSystem) this.feedbackSystem.destroy();
      
      this.rootContainer.destroy({ children: false });
      if (this.app) {
          if (this.app.renderer) { this.app.renderer.off('resize', this._resizeHandler); }
          this.app.ticker.remove(this._updateLoop);
          this.app.destroy(true, { children: true, texture: true }); 
      }
  }
}