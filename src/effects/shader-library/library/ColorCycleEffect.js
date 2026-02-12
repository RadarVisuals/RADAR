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
    uniform float uOpacity;

    // RGB to HSV conversion
    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    // HSV to RGB conversion
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
        vec4 color = texture(uTexture, vTextureCoord);
        if (color.a == 0.0) {
            finalColor = color;
            return;
        }

        vec3 hsv = rgb2hsv(color.rgb);
        
        // Shift hue over time
        hsv.x = fract(hsv.x + (uTime * uSpeed * 0.1));
        
        vec3 rgb = hsv2rgb(hsv);
        
        // Blend based on opacity
        finalColor = vec4(mix(color.rgb, rgb, uOpacity), color.a);
    }
`;

export default class ColorCycleEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new Filter({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment, name: 'color-cycle-filter' }),
            resources: {
                colorCycleUniforms: {
                    uTime: { value: 0.0, type: 'f32' },
                    uSpeed: { value: 0.5, type: 'f32' }, // 0.0 = Static, 1.0 = Fast Cycle
                    uOpacity: { value: 1.0, type: 'f32' }
                }
            },
            resolution: resolution
        });
        return this.filter;
    }

    setParam(key, value) {
        const uniforms = this.filter.resources.colorCycleUniforms.uniforms;
        switch(key) {
            case 'enabled':
                this.active = value > 0.5;
                this.filter.enabled = this.active;
                break;
            case 'speed': uniforms.uSpeed = value; break;
            case 'opacity': uniforms.uOpacity = value; break;
        }
    }

    update(delta) {
        if (this.active) {
            this.filter.resources.colorCycleUniforms.uniforms.uTime += (delta * 0.01);
        }
    }

    static get manifest() {
        return {
            label: 'Spectral Cycle',
            category: 'Light & Color',
            params: {
                enabled: { id: 'colorCycle.enabled', label: 'Active', type: 'bool', min: 0, max: 1, default: 0 },
                speed:   { id: 'colorCycle.speed',   label: 'Flow Speed', type: 'float', min: 0, max: 2.0, default: 0.2 },
                opacity: { id: 'colorCycle.opacity', label: 'Mix', type: 'float', min: 0, max: 1.0, default: 1.0 },
            }
        };
    }
}