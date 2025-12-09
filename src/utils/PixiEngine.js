import { Application, RenderTexture, Mesh, PlaneGeometry } from 'pixi.js';
import { PixiEffectsManager } from './pixi/PixiEffectsManager';
import { useEngineStore } from '../store/useEngineStore'; 

// Import Sub-Systems
import { AudioReactor } from './pixi/systems/AudioReactor';
import { FeedbackSystem } from './pixi/systems/FeedbackSystem';
import { LayerManager } from './pixi/systems/LayerManager';
import { CrossfaderSystem } from './pixi/systems/CrossfaderSystem.js';

export default class PixiEngine {
  constructor(canvasElement) {
    this.app = new Application();
    this.canvas = canvasElement;
    this.isReady = false;
    this._isDestroyed = false;

    // --- SYSTEMS ---
    this.effectsManager = new PixiEffectsManager();
    this.audioReactor = new AudioReactor();
    
    // These are initialized in init() because they need the initialized App/Screen
    this.layerManager = null; 
    this.feedbackSystem = null; 
    this.crossfaderSystem = null; 

    // Mapping Resources (Simple mesh logic kept here for now)
    this.isMappingActive = false;
    this.renderTexture = null;
    this.projectionMesh = null;

    this.industrialConfig = { enabled: false, chaos: 0, mappings: {} };
    
    // Bindings
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

    // Initialize Sub-Systems
    this.effectsManager.init(this.app.screen);
    
    this.layerManager = new LayerManager(this.app, this.effectsManager);
    
    this.feedbackSystem = new FeedbackSystem(this.app);
    
    this.crossfaderSystem = new CrossfaderSystem(this.layerManager, this.audioReactor);

    // Initialize Mapping Resources
    this.initMappingResources();

    // Event Listeners
    this.app.renderer.on('resize', this._resizeHandler);
    this.handleResize(); 
    this.app.ticker.add(this._updateLoop);
    
    // Sync Initial State
    const state = useEngineStore.getState();
    
    // 1. Sync Feedback
    if (state.effectsConfig?.feedback) {
        this.updateEffectConfig('feedback', null, null); 
    }

    // 2. Sync Industrial Config (Critical for Scene Shredder init)
    if (state.industrialConfig) {
        this.setIndustrialConfig(state.industrialConfig);
    }

    this.isReady = true;
    if (import.meta.env.DEV) console.log("[PixiEngine] ✅ Init Complete. Systems Active.");
  }

  // --- MAPPING (Projection) ---
  initMappingResources() {
    const { width, height } = this.app.screen;
    this.renderTexture = RenderTexture.create({ width, height, resolution: this.app.renderer.resolution });
    const geometry = new PlaneGeometry({ width, height, verticesX: 2, verticesY: 2 });
    this.projectionMesh = new Mesh({ geometry, texture: this.renderTexture });
  }

  setMappingMode(isActive) {
    this.isMappingActive = isActive;
    // When mapping is active, we remove the main layer group from stage 
    // because we will render it manually into a texture.
    const mainGroup = this.layerManager.mainLayerGroup;
    
    if (isActive) {
        this.app.stage.removeChild(mainGroup);
        this.app.stage.addChild(this.projectionMesh);
    } else {
        this.app.stage.removeChild(this.projectionMesh);
        this.app.stage.addChild(mainGroup);
    }
  }

  updateCorner(index, x, y) {
    if (!this.projectionMesh) return;
    const buffer = this.projectionMesh.geometry.getAttribute('aPosition').buffer;
    if (buffer.data) {
        buffer.data[index * 2] = x;
        buffer.data[index * 2 + 1] = y;
        buffer.update();
    }
  }

  // --- CONFIG HANDLERS ---

  setRenderedCrossfade(value) { 
      // Handled via SignalBus in CrossfaderSystem for high frequency, 
      // but we update the system reference directly here for redundancy/initialization
      if (this.crossfaderSystem) {
          this.crossfaderSystem.crossfadeValue = value; 
      }
  }

  setIndustrialConfig(config) {
      this.industrialConfig = config;
      
      // 1. Pass config to CrossfaderSystem (Fixes Scene Shredder)
      if (this.crossfaderSystem) {
          this.crossfaderSystem.setIndustrialConfig(config);
      }

      // 2. Pass config to EffectsManager (Visual Destruction)
      if (!config.enabled) {
          // Force cleanup of destruction effects if disabled
          this.effectsManager.updateDestructionMode(this.audioReactor.getAudioData(), config);
          if (this.layerManager) {
              this.layerManager.mainLayerGroup.filters = this.effectsManager.getFilterList();
          }
      }
  }

