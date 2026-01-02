import { GlProgram, Filter } from 'pixi.js';
import { AbstractShaderEffect } from '../AbstractShaderEffect';
import { defaultFilterVertex } from '../ShaderUtils';

const fragment = `
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

export default class VolumetricEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new Filter({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment, name: 'volumetric-filter' }),
            resources: {
                volumetricUniforms: {
                    uLightPos: { value: {x: 0.5, y: 0.5}, type: 'vec2<f32>' },
                    uExposure: { value: 0.0, type: 'f32' },
                    uDecay: { value: 0.95, type: 'f32' },
                    uDensity: { value: 0.8, type: 'f32' },
                    uWeight: { value: 0.4, type: 'f32' },
                    uThreshold: { value: 0.5, type: 'f32' }
                }
            },
            resolution: resolution
        });
        return this.filter;
    }

    setParam(key, value) {
        const uniforms = this.filter.resources.volumetricUniforms.uniforms;
        switch(key) {
            case 'exposure':
                uniforms.uExposure = value;
                this.active = value > 0.01;
                this.filter.enabled = this.active;
                break;
            case 'decay': uniforms.uDecay = value; break;
            case 'density': uniforms.uDensity = value; break;
            case 'x': uniforms.uLightPos.x = value; break;
            case 'y': uniforms.uLightPos.y = value; break;
        }
    }

    static get manifest() {
        return {
            label: 'Volumetric Light',
            params: {
                exposure:  { id: 'volumetric.exposure',  label: 'Exposure',  type: 'float', min: 0, max: 1.0, default: 0.0, hardMin: 0, hardMax: 2.0 },
                decay:     { id: 'volumetric.decay',     label: 'Decay',     type: 'float', min: 0.5, max: 1.0, default: 0.95, hardMin: 0.1, hardMax: 1.0 },
                density:   { id: 'volumetric.density',   label: 'Density',   type: 'float', min: 0, max: 1.0, default: 0.8, hardMin: 0, hardMax: 1.0 },
                x:         { id: 'volumetric.x',         label: 'Source X',  type: 'float', min: 0, max: 1.0, default: 0.5, hardMin: -2.0, hardMax: 3.0 },
                y:         { id: 'volumetric.y',         label: 'Source Y',  type: 'float', min: 0, max: 1.0, default: 0.5, hardMin: -2.0, hardMax: 3.0 },
            }
        };
    }
}