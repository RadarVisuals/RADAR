// src/utils/PixiEngine.js
import { Application, Assets, Container, Sprite, Texture, Graphics, DisplacementFilter, TilingSprite, Filter, GlProgram } from 'pixi.js';
import { 
    AdvancedBloomFilter, 
    GlitchFilter, 
    RGBSplitFilter, 
    PixelateFilter,
    GodrayFilter,
    TwistFilter,
    ZoomBlurFilter,
    CRTFilter
} from 'pixi-filters';
import { sliderParams } from '../config/sliderParams';
import ValueInterpolator from './ValueInterpolator';
import { getDecodedImage } from './imageDecoder'; // <--- Added Import

// Mapping for Pixi Blend Modes
const BLEND_MODE_MAP = {
  'normal': 'normal',
  'multiply': 'multiply',
  'screen': 'screen',
  'overlay': 'overlay',
  'darken': 'darken',
  'lighten': 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  'difference': 'difference',
  'exclusion': 'exclusion',
  'hue': 'normal', 
  'saturation': 'normal',
  'color': 'normal',
  'luminosity': 'overlay', 
  'linear-dodge': 'add',
  'add': 'add'
};

const MIDI_INTERPOLATION_DURATION = 300;
const MAX_TOTAL_OFFSET = 10000;

// --- KALEIDOSCOPE SHADER (INFINITE MIRRORING FIX) ---

const defaultFilterVertex = `
    precision highp float;
    in vec2 aPosition;
    out vec2 vTextureCoord;

    uniform vec4 uInputSize;
    uniform vec4 uOutputFrame;
    uniform vec4 uOutputTexture;

    vec4 filterVertexPosition( void )
    {
        vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
        position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
        position.y = position.y * (2.0 / uOutputTexture.y) - 1.0;
        return vec4(position, 0.0, 1.0);
    }

    vec2 filterTextureCoord( void )
    {
        return aPosition * (uOutputFrame.zw * uInputSize.zw);
    }

    void main(void)
    {
        gl_Position = filterVertexPosition();
        vTextureCoord = filterTextureCoord();
    }
`;

// UPDATED FRAGMENT SHADER
// - Uses gl_FragCoord for centering.
// - Uses infinite mirror math for screen tiling.
// - UPDATED: Clamps PIXEL coordinates (not UVs) to be strictly inside screen bounds.
const kaleidoscopeFragment = `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;

    uniform sampler2D uTexture;
    uniform float sides;
    uniform float angle;
    uniform vec2 uScreenSize; // (width, height) in physical pixels
    uniform vec4 uInputSize;  // (width, height, 1/width, 1/height) of source texture

    void main() {
        // 1. Establish UV-Pixel Relationship
        vec2 uvPerPixel = uInputSize.zw;
        vec2 originUV = vTextureCoord - gl_FragCoord.xy * uvPerPixel;

        // 2. Calculate Center & Polar Coordinates (Screen Space)
        vec2 center = uScreenSize * 0.5;
        vec2 p = gl_FragCoord.xy - center;

        float r = length(p);
        float a = atan(p.y, p.x);

        // 3. Rotation & Kaleidoscope Logic
        a += angle;

        if (sides > 0.0) {
            float slice = 6.28318530718 / sides;
            a = mod(a, slice);
            a = abs(a - 0.5 * slice);
            a -= 0.5 * slice;
        }

        // 4. Convert back to Cartesian (Pixel Space relative to center)
        vec2 newP = r * vec2(cos(a), sin(a));
        vec2 absPos = newP + center;

        // 5. INFINITE MIRRORING (Tiling)
        vec2 safePos = absPos + (uScreenSize * 10.0); 
        vec2 mirroredPos = abs(mod(safePos - uScreenSize, 2.0 * uScreenSize) - uScreenSize);

        // 6. SEAM FIX (Pixel Space Clamping)
        // We clamp the lookup coordinate to stay at least 1.0 pixel away from the screen edge.
        // This prevents the shader from interpolating with the 'void' color at the texture boundary.
        // 1.0 gives a safe buffer against bilinear filtering artifacts.
        mirroredPos = clamp(mirroredPos, vec2(1.0), uScreenSize - vec2(1.0));

        // 7. Map back to UV Space
        // Now we map our "safe" pixel coordinate to the texture UV.
        vec2 finalUV = originUV + mirroredPos * uvPerPixel;

        finalColor = texture(uTexture, finalUV);
    }
`;

class KaleidoscopeFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({
                vertex: defaultFilterVertex,
                fragment: kaleidoscopeFragment,
                name: 'kaleidoscope-filter'
            }),
            resources: {
                kaleidoscopeUniforms: {
                    sides: { value: 6.0, type: 'f32' },
                    angle: { value: 0.0, type: 'f32' },
                    // Initialize with 1,1 to avoid divide by zero, updated in handleResize
                    uScreenSize: { value: { x: 1.0, y: 1.0 }, type: 'vec2<f32>' } 
                }
            }
        });
        this.padding = 0;
    }

    get sides() { return this.resources.kaleidoscopeUniforms.uniforms.sides; }
    set sides(value) { this.resources.kaleidoscopeUniforms.uniforms.sides = value; }

    get angle() { return this.resources.kaleidoscopeUniforms.uniforms.angle; }
    set angle(value) { this.resources.kaleidoscopeUniforms.uniforms.angle = value; }

    get screenSize() { return this.resources.kaleidoscopeUniforms.uniforms.uScreenSize; }
    set screenSize(value) { this.resources.kaleidoscopeUniforms.uniforms.uScreenSize = value; }
}

// Seamless Fluid Map Generator
const createSeamlessFluidMap = (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(128, 128, 128)';
    ctx.fillRect(0, 0, width, height);

    const drawBlob = (cx, cy, radius, rColor, gColor) => {
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, `rgba(${rColor}, ${gColor}, 128, 1)`);
        gradient.addColorStop(0.4, `rgba(${rColor}, ${gColor}, 128, 0.8)`);
        gradient.addColorStop(1, `rgba(128, 128, 128, 0)`);
        
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    };

    ctx.globalCompositeOperation = 'hard-light';

    for (let i = 0; i < 40; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = Math.random() * 150 + 50; 
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);

        drawBlob(x, y, radius, r, g);

        if (x - radius < 0) drawBlob(x + width, y, radius, r, g);
        if (x + radius > width) drawBlob(x - width, y, radius, r, g);
        if (y - radius < 0) drawBlob(x, y + height, radius, r, g);
        if (y + radius > height) drawBlob(x, y - height, radius, r, g);
        if (x - radius < 0 && y - radius < 0) drawBlob(x + width, y + height, radius, r, g);
        if (x + radius > width && y - radius < 0) drawBlob(x - width, y + height, radius, r, g);
        if (x + radius > width && y + radius > height) drawBlob(x + width, y - height, radius, r, g);
        if (x + radius > width && y + radius > height) drawBlob(x - width, y - height, radius, r, g);
    }
    return canvas;
};

const lerp = (start, end, t) => start * (1 - t) + end * t;

class Quadrant {
  constructor() {
    this.container = new Container();
    this.mask = new Graphics();
    this.container.mask = this.mask;
    this.container.addChild(this.mask);

    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.container.addChild(this.sprite);
  }

  updateMask(x, y, w, h) {
    this.mask.clear();
    this.mask.rect(x, y, w, h);
    this.mask.fill({ color: 0xffffff });
  }
}

