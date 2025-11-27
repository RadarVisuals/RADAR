// src/utils/pixi/PixiFilters.js
import { Filter, GlProgram } from 'pixi.js';

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

// --- VOLUMETRIC LIGHT ---
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
    }
    get sides() { return this.resources.kaleidoscopeUniforms.uniforms.sides; }
    set sides(value) { this.resources.kaleidoscopeUniforms.uniforms.sides = value; }
    get angle() { return this.resources.kaleidoscopeUniforms.uniforms.angle; }
    set angle(value) { this.resources.kaleidoscopeUniforms.uniforms.angle = value; }
    get screenSize() { return this.resources.kaleidoscopeUniforms.uniforms.uScreenSize; }
    set screenSize(value) { this.resources.kaleidoscopeUniforms.uniforms.uScreenSize = value; }
}