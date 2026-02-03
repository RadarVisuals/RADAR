// src/utils/PixiEngine.js
import { Application, Container } from 'pixi.js';
import { PixiEffectsManager } from './pixi/PixiEffectsManager';
import SignalBus from '../utils/SignalBus';
import { sliderParams } from '../config/sliderParams';
import { AudioReactor } from './pixi/systems/AudioReactor';
import { FeedbackSystem } from './pixi/systems/FeedbackSystem';
import { LayerManager } from './pixi/systems/LayerManager';
import { CrossfaderSystem } from './pixi/systems/CrossfaderSystem.js';
import { LogicController } from '../utils/LogicController'; 
import { RenderLoop } from './pixi/RenderLoop';
import { useEngineStore } from '../store/useEngineStore'; 

export default class PixiEngine {
  constructor(canvasElement) {
    this.app = null;
    this.canvas = canvasElement;
    this.isReady = false;
    this._isDestroyed = false;
    
    // Core Logic Systems
    this.logic = new LogicController();
    this.audioReactor = new AudioReactor();
    
    // Visual Systems (Initialized in init())
    this.effectsManager = new PixiEffectsManager();
    this.rootContainer = new Container(); 
    this.layerManager = null; 
    this.feedbackSystem = null; 
    this.crossfaderSystem = null; 
    
    // The Render Loop Manager
    this.renderLoop = null;

    // Event Handlers
    this._resizeHandler = this.handleResize.bind(this);
    this._fullscreenHandler = this.handleFullscreenChange.bind(this);
    
    // Signal Bus Listeners
    this._onEventTrigger = (data) => { if(this.logic) this.logic.triggerEvent(data.type); };

    this._onParamUpdate = (data) => {
        const { layerId, param, value, isNormalized } = data;
        if (!this.layerManager || !this.crossfaderSystem) return;
        
        let finalValue = value;
        if (isNormalized) {
            const config = sliderParams.find(p => p.prop === param);
            if (config) finalValue = config.min + (value * (config.max - config.min));
        }
        
        const activeDeck = this.crossfaderSystem.crossfadeValue < 0.5 ? 'A' : 'B';
        
        // MIDI/SIGNAL BUS PATH: isManual = false (Ensures Glide)
        this.layerManager.updateConfig(layerId, param, finalValue, activeDeck, false);
    };
  }

  async init() {
    if (this.isReady || this._isDestroyed || this.app) return;
    
    const initialMaxFPS = useEngineStore.getState().maxFPS;
    
    this.app = new Application();
    
    try {
      await this.app.init({
        canvas: this.canvas,
        resizeTo: this.canvas.parentElement, 
        backgroundAlpha: 0,
        antialias: false, 
        resolution: 1.0, 
        autoDensity: true,
        powerPreference: 'high-performance', 
        preference: 'webgl',
        hello: false,
      });

      if (this._isDestroyed) { 
          this.app.destroy(true); 
          return; 
      }

      // --- APPLY STORED FPS SETTING ---
      // 0 = Uncapped (Native rAF)
      // >0 = Throttled
      this.app.ticker.maxFPS = initialMaxFPS;

      // Setup Scene Graph
      this.app.stage.addChild(this.rootContainer);
      
      // Initialize Systems
      this.effectsManager.init(this.app.screen);
      this.layerManager = new LayerManager(this.app, this.effectsManager);
      this.feedbackSystem = new FeedbackSystem(this.app, this.rootContainer); 
      this.crossfaderSystem = new CrossfaderSystem(this.layerManager, this.audioReactor);

      // Initialize Render Loop
      this.renderLoop = new RenderLoop(this.app, {
          logic: this.logic,
          audioReactor: this.audioReactor,
          effectsManager: this.effectsManager,
          layerManager: this.layerManager,
          crossfaderSystem: this.crossfaderSystem,
          feedbackSystem: this.feedbackSystem,
          rootContainer: this.rootContainer
      });

      // Bind Resize & Input Events
      this.app.renderer.on('resize', this._resizeHandler);
      window.addEventListener('resize', this._resizeHandler);
      document.addEventListener('fullscreenchange', this._fullscreenHandler);
      document.addEventListener('webkitfullscreenchange', this._fullscreenHandler);
      
      // Initial Layout Calculation
      this.handleResize(); 
      
      // Start Loop
      this.renderLoop.start();

      // Bind Signals
      SignalBus.on('event:trigger', this._onEventTrigger);
      SignalBus.on('param:update', this._onParamUpdate);
      
      this.isReady = true;

    } catch (e) { 
        console.error("[PixiEngine] Critical Init Error:", e); 
    }
  }