class PixiLayerDeck {
  constructor(layerId, deckId) {
    this.layerId = layerId;
    this.deckId = deckId;
    this.container = new Container();
    
    this.quadrants = [
      new Quadrant(), // 0: TL
      new Quadrant(), // 1: TR
      new Quadrant(), // 2: BL
      new Quadrant()  // 3: BR
    ];

    this.quadrants.forEach(q => this.container.addChild(q.container));

    this.config = this.getDefaultConfig();
    this.driftState = { x: 0, y: 0, phase: Math.random() * Math.PI * 2 };
    this.continuousAngle = 0;
    this.interpolators = {};
    this.playbackValues = {}; 
    this.tokenId = null;

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

  setTexture(texture) {
    this.quadrants.forEach(q => {
      q.sprite.texture = texture;
    });
  }
}

export default class PixiEngine {
  constructor(canvasElement) {
    this.app = new Application();
    this.canvas = canvasElement;
    this.layers = {};
    this.isReady = false;
    
    // Global State
    this.crossfadeValue = 0.0;
    this.audioFrequencyFactors = { '1': 1.0, '2': 1.0, '3': 1.0 };
    this.beatPulseFactor = 1.0;
    this.beatPulseEndTime = 0;
    this.parallaxOffset = { x: 0, y: 0 };
    this.renderedParallaxOffset = { x: 0, y: 0 };
    this.parallaxFactors = { '1': 10, '2': 25, '3': 50 };

    this.godrayTime = 0;

    // Effect Filters
    this.filters = {
        bloom: null,
        glitch: null,
        rgb: null,
        pixelate: null,
        datamosh: null,
        godray: null,
        twist: null,
        zoomBlur: null,
        crt: null,
        kaleidoscope: null 
    };

    this.datamoshTilingSprite = null;
  }

  async init() {
    if (this.isReady) return;

    await this.app.init({
      canvas: this.canvas,
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      powerPreference: 'high-performance', 
      preference: 'webgl',
    });

    // Initialize Layers
    ['1', '2', '3'].forEach(id => {
      const container = new Container();
      container.label = `Layer-${id}`;
      
      const deckA = new PixiLayerDeck(id, 'A');
      const deckB = new PixiLayerDeck(id, 'B');

      container.addChild(deckA.container);
      container.addChild(deckB.container);

      this.layers[id] = { container, deckA, deckB };
      this.app.stage.addChild(container);
    });

    // --- Datamosh Setup ---
    const mapResolution = 2048;
    const fluidCanvas = createSeamlessFluidMap(mapResolution, mapResolution);
    const fluidTexture = Texture.from(fluidCanvas);
    
    this.datamoshTilingSprite = new TilingSprite({
        texture: fluidTexture,
        width: this.app.screen.width,
        height: this.app.screen.height
    });
    
    if (fluidTexture.source.style) {
        fluidTexture.source.style.addressMode = 'repeat';
        fluidTexture.source.style.magFilter = 'linear';
        fluidTexture.source.style.minFilter = 'linear';
    }

    this.datamoshTilingSprite.renderable = false;
    this.app.stage.addChild(this.datamoshTilingSprite);

    // Initialize Effects
    this.initEffects();

    this.app.renderer.on('resize', () => this.handleResize());
    this.handleResize(); 

    this.app.ticker.add((ticker) => this.update(ticker));
    this.isReady = true;
  }

