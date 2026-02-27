// ============================================================
//  BloomPipeline — PostFX bloom/glow with configurable strength
//  Cheap 5×5 box-blur on bright pixels, additively blended
// ============================================================
import Phaser from 'phaser';

const fragShader = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uStrength;
uniform float uThreshold;
uniform vec2 uResolution;

varying vec2 outTexCoord;

void main() {
    vec4 color = texture2D(uMainSampler, outTexCoord);

    // Box-blur sample (5×5 kernel)
    float offset = uStrength / uResolution.x;
    vec4 sum = vec4(0.0);
    for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            sum += texture2D(uMainSampler, outTexCoord + vec2(x, y) * offset);
        }
    }
    sum /= 25.0;

    // Threshold → additive bloom
    vec4 bloom = max(sum - uThreshold, 0.0) * 1.5;
    gl_FragColor = color + bloom;
}
`;

export default class BloomPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    constructor(game) {
        super({
            game,
            name: 'BloomPipeline',
            fragShader,
        });
        this._strength = 2.0;
        this._threshold = 0.3;
    }

    onPreRender() {
        this.set1f('uStrength', this._strength);
        this.set1f('uThreshold', this._threshold);
        this.set2f('uResolution', this.renderer.width, this.renderer.height);
    }

    setStrength(v) { this._strength = v; return this; }
    setThreshold(v) { this._threshold = v; return this; }
}
