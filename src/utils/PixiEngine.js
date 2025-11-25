import { Application, Container, Sprite, Texture, Graphics, Filter, GlProgram, SimplePlane, RenderTexture } from 'pixi.js';
import { 
    AdvancedBloomFilter, 
    RGBSplitFilter, 
    PixelateFilter,
    TwistFilter,
    ZoomBlurFilter,
    CRTFilter
} from 'pixi-filters';
import { sliderParams } from '../config/sliderParams';
import ValueInterpolator from './ValueInterpolator';
import { getDecodedImage } from './imageDecoder'; 

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

// --- SHADER HELPERS ---
const defaultFilterVertex = `
    precision highp float;
    in vec2 aPosition;
    out vec2 vTextureCoord;
    uniform vec4 uInputSize;
    uniform vec4 uOutputFrame;
    uniform vec4 uOutputTexture;

    vec4 filterVertexPosition( void ) {
        vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
        position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
        position.y = position.y * (2.0 / uOutputTexture.y) - 1.0;
        return vec4(position, 0.0, 1.0);
    }
    vec2 filterTextureCoord( void ) {
        return aPosition * (uOutputFrame.zw * uInputSize.zw);
    }
    void main(void) {
        gl_Position = filterVertexPosition();
        vTextureCoord = filterTextureCoord();
    }
`;

// --- 1. PREMIUM VOLUMETRIC LIGHT ---
const volumetricFragment = `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    
    uniform sampler2D uTexture;
    uniform vec2 uLightPos;
    uniform float uExposure;
    uniform float uDecay;
    uniform float uDensity;
    uniform float uWeight;
    uniform float uThreshold;

    const int SAMPLES = 50;

    void main() {
        vec2 deltaTextCoord = vec2(vTextureCoord - uLightPos);
        vec2 textCoo = vTextureCoord;
        deltaTextCoord *= 1.0 / float(SAMPLES) * uDensity;
        
        vec4 color = vec4(0.0);
        float illuminationDecay = 1.0;
        
        for(int i=0; i < SAMPLES ; i++) {
            textCoo -= deltaTextCoord;
            vec4 sample = texture2D(uTexture, textCoo);
            float brightness = dot(sample.rgb, vec3(0.2126, 0.7152, 0.0722));
            if(brightness < uThreshold) {
                sample *= 0.05;
            }
            sample *= illuminationDecay * uWeight;
            color += sample;
            illuminationDecay *= uDecay;
        }
        
        vec4 realColor = texture2D(uTexture, vTextureCoord);
        finalColor = realColor + (color * uExposure);
    }
`;

class VolumetricLightFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: volumetricFragment, name: 'volumetric-filter' }),
            resources: {
                volumetricUniforms: {
                    uLightPos: { value: {x: 0.5, y: 0.5}, type: 'vec2<f32>' },
                    uExposure: { value: 0.3, type: 'f32' },
                    uDecay: { value: 0.95, type: 'f32' },
                    uDensity: { value: 0.8, type: 'f32' },
                    uWeight: { value: 0.4, type: 'f32' },
                    uThreshold: { value: 0.5, type: 'f32' }
                }
            }
        });
    }
    get exposure() { return this.resources.volumetricUniforms.uniforms.uExposure; }
    set exposure(v) { this.resources.volumetricUniforms.uniforms.uExposure = v; }
    get threshold() { return this.resources.volumetricUniforms.uniforms.uThreshold; }
    set threshold(v) { this.resources.volumetricUniforms.uniforms.uThreshold = v; }
    get density() { return this.resources.volumetricUniforms.uniforms.uDensity; }
    set density(v) { this.resources.volumetricUniforms.uniforms.uDensity = v; }
    get decay() { return this.resources.volumetricUniforms.uniforms.uDecay; }
    set decay(v) { this.resources.volumetricUniforms.uniforms.uDecay = v; }
    set lightX(v) { this.resources.volumetricUniforms.uniforms.uLightPos.x = v; }
    set lightY(v) { this.resources.volumetricUniforms.uniforms.uLightPos.y = v; }
}

