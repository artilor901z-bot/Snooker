// ============================================================
//  JuiceEffects — CARTOON ARCADE VFX System
//  Shockwave rings, burst stars, hit-stop, exaggerated squash,
//  ADD-blend particles, screen shake, slow-mo, floating text
// ============================================================
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';

export default class JuiceEffects {
  constructor(scene) {
    this.scene = scene;
    this._slowMoActive = false;
    this._hitStopActive = false;
    this._trails = [];

    // Persistent decal layer (impact marks)
    this.decalRT = scene.add.renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.decalRT.setDepth(1);
    this.decalRT.setAlpha(0.6);
  }

  // ---- Camera Effects Setup ----
  setupCameraFX() {
    try {
      const cam = this.scene.cameras.main;
      if (!cam.postFX) return;
      cam.postFX.addBloom(0xffffff, 0.5, 0.5, 0.5, 0.8);
      cam.postFX.addVignette(0.5, 0.5, 0.88, 0.2);
      cam.setPostPipeline('ChromaticAberrationPipeline');
      const ca = cam.getPostPipeline('ChromaticAberrationPipeline');
      if (ca) ca.setOffset(0);
    } catch (e) {
      console.warn('[JuiceEffects] PostFX setup failed:', e.message);
    }
  }

  // ---- Squash & Stretch (MULTIPLICATIVE + OVERSHOOT) ----
  // Uses Back.Out ease for cartoon overshoot bounce
  squashStretch(target, multX, multY, duration = 140) {
    if (!target || !target.scene) return;
    const origSX = target.scaleX ?? 1;
    const origSY = target.scaleY ?? 1;
    this.scene.tweens.add({
      targets: target,
      scaleX: { from: origSX * multX, to: origSX },
      scaleY: { from: origSY * multY, to: origSY },
      duration,
      ease: 'Back.Out',
    });
  }

  // ---- Screen Shake ----
  screenShake(intensity = 4, duration = 200) {
    this.scene.cameras.main.shake(duration, intensity / 1000);
  }

  // ---- Chromatic Aberration Punch ----
  chromaticPunch(strength = 0.004, duration = 120) {
    const cam = this.scene.cameras.main;
    const ca = cam.getPostPipeline('ChromaticAberrationPipeline');
    if (!ca) return;
    ca.setOffset(strength);
    this.scene.time.delayedCall(duration, () => ca.setOffset(0));
  }

  // ---- Hit-Stop (brief physics freeze — cartoon impact feel) ----
  hitStop(duration = 50) {
    if (this._hitStopActive || this._slowMoActive) return;
    this._hitStopActive = true;
    const engine = this.scene.matter.world.engine;
    const origScale = engine.timing.timeScale;
    engine.timing.timeScale = 0.02; // nearly frozen
    this.scene.time.delayedCall(duration, () => {
      engine.timing.timeScale = origScale;
      this._hitStopActive = false;
    });
  }

  // ---- Slow-Motion Micro-Snap ----
  slowMo(timeScale = 0.55, duration = 200) {
    if (this._slowMoActive || this._hitStopActive) return;
    this._slowMoActive = true;
    const engine = this.scene.matter.world.engine;
    const origScale = engine.timing.timeScale;
    engine.timing.timeScale = timeScale;
    this.scene.time.delayedCall(duration, () => {
      engine.timing.timeScale = origScale;
      this._slowMoActive = false;
    });
  }

  // ---- Shockwave Ring (expanding circle — cartoon impact) ----
  shockwaveRing(x, y, maxRadius = 50, color = 0xffffff, lineWidth = 3) {
    const ring = this.scene.add.graphics();
    ring.lineStyle(lineWidth, color, 0.8);
    ring.strokeCircle(0, 0, 8);
    ring.x = x;
    ring.y = y;
    ring.setDepth(45);

    this.scene.tweens.add({
      targets: ring,
      scaleX: maxRadius / 8,
      scaleY: maxRadius / 8,
      alpha: 0,
      duration: 280,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy(),
    });
  }