  initEffects() {
    const deviceRes = window.devicePixelRatio || 1;

    // 1. Bloom
    this.filters.bloom = new AdvancedBloomFilter({
        threshold: 0.5, bloomScale: 1.0, brightness: 1.0, blur: 8, quality: 5, resolution: deviceRes
    });
    this.filters.bloom.enabled = false;

    // 2. Glitch
    this.filters.glitch = new GlitchFilter({
        slices: 10, offset: 10, direction: 0, fillMode: 2, resolution: deviceRes
    });
    this.filters.glitch.enabled = false;

    // 3. RGB Split
    this.filters.rgb = new RGBSplitFilter({
        red: { x: -2, y: -2 }, green: { x: 0, y: 0 }, blue: { x: 2, y: 2 }, resolution: deviceRes
    });
    this.filters.rgb.enabled = false;

    // 4. Pixelate
    this.filters.pixelate = new PixelateFilter(10);
    this.filters.pixelate.resolution = deviceRes;
    this.filters.pixelate.enabled = false;

    // 5. Datamosh
    this.filters.datamosh = new DisplacementFilter({
        sprite: this.datamoshTilingSprite,
        scale: { x: 0, y: 0 }
    });
    this.filters.datamosh.resolution = deviceRes; 
    this.filters.datamosh.enabled = false;

    // 6. God Rays
    this.filters.godray = new GodrayFilter({
        gain: 0.5, lacunarity: 2.5, alpha: 1, parallel: false, center: {x: 0, y: 0}, resolution: deviceRes
    });
    this.filters.godray.enabled = false;

    // 7. Twist
    this.filters.twist = new TwistFilter({
        radius: 400, angle: 4, padding: 20, offset: {x:0, y:0}, resolution: deviceRes
    });
    this.filters.twist.enabled = false;

    // 8. Zoom Blur
    this.filters.zoomBlur = new ZoomBlurFilter({
        strength: 0.1, center: { x: this.app.screen.width/2, y: this.app.screen.height/2 }, innerRadius: 50, resolution: deviceRes
    });
    this.filters.zoomBlur.enabled = false;

    // 9. CRT
    this.filters.crt = new CRTFilter({
        curvature: 1, lineWidth: 1, lineContrast: 0.25, noise: 0.1, noiseSize: 1.0,
        vignetting: 0.3, vignettingAlpha: 1.0, vignettingBlur: 0.3, resolution: deviceRes
    });
    this.filters.crt.enabled = false;

    // 10. Kaleidoscope
    this.filters.kaleidoscope = new KaleidoscopeFilter();
    this.filters.kaleidoscope.resolution = deviceRes;
    this.filters.kaleidoscope.enabled = false;

    this.app.stage.filters = [
        this.filters.pixelate,
        this.filters.twist,
        this.filters.datamosh, 
        this.filters.kaleidoscope, 
        this.filters.zoomBlur,
        this.filters.godray,
        this.filters.rgb,
        this.filters.glitch,
        this.filters.bloom,
        this.filters.crt
    ];
  }

  handleResize() {
    // Get physical pixel dimensions from renderer
    // (Pixi's renderer.width/height already include resolution)
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    
    // Logical dimensions for UI elements if needed
    const logicalW = w / this.app.renderer.resolution;
    const logicalH = h / this.app.renderer.resolution;

    if (import.meta.env.DEV) {
        console.log(`[PixiEngine] Resize: Logical: ${logicalW}x${logicalH}, Physical: ${w}x${h}`);
    }

    const hw = Math.ceil(logicalW / 2);
    const hh = Math.ceil(logicalH / 2);

    if (this.datamoshTilingSprite) {
        this.datamoshTilingSprite.width = logicalW;
        this.datamoshTilingSprite.height = logicalH;
    }

    // FORCE FILTER AREA TO SCREEN SIZE
    this.app.stage.filterArea = this.app.screen; 

    // UPDATE KALEIDOSCOPE SCREEN SIZE UNIFORM
    // We pass PHYSICAL pixels to match gl_FragCoord in shader
    if (this.filters.kaleidoscope) {
        this.filters.kaleidoscope.screenSize = { x: w, y: h };
    }

    if (this.filters.zoomBlur) this.filters.zoomBlur.center = { x: logicalW/2, y: logicalH/2 };
    if (this.filters.twist) this.filters.twist.offset = { x: logicalW/2, y: logicalH/2 };

    Object.values(this.layers).forEach(layer => {
      [layer.deckA, layer.deckB].forEach(deck => {
        deck.quadrants[0].updateMask(0, 0, hw, hh);
        deck.quadrants[1].updateMask(hw, 0, logicalW - hw, hh);
        deck.quadrants[2].updateMask(0, hh, hw, logicalH - hh);
        deck.quadrants[3].updateMask(hw, hh, logicalW - hw, logicalH - hh);
      });
    });
  }

