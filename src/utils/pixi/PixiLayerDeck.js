// src/utils/pixi/PixiLayerDeck.js
import { Container, Sprite, Texture, Graphics } from 'pixi.js';
import ValueInterpolator from '../ValueInterpolator';
import { sliderParams } from '../../config/sliderParams';
import { getDecodedImage } from '../imageDecoder';
import { MAX_TOTAL_OFFSET, MIDI_INTERPOLATION_DURATION, BLEND_MODE_MAP } from './PixiConstants';

// --- SCALE FIX ---
const BASE_SCALE_MODIFIER = 0.5;

class Quadrant {
  constructor(container) {
    this.container = new Container();
    this.mask = new Graphics();
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.container.mask = this.mask;
    this.container.addChild(this.mask);
    this.container.addChild(this.sprite);
    container.addChild(this.container);
  }

  updateMask(x, y, w, h) {
    this.mask.clear();
    this.mask.rect(x, y, w, h);
    this.mask.fill({ color: 0xffffff });
  }

  setTexture(texture) {
    this.sprite.texture = texture;
  }
}

export class PixiLayerDeck {
  constructor(layerId, deckId) {
    this.layerId = layerId;
    this.deckId = deckId;
    this.container = new Container();
    
    this.quadrants = [
      new Quadrant(this.container), 
      new Quadrant(this.container), 
      new Quadrant(this.container), 
      new Quadrant(this.container)  
    ];
    
    this.config = this.getDefaultConfig();
    this.driftState = { x: 0, y: 0, phase: Math.random() * Math.PI * 2 };
    this.continuousAngle = 0;
    
    this.interpolators = {};
    this.playbackValues = {}; 
    this.tokenId = null;
    this._loadingTokenId = null;

    // --- MEMORY OPTIMIZATION: Object Pooling ---
    // We allocate this ONCE. We never create a new object during the render loop.
    this._reusableRenderState = {
        speed: 0, size: 1, opacity: 1, drift: 0, driftSpeed: 0,
        xaxis: 0, yaxis: 0, angle: 0, direction: 1,
        blendMode: 'normal', enabled: true,
        totalAngleRad: 0, driftX: 0, driftY: 0
    };

    sliderParams.forEach(param => {
      if (typeof this.config[param.prop] === 'number') {
        this.interpolators[param.prop] = new ValueInterpolator(this.config[param.prop], MIDI_INTERPOLATION_DURATION);
      }
    });
  }

  getDefaultConfig() {
    const defaultConfig = {};
    sliderParams.forEach(p => {
      defaultConfig[p.prop] = p.defaultValue ?? (p.min + p.max) / 2;
      if (p.prop === 'speed') defaultConfig[p.prop] = 0.01;
      if (p.prop === 'size') defaultConfig[p.prop] = 1.0;
    });
    defaultConfig.enabled = true;
    defaultConfig.blendMode = 'normal';
    defaultConfig.direction = 1;
    return defaultConfig;
  }

  syncPhysicsFrom(otherDeck) {
    if (!otherDeck) return;
    this.continuousAngle = otherDeck.continuousAngle;
    this.driftState.x = otherDeck.driftState.x;
    this.driftState.y = otherDeck.driftState.y;
    this.driftState.phase = otherDeck.driftState.phase;
    
    Object.keys(this.interpolators).forEach(key => {
        if (otherDeck.interpolators[key]) {
            // Primitive copy only
            this.interpolators[key].currentValue = otherDeck.interpolators[key].currentValue;
            this.interpolators[key].startValue = otherDeck.interpolators[key].currentValue;
            this.interpolators[key].targetValue = otherDeck.interpolators[key].targetValue;
            this.interpolators[key].isInterpolating = otherDeck.interpolators[key].isInterpolating;
        }
    });
  }

  async setTexture(imageSrc, tokenId) {
    if (this.tokenId === tokenId) return;
    this._loadingTokenId = tokenId;
    if (!imageSrc) {
        this.tokenId = tokenId;
        this.quadrants.forEach(q => q.setTexture(Texture.EMPTY));
        return;
    }
    try {
      const imageBitmap = await getDecodedImage(imageSrc);
      if (this._loadingTokenId === tokenId) {
          this.tokenId = tokenId;
          const texture = Texture.from(imageBitmap);
          this.quadrants.forEach(q => q.setTexture(texture));
      }
    } catch (e) { 
        console.warn(`[PixiLayerDeck] Failed texture load for ${tokenId}`);
    }
  }

  updateConfig(key, value) {
    this.config[key] = value;
    if (this.interpolators[key]) {
        this.interpolators[key].setTarget(value);
    }
  }

  // Optimized method for direct property updates (no object allocation)
  setProperty(key, value) {
    this.config[key] = value; 
    if (this.interpolators[key]) {
        this.interpolators[key].snap(value);
    }
  }

  snapConfig(fullConfig) {
    // We iterate manually to avoid creating a new object with spread {...}
    for (const key in fullConfig) {
        this.config[key] = fullConfig[key];
        if (this.interpolators[key]) {
            this.interpolators[key].snap(fullConfig[key]);
        }
    }
  }

  getState() {
    // Only used for saving/snapshots, so allocation here is fine
    return { 
        config: {...this.config}, 
        driftState: {...this.driftState}, 
        continuousRotationAngle: this.continuousAngle, 
        playbackValues: {...this.playbackValues} 
    };
  }