  // ---- Impact Star Burst (4-point star graphic — comic "POW") ----
  impactStar(x, y, size = 18, color = 0xffffff) {
    const star = this.scene.add.graphics();
    star.fillStyle(color, 1);
    // 4-point star shape
    const s = size;
    const inner = s * 0.3;
    star.beginPath();
    star.moveTo(0, -s);
    star.lineTo(inner, -inner);
    star.lineTo(s, 0);
    star.lineTo(inner, inner);
    star.lineTo(0, s);
    star.lineTo(-inner, inner);
    star.lineTo(-s, 0);
    star.lineTo(-inner, -inner);
    star.closePath();
    star.fill();
    star.x = x;
    star.y = y;
    star.setDepth(55);

    this.scene.tweens.add({
      targets: star,
      scaleX: { from: 0.3, to: 1.8 },
      scaleY: { from: 0.3, to: 1.8 },
      alpha: { from: 1, to: 0 },
      angle: 30 + Math.random() * 30,
      duration: 220,
      ease: 'Quad.Out',
      onComplete: () => star.destroy(),
    });
  }

  // ---- Impact Flash (white flash overlay on sprite) ----
  impactFlash(target, duration = 60) {
    if (!target || !target.scene) return;
    // Briefly set tint to white then restore
    const origTint = target.tintTopLeft;
    target.setTint(0xffffff);
    this.scene.time.delayedCall(duration, () => {
      if (target.scene) target.setTint(origTint || 0xffffff);
    });
  }

  // ---- Hit Flash (alpha flash on sprite) ----
  hitFlash(target, duration = 80) {
    if (!target) return;
    const origAlpha = target.alpha ?? 1;
    this.scene.tweens.add({
      targets: target,
      alpha: { from: 0.2, to: origAlpha },
      duration,
      ease: 'Cubic.Out',
    });
  }

