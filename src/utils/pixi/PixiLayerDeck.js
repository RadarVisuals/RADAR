// src/utils/pixi/PixiLayerDeck.js
import { Container, Sprite, Texture, Graphics } from 'pixi.js';
import ValueInterpolator from '../ValueInterpolator';
import { sliderParams } from '../../config/sliderParams';
import { getDecodedImage } from '../imageDecoder';
import { MAX_TOTAL_OFFSET, MIDI_INTERPOLATION_DURATION, BLEND_MODE_MAP } from './PixiConstants';

const BASE_SCALE_MODIFIER = 0.5;

class Quadrant {
  constructor(container) {
    this.container = new Container();
    this.mask = new Graphics();
    this.sprite = new Sprite(Texture.EMPTY);
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
    this.sprite.texture = texture || Texture.EMPTY;
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
    this.modulatedValues = {}; 

    this.tokenId = null;
    this._loadingTokenId = null;

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

  setModulatedValues(values) {
      this.modulatedValues = values;
  }

  syncPhysicsFrom(otherDeck) {
    if (!otherDeck) return;
    this.continuousAngle = otherDeck.continuousAngle;
    this.driftState.x = otherDeck.driftState.x;
    this.driftState.y = otherDeck.driftState.y;
    this.driftState.phase = otherDeck.driftState.phase;
    
    this.playbackValues = { ...otherDeck.playbackValues };
    
    Object.keys(this.interpolators).forEach(key => {
        if (otherDeck.interpolators[key]) {
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
        if (this._loadingTokenId === tokenId) {
            this.quadrants.forEach(q => q.setTexture(Texture.EMPTY));
        }
    }
  }

  updateConfig(key, value) {
    this.config[key] = value;
    if (this.interpolators[key]) {
        this.interpolators[key].setTarget(value);
    }
  }

  setProperty(key, value) {
    this.config[key] = value; 
    if (this.interpolators[key]) {
        this.interpolators[key].snap(value);
    }
  }

  snapConfig(fullConfig) {
    for (const key in fullConfig) {
        this.config[key] = fullConfig[key];
        if (this.interpolators[key]) {
            this.interpolators[key].snap(fullConfig[key]);
        }
    }
  }

  getState() {
    return { 
        config: {...this.config}, 
        driftState: {...this.driftState}, 
        continuousRotationAngle: this.continuousAngle, 
        playbackValues: {...this.playbackValues} 
    };
  }

  stepPhysics(deltaTime, now) {
    for (const key in this.interpolators) {
        this.interpolators[key].update(now);
    }
    
    // --- FIXED PRIORITY LOGIC ---
    // 1. Playback Value (Absolute Override from P-Lock)
    //    OR
    // 2. Base Config (Interpolated) + Modulation (Additive Offset)
    
    const getVal = (k) => {
        // P-Lock overrides everything if active
        if (this.playbackValues[k] !== undefined) return this.playbackValues[k];
        
        // Otherwise: Base + Modulation
        const base = this.interpolators[k] ? this.interpolators[k].currentValue : this.config[k];
        const mod = this.modulatedValues[k] !== undefined ? this.modulatedValues[k] : 0;
        
        return base + mod;
    };
    
    const speed = getVal('speed');
    const direction = getVal('direction') ?? 1; 
    const drift = getVal('drift');
    const driftSpeed = getVal('driftSpeed');

    this.continuousAngle += (speed * direction * deltaTime * 600);

    if (drift > 0) {
        this.driftState.phase += deltaTime * driftSpeed * 1.0;
        const xVal = Math.sin(this.driftState.phase) * drift * 1.5;
        const yVal = Math.cos(this.driftState.phase * 0.7 + 0.785398) * drift * 1.5; 
        
        this.driftState.x = xVal < -MAX_TOTAL_OFFSET ? -MAX_TOTAL_OFFSET : (xVal > MAX_TOTAL_OFFSET ? MAX_TOTAL_OFFSET : xVal);
        this.driftState.y = yVal < -MAX_TOTAL_OFFSET ? -MAX_TOTAL_OFFSET : (yVal > MAX_TOTAL_OFFSET ? MAX_TOTAL_OFFSET : yVal);
    } else {
        this.driftState.x *= 0.95; 
        this.driftState.y *= 0.95;
    }
  }

  resolveRenderState() {
    const s = this._reusableRenderState;
    
    // --- FIXED RESOLUTION LOGIC ---
    const getVal = (k) => {
        // 1. P-Lock Override
        if (this.playbackValues[k] !== undefined) return this.playbackValues[k];
        
        // 2. Base + Modulation
        const base = this.interpolators[k] ? this.interpolators[k].currentValue : this.config[k];
        const mod = this.modulatedValues[k] !== undefined ? this.modulatedValues[k] : 0;
        
        return base + mod;
    };

    const angle = getVal('angle');
    
    s.speed = getVal('speed');
    s.size = getVal('size');
    s.opacity = getVal('opacity');
    s.drift = getVal('drift');
    s.driftSpeed = getVal('driftSpeed');
    s.xaxis = getVal('xaxis');
    s.yaxis = getVal('yaxis');
    s.angle = angle;
    
    // Non-numeric props don't get modulation offsets, usually just overrides
    s.direction = getVal('direction') ?? 1;
    s.blendMode = getVal('blendMode');
    s.enabled = getVal('enabled');

    s.driftX = this.driftState.x;
    s.driftY = this.driftState.y;
    
    const totalAngleDeg = angle + this.continuousAngle;
    s.totalAngleRad = (totalAngleDeg * 0.01745329251); 

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
    
    const tex = this.quadrants[0].sprite.texture;
    let screenRelativeScale = 1.0;
    
    if (tex && tex.valid && tex.width > 1) {
        const fitWidth = halfW / tex.width;
        const fitHeight = halfH / tex.height;
        screenRelativeScale = (fitWidth < fitHeight) ? fitWidth : fitHeight;
    }
    
    let finalScale = state.size * screenRelativeScale * beatFactor * BASE_SCALE_MODIFIER;
    if (finalScale < 0.001) finalScale = 0.001;

    // Clamp opacity to 0-1 range to prevent visual artifacts
    const finalAlpha = Math.max(0, Math.min(1, state.opacity * alphaMult));
    
    const blend = BLEND_MODE_MAP[state.blendMode] || 'normal';
    const rad = state.totalAngleRad;

    this._updateQuadrant(this.quadrants[0], targetX, targetY, finalScale, finalScale, rad, finalAlpha, blend);
    this._updateQuadrant(this.quadrants[1], screenW - targetX, targetY, -finalScale, finalScale, -rad, finalAlpha, blend);
    this._updateQuadrant(this.quadrants[2], targetX, screenH - targetY, finalScale, -finalScale, -rad, finalAlpha, blend);
    this._updateQuadrant(this.quadrants[3], screenW - targetX, screenH - targetY, -finalScale, -finalScale, rad, finalAlpha, blend);
  }

  _updateQuadrant(quad, x, y, sx, sy, rot, alpha, blend) {
    quad.sprite.position.x = x;
    quad.sprite.position.y = y;
    quad.sprite.scale.x = sx;
    quad.sprite.scale.y = sy;
    quad.sprite.rotation = rot;
    quad.sprite.alpha = alpha;
    
    if (quad.container.blendMode !== blend) {
        quad.container.blendMode = blend;
    }
  }

  resize(renderer) {
    const w = renderer.screen.width;
    const h = renderer.screen.height;
    const hw = (w * 0.5) | 0; 
    const hh = (h * 0.5) | 0;
    
    this.quadrants[0].updateMask(0, 0, hw, hh);
    this.quadrants[1].updateMask(hw, 0, w - hw, hh);
    this.quadrants[2].updateMask(0, hh, hw, h - hh);
    this.quadrants[3].updateMask(hw, hh, w - hw, h - hh);
  }
}