// ============================================================
//  Ball Entity — CARTOON ARCADE Edition
//  Flat-shaded 'ball_lit' texture + Phaser tint.
//  Bold shadow, thick outline baked in texture. No diffuse glow.
//  Impact deformation handled externally by JuiceEffects.
// ============================================================
import Phaser from 'phaser';
import {
  BALL_DEFAULT_RADIUS, CATEGORY, MAX_SPEED,
  DEFAULT_RESTITUTION, DEFAULT_FRICTION, DEFAULT_FRICTION_AIR, DEFAULT_MASS,
} from '../constants.js';
import { ballAbilities } from '../abilities/BallAbilities.js';

let nextInstanceId = 0;

// ball_lit texture has a 30px visual radius inside a 64×64 canvas
const TEX_RADIUS = 30;

export default class Ball {
  constructor(scene, x, y, data, opts = {}) {
    this.scene = scene;
    this.data = data;
    this.instanceId = nextInstanceId++;
    this.isCueBall = opts.isCueBall || false;
    this.isActive = true;

    // Derived from new data contract
    const sp = data.special || {};
    this.scoreValue = data.scoreValue || 10;
    this.scoreMultiplier = (sp.action === 'scoreMultiplier')
      ? (sp.params?.multiplier || 1) : 1;
    this.ghostPassesRemaining = (sp.action === 'phase')
      ? (sp.params?.passesRemaining || 0) : 0;

    // Cooldown system for special abilities
    this.canTriggerSpecial = true;
    this._specialCooldownMs = sp.params?.cooldownMs || 300;
    this._hasSplit = false;
    this.lastTeleportTime = 0;

    const radius = opts.radius || data.radius || BALL_DEFAULT_RADIUS;
    this.radius = radius;

    // ---- Physics body (inertia: Infinity → no angular velocity) ----
    this.body = scene.matter.add.circle(x, y, radius, {
      restitution: data.restitution ?? DEFAULT_RESTITUTION,
      friction: data.friction ?? DEFAULT_FRICTION,
      frictionAir: data.frictionAir ?? DEFAULT_FRICTION_AIR,
      density: (data.mass || DEFAULT_MASS) * 0.001,
      inertia: Infinity,
      inverseInertia: 0,
      collisionFilter: {
        category: CATEGORY.BALL,
        mask: CATEGORY.BALL | CATEGORY.WALL | CATEGORY.POCKET | CATEGORY.BUILDING | CATEGORY.SENSOR,
      },
      label: `ball_${data.id}_${this.instanceId}`,
      sleepThreshold: 60,
    });

    // ---- Bold contact shadow (hard offset — cartoon style) ----
    this.shadow = null;
    if (scene.textures.exists('ball_shadow')) {
      this.shadow = scene.add.image(x + 3, y + 5, 'ball_shadow');
      this.shadow.setAlpha(0.5);
      this.shadow.setDepth(2);
      const baseScale = radius / 12;
      this.shadow.setScale(baseScale * 1.15, baseScale * 0.75);
    }

    // ---- Visual: flat cartoon sphere (Image + tint) ----
    const color = Phaser.Display.Color.HexStringToColor(data.color || '#ffffff').color;
    this.baseColor = color;

    if (scene.textures.exists('ball_lit')) {
      this.gfx = scene.add.image(x, y, 'ball_lit');
      this.gfx.setTint(color);
      this.gfx.setScale(radius / TEX_RADIUS);
    } else {
      // Fallback: simple filled circle
      this.gfx = scene.add.graphics();
      this.gfx.fillStyle(color, 1);
      this.gfx.fillCircle(0, 0, radius);
      this.gfx.x = x;
      this.gfx.y = y;
    }
    this.gfx.setDepth(10);

    // ---- Indicator rings (cue ball = bold gold, special = colored accent) ----
    this.ringGfx = null;
    if (this.isCueBall) {
      this.ringGfx = scene.add.graphics();
      this.ringGfx.lineStyle(3, 0xffdd00, 1);
      this.ringGfx.strokeCircle(0, 0, radius + 1);
      this.ringGfx.lineStyle(1, 0xffffff, 0.4);
      this.ringGfx.strokeCircle(0, 0, radius + 3);
      this.ringGfx.setDepth(10);
      this.ringGfx.x = x;
      this.ringGfx.y = y;
    } else if (sp.action && sp.action !== 'none') {
      this.ringGfx = scene.add.graphics();
      this.ringGfx.lineStyle(2.5, color, 0.5);
      this.ringGfx.strokeCircle(0, 0, radius + 2);
      this.ringGfx.setDepth(10);
      this.ringGfx.x = x;
      this.ringGfx.y = y;
    }

    // Ghost balls start semi-transparent
    if (this.ghostPassesRemaining > 0) {
      this.gfx.setAlpha(sp.params?.alphaWhilePhasing || 0.4);
      if (this.shadow) this.shadow.setAlpha(0.1);
    }

    // Trail reference (managed externally by TrailRenderer)
    this._trail = null;

    // Shot cooldown frames (skip damping for N frames after being shot)
    this._justShotFrames = 0;
  }

  update() {
    if (!this.isActive || !this.body) return;
    const px = this.body.position.x;
    const py = this.body.position.y;

    this.gfx.x = px;
    this.gfx.y = py;
    if (this.ringGfx) {
      this.ringGfx.x = px;
      this.ringGfx.y = py;
    }

    // Bold fixed-offset shadow (cartoon style — no velocity-based shift)
    if (this.shadow) {
      this.shadow.x = px + 3;
      this.shadow.y = py + 5;
    }
  }

  // ---- Ability dispatch ----
  onBallCollision(otherBall, impact) {
    const action = this.data.special?.action;
    if (!action || action === 'none') return;
    const handler = ballAbilities[action];
    if (handler && handler.onBallCollision) {
      handler.onBallCollision(this, otherBall, this.scene, impact);
    }
  }

  onWallCollision(speed) {
    const action = this.data.special?.action;
    if (!action || action === 'none') return;
    const handler = ballAbilities[action];
    if (handler && handler.onWallCollision) {
      handler.onWallCollision(this, this.scene, speed);
    }
  }

  onPocketed() {
    const action = this.data.special?.action;
    if (!action || action === 'none') return;
    const handler = ballAbilities[action];
    if (handler && handler.onPocketed) {
      handler.onPocketed(this, this.scene);
    }
  }

  startCooldown() {
    if (!this.canTriggerSpecial) return false;
    this.canTriggerSpecial = false;
    this.scene.time.delayedCall(this._specialCooldownMs, () => {
      this.canTriggerSpecial = true;
    });
    return true;
  }

  destroy() {
    this.isActive = false;
    if (this.body) {
      this.scene.matter.world.remove(this.body);
      this.body = null;
    }
    if (this._trail && this._trail.scene) {
      this._trail.destroy();
      this._trail = null;
    }
    if (this.ringGfx) {
      this.ringGfx.destroy();
      this.ringGfx = null;
    }
    if (this.shadow) {
      this.shadow.destroy();
      this.shadow = null;
    }
    if (this.gfx) {
      this.gfx.destroy();
      this.gfx = null;
    }
  }
}