  handleResize() {
    if (this._isDestroyed || !this.app || !this.app.renderer) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    
    if (this.renderTexture) this.renderTexture.resize(w, h);
    if (this.feedbackSystem) this.feedbackSystem.resize(w, h);
    if (this.layerManager) this.layerManager.resize();
  }

  triggerVisualEffect(type, config = {}) {
    this.effectsManager.triggerOneShot(type, config, this.app.screen);
    if (this.layerManager) {
        this.layerManager.mainLayerGroup.filters = this.effectsManager.getFilterList();
    }
  }

  updateEffectConfig(name, param, value) {
    if (name === 'feedback') {
        if (this.feedbackSystem) {
            const isEnabled = this.feedbackSystem.updateConfig(param, value);
            // If feedback is enabled, hide the main layers (we draw them manually into the feedback buffer)
            if (this.layerManager) {
                this.layerManager.mainLayerGroup.visible = !isEnabled;
            }
        }
        return;
    }
    
    this.effectsManager.updateConfig(name, param, value);
    if (this.layerManager) {
        this.layerManager.mainLayerGroup.filters = this.effectsManager.getFilterList();
    }
  }

  // --- PROXIES FOR REACT BRIDGE (usePixiOrchestrator) ---
  
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
      
      if (deckTarget && deckSource) {
          const normalizedAngle = ((deckSource.continuousAngle % 360) + 360) % 360;
          deckSource.continuousAngle = normalizedAngle;
          deckTarget.syncPhysicsFrom(deckSource);
      }
  }

  // --- MAIN LOOP ---

  update(ticker) {
    if (this._isDestroyed) return;

    const now = performance.now();
    const deltaTime = ticker.deltaTime * 0.01666; // Normalize to approx seconds

    // 1. Update Industrial/Destruction Effects
    //    We check enabled state here to apply dynamic audio-reactive changes
    if (this.industrialConfig.enabled) {
        this.effectsManager.updateDestructionMode(this.audioReactor.getAudioData(), this.industrialConfig);
        // Re-apply filter list in case enabled filters changed
        this.layerManager.mainLayerGroup.filters = this.effectsManager.getFilterList();
    }

    // 2. Update General Effects (Time based animations like liquid/wave)
    this.effectsManager.update(ticker, this.app.renderer);

    // 3. Update Layers & Transitions via CrossfaderSystem
    //    This handles physics stepping and calculating render state (opacity/transform)
    this.crossfaderSystem.update(deltaTime, now, this.app.screen);

    // 4. Handle Render Pipeline
    
    // A. Feedback Loop (Video Feedback Effect)
    if (this.feedbackSystem.config.enabled) {
        // Render layers into feedback buffer instead of screen
        this.feedbackSystem.render(this.layerManager.mainLayerGroup);
    } 
    
    // B. Projection Mapping (Mesh Distortion)
    if (this.isMappingActive && this.projectionMesh) {
        // Source is either the feedback output or the raw layer group
        const source = this.feedbackSystem.config.enabled ? this.feedbackSystem.outputSprite : this.layerManager.mainLayerGroup;
        
        // Ensure source is visible for the texture render
        const wasVisible = source.visible;
        source.visible = true;
        
        // Render the scene onto the projection mesh texture
        this.app.renderer.render({ container: source, target: this.renderTexture });
        
        // Restore visibility state (e.g. if mainLayerGroup was hidden by feedback)
        source.visible = wasVisible;
    }
  }

  destroy() { 
      this._isDestroyed = true;
      
      // Cleanup Systems
      this.audioReactor.destroy();
      this.layerManager.destroy();
      this.feedbackSystem.destroy();
      // CrossfaderSystem has no internal resources to destroy currently

      if (this.app) {
          if (this.app.renderer) { this.app.renderer.off('resize', this._resizeHandler); }
          this.app.ticker.remove(this._updateLoop);
          
          if (import.meta.env.DEV) console.log("[PixiEngine] Destroying application instance.");
          this.app.destroy(true, { children: true, texture: false, baseTexture: false }); 
      }
      this.isReady = false; 
  }
}