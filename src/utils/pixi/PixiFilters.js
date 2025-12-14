// src/utils/pixi/PixiFilters.js
import { Filter, GlProgram } from 'pixi.js';

// --- SHARED VERTEX SHADER (GLSL 300 ES) ---
const defaultFilterVertex = `
    #version 300 es
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

// --- VOLUMETRIC LIGHT ---
const volumetricFragment = `
    #version 300 es
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
            vec4 sampleCol = texture(uTexture, textCoo);
            float brightness = dot(sampleCol.rgb, vec3(0.2126, 0.7152, 0.0722));
            if(brightness < uThreshold) {
                sampleCol *= 0.05;
            }
            sampleCol *= illuminationDecay * uWeight;
            color += sampleCol;
            illuminationDecay *= uDecay;
        }
        
        vec4 realColor = texture(uTexture, vTextureCoord);
        finalColor = realColor + (color * uExposure);
    }
`;

export class VolumetricLightFilter extends Filter {
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

// --- LIQUID FLOW ---
const liquidFragment = `
    #version 300 es
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

export class LiquidFilter extends Filter {
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

// --- WAVE DISTORT ---
const waveDistortFragment = `
    #version 300 es
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

export class WaveDistortFilter extends Filter {
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
    #version 300 es
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

export class KaleidoscopeFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: kaleidoscopeFragment, name: 'kaleidoscope-filter' }),
            resources: {
                kaleidoscopeUniforms: { sides: { value: 6.0, type: 'f32' }, angle: { value: 0.0, type: 'f32' }, uScreenSize: { value: { x: 1.0, y: 1.0 }, type: 'vec2<f32>' } }
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

// --- ADVERSARIAL GLITCH ---
const adversarialFragment = `
    #version 300 es
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    
    uniform sampler2D uTexture;
    uniform vec4 uInputSize; 
    
    uniform float uTime;
    uniform float uIntensity;
    uniform float uBands;
    uniform float uShift;
    uniform float uNoiseScale;
    uniform float uChromatic;
    uniform float uScanline;
    uniform float uQNoise;
    uniform float uSeed;

    float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
    }

    float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453 + uSeed);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    vec2 perturb(vec2 uv) {
        vec2 p = uv * uNoiseScale + vec2(uSeed * 10.0, 0.0);
        float n1 = noise(p);
        float n2 = noise(p + vec2(7.5, 2.5));
        float ridge = sin(uv.y * (50.0 + 100.0 * n1) + uTime * 0.7);
        float angle = sin(uTime * 0.33 + n2 * 6.28318);
        vec2 dir = vec2(cos(angle), sin(angle));
        vec2 disp = dir * ridge * 0.002 * uIntensity;
        float hf = sin(uv.x * 800.0 + n2 * 10.0) * 0.0008 * uIntensity;
        return uv + disp + vec2(hf, -hf);
    }

    float bandMask(vec2 uv) {
        float bands = max(1.0, uBands);
        float y = uv.y * bands;
        float fracY = fract(y);
        float gate = step(0.5, hash11(floor(y) + uSeed * 100.0));
        float jitter = noise(vec2(fracY * 10.0, uTime * 0.5));
        return gate * jitter;
    }

    vec2 bandShift(vec2 uv) {
        float m = bandMask(uv);
        float shift = (m - 0.5) * 0.002 * uShift; 
        return uv + vec2(shift, 0.0);
    }

    vec3 sampleChromatic(vec2 uv) {
        vec2 cOff = vec2(0.001 * uChromatic, 0.0); 
        float r = texture(uTexture, uv + cOff).r;
        float g = texture(uTexture, uv).g;
        float b = texture(uTexture, uv - cOff).b;
        return vec3(r, g, b);
    }

    vec3 postProcess(vec2 uv, vec3 col) {
        float scan = 0.5 + 0.5 * sin(uv.y * 500.0 * 3.14159);
        col *= mix(1.0, 1.0 + uScanline * (scan - 0.5), uScanline);
        
        if(uQNoise > 0.0) {
            vec3 q = floor(col * (256.0 - uQNoise) + noise(uv * 1024.0) * uQNoise) / (256.0 - uQNoise);
            col = mix(col, q, uQNoise / 8.0);
        }
        return col;
    }

    void main() {
        vec2 uv = vTextureCoord;
        vec2 uvWarp = perturb(uv);
        vec2 uvGlitch = bandShift(uvWarp);
        vec3 col = sampleChromatic(uvGlitch);
        float n = noise(uvGlitch * (uNoiseScale * 0.5 + 0.001 + uIntensity * 0.5));
        col += (n - 0.5) * 0.02 * uIntensity;
        col = postProcess(uvGlitch, col);
        finalColor = vec4(col, 1.0);
    }
