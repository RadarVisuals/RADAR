import { GlProgram, Filter } from 'pixi.js';
import { AbstractShaderEffect } from '../AbstractShaderEffect';
import { defaultFilterVertex } from '../ShaderUtils';

const fragment = `
    #version 300 es
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;

    uniform sampler2D uTexture;
    uniform vec4 uInputSize;
    uniform float uSize;      
    uniform float uInvert;    
    uniform float uCharSet;   
    uniform float uColorMode; 
    uniform float uTime;      

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float charSetShapes(int index, vec2 p) {
        vec2 c = abs(p - 0.5);
        if (index == 0) return 0.0;
        if (index == 1) return step(length(p-0.5), 0.15); 
        if (index == 2) return step(max(c.x, c.y), 0.3) - step(max(c.x, c.y), 0.2); 
        if (index == 3) return step(min(c.x, c.y), 0.08); 
        if (index == 4) return step(abs(c.x - c.y), 0.08); 
        if (index >= 5) return 1.0; 
        return 0.0;
    }

    float charSetBars(float brightness, vec2 p) {
        return step(p.y, brightness); 
    }

    float charSetBinary(float brightness, vec2 p, vec2 id) {
        if (brightness < 0.2) return 0.0;
        float r = random(id + floor(uTime * 5.0)); 
        if (r > 0.5) {
            return step(abs(p.x - 0.5), 0.1) * step(abs(p.y - 0.5), 0.35); 
        } else {
            vec2 c = abs(p - 0.5);
            return (step(max(c.x, c.y*0.7), 0.35) - step(max(c.x, c.y*0.7), 0.2));
        }
    }

    float charSetDensity(float brightness, vec2 p) {
        float r = length(p - 0.5) * 2.0;
        return step(r, brightness * 1.2); 
    }

    vec3 applyColorMode(vec3 src, float brightness) {
        int mode = int(uColorMode);
        if (mode == 0) return src; 
        if (mode == 1) return vec3(0.0, brightness, 0.0); 
        if (mode == 2) return vec3(1.0, 0.7, 0.0) * brightness; 
        if (mode == 3) return vec3(0.0, 1.0, 1.0) * brightness; 
        if (mode == 4) return vec3(brightness); 
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

export default class AsciiEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new Filter({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment, name: 'ascii-filter' }),
            resources: {
                asciiUniforms: {
                    uSize: { value: 8.0, type: 'f32' },
                    uInvert: { value: 0.0, type: 'f32' },
                    uCharSet: { value: 0.0, type: 'f32' },
                    uColorMode: { value: 0.0, type: 'f32' },
                    uTime: { value: 0.0, type: 'f32' }
                }
            },
            resolution: resolution
        });
        return this.filter;
    }

    setParam(key, value) {
        const uniforms = this.filter.resources.asciiUniforms.uniforms;
        switch(key) {
            case 'enabled':
                this.active = value > 0.5;
                this.filter.enabled = this.active;
                break;
            case 'size': uniforms.uSize = Math.max(1, value); break;
            case 'invert': uniforms.uInvert = value > 0.5 ? 1.0 : 0.0; break;
            case 'charSet': uniforms.uCharSet = value; break;
            case 'colorMode': uniforms.uColorMode = value; break;
        }
    }

    update(delta) {
        if (this.active) {
            this.filter.resources.asciiUniforms.uniforms.uTime += (delta * 0.01);
        }
    }

    static get manifest() {
        return {
            label: 'ASCII / Terminal',
            category: 'Texture & Geo', // <-- Categorized
            params: {
                enabled:   { id: 'ascii.enabled',   label: 'Active',    type: 'bool',  min: 0, max: 1,  default: 0 },
                size:      { id: 'ascii.size',      label: 'Grid Size', type: 'int',   min: 2, max: 50, default: 10, hardMin: 2, hardMax: 200 },
                invert:    { id: 'ascii.invert',    label: 'Invert',    type: 'bool',  min: 0, max: 1,  default: 0 },
                charSet:   { id: 'ascii.charSet',   label: 'Char Set',  type: 'select', min: 0, max: 3, default: 0, options: ['Shapes', 'Data Flow', 'Binary', 'Density'] },
                colorMode: { id: 'ascii.colorMode', label: 'Color',     type: 'select', min: 0, max: 4, default: 0, options: ['Original', 'Matrix', 'Amber', 'Cyan', 'B&W'] },
            }
        };
    }
}