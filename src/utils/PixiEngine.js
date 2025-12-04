// src/utils/PixiEngine.js
import { Application, Container, RenderTexture, Mesh, PlaneGeometry } from 'pixi.js';
import { PixiLayerDeck } from './pixi/PixiLayerDeck';
import { PixiEffectsManager } from './pixi/PixiEffectsManager';
import { lerp, lerpAngle } from './helpers';
import { useEngineStore } from '../store/useEngineStore'; 

export default class PixiEngine {
  constructor(canvasElement) {
    this.app = new Application();
    this.canvas = canvasElement;
    this.layers = {}; 
    this.layerList = []; 
    this.isReady = false;
    this.crossfadeValue = 0.0;
    this.effectsManager = new PixiEffectsManager();
    this.mainLayerGroup = new Container(); 
    this.audioFrequencyFactors = { '1': 1.0, '2': 1.0, '3': 1.0 };
    this.beatPulseFactor = 1.0;
    this.beatPulseEndTime = 0;
    this.latestAudioData = { level: 0, frequencyBands: { bass: 0, mid: 0, treble: 0 } };
    this.industrialConfig = { enabled: false, chaos: 0, mappings: {} };
    this.parallaxOffset = { x: 0, y: 0 };
    this.renderedParallaxOffset = { x: 0, y: 0 };
    this.parallaxFactors = { '1': 10, '2': 25, '3': 50 };
    this.isMappingActive = false;
    this.renderTexture = null;
    this.projectionMesh = null;
    this.transitionMode = 'crossfade'; 
    this.lastCrossfadeValue = 0.0;
    this.flythroughSequence = 'A->B'; 
    this._morphedState = {}; 
    this._resizeHandler = this.handleResize.bind(this);
  }

  async init() {
    if (this.isReady) return;
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
    this.effectsManager.init(this.app.screen);
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
    this.mainLayerGroup.filters = this.effectsManager.getFilterList();
    this.app.stage.addChild(this.mainLayerGroup);
    this.initMappingResources();
    this.app.renderer.on('resize', this._resizeHandler);
    this.handleResize(); 
    this.app.ticker.add((ticker) => this.update(ticker));
    const state = useEngineStore.getState();
    this.crossfadeValue = state.renderedCrossfader;
    this.isReady = true;
    if (import.meta.env.DEV) console.log("[PixiEngine] Initialized.");
  }

  setRenderedCrossfade(value) { this.crossfadeValue = value; }
  setTransitionMode(mode) { this.transitionMode = mode; }
  setAudioData(data) { this.latestAudioData = data; }

  setIndustrialConfig(config) {
      this.industrialConfig = config;
      if (!config.enabled) {
          this.effectsManager.updateDestructionMode(this.latestAudioData, config);
          this.mainLayerGroup.filters = this.effectsManager.getFilterList();
      }
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
    if (!this.app || !this.app.renderer) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (this.renderTexture) this.renderTexture.resize(w, h);
    if (this.mainLayerGroup) this.mainLayerGroup.filterArea = this.app.screen;
    for (let i = 0; i < this.layerList.length; i++) {
        const layer = this.layerList[i];
        layer.deckA.resize(this.app.renderer);
        layer.deckB.resize(this.app.renderer);
    }
  }

  triggerVisualEffect(type, config = {}) {
    this.effectsManager.triggerOneShot(type, config, this.app.screen);
    this.mainLayerGroup.filters = this.effectsManager.getFilterList();
  }

  updateEffectConfig(name, param, value) {
    this.effectsManager.updateConfig(name, param, value);
    this.mainLayerGroup.filters = this.effectsManager.getFilterList();
  }

