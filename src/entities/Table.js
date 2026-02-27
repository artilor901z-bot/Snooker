import Phaser from 'phaser';
import { TABLE, POCKETS, CATEGORY, WALL_RESTITUTION, WALL_FRICTION, GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import Pocket from './Pocket.js';

export default class Table {
  constructor(scene) {
    this.scene = scene;
    this.pockets = [];
    this.createVisuals();
    this.createWalls();
    this.createPockets();
  }

  createVisuals() {
    const { X, Y, W, H, CUSHION } = TABLE;

    // ==== BACKGROUND FILL (covers entire game world — no green gaps) ====
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a0a, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.setDepth(-10);

    // ==== TABLE DROP SHADOW (depth from surface) ====
    const shadowGfx = this.scene.add.graphics();
    // Multi-layer soft shadow beneath the table frame
    const shadowLayers = [
      { expand: 22, alpha: 0.12 },
      { expand: 16, alpha: 0.18 },
      { expand: 10, alpha: 0.25 },
    ];
    for (const s of shadowLayers) {
      shadowGfx.fillStyle(0x000000, s.alpha);
      shadowGfx.fillRoundedRect(
        X - CUSHION - 12 - s.expand + 3,   // offset right+down for directional shadow
        Y - CUSHION - 12 - s.expand + 4,
        W + CUSHION * 2 + 24 + s.expand * 2,
        H + CUSHION * 2 + 24 + s.expand * 2,
        4
      );
    }
    shadowGfx.setDepth(-5);

    // ==== MAIN TABLE GRAPHICS ====
    const gfx = this.scene.add.graphics();

    // ==== FRAME (3-layer wood with bevel) ====

    // Layer 1: outermost dark border (shadow edge)
    gfx.fillStyle(0x2a1808, 1);
    gfx.fillRect(X - CUSHION - 12, Y - CUSHION - 12, W + CUSHION * 2 + 24, H + CUSHION * 2 + 24);

    // Layer 2: main wood body
    gfx.fillStyle(0x5a3a1a, 1);
    gfx.fillRect(X - CUSHION - 8, Y - CUSHION - 8, W + CUSHION * 2 + 16, H + CUSHION * 2 + 16);

    // Wood grain texture (subtle horizontal lines on frame)
    for (let yy = Y - CUSHION - 8; yy < Y + H + CUSHION + 8; yy += 4) {
      const a = 0.03 + Math.sin(yy * 0.3) * 0.02;
      gfx.fillStyle(0x000000, Math.max(0, a));
      gfx.fillRect(X - CUSHION - 8, yy, W + CUSHION * 2 + 16, 1);
    }

    // Layer 3: inner wood bevel (lighter top-left, darker bottom-right)
    gfx.lineStyle(2, 0x8b6c3a, 0.7);
    gfx.beginPath();
    gfx.moveTo(X - CUSHION - 8, Y + H + CUSHION + 8);
    gfx.lineTo(X - CUSHION - 8, Y - CUSHION - 8);
    gfx.lineTo(X + W + CUSHION + 8, Y - CUSHION - 8);
    gfx.strokePath();

    gfx.lineStyle(2, 0x2a1808, 0.7);
    gfx.beginPath();
    gfx.moveTo(X + W + CUSHION + 8, Y - CUSHION - 8);
    gfx.lineTo(X + W + CUSHION + 8, Y + H + CUSHION + 8);
    gfx.lineTo(X - CUSHION - 8, Y + H + CUSHION + 8);
    gfx.strokePath();

    // Gold inlay line on frame
    gfx.lineStyle(1, 0xc8a832, 0.35);
    gfx.strokeRect(X - CUSHION - 5, Y - CUSHION - 5, W + CUSHION * 2 + 10, H + CUSHION * 2 + 10);

    // Gold outer border
    gfx.lineStyle(1, 0x8b6914, 0.5);
    gfx.strokeRect(X - CUSHION - 12, Y - CUSHION - 12, W + CUSHION * 2 + 24, H + CUSHION * 2 + 24);

    // ==== CUSHIONS ====
    gfx.fillStyle(0x145530, 1);
    gfx.fillRect(X - CUSHION, Y - CUSHION, W + CUSHION * 2, H + CUSHION * 2);

    // Cushion bevel (light inner top-left edge, dark bottom-right)
    gfx.lineStyle(1.5, 0x2a8a4a, 0.6);
    gfx.beginPath();
    gfx.moveTo(X - CUSHION, Y + H + CUSHION);
    gfx.lineTo(X - CUSHION, Y - CUSHION);
    gfx.lineTo(X + W + CUSHION, Y - CUSHION);
    gfx.strokePath();

    gfx.lineStyle(1.5, 0x0a2a18, 0.8);
    gfx.beginPath();
    gfx.moveTo(X + W + CUSHION, Y - CUSHION);
    gfx.lineTo(X + W + CUSHION, Y + H + CUSHION);
    gfx.lineTo(X - CUSHION, Y + H + CUSHION);
    gfx.strokePath();

    // ==== FELT (playing surface) ====
    gfx.fillStyle(0x1e8040, 1);
    gfx.fillRect(X, Y, W, H);

    // Cloth texture (subtle horizontal + vertical lines — woven fabric)
    for (let yy = Y + 6; yy < Y + H; yy += 6) {
      gfx.fillStyle(0x000000, 0.02);
      gfx.fillRect(X, yy, W, 1);
    }
    for (let xx = X + 8; xx < X + W; xx += 8) {
      gfx.fillStyle(0x000000, 0.01);
      gfx.fillRect(xx, Y, 1, H);
    }

    // Inner shadow (recessed playing area — light from top-left)
    // Top edge (strongest)
    for (let i = 0; i < 12; i++) {
      gfx.fillStyle(0x000000, 0.08 * (1 - i / 12));
      gfx.fillRect(X, Y + i, W, 1);
    }
    // Left edge
    for (let i = 0; i < 10; i++) {
      gfx.fillStyle(0x000000, 0.06 * (1 - i / 10));
      gfx.fillRect(X + i, Y, 1, H);
    }
    // Bottom edge (weaker — facing the light)
    for (let i = 0; i < 6; i++) {
      gfx.fillStyle(0x000000, 0.03 * (1 - i / 6));
      gfx.fillRect(X, Y + H - 1 - i, W, 1);
    }
    // Right edge (weaker)
    for (let i = 0; i < 6; i++) {
      gfx.fillStyle(0x000000, 0.03 * (1 - i / 6));
      gfx.fillRect(X + W - 1 - i, Y, 1, H);
    }

    // Subtle overhead light pool (brighter centre region)
    gfx.fillStyle(0xffffff, 0.015);
    gfx.fillEllipse(X + W / 2, Y + H / 2, W * 0.5, H * 0.5);

    // Felt border (clean white hairline)
    gfx.lineStyle(1.5, 0xffffff, 0.25);
    gfx.strokeRect(X, Y, W, H);

    // ==== DIAMOND MARKERS ====
    gfx.fillStyle(0xdddddd, 0.55);
    const dr = 2.5;
    for (let i = 1; i <= 3; i++) {
      gfx.fillCircle(X + W * i / 4, Y - CUSHION / 2, dr);
      gfx.fillCircle(X + W * i / 4, Y + H + CUSHION / 2, dr);
    }
    for (let i = 1; i <= 2; i++) {
      gfx.fillCircle(X - CUSHION / 2, Y + H * i / 3, dr);
      gfx.fillCircle(X + W + CUSHION / 2, Y + H * i / 3, dr);
    }
    // Diamond marker outlines
    gfx.lineStyle(0.5, 0xffffff, 0.15);
    for (let i = 1; i <= 3; i++) {
      gfx.strokeCircle(X + W * i / 4, Y - CUSHION / 2, dr);
      gfx.strokeCircle(X + W * i / 4, Y + H + CUSHION / 2, dr);
    }
    for (let i = 1; i <= 2; i++) {
      gfx.strokeCircle(X - CUSHION / 2, Y + H * i / 3, dr);
      gfx.strokeCircle(X + W + CUSHION / 2, Y + H * i / 3, dr);
    }

    // ==== HEAD STRING (baulk line) ====
    gfx.lineStyle(1, 0xffffff, 0.08);
    gfx.lineBetween(X + W * 0.25, Y, X + W * 0.25, Y + H);

    // ==== CENTRE SPOT ====
    gfx.fillStyle(0xffffff, 0.12);
    gfx.fillCircle(X + W / 2, Y + H / 2, 2);

    gfx.setDepth(-1);
  }

  createWalls() {
    const { X, Y, W, H, CUSHION } = TABLE;
    const opts = {
      isStatic: true,
      restitution: WALL_RESTITUTION,
      friction: WALL_FRICTION,
      collisionFilter: {
        category: CATEGORY.WALL,
        mask: CATEGORY.BALL,
      },
      label: 'wall',
    };

    // Top wall (split into two segments around center pocket)
    const halfW = (W / 2 - 30);
    this.scene.matter.add.rectangle(X + halfW / 2, Y - CUSHION / 2, halfW, CUSHION, opts);
    this.scene.matter.add.rectangle(X + W - halfW / 2, Y - CUSHION / 2, halfW, CUSHION, opts);

    // Bottom wall (split into two segments around center pocket)
    this.scene.matter.add.rectangle(X + halfW / 2, Y + H + CUSHION / 2, halfW, CUSHION, opts);
    this.scene.matter.add.rectangle(X + W - halfW / 2, Y + H + CUSHION / 2, halfW, CUSHION, opts);

    // Left wall
    this.scene.matter.add.rectangle(X - CUSHION / 2, Y + H / 2, CUSHION, H, opts);

    // Right wall
    this.scene.matter.add.rectangle(X + W + CUSHION / 2, Y + H / 2, CUSHION, H, opts);
  }

  createPockets() {
    for (const pos of POCKETS) {
      const pocket = new Pocket(this.scene, pos.x, pos.y);
      this.pockets.push(pocket);
    }
  }
}