  /**
   * --- INSTANT FPS UPDATE ---
   * Called directly by UI to avoid refresh
   */
  setMaxFPS(fps) {
      if (this.app && this.app.ticker) {
          this.app.ticker.maxFPS = fps;
          if (import.meta.env.DEV) {
              console.log(`[PixiEngine] Updated maxFPS to ${fps === 0 ? 'Native (0)' : fps}`);
          }
      }
  }

  // --- API Methods called by React Hooks ---

  getLiveValue(layerId, param) {
    if (!this.layerManager || !this.crossfaderSystem) return 0;
    const activeDeckSide = this.crossfaderSystem.crossfadeValue < 0.5 ? 'A' : 'B';
    const deck = this.layerManager.getDeck(layerId, activeDeckSide);
    if (!deck) return 0;
    if (deck.interpolators[param]) {
        return deck.interpolators[param].currentValue;
    }
    return deck.config[param] || 0;
  }

  getLivePhysics(side) {
    if (!this.layerManager) return null;
    const physics = {};
    ['1', '2', '3'].forEach(id => {
        const deck = this.layerManager.getDeck(id, side);
        if (deck) {
            physics[id] = {
                continuousAngle: deck.continuousAngle,
                driftState: { ...deck.driftState }
            };
        }
    });
    return physics;
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

  // --- Delegation to Subsystems ---

  fadeTo(target, duration, onComplete) { 
      if (this.crossfaderSystem) this.crossfaderSystem.fadeTo(target, duration, onComplete); 
  }
  
  cancelFade() { 
      if (this.crossfaderSystem) this.crossfaderSystem.cancelFade(); 
  }
  
  setRenderedCrossfade(value) { 
      if (this.crossfaderSystem) this.crossfaderSystem.crossfadeValue = value; 
  }

  setModulationValue(paramId, value) { 
      this.logic.setBaseValue(paramId, value); 
  }
  
  addModulationPatch(source, target, amount) { 
      this.logic.addPatch(source, target, amount); 
  }
  
  removeModulationPatch(patchId) { 
      this.logic.removePatch(patchId); 
  }
  
  clearModulationPatches() { 
      this.logic.clearPatches(); 
  }
  
  get modulationEngine() { return this.logic.modulationEngine; }
  get lfo() { return this.logic.lfo; }

  async setTexture(layerId, deckSide, imageSrc, tokenId) { 
      if (this.layerManager) await this.layerManager.setTexture(layerId, deckSide, imageSrc, tokenId); 
  }
  
  updateConfig(layerId, key, value, deckSide = 'A', isManual = false) { 
      if (this.layerManager) this.layerManager.updateConfig(layerId, key, value, deckSide, isManual); 
  }
  
  snapConfig(layerId, fullConfig, deckSide = 'A', forceSnap = false) { 
      if (this.layerManager) { 
          if (this.renderLoop) this.renderLoop.setBootstrapped(true);
          this.layerManager.snapConfig(layerId, fullConfig, deckSide, forceSnap); 
      } 
  }

  setAudioFactors(factors) { 
      this.audioReactor.setAudioFactors(factors); 
  }
  
  triggerBeatPulse(factor, duration) { 
      this.audioReactor.triggerBeatPulse(factor, duration); 
  }
  
  setParallax(x, y) { 
      if (this.crossfaderSystem) this.crossfaderSystem.setParallax(x, y); 
  }
  
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
      if (deckTarget && deckSource) deckTarget.syncPhysicsFrom(deckSource);
  }

  destroy() { 
      this._isDestroyed = true; 
      this.isReady = false; 
      
      window.removeEventListener('resize', this._resizeHandler);
      document.removeEventListener('fullscreenchange', this._fullscreenHandler);
      document.removeEventListener('webkitfullscreenchange', this._fullscreenHandler);
      SignalBus.off('event:trigger', this._onEventTrigger);
      SignalBus.off('param:update', this._onParamUpdate);
      
      if (this.renderLoop) this.renderLoop.stop();

      if (this.audioReactor) this.audioReactor.destroy();
      if (this.layerManager) this.layerManager.destroy();
      if (this.feedbackSystem) this.feedbackSystem.destroy();
      
      this.rootContainer.destroy({ children: false });
      
      if (this.app) {
          if (this.app.renderer) this.app.renderer.off('resize', this._resizeHandler);
          this.app.destroy(true, { children: true, texture: true }); 
      }
  }
}