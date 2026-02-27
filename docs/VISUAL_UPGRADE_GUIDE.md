# Pocket Roguelite — Visual Upgrade Guide
## From Plain Vector to Arcade-Juicy Pro Visuals

---

## 1. Executive Summary

Upgrade visuals **entirely within Phaser 3's WebGL pipeline** — no PixiJS or Three.js needed. Use Phaser's built-in `postFX` API for camera-level bloom/vignette/glow, its native particle system with `blendMode: 'ADD'` and `color` interpolation for juicy bursts, and custom `PostFXPipeline` subclasses for advanced shaders (chromatic aberration, CRT, screen-space blur). Add soft trails via particle emitters with `follow` or a `RenderTexture` feedback loop. Generate spherical normal maps at runtime for dynamic Light2D lighting on balls. This stack keeps everything in one renderer, batches efficiently, and avoids cross-library integration pain.

---

## 2. Libraries / APIs / Frameworks

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **Phaser 3** (PostFXPipeline + postFX API) | Native integration, zero glue code, built-in bloom/glow/vignette, custom GLSL shaders | Shader authoring more manual than PixiJS filters | **PRIMARY — use this** |
| **PIXI.js** + pixi-filters/pixi-particles | Rich filter library (60+ filters), great particle emitter | Completely incompatible with Phaser 3's renderer — different batch/FBO system | **DO NOT USE** with Phaser 3 |
| **Three.js** (hybrid 2.5D) | GPU instanced particles, compute shaders, post-process via EffectComposer | Requires managing two canvases or a shared GL context; overkill for 2D snooker | **Skip** unless building a 3D mode |
| **regl / twgl / raw WebGL** | Maximum control, instanced draw for 10k+ particles | Requires manual WebGL state management alongside Phaser | **Only** if particle count > 5000 |
| **WebGPU** | Future-proof, compute shaders for massive particles | Browser support ~65%, no Phaser integration yet, API unstable | **Not yet** — revisit in 2027 |
| **Spine / DragonBones** | Rich skeletal animation for characters/UI | Your game has no character sprites — irrelevant for billiard balls | **Skip** |
| **Aseprite** | Best-in-class pixel art + animation workflow | Relevant if adding pixel-art sprites later | **Optional** for asset pipeline |
| **GPU particle frameworks** | Millions of particles via transform feedback / compute | Requires custom WebGL pipeline or Three.js | **Skip** — Phaser handles 5k+ particles fine |

---

## 3. Effect Recipes

### 3.1 Bloom / Glow (Post-Process)
**Complexity:** Trivial (1 line) to Medium (custom shader)
**Library:** Phaser 3 built-in `postFX`

```js
// Quick — camera-level bloom
this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 1, 1.2);

// Per-object glow (special balls, buildings)
ball.gfx.postFX.addGlow(0xff4400, 4, 0, false, 0.1, 16);
```

**Pipeline placement:** Applied after scene renders, before final composite.
**Perf:** Camera bloom = 1 extra full-screen pass. Object glow = 1 pass per object. Keep object glow to < 20 objects.

### 3.2 Additive GPU Particle Bursts
**Complexity:** Low
**Library:** Phaser 3 particles

```js
const emitter = scene.add.particles(x, y, 'particle', {
    speed: { min: 80, max: 300 },
    scale: { start: 4, end: 0 },
    color: [0xffffff, 0xffff00, 0xff8800, 0xff2200], // white-hot → red
    colorEase: 'Quad.Out',
    lifespan: { min: 200, max: 600 },
    blendMode: 'ADD',
    gravityY: 40,
    emitting: false,
});
emitter.explode(30);
```

**Pipeline placement:** Rendered in scene graph at depth, ADD blend breaks batch from NORMAL sprites.
**Perf:** 30 particles × 600ms lifespan = ~30 active at peak. Negligible.

### 3.3 Soft Trails (Particle Follow)
**Complexity:** Low
**Library:** Phaser 3 particles

```js
const trail = scene.add.particles(0, 0, 'particle', {
    speed: 0,
    scale: { start: 1.5, end: 0 },
    alpha: { start: 0.4, end: 0 },
    lifespan: 300,
    frequency: 30,
    tint: ballColor,
    blendMode: 'ADD',
    follow: ball.gfx,
});
```