  update(ticker) {
    const now = performance.now();
    const deltaTime = ticker.deltaTime / 60; 

    // --- DATAMOSH UPDATE ---
    if (this.filters.datamosh && this.filters.datamosh.enabled && this.datamoshTilingSprite) {
        const transitionIntensity = Math.sin(Math.PI * this.crossfadeValue);
        const maxScale = this.filters.datamosh.config?.scale || 200;
        const flowSpeed = this.filters.datamosh.config?.speed || 2;
        const waveSize = this.filters.datamosh.config?.zoom || 1.0; 
        const flowAngleDeg = this.filters.datamosh.config?.angle !== undefined ? this.filters.datamosh.config.angle : 25;

        this.datamoshTilingSprite.tileScale.set(waveSize);

        const currentScale = transitionIntensity * maxScale;
        this.filters.datamosh.scale.x = currentScale;
        this.filters.datamosh.scale.y = currentScale;

        if (flowSpeed > 0) {
            const dynamicSpeed = flowSpeed * (1 + transitionIntensity * 2);
            const rads = flowAngleDeg * (Math.PI / 180);
            const vx = Math.cos(rads) * dynamicSpeed;
            const vy = Math.sin(rads) * dynamicSpeed;

            this.datamoshTilingSprite.tilePosition.x += vx * ticker.deltaTime;
            this.datamoshTilingSprite.tilePosition.y += vy * ticker.deltaTime;
        }
    }

    // --- GOD RAYS ANIMATION ---
    if (this.filters.godray && this.filters.godray.enabled) {
        this.godrayTime += ticker.deltaTime * 0.01;
        const radius = Math.min(this.app.screen.width, this.app.screen.height) * 0.4;
        const cx = this.app.screen.width / 2;
        const cy = this.app.screen.height / 2;
        
        this.filters.godray.center = {
            x: cx + Math.cos(this.godrayTime) * radius,
            y: cy + Math.sin(this.godrayTime) * radius * 0.5 
        };
        this.filters.godray.time += ticker.deltaTime * 0.01;
    }

    // --- CRT NOISE ANIMATION ---
    if (this.filters.crt && this.filters.crt.enabled) {
        this.filters.crt.seed = Math.random();
        this.filters.crt.time += ticker.deltaTime * 0.1;
    }

    // Glitch Effect Update
    if (this.filters.glitch && this.filters.glitch.enabled) {
        this.filters.glitch.seed = Math.random();
        if (Math.random() > 0.95) {
            this.filters.glitch.slices = Math.floor(Math.random() * 20) + 5;
        }
    }

    let currentBeatFactor = 1.0;
    if (this.beatPulseEndTime > now) {
      currentBeatFactor = this.beatPulseFactor;
    } else {
        this.beatPulseFactor = 1.0;
    }

    const parallaxLerp = 0.05;
    this.renderedParallaxOffset.x += (this.parallaxOffset.x - this.renderedParallaxOffset.x) * parallaxLerp;
    this.renderedParallaxOffset.y += (this.parallaxOffset.y - this.renderedParallaxOffset.y) * parallaxLerp;

    const angle = this.crossfadeValue * 0.5 * Math.PI;
    const opacityA = Math.cos(angle);
    const opacityB = Math.sin(angle);

    Object.values(this.layers).forEach(layer => {
      this.stepPhysics(layer.deckA, deltaTime, now);
      this.stepPhysics(layer.deckB, deltaTime, now);

      const stateA = this.resolveState(layer.deckA);
      const stateB = this.resolveState(layer.deckB);

      let startState = stateA;
      let endState = stateB;

      if (!layer.deckB.tokenId && layer.deckA.tokenId) {
        endState = stateA; 
      } else if (!layer.deckA.tokenId && layer.deckB.tokenId) {
        startState = stateB; 
      }

      const morphedState = {
        speed: lerp(startState.speed, endState.speed, this.crossfadeValue),
        size: lerp(startState.size, endState.size, this.crossfadeValue),
        opacity: lerp(startState.opacity, endState.opacity, this.crossfadeValue), 
        drift: lerp(startState.drift, endState.drift, this.crossfadeValue),
        driftSpeed: lerp(startState.driftSpeed, endState.driftSpeed, this.crossfadeValue),
        xaxis: lerp(startState.xaxis, endState.xaxis, this.crossfadeValue),
        yaxis: lerp(startState.yaxis, endState.yaxis, this.crossfadeValue),
        totalAngleRad: lerp(startState.totalAngleRad, endState.totalAngleRad, this.crossfadeValue),
        driftX: lerp(startState.driftX, endState.driftX, this.crossfadeValue),
        driftY: lerp(startState.driftY, endState.driftY, this.crossfadeValue),
        blendMode: this.crossfadeValue < 0.5 ? startState.blendMode : endState.blendMode,
        direction: this.crossfadeValue < 0.5 ? startState.direction : endState.direction,
        enabled: this.crossfadeValue < 0.5 ? startState.enabled : endState.enabled,
      };

      this.applyStateToDeck(layer.deckA, morphedState, opacityA, currentBeatFactor);
      this.applyStateToDeck(layer.deckB, morphedState, opacityB, currentBeatFactor);
    });
  }