  // ---- Explosion Particle Burst (ADD blend + color interp) ----
  explosionAt(x, y, radius = 60) {
    if (!this.scene.textures.exists('particle')) return;
    const count = Math.min(50, Math.max(16, Math.floor(radius / 2)));
    const emitter = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 80, max: 350 },
      scale: { start: 5, end: 0 },
      lifespan: { min: 150, max: 600 },
      color: [0xffffff, 0xffff66, 0xff8800, 0xff2200, 0x440000],
      colorEase: 'Quad.Out',
      blendMode: 'ADD',
      gravityY: 50,
      emitting: false,
    });
    emitter.setDepth(50);
    emitter.explode(count);
    this.scene.time.delayedCall(700, () => emitter.destroy());

    this._stampDecal(x, y, 14, 0x332200, 0.35);
    this.shockwaveRing(x, y, radius * 1.2, 0xff8800, 4);
  }

  // ---- Collision Spark (ADD blend — bigger for cartoon punch) ----
  collisionSpark(x, y, intensity = 1) {
    if (!this.scene.textures.exists('particle')) return;
    const count = Math.max(6, Math.floor(12 * intensity));
    const emitter = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 50, max: 180 * intensity },
      scale: { start: 3.5, end: 0 },
      lifespan: { min: 60, max: 250 },
      color: [0xffffff, 0xffffcc, 0xffdd44],
      colorEase: 'Linear',
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.setDepth(50);
    emitter.explode(count);
    this.scene.time.delayedCall(350, () => emitter.destroy());
  }

  // ---- Trail Burst (colored directional, ADD blend) ----
  trailBurst(x, y, count = 10, colorHex = '#ff44ff') {
    if (!this.scene.textures.exists('particle')) return;
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const emitter = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 50, max: 180 },
      scale: { start: 3, end: 0 },
      lifespan: { min: 120, max: 350 },
      tint: [color],
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.setDepth(50);
    emitter.explode(count);
    this.scene.time.delayedCall(450, () => emitter.destroy());
  }

  // ---- Destroy all trails (on scene restart) ----
  destroyTrails() {
    for (const trail of this._trails) {
      if (trail && trail.scene) trail.destroy();
    }
    this._trails = [];
  }

  // ---- Lightning Bolt ----
  lightningBolt(from, to, colorHex = '#ffff00', width = 2, segments = 6) {
    const color = typeof colorHex === 'string'
      ? Phaser.Display.Color.HexStringToColor(colorHex).color
      : (colorHex || 0xffff44);
    const gfx = this.scene.add.graphics();
    gfx.lineStyle(width, color, 1);
    gfx.beginPath();
    gfx.moveTo(from.x, from.y);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const x = Phaser.Math.Linear(from.x, to.x, t) + (Math.random() - 0.5) * 24;
      const y = Phaser.Math.Linear(from.y, to.y, t) + (Math.random() - 0.5) * 24;
      gfx.lineTo(x, y);
    }
    gfx.lineTo(to.x, to.y);
    gfx.strokePath();
    gfx.setDepth(50);

    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 180,
      onComplete: () => gfx.destroy(),
    });
  }

  // ---- Portal Flash (ADD blend particles) ----
  portalFlash(from, to) {
    if (!this.scene.textures.exists('particle')) return;
    for (const pos of [from, to]) {
      const emitter = this.scene.add.particles(pos.x, pos.y, 'particle', {
        speed: { min: 30, max: 100 },
        scale: { start: 3, end: 0 },
        lifespan: 350,
        color: [0xcc88ff, 0x8844ff, 0x4400aa],
        colorEase: 'Linear',
        blendMode: 'ADD',
        emitting: false,
      });
      emitter.setDepth(50);
      emitter.explode(16);
      this.scene.time.delayedCall(450, () => emitter.destroy());
    }
    this.shockwaveRing(from.x, from.y, 40, 0x8844ff);
    this.shockwaveRing(to.x, to.y, 40, 0x8844ff);
  }

  // ---- Pocket Burst (golden celebration — bigger for cartoon) ----
  pocketBurst(x, y) {
    if (!this.scene.textures.exists('particle')) return;
    const emitter = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 100, max: 260 },
      scale: { start: 4, end: 0 },
      lifespan: 450,
      color: [0xffffff, 0xffdd00, 0xff8800],
      colorEase: 'Quad.Out',
      angle: { min: 180, max: 360 },
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.setDepth(50);
    emitter.explode(24);
    this.scene.time.delayedCall(550, () => emitter.destroy());

    this.shockwaveRing(x, y, 35, 0xffdd00, 2);
    this.impactStar(x, y, 14, 0xffdd00);
  }

  // ---- Floating Text (score pop — bigger, bolder for cartoon) ----
  floatingText(x, y, text, color = '#ffdd00', scale = 1.0) {
    const txt = this.scene.add.text(x, y, text, {
      fontSize: `${Math.round(20 * scale)}px`,
      fontFamily: 'monospace',
      color,
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100);

    this.scene.tweens.add({
      targets: txt,
      scaleX: { from: 0.2, to: 1.2 },
      scaleY: { from: 0.2, to: 1.2 },
      duration: 120,
      ease: 'Back.Out',
    });
    this.scene.tweens.add({
      targets: txt,
      y: y - 55,
      alpha: 0,
      delay: 250,
      duration: 600,
      ease: 'Cubic.Out',
      onComplete: () => txt.destroy(),
    });
  }

  // ---- Internal: stamp a decal circle onto the persistent RT ----
  _stampDecal(x, y, radius, color, alpha) {
    const gfx = this.scene.make.graphics({ add: false });
    gfx.fillStyle(color, alpha);
    gfx.fillCircle(0, 0, radius);
    this.decalRT.draw(gfx, x, y);
    gfx.destroy();
  }
}