**Alt: RenderTexture feedback** — stamp ball positions each frame into a persistent RT, fade with `rt.fill(bgColor, 0.05)`.
**Perf:** ~10 particles alive per ball × 15 balls = 150 particles. Trivial.

### 3.4 Normal-Map Lighting (Dynamic Lights)
**Complexity:** Medium
**Library:** Phaser 3 Light2D pipeline

```js
// Enable lights system
this.lights.enable();
this.lights.setAmbientColor(0x444444);

// Add dynamic light following cue ball
this.cueBallLight = this.lights.addLight(0, 0, 200, 0xffffcc, 1.5);
// Update in loop: this.cueBallLight.setPosition(cueBall.x, cueBall.y);

// Sprites need Light2D pipeline + normal map texture
sprite.setPipeline('Light2D');
```

**Pipeline placement:** Built-in pipeline, replaces default single-texture pipeline.
**Perf:** Max 10 lights (PHASER_MAX_LIGHTS). Each light = 1 extra uniform set per batch. Fine for < 5 lights.

### 3.5 Squash & Stretch + Transform Tweening
**Complexity:** Trivial
**Library:** Phaser 3 tweens (built-in)

```js
scene.tweens.add({
    targets: ball.gfx,
    scaleX: { from: 1.4, to: 1 },
    scaleY: { from: 0.6, to: 1 },
    duration: 120,
    ease: 'Bounce.Out',
});
```

Already implemented in `JuiceEffects.squashStretch()`. No GSAP needed — Phaser tweens are sufficient.

### 3.6 Palette Shader / SDF Fonts
**Complexity:** Medium (custom PostFXPipeline)
**Library:** Phaser 3 PostFXPipeline

```glsl
// Palette swap fragment shader
precision mediump float;
uniform sampler2D uMainSampler;
uniform sampler2D uPalette; // 256x1 palette texture
varying vec2 outTexCoord;

void main() {
    vec4 color = texture2D(uMainSampler, outTexCoord);
    float index = color.r; // use red channel as palette index
    vec4 mapped = texture2D(uPalette, vec2(index, 0.5));
    gl_FragColor = vec4(mapped.rgb, color.a);
}
```

**Perf:** 1 extra texture lookup per pixel. Negligible.

### 3.7 Metaballs / Gooblobs (SDF)
**Complexity:** High
**Library:** Custom PostFXPipeline

```glsl
// SDF metaball — pass ball positions as uniform array
uniform vec2 uBalls[16];
uniform int uBallCount;

float metaball(vec2 uv) {
    float sum = 0.0;
    for (int i = 0; i < 16; i++) {
        if (i >= uBallCount) break;
        float d = distance(uv, uBalls[i]);
        sum += 1.0 / (d * d + 0.001);
    }
    return sum;
}
```

**Perf:** O(pixels × balls). Keep ball count < 16 for this pass. Can render at half resolution.

### 3.8 Screen-Space Motion Blur
**Complexity:** Medium
**Library:** Custom PostFXPipeline

```glsl
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uVelocity; // camera/screen velocity
uniform float uStrength;
varying vec2 outTexCoord;

void main() {
    vec4 color = vec4(0.0);
    vec2 vel = uVelocity * uStrength;
    for (float i = -3.0; i <= 3.0; i += 1.0) {
        color += texture2D(uMainSampler, outTexCoord + vel * i / 3.0);
    }
    gl_FragColor = color / 7.0;
}
```

**Perf:** 7 texture samples per pixel. Only activate during camera shake.

### 3.9 Camera Shake + Chromatic Aberration
**Complexity:** Low (shake) + Medium (CA shader)
**Library:** Phaser 3 built-in + PostFXPipeline

```js
// Shake (already in JuiceEffects)
camera.shake(duration, intensity / 1000);

// Chromatic aberration — activate briefly on heavy hits
// See ChromaticAberrationPipeline in Section 4
const ca = camera.getPostPipeline('ChromaticAberrationPipeline');
ca.setOffset(0.005);
scene.time.delayedCall(150, () => ca.setOffset(0));
```

**Perf:** 3 texture samples per pixel (R/G/B offset). Negligible when brief.

### 3.10 Particle Decals / Splats (Persistent)
**Complexity:** Low
**Library:** Phaser 3 RenderTexture