`;

export class AdversarialGlitchFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: adversarialFragment, name: 'adversarial-glitch-filter' }),
            resources: {
                adversarialUniforms: {
                    uTime: { value: 0.0, type: 'f32' },
                    uIntensity: { value: 0.8, type: 'f32' },
                    uBands: { value: 24.0, type: 'f32' },
                    uShift: { value: 12.0, type: 'f32' },
                    uNoiseScale: { value: 3.0, type: 'f32' },
                    uChromatic: { value: 1.5, type: 'f32' },
                    uScanline: { value: 0.35, type: 'f32' },
                    uQNoise: { value: 2.0, type: 'f32' },
                    uSeed: { value: 0.42, type: 'f32' }
                }
            }
        });
    }
    
    get time() { return this.resources.adversarialUniforms.uniforms.uTime; }
    set time(v) { this.resources.adversarialUniforms.uniforms.uTime = v; }
    
    set intensity(v) { this.resources.adversarialUniforms.uniforms.uIntensity = v; }
    set bands(v) { this.resources.adversarialUniforms.uniforms.uBands = v; }
    set shift(v) { this.resources.adversarialUniforms.uniforms.uShift = v; }
    set noiseScale(v) { this.resources.adversarialUniforms.uniforms.uNoiseScale = v; }
    set chromatic(v) { this.resources.adversarialUniforms.uniforms.uChromatic = v; }
    set scanline(v) { this.resources.adversarialUniforms.uniforms.uScanline = v; }
    set qNoise(v) { this.resources.adversarialUniforms.uniforms.uQNoise = v; }
    set seed(v) { this.resources.adversarialUniforms.uniforms.uSeed = v; }
}

// --- ADVANCED ASCII / TEXTMODE FILTER ---
const asciiFragment = `
    #version 300 es
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;

    uniform sampler2D uTexture;
    uniform vec4 uInputSize;
    uniform float uSize;      
    uniform float uInvert;    
    uniform float uCharSet;   // 0: Shapes, 1: Data Bars, 2: Binary, 3: Dense
    uniform float uColorMode; // 0: Color, 1: Green, 2: Amber, 3: Cyan, 4: B&W
    uniform float uTime;      // For animations

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    // --- CHARACTER SETS ---

    // Set 0: Abstract Geometric Shapes
    float charSetShapes(int index, vec2 p) {
        vec2 c = abs(p - 0.5);
        if (index == 0) return 0.0;
        if (index == 1) return step(length(p-0.5), 0.15); // Dot
        if (index == 2) return step(max(c.x, c.y), 0.3) - step(max(c.x, c.y), 0.2); // Box Outline
        if (index == 3) return step(min(c.x, c.y), 0.08); // Plus
        if (index == 4) return step(abs(c.x - c.y), 0.08); // Cross
        if (index >= 5) return 1.0; // Block
        return 0.0;
    }

    // Set 1: Data Flow (Vertical Bars)
    float charSetBars(float brightness, vec2 p) {
        return step(p.y, brightness); // Height based on brightness
    }

    // Set 2: Binary / Crypto (0 or 1)
    float charSetBinary(float brightness, vec2 p, vec2 id) {
        if (brightness < 0.2) return 0.0;
        float r = random(id + floor(uTime * 5.0)); // Random 0 or 1 change speed
        if (r > 0.5) {
            // Draw '1'
            return step(abs(p.x - 0.5), 0.1) * step(abs(p.y - 0.5), 0.35); 
        } else {
            // Draw '0'
            vec2 c = abs(p - 0.5);
            return (step(max(c.x, c.y*0.7), 0.35) - step(max(c.x, c.y*0.7), 0.2));
        }
    }

    // Set 3: Density / Halftone
    float charSetDensity(float brightness, vec2 p) {
        float r = length(p - 0.5) * 2.0;
        return step(r, brightness * 1.2); 
    }

    // --- COLOR MODES ---
    vec3 applyColorMode(vec3 src, float brightness) {
        int mode = int(uColorMode);
        if (mode == 0) return src; // Original
        if (mode == 1) return vec3(0.0, brightness, 0.0); // Matrix Green
        if (mode == 2) return vec3(1.0, 0.7, 0.0) * brightness; // Amber Terminal
        if (mode == 3) return vec3(0.0, 1.0, 1.0) * brightness; // Cyan Cyber
        if (mode == 4) return vec3(brightness); // B&W
        return src;
    }

    void main() {
        vec2 pixelSize = vec2(uSize) / uInputSize.xy;
        vec2 gridID = floor(vTextureCoord / pixelSize);
        vec2 gridUV = gridID * pixelSize + (pixelSize * 0.5);
        
        vec4 color = texture(uTexture, gridUV);
        float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        
        vec2 cellCoord = fract(vTextureCoord / pixelSize);
        float shape = 0.0;

        int set = int(uCharSet);
        if (set == 0) {
            int charIndex = int(floor(brightness * 5.9));
            shape = charSetShapes(charIndex, cellCoord);
        } else if (set == 1) {
            shape = charSetBars(brightness, cellCoord);
        } else if (set == 2) {
            shape = charSetBinary(brightness, cellCoord, gridID);
        } else if (set == 3) {
            shape = charSetDensity(brightness, cellCoord);
        }

        vec3 processedColor = applyColorMode(color.rgb, brightness);
        
        if (uInvert > 0.5) {
            finalColor = vec4(processedColor * (1.0 - shape), 1.0); 
        } else {
            finalColor = vec4(processedColor * shape, 1.0); 
        }
        finalColor.a = 1.0;
    }
