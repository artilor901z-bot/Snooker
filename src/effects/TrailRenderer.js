// ============================================================
//  TrailRenderer — Cartoon Arcade Ball Trails
//  Stamps circle dots at ball positions onto a RenderTexture.
//  Fade brush darkens old stamps each frame → natural trailing.
//  Uses beginDraw/batchDraw/endDraw for single-pass efficiency.
// ============================================================
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, MAX_SPEED } from '../constants.js';

export default class TrailRenderer {
  constructor(scene) {
    this.scene = scene;

    // Accumulation RT (drawn with ADD blend on screen)
    this.rt = scene.add.renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.rt.setBlendMode(Phaser.BlendModes.ADD);
    this.rt.setDepth(4);
    this.rt.setAlpha(0.7); // slightly toned down so trails don't overpower

    // Faster fade = tighter trails that stay close to the ball (10% per frame ≈ 0.5s)
    this._fadeBrush = scene.make.graphics({ add: false });
    this._fadeBrush.fillStyle(0x000000, 0.10);
    this._fadeBrush.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Reusable stamp sprite (simple circle — no rotation artifacts)
    this._stamp = null;
    if (scene.textures.exists('soft_circle')) {
      this._stamp = scene.make.image({ key: 'soft_circle', add: false });
      this._stamp.setOrigin(0.5);
    }

    this.speedThreshold = 1.2; // minimum speed to leave a trail
  }

  update(balls) {
    if (!this._stamp) return;

    // Single-pass: open RT once, draw everything, close
    this.rt.beginDraw();

    // Fade pass — darken existing content
    this.rt.batchDraw(this._fadeBrush);

    // Stamp pass — simple circle at each moving ball's position
    for (const ball of balls) {
      if (!ball.isActive || !ball.body) continue;
      const vx = ball.body.velocity.x;
      const vy = ball.body.velocity.y;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed < this.speedThreshold) continue;

      const speedRatio = Math.min(speed / MAX_SPEED, 1);
      const px = ball.body.position.x;
      const py = ball.body.position.y;

      // Uniform circle stamp — no rotation, no asymmetric scale
      // RT accumulation creates the trailing naturally as ball moves
      const scale = 0.25 + speedRatio * 0.5;
      this._stamp.setScale(scale);
      this._stamp.setTint(ball.baseColor);
      this._stamp.setAlpha(0.15 + speedRatio * 0.35);

      this.rt.batchDraw(this._stamp, px, py);
    }

    this.rt.endDraw();
  }

  clear() {
    this.rt.clear();
  }

  destroy() {
    if (this.rt) { this.rt.destroy(); this.rt = null; }
    if (this._fadeBrush) { this._fadeBrush.destroy(); this._fadeBrush = null; }
    if (this._stamp) { this._stamp.destroy(); this._stamp = null; }
  }
}