```js
// Create a persistent decal layer
this.decalRT = this.add.renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT).setDepth(1);

// On impact, stamp a splat texture
onImpact(x, y, color) {
    const splat = this.add.circle(x, y, 8, color, 0.3);
    this.decalRT.draw(splat);
    splat.destroy();
}
```

**Perf:** Each stamp = 1 draw to RT. The RT itself = 1 sprite draw. Excellent for persistent marks.

---

## 4. Code Snippets (Copy-Pasteable)

### 4.1 Bloom PostFXPipeline

```js
// src/pipelines/BloomPipeline.js
import Phaser from 'phaser';

const fragShader = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform float uStrength;
uniform vec2 uResolution;
varying vec2 outTexCoord;

void main() {
    vec4 color = texture2D(uMainSampler, outTexCoord);
    float offset = uStrength / uResolution.x;
    vec4 sum = vec4(0.0);
    for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            sum += texture2D(uMainSampler, outTexCoord + vec2(x, y) * offset);
        }
    }
    sum /= 25.0;
    vec4 bloom = max(sum - 0.3, 0.0) * 1.5;
    gl_FragColor = color + bloom;
}
`;

export default class BloomPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    constructor(game) {
        super({ game, name: 'BloomPipeline', fragShader });
        this._strength = 2.0;
    }
    onPreRender() {
        this.set1f('uStrength', this._strength);
        this.set2f('uResolution', this.renderer.width, this.renderer.height);
    }
    setStrength(v) { this._strength = v; return this; }
}
```

### 4.2 Chromatic Aberration PostFXPipeline

```js
// src/pipelines/ChromaticAberrationPipeline.js
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
        super({ game, name: 'ChromaticAberrationPipeline', fragShader });
        this._offset = 0.0;
    }
    onPreRender() { this.set1f('uOffset', this._offset); }
    setOffset(v) { this._offset = v; return this; }
}
```

### 4.3 Phaser Integration — Registering Pipelines

```js
// In main.js — add to Phaser config:
import BloomPipeline from './pipelines/BloomPipeline.js';
import ChromaticAberrationPipeline from './pipelines/ChromaticAberrationPipeline.js';

const config = {
    type: Phaser.WEBGL,  // REQUIRED for PostFX
    // ... existing config ...
    pipeline: [BloomPipeline, ChromaticAberrationPipeline],
};
```

```js
// In PlayScene.create():
// Camera-level effects
this.cameras.main.setPostPipeline([BloomPipeline, ChromaticAberrationPipeline]);

// Built-in effects (no custom pipeline needed)
this.cameras.main.postFX.addVignette(0.5, 0.5, 0.3, 0.5);

// Per-ball glow
for (const ball of this.physicsSystem.activeBalls) {
    if (ball.data.special?.action && ball.data.special.action !== 'none') {
        const c = Phaser.Display.Color.HexStringToColor(ball.data.color).color;
        ball.gfx.postFX.addGlow(c, 4, 0, false, 0.1, 12);
    }
}

