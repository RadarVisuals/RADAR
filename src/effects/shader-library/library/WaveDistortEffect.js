import { GlProgram, Filter } from 'pixi.js';
import { AbstractShaderEffect } from '../AbstractShaderEffect';
import { defaultFilterVertex } from '../ShaderUtils';

const fragment = `
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

export default class WaveDistortEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new Filter({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment, name: 'wave-distort-filter' }),
            resources: {
                waveUniforms: {
                    uTime: { value: 0.0, type: 'f32' },
                    uIntensity: { value: 0.0, type: 'f32' }
                }
            },
            resolution: resolution
        });
        return this.filter;
    }

    setParam(key, value) {
        const uniforms = this.filter.resources.waveUniforms.uniforms;
        if (key === 'intensity') {
            uniforms.uIntensity = value;
            this.active = value > 0.001;
            this.filter.enabled = this.active;
        }
    }

    update(delta) {
        if (this.active) {
            this.filter.resources.waveUniforms.uniforms.uTime += (delta * 0.01);
        }
    }

    static get manifest() {
        return {
            label: 'Wave Distortion',
            params: {
                intensity: { id: 'waveDistort.intensity', label: 'Amplitude', type: 'float', min: 0, max: 2.0, default: 0.0, hardMin: 0, hardMax: 10.0 },
            }
        };
    }
}