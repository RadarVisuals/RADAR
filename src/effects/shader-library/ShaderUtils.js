// src/effects/shader-library/ShaderUtils.js

// Standard GLSL 300 ES Vertex Shader for full-screen filters in Pixi v8
export const defaultFilterVertex = `
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