  stepPhysics(deck, deltaTime, now) {
    Object.values(deck.interpolators).forEach(interp => interp.update(now));
    const getVal = (prop) => deck.playbackValues[prop] ?? deck.interpolators[prop].getCurrentValue();

    const speed = getVal('speed');
    const direction = deck.config.direction || 1;
    const drift = getVal('drift');
    const driftSpeed = getVal('driftSpeed');

    deck.continuousAngle = (deck.continuousAngle + (speed * direction * deltaTime * 600)) % 360;

    if (drift > 0) {
        deck.driftState.phase += deltaTime * driftSpeed * 1.0;
        const calculatedX = Math.sin(deck.driftState.phase) * drift * 1.5;
        const calculatedY = Math.cos(deck.driftState.phase * 0.7 + Math.PI / 4) * drift * 1.5;
        deck.driftState.x = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, calculatedX));
        deck.driftState.y = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, calculatedY));
    } else {
        deck.driftState.x *= 0.95;
        deck.driftState.y *= 0.95;
    }
  }

  resolveState(deck) {
    const getVal = (prop) => deck.playbackValues[prop] ?? deck.interpolators[prop].getCurrentValue();
    const angle = getVal('angle');
    const totalAngle = angle + deck.continuousAngle;
    return {
        speed: getVal('speed'),
        size: getVal('size'),
        opacity: getVal('opacity'),
        drift: getVal('drift'),
        driftSpeed: getVal('driftSpeed'),
        xaxis: getVal('xaxis'),
        yaxis: getVal('yaxis'),
        angle: angle,
        direction: deck.config.direction || 1,
        blendMode: deck.config.blendMode,
        enabled: deck.config.enabled,
        totalAngleRad: (totalAngle * Math.PI) / 180,
        driftX: deck.driftState.x,
        driftY: deck.driftState.y,
    };
  }

  applyStateToDeck(deck, state, alphaMult, beatFactor) {
    if (alphaMult <= 0.001 || !state.enabled || !deck.tokenId) {
        deck.container.visible = false;
        return;
    }
    deck.container.visible = true;

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const halfW = screenW / 2;
    const halfH = screenH / 2;

    const layerParallaxFactor = this.parallaxFactors[deck.layerId] || 0;
    const pX = this.renderedParallaxOffset.x * layerParallaxFactor;
    const pY = this.renderedParallaxOffset.y * layerParallaxFactor;

    const targetX = halfW + (state.xaxis / 10) + state.driftX + pX;
    const targetY = halfH + (state.yaxis / 10) + state.driftY + pY;

    const tex = deck.quadrants[0].sprite.texture;
    let screenRelativeScale = 1.0;
    if (tex && tex.width > 1 && tex.height > 1) {
        const ratioW = halfW / tex.width;
        const ratioH = halfH / tex.height;
        screenRelativeScale = Math.min(ratioW, ratioH);
    }

    const audioScale = this.audioFrequencyFactors[deck.layerId] || 1.0;
    const finalScale = Math.max(0.001, state.size * screenRelativeScale * audioScale * beatFactor);
    const finalAlpha = state.opacity * alphaMult;
    let blendModeStr = BLEND_MODE_MAP[state.blendMode] || 'normal';

    const updateQuadrant = (q, x, y, scaleX, scaleY, rot) => {
        q.sprite.position.set(x, y);
        q.sprite.scale.set(scaleX, scaleY);
        q.sprite.rotation = rot;
        q.sprite.alpha = finalAlpha;
        q.container.blendMode = blendModeStr; 
    };

    updateQuadrant(deck.quadrants[0], targetX, targetY, finalScale, finalScale, state.totalAngleRad);
    updateQuadrant(deck.quadrants[1], screenW - targetX, targetY, -finalScale, finalScale, -state.totalAngleRad);
    updateQuadrant(deck.quadrants[2], targetX, screenH - targetY, finalScale, -finalScale, -state.totalAngleRad);
    updateQuadrant(deck.quadrants[3], screenW - targetX, screenH - targetY, -finalScale, -finalScale, state.totalAngleRad);
  }

  async setTexture(layerId, deckSide, imageSrc, tokenId) {
    if (!this.isReady || !this.layers[layerId]) return;
    
    const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    
    if (deck.tokenId === tokenId) return;
    
    deck.tokenId = tokenId;
    
    if (!imageSrc) { 
        deck.setTexture(Texture.EMPTY); 
        return; 
    }

    try {
      const imageBitmap = await getDecodedImage(imageSrc);
      const texture = Texture.from(imageBitmap);

      if (deck.tokenId === tokenId) {
          deck.setTexture(texture);
      }
    } catch (e) { 
      console.warn(`[PixiEngine] Failed to load texture: ${imageSrc}`, e); 
    }
  }

  updateConfig(layerId, key, value, deckSide = 'A') {
    if (!this.layers[layerId]) return;
    const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    deck.config[key] = value;
    if (deck.interpolators[key]) deck.interpolators[key].setTarget(value);
  }

  snapConfig(layerId, fullConfig, deckSide = 'A') {
    if (!this.layers[layerId]) return;
    const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    deck.config = { ...deck.config, ...fullConfig };
    Object.keys(deck.interpolators).forEach(key => {
      if (fullConfig[key] !== undefined) deck.interpolators[key].snap(fullConfig[key]);
    });
  }

  getState(layerId, deckSide) {
    if (!this.layers[layerId]) return null;
    const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    const snapshot = {
      config: { ...deck.config },
      driftState: { ...deck.driftState },
      continuousRotationAngle: deck.continuousAngle, 
      playbackValues: { ...deck.playbackValues }
    };
    for(const key in snapshot.playbackValues) snapshot.config[key] = snapshot.playbackValues[key];
    return snapshot;
  }

  updateEffectConfig(effectName, param, value) {
    const filter = this.filters[effectName];
    if (!filter) return;

    if (param === 'enabled') {
        filter.enabled = !!value;
    } else {
        if (effectName === 'datamosh') {
            if (!filter.config) filter.config = {};
            filter.config[param] = value;
            return;
        }
        if (effectName === 'rgb') {
           if (param === 'red') filter.red = { x: value, y: value };
           if (param === 'green') filter.green = { x: value, y: value };
           if (param === 'blue') filter.blue = { x: value, y: value };
        } else if (effectName === 'pixelate' && param === 'size') {
            filter.size = value; 
        } else {
            filter[param] = value;
        }
    }
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
    Object.values(this.layers).forEach(layer => {
      layer.deckA.playbackValues = {};
      layer.deckB.playbackValues = {};
    });
  }
  
  destroy() {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: false, baseTexture: false });
    }
    this.isReady = false;
  }
}