// --- 2. LIQUID FLOW SHADER ---
const liquidFragment = `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uScale;
    uniform float uIntensity;

    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    void main() {
        vec2 uv = vTextureCoord;
        float noiseVal = snoise(uv * uScale + (uTime * uSpeed));
        vec2 distort = vec2(noiseVal * uIntensity, noiseVal * uIntensity);
        finalColor = texture(uTexture, uv + distort);
    }
`;

class LiquidFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: liquidFragment, name: 'liquid-filter' }),
            resources: {
                liquidUniforms: {
                    uTime: { value: 0.0, type: 'f32' },
                    uSpeed: { value: 0.5, type: 'f32' },
                    uScale: { value: 3.0, type: 'f32' },
                    uIntensity: { value: 0.02, type: 'f32' }
                }
            }
        });
    }
    get time() { return this.resources.liquidUniforms.uniforms.uTime; }
    set time(v) { this.resources.liquidUniforms.uniforms.uTime = v; }
    get speed() { return this.resources.liquidUniforms.uniforms.uSpeed; }
    set speed(v) { this.resources.liquidUniforms.uniforms.uSpeed = v; }
    get scale() { return this.resources.liquidUniforms.uniforms.uScale; }
    set scale(v) { this.resources.liquidUniforms.uniforms.uScale = v; }
    get intensity() { return this.resources.liquidUniforms.uniforms.uIntensity; }
    set intensity(v) { this.resources.liquidUniforms.uniforms.uIntensity = v; }
}

// --- 3. WAVE DISTORT ---
const waveDistortFragment = `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uIntensity;

    void main() {
        vec2 uv = vTextureCoord;
        float wave = sin(uv.y * 20.0 + uTime * 5.0) * 0.005 * uIntensity;
        uv.x += wave;
        finalColor = texture(uTexture, uv);
    }
`;

class WaveDistortFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: waveDistortFragment, name: 'wave-distort-filter' }),
            resources: {
                waveUniforms: {
                    uTime: { value: 0.0, type: 'f32' },
                    uIntensity: { value: 0.5, type: 'f32' }
                }
            }
        });
    }
    get time() { return this.resources.waveUniforms.uniforms.uTime; }
    set time(v) { this.resources.waveUniforms.uniforms.uTime = v; }
    get intensity() { return this.resources.waveUniforms.uniforms.uIntensity; }
    set intensity(v) { this.resources.waveUniforms.uniforms.uIntensity = v; }
}

// --- KALEIDOSCOPE ---
const kaleidoscopeFragment = `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    uniform sampler2D uTexture;
    uniform float sides;
    uniform float angle;
    uniform vec2 uScreenSize; 
    uniform vec4 uInputSize;
    void main() {
        vec2 uvPerPixel = uInputSize.zw;
        vec2 originUV = vTextureCoord - gl_FragCoord.xy * uvPerPixel;
        vec2 center = uScreenSize * 0.5;
        vec2 p = gl_FragCoord.xy - center;
        float r = length(p);
        float a = atan(p.y, p.x) + angle;
        if (sides > 0.0) {
            float slice = 6.28318530718 / sides;
            a = mod(a, slice);
            a = abs(a - 0.5 * slice);
            a -= 0.5 * slice;
        }
        vec2 newP = r * vec2(cos(a), sin(a));
        vec2 absPos = newP + center;
        vec2 safePos = absPos + (uScreenSize * 10.0); 
        vec2 mirroredPos = abs(mod(safePos - uScreenSize, 2.0 * uScreenSize) - uScreenSize);
        mirroredPos = clamp(mirroredPos, vec2(1.0), uScreenSize - vec2(1.0));
        vec2 finalUV = originUV + mirroredPos * uvPerPixel;
        finalColor = texture(uTexture, finalUV);
    }
`;

class KaleidoscopeFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: kaleidoscopeFragment, name: 'kaleidoscope-filter' }),
            resources: {
                kaleidoscopeUniforms: { sides: { value: 6.0, type: 'f32' }, angle: { value: 0.0, type: 'f32' }, uScreenSize: { value: { x: 1.0, y: 1.0 }, type: 'vec2<f32>' } }
            }
        });
    }
    get sides() { return this.resources.kaleidoscopeUniforms.uniforms.sides; }
    set sides(value) { this.resources.kaleidoscopeUniforms.uniforms.sides = value; }
    get angle() { return this.resources.kaleidoscopeUniforms.uniforms.angle; }
    set angle(value) { this.resources.kaleidoscopeUniforms.uniforms.angle = value; }
    get screenSize() { return this.resources.kaleidoscopeUniforms.uniforms.uScreenSize; }
    set screenSize(value) { this.resources.kaleidoscopeUniforms.uniforms.uScreenSize = value; }
}

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
    this.quadrants = [new Quadrant(), new Quadrant(), new Quadrant(), new Quadrant()];
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
    this.quadrants.forEach(q => { q.sprite.texture = texture; });
  }
}

export default class PixiEngine {
  constructor(canvasElement) {
    this.app = new Application();
    this.canvas = canvasElement;
    this.layers = {};
    this.isReady = false;
    this.crossfadeValue = 0.0;
    this.audioFrequencyFactors = { '1': 1.0, '2': 1.0, '3': 1.0 };
    this.beatPulseFactor = 1.0;
    this.beatPulseEndTime = 0;
    this.parallaxOffset = { x: 0, y: 0 };
    this.renderedParallaxOffset = { x: 0, y: 0 };
    this.parallaxFactors = { '1': 10, '2': 25, '3': 50 };
    this.filters = {
        bloom: null, rgb: null, pixelate: null,
        twist: null, zoomBlur: null,
        crt: null, kaleidoscope: null,
        volumetric: null, waveDistort: null, liquid: null
    };
    this._morphedConfig = {};
    this._morphedDriftState = { x: 0, y: 0 };

    // --- MAPPING PROPS ---
    this.mainLayerGroup = new Container(); // Holds all visual layers
    this.isMappingActive = false;
    this.renderTexture = null;
    this.projectionMesh = null;
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

    // 1. Create Layers and add them to mainLayerGroup instead of stage
    ['1', '2', '3'].forEach(id => {
      const container = new Container();
      const deckA = new PixiLayerDeck(id, 'A');
      const deckB = new PixiLayerDeck(id, 'B');
      container.addChild(deckA.container);
      container.addChild(deckB.container);
      this.layers[id] = { container, deckA, deckB };
      
      // Added to group instead of stage
      this.mainLayerGroup.addChild(container);
    });

    // 2. Add main group to stage (default state)
    this.app.stage.addChild(this.mainLayerGroup);

    // 3. Initialize Projection Mapping Resources
    this.initMappingResources();

    this.initEffects();
    this.app.renderer.on('resize', () => this.handleResize());
    this.handleResize(); 
    this.app.ticker.add((ticker) => this.update(ticker));
    this.isReady = true;
  }

  initMappingResources() {
    const { width, height } = this.app.screen;
    
    // Create render texture (Virtual Screen)
    this.renderTexture = RenderTexture.create({
        width,
        height,
        resolution: this.app.renderer.resolution
    });

    // Create Mesh (2x2 = 4 vertices)
    this.projectionMesh = new SimplePlane(this.renderTexture, 2, 2);
    this.projectionMesh.width = width;
    this.projectionMesh.height = height;
    
    // Reset corners to fill screen
    this.updateCorner(0, 0, 0);           // TL
    this.updateCorner(1, width, 0);       // TR
    this.updateCorner(2, 0, height);      // BL
    this.updateCorner(3, width, height);  // BR
  }

  setMappingMode(isActive) {
    this.isMappingActive = isActive;

    if (isActive) {
        // Remove visuals from screen, add mesh to screen
        this.app.stage.removeChild(this.mainLayerGroup);
        this.app.stage.addChild(this.projectionMesh);
    } else {
        // Remove mesh, put visuals back on screen
        this.app.stage.removeChild(this.projectionMesh);
        this.app.stage.addChild(this.mainLayerGroup);
    }
  }