  update(ticker) {
    const now = performance.now();
    const deltaTime = ticker.deltaTime * 0.01666;
    const state = useEngineStore.getState();
    this.transitionMode = state.transitionMode; 

    if (this.app && this.app.screen && this.mainLayerGroup) {
        this.mainLayerGroup.filterArea = this.app.screen;
    }

    if (this.industrialConfig.enabled) {
        this.effectsManager.updateDestructionMode(this.latestAudioData, this.industrialConfig);
        this.mainLayerGroup.filters = this.effectsManager.getFilterList();
    }

    this.effectsManager.update(ticker, this.app.renderer);

    // --- LOGIC: SCENE SHREDDER (Industrial Mode) ---
    // If enabled, we override the crossfader value based on audio bass
    let effectiveCrossfade = this.crossfadeValue;
    
    if (this.industrialConfig.enabled) {
        const shredMap = this.industrialConfig.mappings?.crossfaderShred;
        if (shredMap && shredMap.enabled && shredMap.amount > 0) {
            const bands = this.latestAudioData.frequencyBands;
            const sourceVal = shredMap.source === 'level' ? this.latestAudioData.level : (bands[shredMap.source] || 0);
            
            // If the audio hit is strong enough (kick), force a jump
            if (sourceVal * shredMap.amount > 0.6) {
                // If it's a kick, snap to 0 or 1 randomly or strobe between them
                // Using Math.sin(now) to create a strobe effect if held
                effectiveCrossfade = Math.sin(now * 0.05) > 0 ? 1.0 : 0.0;
            }
        }
    }

    // Update flythrough sequence based on effective value
    if (effectiveCrossfade >= 0.999) this.flythroughSequence = 'B->A';
    else if (effectiveCrossfade <= 0.001) this.flythroughSequence = 'A->B';
    
    this.lastCrossfadeValue = effectiveCrossfade;

    let currentBeatFactor = this.beatPulseEndTime > now ? this.beatPulseFactor : 1.0;
    
    this.renderedParallaxOffset.x += (this.parallaxOffset.x - this.renderedParallaxOffset.x) * 0.05;
    this.renderedParallaxOffset.y += (this.parallaxOffset.y - this.renderedParallaxOffset.y) * 0.05;

    for (let i = 0; i < this.layerList.length; i++) {
      const layer = this.layerList[i];
      const audioScale = this.audioFrequencyFactors[layer.deckA.layerId] || 1.0;
      const combinedBeatFactor = currentBeatFactor * audioScale;

      let renderA = true;
      let renderB = true;

      // Use effectiveCrossfade here
      if (this.transitionMode === 'crossfade') {
          if (effectiveCrossfade > 0.999) renderA = false;
          if (effectiveCrossfade < 0.001) renderB = false;
      }

      if (renderA) layer.deckA.stepPhysics(deltaTime, now);
      if (renderB) layer.deckB.stepPhysics(deltaTime, now);

      const stateA = renderA ? layer.deckA.resolveRenderState() : null;
      const stateB = renderB ? layer.deckB.resolveRenderState() : null;
      
      if (this.transitionMode === 'flythrough') {
          const t = effectiveCrossfade;
          let scaleMultA, alphaMultA;
          let scaleMultB, alphaMultB;
          const SIDEWAYS_FORCE = -25000; 
          const VERTICAL_FORCE = -8000;

          if (this.flythroughSequence === 'A->B') {
              const easeOut = t * t * t * t; 
              if (renderA) {
                  scaleMultA = 1.0 + (59.0) * easeOut; 
                  stateA.driftX += easeOut * SIDEWAYS_FORCE;
                  stateA.driftY += easeOut * VERTICAL_FORCE;
                  const fadeStartZoom = layer.deckA.layerId === '1' ? 1.1 : (layer.deckA.layerId === '2' ? 1.5 : 3.0);
                  const fadeEndZoom = layer.deckA.layerId === '1' ? 4.0 : (layer.deckA.layerId === '2' ? 8.0 : 20.0);
                  if (scaleMultA > fadeStartZoom) {
                      const fadeProg = (scaleMultA - fadeStartZoom) / (fadeEndZoom - fadeStartZoom);
                      alphaMultA = 1.0 - fadeProg;
                      if (alphaMultA < 0) alphaMultA = 0;
                  } else { alphaMultA = 1.0; }
                  stateA.size = stateA.size * scaleMultA;
                  layer.deckA.applyRenderState(stateA, alphaMultA, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckA.layerId], this.app.screen);
              } else { layer.deckA.container.visible = false; }

              if (renderB) {
                  scaleMultB = t; 
                  alphaMultB = t * 5.0;
                  if (alphaMultB > 1.0) alphaMultB = 1.0;
                  stateB.size = stateB.size * scaleMultB;
                  layer.deckB.applyRenderState(stateB, alphaMultB, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckB.layerId], this.app.screen);
              } else { layer.deckB.container.visible = false; }
              layer.container.setChildIndex(layer.deckB.container, 0); 
              layer.container.setChildIndex(layer.deckA.container, 1);
          } else {
              const rt = 1.0 - t;
              const easeOut = rt * rt * rt * rt;
              if (renderB) {
                  scaleMultB = 1.0 + (59.0) * easeOut;
                  stateB.driftX += easeOut * SIDEWAYS_FORCE;
                  stateB.driftY += easeOut * VERTICAL_FORCE;
                  const fadeStartZoom = layer.deckA.layerId === '1' ? 1.1 : (layer.deckA.layerId === '2' ? 1.5 : 3.0);
                  const fadeEndZoom = layer.deckA.layerId === '1' ? 4.0 : (layer.deckA.layerId === '2' ? 8.0 : 20.0);
                  if (scaleMultB > fadeStartZoom) {
                      const fadeProg = (scaleMultB - fadeStartZoom) / (fadeEndZoom - fadeStartZoom);
                      alphaMultB = 1.0 - fadeProg;
                      if (alphaMultB < 0) alphaMultB = 0;
                  } else { alphaMultB = 1.0; }
                  stateB.size = stateB.size * scaleMultB;
                  layer.deckB.applyRenderState(stateB, alphaMultB, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckB.layerId], this.app.screen);
              } else { layer.deckB.container.visible = false; }

              if (renderA) {
                  scaleMultA = rt;
                  alphaMultA = rt * 5.0;
                  if (alphaMultA > 1.0) alphaMultA = 1.0;
                  stateA.size = stateA.size * scaleMultA;
                  layer.deckA.applyRenderState(stateA, alphaMultA, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckA.layerId], this.app.screen);
              } else { layer.deckA.container.visible = false; }
              layer.container.setChildIndex(layer.deckA.container, 0);
              layer.container.setChildIndex(layer.deckB.container, 1);
          }
      } else {
          const angle = effectiveCrossfade * 1.570796; 
          const opacityA = Math.cos(angle);
          const opacityB = Math.sin(angle);
          
          if (renderA && renderB) {
              const ms = this._morphedState;
              ms.speed = effectiveCrossfade < 0.5 ? stateA.speed : stateB.speed;
              ms.size = lerp(stateA.size, stateB.size, effectiveCrossfade);
              ms.opacity = lerp(stateA.opacity, stateB.opacity, effectiveCrossfade);
              ms.drift = lerp(stateA.drift, stateB.drift, effectiveCrossfade);
              ms.driftSpeed = lerp(stateA.driftSpeed, stateB.driftSpeed, effectiveCrossfade);
              ms.xaxis = lerp(stateA.xaxis, stateB.xaxis, effectiveCrossfade);
              ms.yaxis = lerp(stateA.yaxis, stateB.yaxis, effectiveCrossfade);
              ms.angle = lerpAngle(stateA.angle, stateB.angle, effectiveCrossfade);
              ms.direction = effectiveCrossfade < 0.5 ? stateA.direction : stateB.direction;
              ms.blendMode = effectiveCrossfade < 0.5 ? stateA.blendMode : stateB.blendMode;
              ms.enabled = effectiveCrossfade < 0.5 ? stateA.enabled : stateB.enabled;
              ms.driftX = lerp(stateA.driftX, stateB.driftX, effectiveCrossfade);
              ms.driftY = lerp(stateA.driftY, stateB.driftY, effectiveCrossfade);
              const currentContinuous = lerp(layer.deckA.continuousAngle, layer.deckB.continuousAngle, effectiveCrossfade);
              const totalAngleDeg = ms.angle + currentContinuous;
              ms.totalAngleRad = (totalAngleDeg * 0.01745329251);
              layer.deckA.applyRenderState(ms, opacityA, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckA.layerId], this.app.screen);
              layer.deckB.applyRenderState(ms, opacityB, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckB.layerId], this.app.screen);
          } else {
              if (renderA) { layer.deckA.applyRenderState(stateA, opacityA, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckA.layerId], this.app.screen); } 
              else { layer.deckA.container.visible = false; }
              if (renderB) { layer.deckB.applyRenderState(stateB, opacityB, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckB.layerId], this.app.screen); } 
              else { layer.deckB.container.visible = false; }
          }
      }
    }
    if (this.isMappingActive) {
        this.app.renderer.render({ container: this.mainLayerGroup, target: this.renderTexture });
    }
  }

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
      for (let i=0; i<this.layerList.length; i++) {
          const l = this.layerList[i];
          l.deckA.playbackValues = {};
          l.deckB.playbackValues = {};
      }
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
  destroy() { 
      if (this.app) {
          if (this.app.renderer) { this.app.renderer.off('resize', this._resizeHandler); }
          if (import.meta.env.DEV) console.log("[PixiEngine] Destroying application instance.");
          this.app.destroy(true, { children: true, texture: false, baseTexture: false }); 
      }
      this.isReady = false; 
  }
}