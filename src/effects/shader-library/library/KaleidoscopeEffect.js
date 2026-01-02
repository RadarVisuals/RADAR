import { GlProgram, Filter } from 'pixi.js';
import { AbstractShaderEffect } from '../AbstractShaderEffect';
import { defaultFilterVertex } from '../ShaderUtils';

const fragment = `
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

export default class KaleidoscopeEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new Filter({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment, name: 'kaleidoscope-filter' }),
            resources: {
                kaleidoscopeUniforms: { 
                    sides: { value: 0.0, type: 'f32' }, 
                    angle: { value: 0.0, type: 'f32' }, 
                    uScreenSize: { value: { x: 1.0, y: 1.0 }, type: 'vec2<f32>' } 
                }
            },
            resolution: resolution
        });
        // Important: Pixi filters usually have padding=0 for full screen effects to avoid artifacts
        this.filter.padding = 0;
        return this.filter;
    }

    setParam(key, value) {
        const uniforms = this.filter.resources.kaleidoscopeUniforms.uniforms;
        switch(key) {
            case 'sides':
                uniforms.sides = value;
                this.active = value > 0;
                this.filter.enabled = this.active;
                break;
            case 'angle':
                uniforms.angle = value;
                break;
        }
    }

    // Special: Needs screen size update from manager
    update(delta, now) {
        // Handled by setParam mostly, but if we need screen resize logic:
        // The manager handles passing screen size via filter properties usually, 
        // but here we used a uniform. Let's assume the manager might need to call a specific method
        // or we handle resizing via a separate hook. 
        // For now, let's expose a setter for screenSize.
    }
    
    // Custom method called by PixiEffectsManager.update()
    setScreenSize(width, height) {
        if(this.filter) {
            this.filter.resources.kaleidoscopeUniforms.uniforms.uScreenSize = { x: width, y: height };
        }
    }

    static get manifest() {
        return {
            label: 'Kaleidoscope',
            params: {
                sides: { id: 'kaleidoscope.sides', label: 'Segments', type: 'int',   min: 0, max: 32,   default: 0, hardMin: 0, hardMax: 64 },
                angle: { id: 'kaleidoscope.angle', label: 'Rotation', type: 'float', min: 0, max: 6.28, default: 0, hardMin: -100, hardMax: 100 },
            }
        };
    }
}