  // Called by React UI to warp the texture
  updateCorner(index, x, y) {
    if (!this.projectionMesh) return;
    const buffer = this.projectionMesh.geometry.getBuffer('aVertexPosition');
    buffer.data[index * 2] = x;
    buffer.data[index * 2 + 1] = y;
    buffer.update();
  }

  initEffects() {
    const res = window.devicePixelRatio || 1;
    
    this.filters.bloom = new AdvancedBloomFilter({ threshold: 0.5, bloomScale: 1.0, brightness: 1.0, blur: 8, quality: 5, resolution: res });
    this.filters.rgb = new RGBSplitFilter({ red: {x:-2,y:-2}, green: {x:0,y:0}, blue: {x:2,y:2}, resolution: res });
    this.filters.pixelate = new PixelateFilter(10); this.filters.pixelate.resolution = res;
    this.filters.twist = new TwistFilter({ radius: 400, angle: 4, padding: 20, resolution: res });
    this.filters.zoomBlur = new ZoomBlurFilter({ strength: 0.1, innerRadius: 50, resolution: res });
    this.filters.crt = new CRTFilter({ curvature: 1, lineWidth: 1, resolution: res });
    this.filters.kaleidoscope = new KaleidoscopeFilter(); this.filters.kaleidoscope.resolution = res;
    
    // PREMIUM CUSTOM SHADERS
    this.filters.volumetric = new VolumetricLightFilter(); 
    this.filters.waveDistort = new WaveDistortFilter();
    this.filters.liquid = new LiquidFilter();

    Object.values(this.filters).forEach(f => f.enabled = false);

    // Apply filters to the main group. 
    // This ensures effects are applied "inside" the texture before it gets warped in mapping mode.
    this.mainLayerGroup.filters = [
        this.filters.liquid,
        this.filters.kaleidoscope, 
        this.filters.twist, 
        this.filters.zoomBlur,
        this.filters.volumetric,
        this.filters.waveDistort,
        this.filters.rgb, 
        this.filters.bloom,
        this.filters.pixelate,
        this.filters.crt
    ];
  }

  handleResize() {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    
    // Resize render texture if mapping
    if (this.renderTexture) {
        this.renderTexture.resize(w, h);
    }

    const logicalW = w / this.app.renderer.resolution;
    const logicalH = h / this.app.renderer.resolution;
    
    this.app.stage.filterArea = this.app.screen; 
    if (this.filters.kaleidoscope) this.filters.kaleidoscope.screenSize = { x: w, y: h };
    if (this.filters.zoomBlur) this.filters.zoomBlur.center = { x: logicalW/2, y: logicalH/2 };
    if (this.filters.twist) this.filters.twist.offset = { x: logicalW/2, y: logicalH/2 };

    const hw = Math.ceil(logicalW / 2); const hh = Math.ceil(logicalH / 2);
    Object.values(this.layers).forEach(layer => {
      [layer.deckA, layer.deckB].forEach(deck => {
        deck.quadrants[0].updateMask(0, 0, hw, hh);
        deck.quadrants[1].updateMask(hw, 0, logicalW - hw, hh);
        deck.quadrants[2].updateMask(0, hh, hw, logicalH - hh);
        deck.quadrants[3].updateMask(hw, hh, logicalW - hw, logicalH - hh);
      });
    });
  }

