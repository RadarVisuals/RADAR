import { Filter, GlProgram } from 'pixi.js';
import { AbstractShaderEffect } from '../AbstractShaderEffect';
import { defaultFilterVertex } from '../ShaderUtils';

const fragment = `
    #version 300 es
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    
    uniform sampler2D uTexture;
    uniform vec4 uInputSize;      // (width, height, 1/width, 1/height) of source texture
    uniform vec4 uOutputFrame;    // (x, y, width, height) of destination frame
    
    uniform float uCurvature; 
    uniform float uLineWidth;
    uniform float uLineContrast;
    uniform float uVignette;
    uniform float uNoise;
    uniform float uSeed;
    uniform float uZoom;
    uniform float uTime;

    float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
        // 1. Calculate the actual UV range used by the content
        // vTextureCoord goes from (0,0) to (uOutputFrame.z * uInputSize.z, uOutputFrame.w * uInputSize.w)
        // because Pixi texture coordinates are often mapped to a sub-region of a larger power-of-two texture.
        vec2 maxUV = uOutputFrame.zw * uInputSize.zw;
        
        // 2. Normalize current UV to 0.0 - 1.0 range relative to the content area
        // This ensures '0.5' is the visual center of the content, not the raw texture.
        vec2 uv = vTextureCoord / maxUV;

        // 3. Center UVs for processing
        uv = uv - 0.5;

        // 4. Apply Zoom (Inverse scaling)
        // Higher zoom value = smaller divider = larger coordinates = zoomed out image? 
        // Logic: uv *= scale. If scale < 1, coordinates shrink, fetching closer pixels -> Zoom IN.
        // We want uZoom > 1.0 to Zoom IN. So scale should be < 1.0.
        float scale = 1.0 / max(0.1, uZoom);
        uv *= scale;

        // 5. High-quality Barrel Distortion
        // r2 is squared distance from center
        float r2 = dot(uv, uv);
        // Distortion formula: new_pos = pos * (1.0 + k * r^2)
        // This pushes pixels OUTWARD as they get further from center (Pincushion) or Inward (Barrel).
        // For CRT "bulge", we usually want to sample from *further out* to bring edges in? 
        // Or sample *further in* to push edges out?
        // Actually, to make image look like it's on a curved surface bulging at you:
        // You see *less* of the image at the edges (it wraps around).
        // So we need to sample coordinates that are "further out" than the linear pixel.
        uv *= (1.0 + uCurvature * r2 * 0.5);

        // 6. Restore UVs to 0..1 range
        uv = uv + 0.5;

        // 7. Bounds Check (Hard cutoff for "Bezel" effect)
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            finalColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
        }

        // 8. De-normalize back to Texture Space for sampling
        vec2 texCoord = uv * maxUV;

        vec4 col = texture(uTexture, texCoord);

        // 9. Scanlines
        // Calculate number of lines based on screen height
        if (uLineContrast > 0.0) {
            float count = uOutputFrame.w * uLineWidth * 0.5;
            float s = sin(uv.y * count * 3.14159 * 2.0);
            col.rgb *= mix(1.0, (0.5 + 0.5 * s), uLineContrast);
        }

        // 10. Vignette
        if (uVignette > 0.0) {
            float dist = distance(uv, vec2(0.5));
            // Soften edges based on distance from center
            float val = smoothstep(0.7, 0.3, dist * (0.5 + uVignette));
            col.rgb *= val;
        }

        // 11. Noise
        if (uNoise > 0.0) {
            float n = rand(uv * uSeed + uTime) * uNoise;
            col.rgb += n;
        }

        finalColor = col;
    }
`;

export default class CRTEffect extends AbstractShaderEffect {
    init(resolution) {
        this.filter = new Filter({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment, name: 'crt-filter' }),
            resources: {
                crtUniforms: {
                    uCurvature: { value: 1.0, type: 'f32' },
                    uLineWidth: { value: 1.0, type: 'f32' },
                    uLineContrast: { value: 0.25, type: 'f32' },
                    uVignette: { value: 0.3, type: 'f32' },
                    uNoise: { value: 0.1, type: 'f32' },
                    uSeed: { value: 0.0, type: 'f32' },
                    uZoom: { value: 1.0, type: 'f32' },
                    uTime: { value: 0.0, type: 'f32' }
                }
            },
            resolution: resolution
        });
        return this.filter;
    }

    setParam(key, value) {
        const uniforms = this.filter.resources.crtUniforms.uniforms;
        switch(key) {
            case 'enabled':
                this.active = value > 0.5;
                this.filter.enabled = this.active;
                break;
            case 'curvature': uniforms.uCurvature = value; break;
            case 'lineWidth': uniforms.uLineWidth = value; break;
            case 'lineContrast': uniforms.uLineContrast = value; break;
            case 'vignette': uniforms.uVignette = value; break;
            case 'noise': uniforms.uNoise = value; break;
            case 'zoom': uniforms.uZoom = value; break;
        }
    }

    update(delta) {
        if (this.active) {
            const uniforms = this.filter.resources.crtUniforms.uniforms;
            uniforms.uSeed = Math.random();
            uniforms.uTime += (delta * 0.01);
        }
    }

    static get manifest() {
        return {
            label: 'CRT Monitor',
            category: 'Distortion',
            params: {
                enabled:      { id: 'crt.enabled',      label: 'Active',        type: 'bool',  min: 0, max: 1,   default: 0 },
                zoom:         { id: 'crt.zoom',         label: 'Zoom/Fill',     type: 'float', min: 0.5, max: 2.0, default: 1.0 },
                curvature:    { id: 'crt.curvature',    label: 'Bend',          type: 'float', min: 0, max: 5.0,  default: 1.0 },
                lineContrast: { id: 'crt.lineContrast', label: 'Scanlines',     type: 'float', min: 0, max: 1.0,  default: 0.3 },
                vignette:     { id: 'crt.vignette',     label: 'Vignette',      type: 'float', min: 0, max: 1.0,  default: 0.3 },
                noise:        { id: 'crt.noise',        label: 'Static',        type: 'float', min: 0, max: 0.5,  default: 0.1 },
            }
        };
    }
}