// src/utils/PixiEngine.js
import { Application, Container, RenderTexture, Mesh, PlaneGeometry } from 'pixi.js';
import { PixiLayerDeck } from './pixi/PixiLayerDeck';
import { PixiEffectsManager } from './pixi/PixiEffectsManager';
import { lerp, lerpAngle } from './helpers';

export default class PixiEngine {
  constructor(canvasElement) {
    this.app = new Application();
    this.canvas = canvasElement;
    this.layers = {}; 
    this.isReady = false;
    this.crossfadeValue = 0.0;
    this.effectsManager = new PixiEffectsManager();
    this.mainLayerGroup = new Container(); 
    
    this.audioFrequencyFactors = { '1': 1.0, '2': 1.0, '3': 1.0 };
    this.beatPulseFactor = 1.0;
    this.beatPulseEndTime = 0;
    this.parallaxOffset = { x: 0, y: 0 };
    this.renderedParallaxOffset = { x: 0, y: 0 };
    this.parallaxFactors = { '1': 10, '2': 25, '3': 50 };
    
    this.isMappingActive = false;
    this.renderTexture = null;
    this.projectionMesh = null;

    this.transitionMode = 'crossfade'; 
    this.lastCrossfadeValue = 0.0;
    
    // --- FIX: Use a latched state for flythrough direction ---
    // 0 = A->B (Forward), 1 = B->A (Backward)
    // Only changes when hitting boundaries 0.0 or 1.0
    this.flythroughSequence = 'A->B'; 
  }

  async init() {
    if (this.isReady) return;
    
    await this.app.init({
      canvas: this.canvas,
      resizeTo: this.canvas.parentElement, 
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      powerPreference: 'high-performance', 
      preference: 'webgl',
    });

    this.effectsManager.init(this.app.screen);

    ['1', '2', '3'].forEach(id => {
      const container = new Container();
      const deckA = new PixiLayerDeck(id, 'A');
      const deckB = new PixiLayerDeck(id, 'B');
      
      container.addChild(deckA.container);
      container.addChild(deckB.container);
      
      this.layers[id] = { container, deckA, deckB };
      this.mainLayerGroup.addChild(container);
    });

    this.mainLayerGroup.filters = this.effectsManager.getFilterList();
    this.app.stage.addChild(this.mainLayerGroup);

    this.initMappingResources();

    this.app.renderer.on('resize', () => this.handleResize());
    this.handleResize(); 
    
    this.app.ticker.add((ticker) => this.update(ticker));
    
    this.isReady = true;
    if (import.meta.env.DEV) console.log("[PixiEngine] Initialized.");
  }

  setTransitionMode(mode) {
    this.transitionMode = mode;
  }

  initMappingResources() {
    const { width, height } = this.app.screen;
    this.renderTexture = RenderTexture.create({ width, height, resolution: this.app.renderer.resolution });
    const geometry = new PlaneGeometry({ width, height, verticesX: 2, verticesY: 2 });
    this.projectionMesh = new Mesh({ geometry, texture: this.renderTexture });
  }

