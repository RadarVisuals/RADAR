// src/utils/PixiEngine.js
import { Application, RenderTexture, Mesh, PlaneGeometry } from 'pixi.js';
import { PixiEffectsManager } from './pixi/PixiEffectsManager';
import { useEngineStore } from '../store/useEngineStore'; 
import SignalBus from '../utils/SignalBus';

import { AudioReactor } from './pixi/systems/AudioReactor';
import { FeedbackSystem } from './pixi/systems/FeedbackSystem';
import { LayerManager } from './pixi/systems/LayerManager';
import { CrossfaderSystem } from './pixi/systems/CrossfaderSystem.js';

import { ModulationEngine } from './ModulationEngine';
import { LFO } from './LFO';

export default class PixiEngine {
  constructor(canvasElement) {
    this.app = new Application();
    this.canvas = canvasElement;
    this.isReady = false;
    this._isDestroyed = false;

    this.modulationEngine = new ModulationEngine();
    this.lfo = new LFO();

    this.effectsManager = new PixiEffectsManager();
    this.audioReactor = new AudioReactor();
    
    this.layerManager = null; 
    this.feedbackSystem = null; 
    this.crossfaderSystem = null; 

    this.isMappingActive = false;
    this.renderTexture = null;
    this.projectionMesh = null;
    
    this._resizeHandler = this.handleResize.bind(this);
    this._updateLoop = this.update.bind(this);
  }

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

    this.effectsManager.init(this.app.screen);
    this.layerManager = new LayerManager(this.app, this.effectsManager);
    this.feedbackSystem = new FeedbackSystem(this.app);
    this.crossfaderSystem = new CrossfaderSystem(this.layerManager, this.audioReactor);

    this.initMappingResources();

    this.app.renderer.on('resize', this._resizeHandler);
    this.handleResize(); 
    this.app.ticker.add(this._updateLoop);
    
    // Sync Initial State
    const state = useEngineStore.getState();
    if (state.baseValues) {
        Object.entries(state.baseValues).forEach(([fullId, value]) => {
            this.modulationEngine.setBaseValue(fullId, value);
        });
    }
    if (state.patches) {
        state.patches.forEach(patch => {
            this.modulationEngine.addPatch(patch.source, patch.target, patch.amount);
        });
    }

    const initialSignals = this.lfo.update();
    const initialParams = this.modulationEngine.compute({ ...initialSignals, 'audio.bass': 0, 'audio.mid': 0, 'audio.treble': 0, 'audio.level': 0 });
    
    if (this.feedbackSystem && initialParams['feedback.enabled'] !== undefined) {
        this.feedbackSystem.updateConfig('enabled', initialParams['feedback.enabled'] > 0.5);
    }
    
    this.effectsManager.applyValues(initialParams);

