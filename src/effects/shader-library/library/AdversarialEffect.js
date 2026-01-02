// src/effects/shader-library/library/AdversarialEffect.js
import { Filter, GlProgram } from 'pixi.js';
import { AbstractShaderEffect } from '../AbstractShaderEffect';
import { defaultFilterVertex } from '../ShaderUtils';

const fragment = `
    #version 300 es
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    
    uniform sampler2D uTexture;
    uniform vec4 uInputSize; 
    
    uniform float uTime;
    uniform float uIntensity; // Acts as "Power"
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
        // Scale shift by uIntensity to allow full fade out
        float shift = (m - 0.5) * 0.002 * uShift * uIntensity; 
        return uv + vec2(shift, 0.0);
    }

    vec3 sampleChromatic(vec2 uv) {
        // Scale chromatic split by uIntensity
        vec2 cOff = vec2(0.001 * uChromatic * uIntensity, 0.0); 
        float r = texture(uTexture, uv + cOff).r;
        float g = texture(uTexture, uv).g;
        float b = texture(uTexture, uv - cOff).b;
        return vec3(r, g, b);
    }

    vec3 postProcess(vec2 uv, vec3 col) {
        float scan = 0.5 + 0.5 * sin(uv.y * 500.0 * 3.14159);
        
        // Scale scanline opacity by clamped intensity (0-1)
        float scanStrength = uScanline * clamp(uIntensity, 0.0, 1.0);
        col *= mix(1.0, 1.0 + scanStrength * (scan - 0.5), scanStrength);
        
        // Scale quantization by intensity
        float qMix = uQNoise * uIntensity;
        if(qMix > 0.0) {
            vec3 q = floor(col * (256.0 - qMix) + noise(uv * 1024.0) * qMix) / (256.0 - qMix);
            col = mix(col, q, clamp(qMix / 8.0, 0.0, 1.0));
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

export default class AdversarialEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new Filter({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment, name: 'adversarial-filter' }),
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
            },
            resolution: resolution
        });
        return this.filter;
    }

    setParam(key, value) {
        const uniforms = this.filter.resources.adversarialUniforms.uniforms;
        
        switch(key) {
            case 'enabled':
                this.active = value > 0.5;
                this.filter.enabled = this.active;
                break;
            case 'intensity':
                uniforms.uIntensity = value;
                break;
            case 'bands':
                uniforms.uBands = value;
                break;
            case 'noiseScale':
                uniforms.uNoiseScale = value;
                break;
            case 'chromatic':
                uniforms.uChromatic = value;
                break;
            // These params were in the shader but missing from old UI manifest, mapping them just in case
            case 'shift': uniforms.uShift = value; break;
            case 'scanline': uniforms.uScanline = value; break;
            case 'qNoise': uniforms.uQNoise = value; break;
        }
    }

    update(delta) {
        if (this.active) {
            const uniforms = this.filter.resources.adversarialUniforms.uniforms;
            uniforms.uTime += (delta * 0.01);
            uniforms.uSeed = Math.random(); // Randomize seed every frame for glitch flicker
        }
    }

    static get manifest() {
        return {
            label: 'Data Mosh (Adversarial)', 
            params: {
                enabled:    { id: 'adversarial.enabled',    label: 'Active',      type: 'bool',  min: 0, max: 1,   default: 0 },
                intensity:  { id: 'adversarial.intensity',  label: 'Power',       type: 'float', min: 0, max: 2.0, default: 0.5, hardMin: 0, hardMax: 5.0 },
                bands:      { id: 'adversarial.bands',      label: 'Bands',       type: 'float', min: 1, max: 64,  default: 24, hardMin: 1, hardMax: 128 },
                noiseScale: { id: 'adversarial.noiseScale', label: 'Noise Scale', type: 'float', min: 0.1, max: 12, default: 3.0, hardMin: 0.01, hardMax: 50 },
                chromatic:  { id: 'adversarial.chromatic',  label: 'RGB Split',   type: 'float', min: 0, max: 10,  default: 1.5, hardMin: 0, hardMax: 100 },
            }
        };
    }
}