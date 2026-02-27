// ============================================================
//  ChromaticAberrationPipeline — RGB channel split
//  Activate briefly on heavy impacts for punch feedback
// ============================================================
import Phaser from 'phaser';

const fragShader = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uOffset;

varying vec2 outTexCoord;

void main() {
    float r = texture2D(uMainSampler, outTexCoord + vec2(uOffset, 0.0)).r;
    float g = texture2D(uMainSampler, outTexCoord).g;
    float b = texture2D(uMainSampler, outTexCoord - vec2(uOffset, 0.0)).b;
    float a = texture2D(uMainSampler, outTexCoord).a;
    gl_FragColor = vec4(r, g, b, a);
}
`;

export default class ChromaticAberrationPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    constructor(game) {
        super({
            game,
            name: 'ChromaticAberrationPipeline',
            fragShader,
        });
        this._offset = 0.0;
    }

    onPreRender() {
        this.set1f('uOffset', this._offset);
    }

    setOffset(v) { this._offset = v; return this; }
}