  stepPhysics(deltaTime, now) {
    // Avoid Object.values allocation
    for (const key in this.interpolators) {
        this.interpolators[key].update(now);
    }
    
    // Inline access helper to avoid closure allocation
    // getVal(prop) => this.playbackValues[prop] ?? this.interpolators[prop].getCurrentValue();
    
    const getVal = (k) => (this.playbackValues[k] !== undefined ? this.playbackValues[k] : this.interpolators[k].currentValue);
    
    const speed = getVal('speed');
    const direction = this.config.direction || 1;
    const drift = getVal('drift');
    const driftSpeed = getVal('driftSpeed');

    this.continuousAngle += (speed * direction * deltaTime * 600);

    if (drift > 0) {
        this.driftState.phase += deltaTime * driftSpeed * 1.0;
        // Optimized math
        const xVal = Math.sin(this.driftState.phase) * drift * 1.5;
        const yVal = Math.cos(this.driftState.phase * 0.7 + 0.785398) * drift * 1.5; // 0.785398 = PI/4
        
        // Clamp without creating new Math objects
        this.driftState.x = xVal < -MAX_TOTAL_OFFSET ? -MAX_TOTAL_OFFSET : (xVal > MAX_TOTAL_OFFSET ? MAX_TOTAL_OFFSET : xVal);
        this.driftState.y = yVal < -MAX_TOTAL_OFFSET ? -MAX_TOTAL_OFFSET : (yVal > MAX_TOTAL_OFFSET ? MAX_TOTAL_OFFSET : yVal);
    } else {
        this.driftState.x *= 0.95; 
        this.driftState.y *= 0.95;
    }
  }

  resolveRenderState() {
    // --- ZERO ALLOCATION: Reuse the existing object ---
    const s = this._reusableRenderState;
    const getVal = (k) => (this.playbackValues[k] !== undefined ? this.playbackValues[k] : this.interpolators[k].currentValue);

    const angle = getVal('angle');
    
    s.speed = getVal('speed');
    s.size = getVal('size');
    s.opacity = getVal('opacity');
    s.drift = getVal('drift');
    s.driftSpeed = getVal('driftSpeed');
    s.xaxis = getVal('xaxis');
    s.yaxis = getVal('yaxis');
    s.angle = angle;
    s.direction = this.config.direction || 1;
    s.blendMode = this.config.blendMode;
    s.enabled = this.config.enabled;
    s.driftX = this.driftState.x;
    s.driftY = this.driftState.y;
    
    // Pre-calculate radians here
    const totalAngleDeg = angle + this.continuousAngle;
    s.totalAngleRad = (totalAngleDeg * 0.01745329251); // PI / 180 constant

    return s;
  }

  applyRenderState(state, alphaMult, beatFactor, parallaxOffset, parallaxFactor, screen) {
    if (alphaMult <= 0.001 || !state.enabled || !this.tokenId) { 
        this.container.visible = false; 
        return; 
    }
    this.container.visible = true;

    const screenW = screen.width; 
    const screenH = screen.height;
    const halfW = screenW * 0.5; 
    const halfH = screenH * 0.5;
    
    const pX = parallaxOffset.x * parallaxFactor;
    const pY = parallaxOffset.y * parallaxFactor;
    
    const targetX = halfW + (state.xaxis * 0.1) + state.driftX + pX;
    const targetY = halfH + (state.yaxis * 0.1) + state.driftY + pY;
    
    // Access sprite texture directly
    const tex = this.quadrants[0].sprite.texture;
    let screenRelativeScale = 1.0;
    
    if (tex && tex.valid && tex.width > 1) {
        const fitWidth = halfW / tex.width;
        const fitHeight = halfH / tex.height;
        screenRelativeScale = (fitWidth < fitHeight) ? fitWidth : fitHeight;
    }
    
    let finalScale = state.size * screenRelativeScale * beatFactor * BASE_SCALE_MODIFIER;
    if (finalScale < 0.001) finalScale = 0.001;

    const finalAlpha = state.opacity * alphaMult;
    const blend = BLEND_MODE_MAP[state.blendMode] || 'normal';
    const rad = state.totalAngleRad;

    // Unroll the loop manually for performance
    this._updateQuadrant(this.quadrants[0], targetX, targetY, finalScale, finalScale, rad, finalAlpha, blend);
    this._updateQuadrant(this.quadrants[1], screenW - targetX, targetY, -finalScale, finalScale, -rad, finalAlpha, blend);
    this._updateQuadrant(this.quadrants[2], targetX, screenH - targetY, finalScale, -finalScale, -rad, finalAlpha, blend);
    this._updateQuadrant(this.quadrants[3], screenW - targetX, screenH - targetY, -finalScale, -finalScale, rad, finalAlpha, blend);
  }

  _updateQuadrant(quad, x, y, sx, sy, rot, alpha, blend) {
    // Direct property access is slightly faster than .set()
    quad.sprite.position.x = x;
    quad.sprite.position.y = y;
    quad.sprite.scale.x = sx;
    quad.sprite.scale.y = sy;
    quad.sprite.rotation = rot;
    quad.sprite.alpha = alpha;
    
    // Only update blendMode if it changed (avoids PIXI internal state thrashing)
    if (quad.container.blendMode !== blend) {
        quad.container.blendMode = blend;
    }
  }

  resize(renderer) {
    const w = renderer.screen.width;
    const h = renderer.screen.height;
    // Use bitwise floor for speed
    const hw = (w * 0.5) | 0; 
    const hh = (h * 0.5) | 0;
    
    this.quadrants[0].updateMask(0, 0, hw, hh);
    this.quadrants[1].updateMask(hw, 0, w - hw, hh);
    this.quadrants[2].updateMask(0, hh, hw, h - hh);
    this.quadrants[3].updateMask(hw, hh, w - hw, h - hh);
  }
}