  updateEffectConfig(effectName, param, value) {
    const filter = this.filters[effectName];
    if (!filter) return;

    if (param === 'enabled') {
        filter.enabled = !!value;
    } else if (effectName === 'rgb' && param === 'amount') {
        filter.red = { x: -value, y: -value };
        filter.green = { x: 0, y: 0 };
        filter.blue = { x: value, y: value };
    } else if (effectName === 'bloom' && param === 'intensity') {
        filter.bloomScale = value;
    } else if (effectName === 'liquid') {
        if (param === 'speed') filter.speed = value;
        if (param === 'scale') filter.scale = value;
        if (param === 'intensity') filter.intensity = value;
    } else if (effectName === 'volumetric') {
        if (param === 'exposure') filter.exposure = value;
        if (param === 'decay') filter.decay = value;
        if (param === 'density') filter.density = value;
        if (param === 'threshold') filter.threshold = value;
        if (param === 'x') filter.lightX = value;
        if (param === 'y') filter.lightY = value;
    } else if (effectName === 'waveDistort') {
        if (param === 'intensity') filter.intensity = value;
    } else {
        if (param in filter) {
            filter[param] = value;
        }
    }
  }

  update(ticker) {
    const now = performance.now();
    const deltaTime = ticker.deltaTime / 60; 

    // Ticking time for filters
    if (this.filters.crt && this.filters.crt.enabled) {
        this.filters.crt.seed = Math.random();
        this.filters.crt.time += ticker.deltaTime * 0.1;
    }
    const filterDelta = ticker.deltaTime * 0.01;
    if (this.filters.liquid && this.filters.liquid.enabled) this.filters.liquid.time += filterDelta;
    if (this.filters.waveDistort && this.filters.waveDistort.enabled) this.filters.waveDistort.time += filterDelta;

    let currentBeatFactor = this.beatPulseEndTime > now ? this.beatPulseFactor : 1.0;
    this.renderedParallaxOffset.x += (this.parallaxOffset.x - this.renderedParallaxOffset.x) * 0.05;
    this.renderedParallaxOffset.y += (this.parallaxOffset.y - this.renderedParallaxOffset.y) * 0.05;

    const angle = this.crossfadeValue * 0.5 * Math.PI;
    const opacityA = Math.cos(angle);
    const opacityB = Math.sin(angle);

    Object.values(this.layers).forEach(layer => {
      this.stepPhysics(layer.deckA, deltaTime, now);
      this.stepPhysics(layer.deckB, deltaTime, now);
      const stateA = this.resolveState(layer.deckA);
      const stateB = this.resolveState(layer.deckB);
      
      const morphedState = { ...this._morphedConfig }; 
      for (let key in stateA) {
          if (typeof stateA[key] === 'number' && typeof stateB[key] === 'number') {
              morphedState[key] = lerp(stateA[key], stateB[key], this.crossfadeValue);
          } else {
              morphedState[key] = this.crossfadeValue < 0.5 ? stateA[key] : stateB[key];
          }
      }
      
      this.applyStateToDeck(layer.deckA, morphedState, opacityA, currentBeatFactor);
      this.applyStateToDeck(layer.deckB, morphedState, opacityB, currentBeatFactor);
    });

    // --- RENDER PIPELINE SWITCH ---
    if (this.isMappingActive) {
        // Render kaleidoscope into the texture
        this.app.renderer.render({
            container: this.mainLayerGroup,
            target: this.renderTexture
        });
        // The app loop automatically renders the stage (which contains projectionMesh)
    }
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
        deck.driftState.x *= 0.95; deck.driftState.y *= 0.95;
    }
  }

  resolveState(deck) {
    const getVal = (prop) => deck.playbackValues[prop] ?? deck.interpolators[prop].getCurrentValue();
    const angle = getVal('angle');
    const totalAngle = angle + deck.continuousAngle;
    return {
        speed: getVal('speed'), size: getVal('size'), opacity: getVal('opacity'),
        drift: getVal('drift'), driftSpeed: getVal('driftSpeed'),
        xaxis: getVal('xaxis'), yaxis: getVal('yaxis'),
        angle: angle, direction: deck.config.direction || 1,
        blendMode: deck.config.blendMode, enabled: deck.config.enabled,
        totalAngleRad: (totalAngle * Math.PI) / 180,
        driftX: deck.driftState.x, driftY: deck.driftState.y,
    };
  }

  applyStateToDeck(deck, state, alphaMult, beatFactor) {
    if (alphaMult <= 0.001 || !state.enabled || !deck.tokenId) { deck.container.visible = false; return; }
    deck.container.visible = true;
    const screenW = this.app.screen.width; const screenH = this.app.screen.height;
    const halfW = screenW / 2; const halfH = screenH / 2;
    const pX = this.renderedParallaxOffset.x * (this.parallaxFactors[deck.layerId] || 0);
    const pY = this.renderedParallaxOffset.y * (this.parallaxFactors[deck.layerId] || 0);
    const targetX = halfW + (state.xaxis / 10) + state.driftX + pX;
    const targetY = halfH + (state.yaxis / 10) + state.driftY + pY;
    const tex = deck.quadrants[0].sprite.texture;
    let screenRelativeScale = 1.0;
    if (tex && tex.width > 1) {
        screenRelativeScale = Math.min(halfW / tex.width, halfH / tex.height);
    }
    const audioScale = this.audioFrequencyFactors[deck.layerId] || 1.0;
    const finalScale = Math.max(0.001, state.size * screenRelativeScale * audioScale * beatFactor);
    const finalAlpha = state.opacity * alphaMult;
    const blend = BLEND_MODE_MAP[state.blendMode] || 'normal';

    const updateQ = (q, x, y, sx, sy, rot) => {
        q.sprite.position.set(x, y); q.sprite.scale.set(sx, sy); q.sprite.rotation = rot; q.sprite.alpha = finalAlpha; q.container.blendMode = blend;
    };
    updateQ(deck.quadrants[0], targetX, targetY, finalScale, finalScale, state.totalAngleRad);
    updateQ(deck.quadrants[1], screenW - targetX, targetY, -finalScale, finalScale, -state.totalAngleRad);
    updateQ(deck.quadrants[2], targetX, screenH - targetY, finalScale, -finalScale, -state.totalAngleRad);
    updateQ(deck.quadrants[3], screenW - targetX, screenH - targetY, -finalScale, -finalScale, state.totalAngleRad);
  }

  async setTexture(layerId, deckSide, imageSrc, tokenId) {
    if (!this.isReady || !this.layers[layerId]) return;
    const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    if (deck.tokenId === tokenId) return;
    deck.tokenId = tokenId;
    if (!imageSrc) { deck.setTexture(Texture.EMPTY); return; }
    try {
      const imageBitmap = await getDecodedImage(imageSrc);
      if (deck.tokenId === tokenId) deck.setTexture(Texture.from(imageBitmap));
    } catch (e) { console.warn(`[PixiEngine] Failed texture load: ${imageSrc}`); }
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
    Object.keys(deck.interpolators).forEach(key => { if (fullConfig[key] !== undefined) deck.interpolators[key].snap(fullConfig[key]); });
  }

  getState(layerId, deckSide) {
    if (!this.layers[layerId]) return null;
    const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    return { config: {...deck.config}, driftState: {...deck.driftState}, continuousRotationAngle: deck.continuousAngle, playbackValues: {...deck.playbackValues} };
  }

  setCrossfade(val) { this.crossfadeValue = Math.max(0, Math.min(1, val)); }
  setAudioFactors(factors) { this.audioFrequencyFactors = { ...this.audioFrequencyFactors, ...factors }; }
  triggerBeatPulse(factor, duration) { this.beatPulseFactor = factor; this.beatPulseEndTime = performance.now() + duration; }
  setParallax(x, y) { this.parallaxOffset = { x, y }; }
  applyPlaybackValue(layerId, key, value) { if (this.layers[layerId]) { this.layers[layerId].deckA.playbackValues[key] = value; this.layers[layerId].deckB.playbackValues[key] = value; } }
  clearPlaybackValues() { Object.values(this.layers).forEach(l => { l.deckA.playbackValues = {}; l.deckB.playbackValues = {}; }); }
  destroy() { if (this.app) this.app.destroy(true, { children: true, texture: false, baseTexture: false }); this.isReady = false; }
}