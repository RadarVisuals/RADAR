// src/effects/shader-library/library/LiquidEffect.js
import { Filter, GlProgram } from 'pixi.js';
import { AbstractShaderEffect } from '../AbstractShaderEffect';
import { defaultFilterVertex } from '../ShaderUtils';

const fragment = `
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

export default class LiquidEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new Filter({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment, name: 'liquid-filter' }),
            resources: {
                liquidUniforms: {
                    uTime: { value: 0.0, type: 'f32' },
                    uSpeed: { value: 0.5, type: 'f32' },
                    uScale: { value: 3.0, type: 'f32' },
                    uIntensity: { value: 0.0, type: 'f32' }
                }
            },
            resolution: resolution
        });
        return this.filter;
    }

    setParam(key, value) {
        const uniforms = this.filter.resources.liquidUniforms.uniforms;
        
        switch(key) {
            case 'intensity':
                uniforms.uIntensity = value;
                this.active = value > 0.001;
                this.filter.enabled = this.active;
                break;
            case 'speed':
                uniforms.uSpeed = value;
                break;
            case 'scale':
                uniforms.uScale = value;
                break;
            case 'enabled':
                this.active = value > 0.5;
                this.filter.enabled = this.active;
                break;
        }
    }

    update(delta) {
        if (this.active) {
            this.filter.resources.liquidUniforms.uniforms.uTime += (delta * 0.01);
        }
    }

    static get manifest() {
        return {
            label: 'Liquid Flow',
            category: 'Texture & Geo', // <-- Added Category
            params: {
                intensity: { id: 'liquid.intensity', label: 'Amount', type: 'float', min: 0, max: 0.5, default: 0.0, hardMin: 0, hardMax: 2.0 },
                scale:     { id: 'liquid.scale',     label: 'Density', type: 'float', min: 0.1, max: 10, default: 3.0, hardMin: 0.01, hardMax: 50 },
                speed:     { id: 'liquid.speed',     label: 'Speed',   type: 'float', min: 0, max: 5.0, default: 0.5, hardMin: 0, hardMax: 20 },
            }
        };
    }
}