// Trigger CA on heavy hit
onHeavyImpact() {
    const ca = this.cameras.main.getPostPipeline('ChromaticAberrationPipeline');
    ca.setOffset(0.004);
    this.time.delayedCall(120, () => ca.setOffset(0));
}
```

### 4.4 Enhanced Particle Burst with Color Interpolation

```js
// In JuiceEffects.js — upgraded explosion
explosionAt(x, y, radius = 60) {
    if (!this.scene.textures.exists('particle')) return;
    const count = Math.min(40, Math.max(12, Math.floor(radius / 2.5)));
    const emitter = this.scene.add.particles(x, y, 'particle', {
        speed: { min: 60, max: 280 },
        scale: { start: 4, end: 0 },
        lifespan: { min: 200, max: 700 },
        color: [0xffffff, 0xffff66, 0xff8800, 0xff2200, 0x440000],
        colorEase: 'Quad.Out',
        blendMode: 'ADD',
        gravityY: 40,
        emitting: false,
    });
    emitter.setDepth(50);
    emitter.explode(count);
    this.scene.time.delayedCall(800, () => emitter.destroy());
}
```

### 4.5 Ball Trail Emitter

```js
// Add trailing particles that follow a ball
createTrail(ball) {
    const color = Phaser.Display.Color.HexStringToColor(ball.data.color || '#ffffff').color;
    const trail = this.scene.add.particles(0, 0, 'particle', {
        speed: { min: 0, max: 5 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 0.35, end: 0 },
        lifespan: 250,
        frequency: 25,
        tint: color,
        blendMode: 'ADD',
        follow: ball.gfx,
    });
    trail.setDepth(5);
    return trail;
}
```

### 4.6 Spherical Normal Map Generation (Runtime)

```js
// In BootScene.generatePlaceholderTextures():
generateBallNormalMap(radius = 24) {
    const size = radius * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const nx = (x / size) * 2 - 1;
            const ny = (y / size) * 2 - 1;
            const distSq = nx * nx + ny * ny;
            const i = (y * size + x) * 4;
            if (distSq <= 1) {
                const nz = Math.sqrt(1 - distSq);
                imageData.data[i]     = Math.floor((nx * 0.5 + 0.5) * 255);
                imageData.data[i + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
                imageData.data[i + 2] = Math.floor(nz * 255);
                imageData.data[i + 3] = 255;
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
    this.textures.addCanvas('ball_normal', canvas);
}
```

---

## 5. Asset & Artist Pipeline

### 5.1 Sprite Atlases (TexturePacker / Aseprite)
1. Export all small sprites (balls, particles, UI icons) into a single atlas via **TexturePacker** or **Free Texture Packer**
2. Output format: `{name}.png` + `{name}.json` (Phaser JSON Hash format)
3. Max atlas size: 2048×2048 for broad GPU compatibility
4. Load: `this.load.atlas('sprites', 'sprites.png', 'sprites.json')`
5. This batches all sprites into 1 draw call

### 5.2 Normal Maps from Pixel Art
- **Laigter** (free, open source) — auto-generates normal maps from 2D sprites
- **SpriteIlluminator** (TexturePacker companion) — more control
- **Photoshop/GIMP manual:** Convert to grayscale → Filter > 3D > Generate Normal Map
- Export with `_n` suffix: `ball_red.png` → `ball_red_n.png`
- For your runtime-generated textures: use the spherical normal map code from 4.6

### 5.3 Palette Management
- Define a master palette (12-16 colors) in a shared config file
- Export as a 256×1 PNG strip for palette-swap shaders
- Use CSS custom properties for UI palette consistency:
  ```css
  :root { --bg: #1a472a; --accent: #ffdd00; --danger: #ff4444; }
  ```

### 5.4 Particle Sheets vs GPU Raw Textures
- **Particle sheets:** 4×4 or 8×8 grid of particle frames, loaded as spritesheet. Use `frame` config.
- **GPU raw:** For your 4×4 white square approach — ideal. One texture, tinted per-particle. Maximum batching.
- Recommendation: Keep the 4×4 white square for most particles. Add a soft circle (radial gradient, 16×16) for glow particles.

### 5.5 Folder Layout

```
public/
├── audio/           # .wav/.ogg files (when replacing procedural audio)
├── sprites/
│   ├── atlas.png    # Combined texture atlas
│   ├── atlas.json   # Atlas data (Phaser JSON Hash)
│   ├── atlas_n.png  # Normal map atlas
│   └── particles/
│       ├── soft_circle.png
│       └── spark.png
├── fonts/           # .woff2 bitmap fonts
└── style.css
```

---

## 6. Performance & Scaling Checklist

| Rule | Target | Notes |
|------|--------|-------|
| Draw calls | < 100 (ideal < 50) | Use atlases, same blend mode, same depth sorting |
| Sprite batching | All balls/buildings in one atlas | Phaser auto-batches same-texture same-blend |
| Active particles | < 2000 simultaneous | Your current peak: ~100. Massive headroom |
| PostFX passes | < 4 on camera | Each = 1 full-screen draw. bloom + vignette + CA = 3 passes |
| Object glow | < 15 objects with `postFX.addGlow()` | Each = separate FBO round-trip |
| Frame budget | < 12ms render (60fps) | Profile with `game.loop.actualFps` |
| Texture memory | < 64MB total | Your runtime textures: < 1MB. Atlas: ~4MB |
| GC avoidance | Pool particle emitters | Reuse via `emitter.setPosition()` + `explode()` instead of create/destroy |
| Tween count | < 50 active tweens | Your floating text + squash/stretch: ~10 peak |
| Mobile fallback | Halve particle counts, skip bloom | `if (this.sys.game.device.os.android) { ... }` |

### Profiling Commands
```js
// In DebugUI, add:
const fps = this.scene.game.loop.actualFps.toFixed(1);
const draws = this.scene.renderer?.drawCount || 'N/A';
this.debugText.setText(`FPS: ${fps} | Draws: ${draws} | Balls: ${balls.length}`);
```

---

## 7. Integration Step-by-Step Plan

### Step 1: WebGL + Camera Bloom + Vignette
**Who:** Front-end
**Work:** Change `Phaser.AUTO` → `Phaser.WEBGL` in main.js. Add `postFX.addBloom()` and `postFX.addVignette()` in PlayScene.
**Time:** ~30 min
**Test:** Game renders with subtle glow and darkened edges. No performance regression.

### Step 2: Enhanced Particles (ADD blend, color interp)
**Who:** Front-end
**Work:** Update all emitters in JuiceEffects.js: add `blendMode: 'ADD'`, replace `tint` arrays with `color` + `colorEase`, add `gravityY` to explosions.
**Time:** ~1 hour
**Test:** Explosions glow bright, sparks have white-hot cores, particles drift slightly downward.

### Step 3: Ball Trails + Decal Layer
**Who:** Front-end
**Work:** Add trail emitters with `follow` in PlayScene. Create a RenderTexture decal layer for persistent impact marks.
**Time:** ~1 hour
**Test:** Moving balls leave fading light trails. Impact points have lingering splats.

### Step 4: Per-Object Glow on Special Balls
**Who:** Front-end
**Work:** In Ball.js constructor, add `gfx.postFX.addGlow()` for balls with `special.action !== 'none'`.
**Time:** ~30 min
**Test:** Explosive balls glow orange, ghost balls glow blue, etc.

### Step 5: Chromatic Aberration on Heavy Hits
**Who:** Front-end
**Work:** Create ChromaticAberrationPipeline, register in main.js, trigger on impacts > threshold.
**Time:** ~1 hour
**Test:** Powerful shots cause brief RGB split effect. Auto-clears after 120ms.

### Step 6: Profile & Optimize
**Who:** Front-end
**Work:** Add FPS/draw-call counter to DebugUI. Profile with Chrome DevTools Performance tab. Pool emitters if needed. Test mobile.
**Time:** ~1 hour
**Test:** Stable 60fps with all effects active on mid-range hardware. Draw calls < 100.

---

## 8. Reference Games & Visual Patterns

| Game | What to Learn |
|------|---------------|
| **Agar.io / Slither.io** | Massive entity scaling + extreme batching, smooth trails on thousands of objects, minimal draw calls |
| **Vampire Survivors** | Screen-filling particle mayhem, blendMode ADD for every hit, clear visual hierarchy despite chaos |
| **Nuclear Throne** | Screenshake as a design language, chromatic aberration on damage, camera punch, crunchy hit feedback |
| **Disc Room** | Tight juice loops: squash/stretch + screenshake + particles on every collision, minimal art maximum feel |
| **Neon White** | High-contrast color palette, bloom on key elements, motion blur for speed feedback, clean readability under effects |

---

## 9. Starter Kit Checklist

If asked to continue, produce:

- [ ] `src/pipelines/BloomPipeline.js` — custom PostFXPipeline with configurable strength
- [ ] `src/pipelines/ChromaticAberrationPipeline.js` — brief RGB split shader
- [ ] `src/pipelines/VignettePipeline.js` — darkened edges with configurable radius
- [ ] Updated `src/main.js` — register pipelines, switch to `Phaser.WEBGL`
- [ ] Updated `src/effects/JuiceEffects.js` — enhanced particles (ADD blend, color interp, trails, decals)
- [ ] Updated `src/entities/Ball.js` — per-ball glow for special balls
- [ ] Updated `src/scenes/PlayScene.js` — camera effects, trail management, CA trigger on heavy hits
- [ ] Updated `src/scenes/BootScene.js` — generate soft circle + normal map textures
- [ ] Updated `src/ui/DebugUI.js` — FPS + draw call counter
- [ ] `README_VFX.md` — setup instructions for the visual upgrade
