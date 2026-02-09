// src/utils/pixi/PixiLayerDeck.js
import { Container, Sprite, Texture } from 'pixi.js';
import ValueInterpolator from '../ValueInterpolator';
import { sliderParams } from '../../config/sliderParams';
import { getDecodedImage } from '../imageDecoder';
import { MAX_TOTAL_OFFSET, BLEND_MODE_MAP } from './PixiConstants';

const BASE_SCALE_MODIFIER = 0.5;
// DEFAULT_SMOOTHING: 0.9 is your preferred responsiveness for MIDI.
const DEFAULT_SMOOTHING = 0.9;

class Quadrant {
  constructor(container) {
    this.container = new Container();
    this.maskSprite = new Sprite(Texture.WHITE);
    this.sprite = new Sprite(Texture.EMPTY);
    this.sprite.anchor.set(0.5);
    this.container.mask = this.maskSprite;
    this.container.addChild(this.maskSprite);
    this.container.addChild(this.sprite);
    container.addChild(this.container);
  }

  updateMask(x, y, w, h) {
    this.maskSprite.x = x;
    this.maskSprite.y = y;
    this.maskSprite.width = w;
    this.maskSprite.height = h;
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
    
    this.interpolators = {};
    this.playbackValues = {}; 
    this.modulatedValues = {}; 

    this.tokenId = null;
    this.currentTexture = null; 
    this._loadingTokenId = null;

    sliderParams.forEach(param => {
      const startVal = this.config[param.prop] || 0;
      this.interpolators[param.prop] = new ValueInterpolator(startVal, DEFAULT_SMOOTHING);
    });
  }

  getDefaultConfig() {
    const defaultConfig = {};
    sliderParams.forEach(p => {
      defaultConfig[p.prop] = p.defaultValue ?? (p.min + p.max) / 2;
    });
    defaultConfig.enabled = true;
    defaultConfig.blendMode = 'normal';
    defaultConfig.direction = 1;
    return defaultConfig;
  }

  /**
   * Resets all parameters to their default values.
   */
  resetToDefaults() {
    const defaults = this.getDefaultConfig();
    this.config = { ...defaults };
    for (const key in this.interpolators) {
        if (defaults[key] !== undefined) {
            this.interpolators[key].snap(defaults[key]);
        }
    }
  }

  setModulatedValues(values) {
      this.modulatedValues = values;
  }

  syncPhysicsFrom(otherDeck) {
    if (!otherDeck) return;
    Object.keys(this.interpolators).forEach(key => {
        if (otherDeck.interpolators[key]) {
            this.interpolators[key].snap(otherDeck.interpolators[key].currentValue);
        }
    });
    this.playbackValues = { ...otherDeck.playbackValues };
  }

  async setTexture(imageSrc, tokenId) {
    if (this.tokenId === tokenId) return;
    this._loadingTokenId = tokenId;
    
    if (!imageSrc) {
        this.tokenId = tokenId;
        this.quadrants.forEach(q => q.setTexture(Texture.EMPTY));
        if (this.currentTexture) { 
            this.currentTexture.destroy(false); 
            this.currentTexture = null; 
        }
        return;
    }

    try {
      const imageBitmap = await getDecodedImage(imageSrc);
      if (this._loadingTokenId === tokenId) {
          if (this.currentTexture) { this.currentTexture.destroy(false); }
          this.tokenId = tokenId;
          const texture = Texture.from(imageBitmap);
          this.currentTexture = texture;
          this.quadrants.forEach(q => q.setTexture(texture));
      }
    } catch (e) { 
        if (this._loadingTokenId === tokenId) {
            this.quadrants.forEach(q => q.setTexture(Texture.EMPTY));
            if (this.currentTexture) { 
                this.currentTexture.destroy(false); 
                this.currentTexture = null; 
            }
        }
    }
  }

  /**
   * updateConfig: Direct parameter updates (MIDI/Mouse).
   * @param {boolean} isManual - If true (Mouse/Slider), we snap. If false (MIDI), we Glide.
   */
  updateConfig(key, value, isManual = false) {
    this.config[key] = value;
    if (this.interpolators[key]) {
        if (isManual) {
            this.interpolators[key].snap(value);
        } else {
            this.interpolators[key].setTarget(value);
        }
    }
  }

