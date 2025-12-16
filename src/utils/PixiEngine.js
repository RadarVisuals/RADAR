// src/utils/PixiEngine.js
import { Application, RenderTexture, Mesh, PlaneGeometry, Container } from 'pixi.js';
import { PixiEffectsManager } from './pixi/PixiEffectsManager';
import { useEngineStore } from '../store/useEngineStore'; 
import SignalBus from '../utils/SignalBus';

import { AudioReactor } from './pixi/systems/AudioReactor';
import { FeedbackSystem } from './pixi/systems/FeedbackSystem';
import { LayerManager } from './pixi/systems/LayerManager';
import { CrossfaderSystem } from './pixi/systems/CrossfaderSystem.js';

import { ModulationEngine } from './ModulationEngine';
import { LFO } from './LFO';
import { EventSignalGenerator } from './EventSignalGenerator';

export default class PixiEngine {
  constructor(canvasElement) {
    this.app = new Application();
    this.canvas = canvasElement;
    this.isReady = false;
    this._isDestroyed = false;

    this.modulationEngine = new ModulationEngine();
    this.lfo = new LFO();
    this.eventSignalGenerator = new EventSignalGenerator();

    this.effectsManager = new PixiEffectsManager();
    this.audioReactor = new AudioReactor();
    
    this.rootContainer = new Container(); 
    this.layerManager = null; 
    this.feedbackSystem = null; 
    this.crossfaderSystem = null; 

    this.isMappingActive = false;
    this.renderTexture = null;
    this.projectionMesh = null;
    
    // Zero-allocation signal container
    this._signals = {
        'audio.bass': 0, 'audio.mid': 0, 'audio.treble': 0, 'audio.level': 0,
        'lfo.slow.sine': 0, 'lfo.mid.sine': 0, 'lfo.fast.sine': 0,
        'lfo.slow.saw': 0, 'lfo.fast.saw': 0,
        'lfo.pulse': 0, 'lfo.chaos': 0,
        'event.any': 0
    };
    
    this._resizeHandler = this.handleResize.bind(this);
    this._updateLoop = this.update.bind(this);
    
    this._onEventTrigger = (data) => {
        if(this.eventSignalGenerator) {
            this.eventSignalGenerator.trigger(data.type);
        }
    };
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

    this.app.stage.addChild(this.rootContainer);

    this.effectsManager.init(this.app.screen);
    this.layerManager = new LayerManager(this.app, this.effectsManager);
    this.feedbackSystem = new FeedbackSystem(this.app, this.rootContainer); 
    this.crossfaderSystem = new CrossfaderSystem(this.layerManager, this.audioReactor);

    this.initMappingResources();

    this.app.renderer.on('resize', this._resizeHandler);
    this.handleResize(); 
    this.app.ticker.add(this._updateLoop);
    
    SignalBus.on('event:trigger', this._onEventTrigger);
    
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

    const lfoData = this.lfo.update();
    Object.assign(this._signals, lfoData);
    
    const eventData = this.eventSignalGenerator.update(0);
    Object.assign(this._signals, eventData);

    const initialParams = this.modulationEngine.compute(this._signals);
    
    if (this.feedbackSystem && initialParams['feedback.enabled'] !== undefined) {
        this.feedbackSystem.updateConfig('enabled', initialParams['feedback.enabled'] > 0.5);
    }
    
    this.effectsManager.applyValues(initialParams);
    
    if (this.layerManager) {
        this.layerManager.applyModulations(initialParams);
    }

    this.isReady = true;
    console.log("[PixiEngine] ✅ Init Complete.");
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

  // --- NEW: Fade Command exposed to React ---
  fadeTo(targetValue, duration, onComplete) {
      if (this.crossfaderSystem) {
          this.crossfaderSystem.fadeTo(targetValue, duration, onComplete);
      }
  }

  cancelFade() {
      if (this.crossfaderSystem) {
          this.crossfaderSystem.cancelFade();
      }
  }

  setRenderedCrossfade(value) { 
      if (this.crossfaderSystem) this.crossfaderSystem.crossfadeValue = value; 
  }
  
  setModulationValue(paramId, value) {
      this.modulationEngine.setBaseValue(paramId, value);
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

  update(ticker) {
    if (this._isDestroyed) return;

    const now = performance.now();
    const deltaTime = ticker.deltaTime * 0.01666; 

    const lfoSignals = this.lfo.update();
    for (const key in lfoSignals) {
        this._signals[key] = lfoSignals[key];
    }

    const audioData = this.audioReactor.getAudioData();
    this._signals['audio.bass'] = audioData.frequencyBands.bass;
    this._signals['audio.mid'] = audioData.frequencyBands.mid;
    this._signals['audio.treble'] = audioData.frequencyBands.treble;
    this._signals['audio.level'] = audioData.level;

    const eventSignals = this.eventSignalGenerator.update(deltaTime);
    for (const key in eventSignals) {
        this._signals[key] = eventSignals[key];
    }

    // --- ADDED: EMIT RAW SIGNALS FOR DEBUGGER ---
    if (import.meta.env.DEV) {
        SignalBus.emit('signals:update', this._signals);
    }
    // --------------------------------------------

    const finalParams = this.modulationEngine.compute(this._signals);
    SignalBus.emit('modulation:update', finalParams);

    // --- Priority Logic for Crossfader ---
    if (this.modulationEngine.patches.some(p => p.target === 'global.crossfader')) {
        if (finalParams['global.crossfader'] !== undefined) {
            const modValue = Math.max(0, Math.min(1, finalParams['global.crossfader']));
            this.crossfaderSystem.crossfadeValue = modValue;
            SignalBus.emit('crossfader:update', modValue);
        }
    }

    this.effectsManager.applyValues(finalParams);
    
    if (this.layerManager) {
        this.layerManager.applyModulations(finalParams);
    }
    
    let isFeedbackOn = false;
    if (this.feedbackSystem) {
        if (finalParams['feedback.enabled'] !== undefined) { 
            const isEnabled = finalParams['feedback.enabled'] > 0.5;
            this.feedbackSystem.updateConfig('enabled', isEnabled); 
        }
        // --- UPDATED: replaced shake with sway, added chroma ---
        ['amount', 'scale', 'rotation', 'xOffset', 'yOffset', 'hueShift', 'satShift', 'contrast', 'sway', 'chroma', 'invert', 'renderOnTop'].forEach(p => {
            if (finalParams[`feedback.${p}`] !== undefined) {
                this.feedbackSystem.updateConfig(p, finalParams[`feedback.${p}`]);
            }
        });
        isFeedbackOn = this.feedbackSystem.config.enabled;
    }

    if (this.layerManager) {
        const mainGroup = this.layerManager.mainLayerGroup;
        this.rootContainer.filters = this.effectsManager.getFilterList();

        if (mainGroup.filters && mainGroup.filters.length > 0) {
            mainGroup.filters = null;
        }

        if (mainGroup.parent !== this.rootContainer) {
            this.rootContainer.addChildAt(mainGroup, 0);
        }

        if (isFeedbackOn) {
            mainGroup.visible = false;
            if (this.feedbackSystem.displaySprite.parent !== this.rootContainer) {
                this.rootContainer.addChild(this.feedbackSystem.displaySprite);
            }
        } else {
            mainGroup.visible = true;
            if (this.feedbackSystem.displaySprite.parent) {
                this.feedbackSystem.displaySprite.parent.removeChild(this.feedbackSystem.displaySprite);
            }
        }
    }

    this.effectsManager.update(ticker, this.app.renderer);
    this.crossfaderSystem.update(deltaTime, now, this.app.screen);

    if (isFeedbackOn) {
        this.feedbackSystem.render(this.layerManager.mainLayerGroup);
    } 
    
    if (this.isMappingActive && this.projectionMesh) {
        const wasRenderable = this.rootContainer.renderable;
        this.rootContainer.renderable = true;
        if (this.rootContainer.updateTransform) this.rootContainer.updateTransform();

        this.app.renderer.render({ container: this.rootContainer, target: this.renderTexture });
        this.rootContainer.renderable = wasRenderable;
    }
  }

  destroy() { 
      this._isDestroyed = true;
      SignalBus.off('event:trigger', this._onEventTrigger);
      this.audioReactor.destroy();
      this.layerManager.destroy();
      this.feedbackSystem.destroy();
      
      this.rootContainer.destroy({ children: false });

      if (this.app) {
          if (this.app.renderer) { this.app.renderer.off('resize', this._resizeHandler); }
          this.app.ticker.remove(this._updateLoop);
          this.app.destroy(true, { children: true, texture: false, baseTexture: false }); 
      }
      this.isReady = false; 
  }
}