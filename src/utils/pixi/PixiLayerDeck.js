// src/utils/pixi/PixiLayerDeck.js
import { Container, Sprite, Texture, Graphics } from 'pixi.js';
import ValueInterpolator from '../ValueInterpolator';
import { sliderParams } from '../../config/sliderParams';
import { getDecodedImage } from '../imageDecoder';
import { MAX_TOTAL_OFFSET, MIDI_INTERPOLATION_DURATION, BLEND_MODE_MAP } from './PixiConstants';

// --- SCALE FIX ---
// 0.5 reduces the base calculation by half. 
// This makes 'Size: 2.5' behave more like 'Size: 1.25' relative to the screen,
// restoring the "Kaleidoscope" look instead of the "Macro Zoom" look.
const BASE_SCALE_MODIFIER = 0.5;

class Quadrant {
  constructor(container) {
    this.container = new Container();
    this.mask = new Graphics();
    this.sprite = new Sprite();
    
    // Center anchor so scaling/rotation happens from the middle of the sprite
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
      new Quadrant(this.container), // Top-Left
      new Quadrant(this.container), // Top-Right
      new Quadrant(this.container), // Bottom-Left
      new Quadrant(this.container)  // Bottom-Right
    ];
    
    this.config = this.getDefaultConfig();
    
    this.driftState = { x: 0, y: 0, phase: Math.random() * Math.PI * 2 };
    this.continuousAngle = 0;
    
    this.interpolators = {};
    this.playbackValues = {}; 
    
    this.tokenId = null;
    this._loadingTokenId = null;

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
    this.driftState = { ...otherDeck.driftState };
    
    Object.keys(this.interpolators).forEach(key => {
        if (otherDeck.interpolators[key]) {
            this.interpolators[key].currentValue = otherDeck.interpolators[key].currentValue;
            this.interpolators[key].startValue = otherDeck.interpolators[key].currentValue;
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

  snapConfig(fullConfig) {
    this.config = { ...this.config, ...fullConfig };
    Object.keys(this.interpolators).forEach(key => { 
        if (fullConfig[key] !== undefined) {
            this.interpolators[key].snap(fullConfig[key]); 
        }
    });
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
    Object.values(this.interpolators).forEach(interp => interp.update(now));
    
    const getVal = (prop) => this.playbackValues[prop] ?? this.interpolators[prop].getCurrentValue();
    
    const speed = getVal('speed');
    const direction = this.config.direction || 1;
    const drift = getVal('drift');
    const driftSpeed = getVal('driftSpeed');

    this.continuousAngle = (this.continuousAngle + (speed * direction * deltaTime * 600)) % 360;

    if (drift > 0) {
        this.driftState.phase += deltaTime * driftSpeed * 1.0;
        const calculatedX = Math.sin(this.driftState.phase) * drift * 1.5;
        const calculatedY = Math.cos(this.driftState.phase * 0.7 + Math.PI / 4) * drift * 1.5;
        
        this.driftState.x = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, calculatedX));
        this.driftState.y = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, calculatedY));
    } else {
        this.driftState.x *= 0.95; 
        this.driftState.y *= 0.95;
    }
  }

  resolveRenderState() {
    const getVal = (prop) => this.playbackValues[prop] ?? this.interpolators[prop].getCurrentValue();
    const angle = getVal('angle');
    const totalAngleDeg = angle + this.continuousAngle;
    
    return {
        speed: getVal('speed'), 
        size: getVal('size'), 
        opacity: getVal('opacity'),
        drift: getVal('drift'), 
        driftSpeed: getVal('driftSpeed'),
        xaxis: getVal('xaxis'), 
        yaxis: getVal('yaxis'),
        angle: angle, 
        direction: this.config.direction || 1,
        blendMode: this.config.blendMode, 
        enabled: this.config.enabled,
        totalAngleRad: (totalAngleDeg * Math.PI) / 180,
        driftX: this.driftState.x, 
        driftY: this.driftState.y,
    };
  }

  applyRenderState(state, alphaMult, beatFactor, parallaxOffset, parallaxFactor, screen) {
    if (alphaMult <= 0.001 || !state.enabled || !this.tokenId) { 
        this.container.visible = false; 
        return; 
    }
    this.container.visible = true;

    const screenW = screen.width; 
    const screenH = screen.height;
    const halfW = screenW / 2; 
    const halfH = screenH / 2;
    
    const pX = parallaxOffset.x * parallaxFactor;
    const pY = parallaxOffset.y * parallaxFactor;
    
    const targetX = halfW + (state.xaxis / 10) + state.driftX + pX;
    const targetY = halfH + (state.yaxis / 10) + state.driftY + pY;
    
    // Scale Logic
    const tex = this.quadrants[0].sprite.texture;
    let screenRelativeScale = 1.0;
    
    if (tex && tex.valid && tex.width > 1) {
        // Calculate ratio to fit inside the quadrant
        const fitWidth = halfW / tex.width;
        const fitHeight = halfH / tex.height;
        
        // --- KEY FIX HERE ---
        // Use Math.min ("Contain") instead of Math.max ("Cover")
        // This ensures the image isn't pre-zoomed to fill the screen before the Size slider applies.
        screenRelativeScale = Math.min(fitWidth, fitHeight);
    }
    
    // Apply dampener to align '2.5' slider value with legacy appearance
    const finalScale = Math.max(0.001, state.size * screenRelativeScale * beatFactor * BASE_SCALE_MODIFIER);
    
    const finalAlpha = state.opacity * alphaMult;
    const blend = BLEND_MODE_MAP[state.blendMode] || 'normal';

    // 1. Top-Left
    this._updateQuadrant(this.quadrants[0], 
        targetX, targetY, 
        finalScale, finalScale, 
        state.totalAngleRad, 
        finalAlpha, blend
    );

    // 2. Top-Right (Mirror X)
    this._updateQuadrant(this.quadrants[1], 
        screenW - targetX, targetY, 
        -finalScale, finalScale, 
        -state.totalAngleRad, 
        finalAlpha, blend
    );

    // 3. Bottom-Left (Mirror Y)
    this._updateQuadrant(this.quadrants[2], 
        targetX, screenH - targetY, 
        finalScale, -finalScale, 
        -state.totalAngleRad, 
        finalAlpha, blend
    );

    // 4. Bottom-Right (Mirror Both)
    this._updateQuadrant(this.quadrants[3], 
        screenW - targetX, screenH - targetY, 
        -finalScale, -finalScale, 
        state.totalAngleRad, 
        finalAlpha, blend
    );
  }

  _updateQuadrant(quad, x, y, sx, sy, rot, alpha, blend) {
    quad.sprite.position.set(x, y); 
    quad.sprite.scale.set(sx, sy); 
    quad.sprite.rotation = rot; 
    quad.sprite.alpha = alpha; 
    quad.container.blendMode = blend;
  }

  resize(renderer) {
    const w = renderer.screen.width;
    const h = renderer.screen.height;
    
    const hw = Math.ceil(w / 2); 
    const hh = Math.ceil(h / 2);

    this.quadrants[0].updateMask(0, 0, hw, hh);
    this.quadrants[1].updateMask(hw, 0, w - hw, hh);
    this.quadrants[2].updateMask(0, hh, hw, h - hh);
    this.quadrants[3].updateMask(hw, hh, w - hw, h - hh);
  }
}