  setMappingMode(isActive) {
    this.isMappingActive = isActive;
    if (isActive) {
        this.app.stage.removeChild(this.mainLayerGroup);
        this.app.stage.addChild(this.projectionMesh);
    } else {
        this.app.stage.removeChild(this.projectionMesh);
        this.app.stage.addChild(this.mainLayerGroup);
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

  handleResize() {
    if (!this.app.renderer) return;

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    
    if (this.renderTexture) {
        this.renderTexture.resize(w, h);
    }
    
    if (this.mainLayerGroup) {
        this.mainLayerGroup.filterArea = this.app.screen;
    }
    
    Object.values(this.layers).forEach(layer => {
      layer.deckA.resize(this.app.renderer);
      layer.deckB.resize(this.app.renderer);
    });
  }

  triggerVisualEffect(type, config = {}) {
    this.effectsManager.triggerOneShot(type, config, this.app.screen);
  }

  updateEffectConfig(name, param, value) {
    this.effectsManager.updateConfig(name, param, value);
  }

  update(ticker) {
    const now = performance.now();
    const deltaTime = ticker.deltaTime / 60; 

    if (this.app && this.app.screen && this.mainLayerGroup) {
        this.mainLayerGroup.filterArea = this.app.screen;
    }

    this.effectsManager.update(ticker, this.app.renderer);

    // --- FIX: Latch Logic for Hyperdrift ---
    // Instead of checking delta, we check boundaries to switch modes.
    if (this.crossfadeValue >= 0.999) {
        this.flythroughSequence = 'B->A'; // We are at B, next movement is back to A
    } else if (this.crossfadeValue <= 0.001) {
        this.flythroughSequence = 'A->B'; // We are at A, next movement is to B
    }
    
    this.lastCrossfadeValue = this.crossfadeValue;

    let currentBeatFactor = this.beatPulseEndTime > now ? this.beatPulseFactor : 1.0;
    this.renderedParallaxOffset.x += (this.parallaxOffset.x - this.renderedParallaxOffset.x) * 0.05;
    this.renderedParallaxOffset.y += (this.parallaxOffset.y - this.renderedParallaxOffset.y) * 0.05;

    Object.values(this.layers).forEach(layer => {
      const audioScale = this.audioFrequencyFactors[layer.deckA.layerId] || 1.0;
      const combinedBeatFactor = currentBeatFactor * audioScale;

      layer.deckA.stepPhysics(deltaTime, now);
      layer.deckB.stepPhysics(deltaTime, now);

      const stateA = layer.deckA.resolveRenderState();
      const stateB = layer.deckB.resolveRenderState();
      
      if (this.transitionMode === 'flythrough') {
          // --- FLY THROUGH MODE (Bi-Directional Forward Zoom) ---
          const t = this.crossfadeValue;
          const MAX_ZOOM = 60.0;
          
          let fadeStartZoom = 3.0; 
          let fadeEndZoom = 20.0; 
          
          if (layer.deckA.layerId === '1') { fadeStartZoom = 1.1; fadeEndZoom = 4.0; }
          else if (layer.deckA.layerId === '2') { fadeStartZoom = 1.5; fadeEndZoom = 8.0; }
          
          const SIDEWAYS_FORCE = -25000; 
          const VERTICAL_FORCE = -8000;  
          
          let scaleMultA, alphaMultA;
          let scaleMultB, alphaMultB;

          // LOGIC A->B: (Fader 0 -> 1)
          // Deck A is Exiting (Zooms out), Deck B is Entering (Zooms from 0)
          const applyForwardLogic = (progress) => {
              const easeOut = Math.pow(progress, 4); 
              
              // Exiting Deck (A)
              scaleMultA = 1.0 + (MAX_ZOOM - 1.0) * easeOut;
              stateA.driftX += easeOut * SIDEWAYS_FORCE;
              stateA.driftY += easeOut * VERTICAL_FORCE;
              
              if (scaleMultA > fadeStartZoom) {
                  const fadeProg = (scaleMultA - fadeStartZoom) / (fadeEndZoom - fadeStartZoom);
                  alphaMultA = Math.max(0, 1.0 - fadeProg);
              } else {
                  alphaMultA = 1.0;
              }

              // Entering Deck (B)
              scaleMultB = progress; 
              alphaMultB = Math.min(1.0, progress * 5.0); 

              // Order: B Behind A
              layer.container.setChildIndex(layer.deckB.container, 0); 
              layer.container.setChildIndex(layer.deckA.container, 1);
          };

          // LOGIC B->A: (Fader 1 -> 0)
          // Deck B is Exiting (Zooms out), Deck A is Entering (Zooms from 0)
          const applyReverseLogic = (progress) => {
              // progress here is (1-t), moving 0 -> 1 as fader moves 1 -> 0
              const easeOut = Math.pow(progress, 4); 

              // Exiting Deck (B)
              scaleMultB = 1.0 + (MAX_ZOOM - 1.0) * easeOut;
              stateB.driftX += easeOut * SIDEWAYS_FORCE;
              stateB.driftY += easeOut * VERTICAL_FORCE;

              if (scaleMultB > fadeStartZoom) {
                  const fadeProg = (scaleMultB - fadeStartZoom) / (fadeEndZoom - fadeStartZoom);
                  alphaMultB = Math.max(0, 1.0 - fadeProg);
              } else {
                  alphaMultB = 1.0;
              }

              // Entering Deck (A)
              scaleMultA = progress;
              alphaMultA = Math.min(1.0, progress * 5.0);

              // Order: A Behind B
              layer.container.setChildIndex(layer.deckA.container, 0);
              layer.container.setChildIndex(layer.deckB.container, 1);
          };

          // Use Latched Sequence to determine logic
          if (this.flythroughSequence === 'A->B') {
              applyForwardLogic(t);
          } else {
              applyReverseLogic(1.0 - t);
          }

          // Apply Scaling & State
          stateA.size = stateA.size * scaleMultA;
          stateB.size = stateB.size * scaleMultB;

          layer.deckA.applyRenderState(stateA, alphaMultA, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckA.layerId], this.app.screen);
          layer.deckB.applyRenderState(stateB, alphaMultB, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckB.layerId], this.app.screen);

      } else {
          // --- STANDARD CROSSFADE MODE ---
          const angle = this.crossfadeValue * 0.5 * Math.PI;
          const opacityA = Math.cos(angle);
          const opacityB = Math.sin(angle);
          
          const morphedState = {}; 
          for (let key in stateA) {
              if (key === 'angle') {
                  morphedState[key] = lerpAngle(stateA[key], stateB[key], this.crossfadeValue);
              } else if (key === 'totalAngleRad') {
                  continue; 
              } else if (typeof stateA[key] === 'number' && typeof stateB[key] === 'number') {
                  morphedState[key] = lerp(stateA[key], stateB[key], this.crossfadeValue);
              } else {
                  morphedState[key] = this.crossfadeValue < 0.5 ? stateA[key] : stateB[key];
              }
          }

          const currentContinuous = lerp(layer.deckA.continuousAngle, layer.deckB.continuousAngle, this.crossfadeValue);
          const totalAngleDeg = morphedState.angle + currentContinuous;
          morphedState.totalAngleRad = (totalAngleDeg * Math.PI) / 180;

          layer.deckA.applyRenderState(morphedState, opacityA, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckA.layerId], this.app.screen);
          layer.deckB.applyRenderState(morphedState, opacityB, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckB.layerId], this.app.screen);
      }
    });

    if (this.isMappingActive) {
        this.app.renderer.render({ container: this.mainLayerGroup, target: this.renderTexture });
    }
  }

  // --- API Proxies ---
  async setTexture(layerId, deckSide, imageSrc, tokenId) {
    if (!this.isReady || !this.layers[layerId]) return;
    const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    await deck.setTexture(imageSrc, tokenId);
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

  getState(layerId, deckSide) {
    if (!this.layers[layerId]) return null;
    const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    return deck.getState();
  }

  setCrossfade(val) { this.crossfadeValue = Math.max(0, Math.min(1, val)); }
  setAudioFactors(factors) { this.audioFrequencyFactors = { ...this.audioFrequencyFactors, ...factors }; }
  triggerBeatPulse(factor, duration) { this.beatPulseFactor = factor; this.beatPulseEndTime = performance.now() + duration; }
  setParallax(x, y) { this.parallaxOffset = { x, y }; }
  
  applyPlaybackValue(layerId, key, value) { 
      if (this.layers[layerId]) { 
          this.layers[layerId].deckA.playbackValues[key] = value; 
          this.layers[layerId].deckB.playbackValues[key] = value; 
      } 
  }
  clearPlaybackValues() { 
      Object.values(this.layers).forEach(l => { l.deckA.playbackValues = {}; l.deckB.playbackValues = {}; }); 
  }

  syncDeckPhysics(layerId, targetDeckSide) {
      const layer = this.layers[layerId];
      if (!layer) return;
      const target = targetDeckSide === 'A' ? layer.deckA : layer.deckB;
      const source = targetDeckSide === 'A' ? layer.deckB : layer.deckA;
      
      const normalizedAngle = ((source.continuousAngle % 360) + 360) % 360;
      source.continuousAngle = normalizedAngle;

      target.syncPhysicsFrom(source);
  }

  triggerVisualEffect(type, config) { this.effectsManager.triggerOneShot(type, config, this.app.screen); }
  updateEffectConfig(name, param, value) { this.effectsManager.updateConfig(name, param, value); }

  destroy() { 
      if (this.app) {
          if (import.meta.env.DEV) console.log("[PixiEngine] Destroying application instance.");
          this.app.destroy(true, { children: true, texture: false, baseTexture: false }); 
      }
      this.isReady = false; 
  }
}