  /**
   * snapConfig: Synchronizes the GPU deck with the React Store.
   * @param {boolean} forceSnap - If true (Scene Load), reset deck to clean slate and jump instantly.
   */
  snapConfig(fullConfig, forceSnap = false) {
    // 1. Scene Load Logic: Wipe to defaults so missing JSON keys don't "stick"
    if (forceSnap) {
        this.resetToDefaults();
    }

    // 2. Apply config
    for (const key in fullConfig) {
        const newValue = fullConfig[key];
        this.config[key] = newValue;

        if (this.interpolators[key]) {
            if (forceSnap) {
                // HARD JUMP: Used for scene changes
                this.interpolators[key].snap(newValue);
            } else {
                // SOFT TARGET: Used for store sync to keep MIDI gliding smooth
                this.interpolators[key].setTarget(newValue);
            }
        }
    }
  }

  stepPhysics(deltaTime) {
    for (const key in this.interpolators) {
        this.interpolators[key].update(deltaTime);
    }
  }

  resolveRenderState() {
    const getVal = (k) => {
        if (this.playbackValues[k] !== undefined) return this.playbackValues[k];
        const base = this.interpolators[k] ? this.interpolators[k].currentValue : (this.config[k] ?? 0);
        const mod = this.modulatedValues[k] !== undefined ? this.modulatedValues[k] : 0;
        return base + mod;
    };
    
    return {
        speed: getVal('speed'),
        size: getVal('size'),
        opacity: getVal('opacity'),
        drift: getVal('drift'),
        driftSpeed: getVal('driftSpeed'),
        xaxis: getVal('xaxis'),
        yaxis: getVal('yaxis'),
        angle: getVal('angle'),
        direction: this.config.direction ?? 1,
        blendMode: this.config.blendMode || 'normal',
        enabled: this.config.enabled ?? true
    };
  }

  applyRenderState(state, physicsData, alphaMult, beatFactor, parallaxOffset, parallaxFactor, screen) {
    if (alphaMult <= 0.001 || !state.enabled || !this.tokenId) { 
        this.container.visible = false; 
        return; 
    }
    
    this.container.visible = true;
    const screenW = screen.width; 
    const screenH = screen.height;
    const halfW = screenW * 0.5; 
    const halfH = screenH * 0.5;

    const targetX = halfW + (state.xaxis * 0.1) + physicsData.driftX + (parallaxOffset.x * parallaxFactor);
    const targetY = halfH + (state.yaxis * 0.1) + physicsData.driftY + (parallaxOffset.y * parallaxFactor);

    const tex = this.quadrants[0].sprite.texture;
    let screenRelativeScale = 1.0;
    if (tex && tex.valid && tex.width > 1) {
        const fitWidth = halfW / tex.width; 
        const fitHeight = halfH / tex.height;
        screenRelativeScale = (fitWidth < fitHeight) ? fitWidth : fitHeight;
    }

    let finalScale = state.size * screenRelativeScale * beatFactor * BASE_SCALE_MODIFIER;
    const finalAlpha = Math.max(0, Math.min(1, state.opacity * alphaMult));
    const blend = BLEND_MODE_MAP[state.blendMode] || 'normal';

    const rad = (state.angle + physicsData.continuousAngle) * 0.01745329251;

    this._updateQuadrant(this.quadrants[0], targetX, targetY, finalScale, finalScale, rad, finalAlpha, blend);
    this._updateQuadrant(this.quadrants[1], screenW - targetX, targetY, -finalScale, finalScale, -rad, finalAlpha, blend);
    this._updateQuadrant(this.quadrants[2], targetX, screenH - targetY, finalScale, -finalScale, -rad, finalAlpha, blend);
    this._updateQuadrant(this.quadrants[3], screenW - targetX, screenH - targetY, -finalScale, -finalScale, rad, finalAlpha, blend);
  }

  _updateQuadrant(quad, x, y, sx, sy, rot, alpha, blend) {
    quad.sprite.position.set(x, y);
    quad.sprite.scale.set(sx, sy);
    quad.sprite.rotation = rot;
    quad.sprite.alpha = alpha;
    if (quad.container.blendMode !== blend) {
        quad.container.blendMode = blend;
    }
  }

  resize(renderer) {
    // FIX: Removed bitwise floor (| 0) to allow sub-pixel precision on odd-width screens/projectors
    const hw = renderer.screen.width * 0.5; 
    const hh = renderer.screen.height * 0.5;
    
    this.quadrants[0].updateMask(0, 0, hw, hh);
    this.quadrants[1].updateMask(hw, 0, renderer.screen.width - hw, hh);
    this.quadrants[2].updateMask(0, hh, hw, renderer.screen.height - hh);
    this.quadrants[3].updateMask(hw, hh, renderer.screen.width - hw, renderer.screen.height - hh);
  }
}