`;

export class AsciiFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: asciiFragment, name: 'ascii-filter' }),
            resources: {
                asciiUniforms: {
                    uSize: { value: 8.0, type: 'f32' },
                    uInvert: { value: 0.0, type: 'f32' },
                    uCharSet: { value: 0.0, type: 'f32' },
                    uColorMode: { value: 0.0, type: 'f32' },
                    uTime: { value: 0.0, type: 'f32' }
                }
            }
        });
    }
    get size() { return this.resources.asciiUniforms.uniforms.uSize; }
    set size(v) { this.resources.asciiUniforms.uniforms.uSize = v; }
    
    get invert() { return this.resources.asciiUniforms.uniforms.uInvert; }
    set invert(v) { this.resources.asciiUniforms.uniforms.uInvert = v; }

    get charSet() { return this.resources.asciiUniforms.uniforms.uCharSet; }
    set charSet(v) { this.resources.asciiUniforms.uniforms.uCharSet = v; }

    get colorMode() { return this.resources.asciiUniforms.uniforms.uColorMode; }
    set colorMode(v) { this.resources.asciiUniforms.uniforms.uColorMode = v; }

    get time() { return this.resources.asciiUniforms.uniforms.uTime; }
    set time(v) { this.resources.asciiUniforms.uniforms.uTime = v; }
}