    this.isReady = true;
    console.log("[PixiEngine] ✅ Init Complete. Modulation Engine Active & Synced.");
  }

  initMappingResources() {
    const { width, height } = this.app.screen;
    this.renderTexture = RenderTexture.create({ width, height, resolution: this.app.renderer.resolution });
    const geometry = new PlaneGeometry({ width, height, verticesX: 2, verticesY: 2 });
    this.projectionMesh = new Mesh({ geometry, texture: this.renderTexture });
  }

  setMappingMode(isActive) {
    this.isMappingActive = isActive;
  }

  handleResize() {
    if (this._isDestroyed || !this.app || !this.app.renderer) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (this.renderTexture) this.renderTexture.resize(w, h);
    if (this.feedbackSystem) this.feedbackSystem.resize(w, h);
    if (this.layerManager) this.layerManager.resize();
  }

  setRenderedCrossfade(value) { 
      if (this.crossfaderSystem) this.crossfaderSystem.crossfadeValue = value; 
  }
  setIndustrialConfig(config) {}
  updateEffectConfig(name, param, value) {
      const fullId = `${name}.${param}`;
      this.modulationEngine.setBaseValue(fullId, value);
  }
  addModulationPatch(source, target, amount) { this.modulationEngine.addPatch(source, target, amount); }
  removeModulationPatch(patchId) { this.modulationEngine.removePatch(patchId); }
  clearModulationPatches() { this.modulationEngine.clearAllPatches(); }
  
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

  // --- UPDATED MAIN LOOP ---

  update(ticker) {
    if (this._isDestroyed) return;

    const now = performance.now();
    const deltaTime = ticker.deltaTime * 0.01666; 

    // 1. SIGNALS
    const lfoSignals = this.lfo.update();
    const audioData = this.audioReactor.getAudioData();
    const signals = {
        ...lfoSignals,
        'audio.bass': audioData.frequencyBands.bass,
        'audio.mid':  audioData.frequencyBands.mid,
        'audio.treble': audioData.frequencyBands.treble,
        'audio.level': audioData.level
    };

    // 2. MODULATION
    const finalParams = this.modulationEngine.compute(signals);
    SignalBus.emit('modulation:update', finalParams);

    const isCrossfaderModulated = this.modulationEngine.patches.some(p => p.target === 'global.crossfader');
    if (isCrossfaderModulated && finalParams['global.crossfader'] !== undefined) {
        this.crossfaderSystem.crossfadeValue = Math.max(0, Math.min(1, finalParams['global.crossfader']));
    }

    // 3. APPLY TO FILTERS
    this.effectsManager.applyValues(finalParams);
    
    // 4. FEEDBACK CONFIG
    let isFeedbackOn = false;
    if (this.feedbackSystem) {
        if (finalParams['feedback.enabled'] !== undefined) { 
            const isEnabled = finalParams['feedback.enabled'] > 0.5;
            this.feedbackSystem.updateConfig('enabled', isEnabled); 
        }
        ['amount', 'scale', 'rotation', 'xOffset', 'yOffset'].forEach(p => {
            if (finalParams[`feedback.${p}`] !== undefined) {
                this.feedbackSystem.updateConfig(p, finalParams[`feedback.${p}`]);
            }
        });
        isFeedbackOn = this.feedbackSystem.config.enabled;
    }

    // --- STAGE GRAPH MANAGEMENT ---
    // If Feedback is ON, remove mainLayerGroup from stage to stop automatic rendering.
    // If Feedback is OFF, add it back to stage so it renders normally.
    if (this.layerManager) {
        const mainGroup = this.layerManager.mainLayerGroup;
        this.layerManager.mainLayerGroup.filters = this.effectsManager.getFilterList();

        if (isFeedbackOn) {
            if (mainGroup.parent) {
                mainGroup.parent.removeChild(mainGroup);
            }
            // Ensure it's marked visible so manual rendering in FeedbackSystem works
            mainGroup.visible = true; 
            mainGroup.renderable = true;
        } else if (!this.isMappingActive) {
            // Standard Mode: Ensure it's on stage
            if (!mainGroup.parent) {
                this.app.stage.addChildAt(mainGroup, 0); // Put at bottom
            }
            mainGroup.visible = true;
            mainGroup.renderable = true;
        }
    }

    this.effectsManager.update(ticker, this.app.renderer);
    this.crossfaderSystem.update(deltaTime, now, this.app.screen);

    // 6. RENDER PIPELINE
    if (isFeedbackOn) {
        // Render mainLayerGroup (detached) into feedback loop
        this.feedbackSystem.render(this.layerManager.mainLayerGroup);
    } 
    
    // MAPPING MODE
    if (this.isMappingActive && this.projectionMesh) {
        // Determine source: Feedback Output or Main Group
        const source = isFeedbackOn ? this.feedbackSystem.outputSprite : this.layerManager.mainLayerGroup;
        
        // Ensure source is detached from stage to avoid double render, 
        // unless it's already detached (which mainGroup is if feedback ON)
        const wasParent = source.parent;
        if (wasParent) wasParent.removeChild(source);
        
        // Manual Render to texture
        this.app.renderer.render({ container: source, target: this.renderTexture });
        
        // Restore parent if needed (e.g. if mapping toggles off)
        if (wasParent) wasParent.addChild(source);
    }
  }

  destroy() { 
      this._isDestroyed = true;
      this.audioReactor.destroy();
      this.layerManager.destroy();
      this.feedbackSystem.destroy();
      if (this.app) {
          if (this.app.renderer) { this.app.renderer.off('resize', this._resizeHandler); }
          this.app.ticker.remove(this._updateLoop);
          this.app.destroy(true, { children: true, texture: false, baseTexture: false }); 
      }
      this.isReady = false; 
  }
}