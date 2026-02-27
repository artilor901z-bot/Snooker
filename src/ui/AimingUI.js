// ============================================================
//  AimingUI — Pull-back aiming with dotted line + power bar
//  Wall reflection preview (1 bounce), ghost ball at end
//  Uses DOM pointer events for drag so aiming works outside canvas
// ============================================================
import Phaser from 'phaser';
import { MAX_SHOT_FORCE, DRAG_DIVISOR, MAX_AIM_LINE_LEN, BALL_DEFAULT_RADIUS, TABLE, GAME_WIDTH, GAME_HEIGHT } from '../constants.js';

// Table inner bounds (cushion edges)
const LEFT   = TABLE.X;
const RIGHT  = TABLE.X + TABLE.W;
const TOP    = TABLE.Y;
const BOTTOM = TABLE.Y + TABLE.H;

export default class AimingUI {
  constructor(scene) {
    this.scene = scene;
    this.isAiming = false;
    this.dragStart = null;
    this.currentPower = 0;
    this.aimAngle = 0;
    this.cueBall = null;
    this.enabled = false;

    this.lineGfx = scene.add.graphics().setDepth(20);
    this.powerBarBg = scene.add.graphics().setDepth(20);
    this.powerBarFill = scene.add.graphics().setDepth(21);

    // DOM event bound handlers (for cleanup)
    this._boundDomMove = null;
    this._boundDomUp = null;
  }

  enable(cueBall) {
    this.cueBall = cueBall;
    this.enabled = true;
    // Only pointerdown on Phaser — drag tracking uses DOM events
    this.scene.input.on('pointerdown', this._onDown, this);
  }

  disable() {
    this.enabled = false;
    this.isAiming = false;
    this.scene.input.off('pointerdown', this._onDown, this);
    this._removeDomListeners();
    this.clear();
  }

  _onDown(pointer) {
    if (!this.enabled || !this.cueBall || !this.cueBall.isActive) return;
    const bx = this.cueBall.body.position.x;
    const by = this.cueBall.body.position.y;
    const dx = pointer.worldX - bx;
    const dy = pointer.worldY - by;
    if (Math.sqrt(dx * dx + dy * dy) > BALL_DEFAULT_RADIUS * 6) return;

    this.isAiming = true;
    // Anchor drag origin to ball body center
    this.dragStart = { x: bx, y: by };

    // Attach DOM listeners on window — tracks pointer even outside canvas
    this._boundDomMove = (e) => this._onDomMove(e);
    this._boundDomUp = (e) => this._onDomUp(e);
    window.addEventListener('pointermove', this._boundDomMove);
    window.addEventListener('pointerup', this._boundDomUp);
  }

  /** Convert DOM pointer event to game-world coordinates and update aim */
  _onDomMove(e) {
    if (!this.isAiming || !this.cueBall) return;

    const canvas = this.scene.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    const worldX = (e.clientX - rect.left) * scaleX;
    const worldY = (e.clientY - rect.top) * scaleY;

    const ballPos = this.cueBall.body.position;
    const dx = worldX - this.dragStart.x;
    const dy = worldY - this.dragStart.y;
    const dragDist = Math.sqrt(dx * dx + dy * dy);

    this.currentPower = Math.min(dragDist / DRAG_DIVISOR, 1.0);
    this.aimAngle = Math.atan2(-dy, -dx);

    this._drawAimLine(ballPos);
    this._drawPowerBar(ballPos);
  }

  /** Release — fire shot and clean up DOM listeners */
  _onDomUp() {
    this._removeDomListeners();
    if (!this.isAiming) return;
    this.isAiming = false;

    if (this.currentPower > 0.05) {
      const force = this.currentPower * MAX_SHOT_FORCE;
      this.scene.events.emit('shoot', {
        fx: Math.cos(this.aimAngle) * force,
        fy: Math.sin(this.aimAngle) * force,
        power: this.currentPower,
      });
    }
    this.clear();
  }

  _removeDomListeners() {
    if (this._boundDomMove) {
      window.removeEventListener('pointermove', this._boundDomMove);
      this._boundDomMove = null;
    }
    if (this._boundDomUp) {
      window.removeEventListener('pointerup', this._boundDomUp);
      this._boundDomUp = null;
    }
  }

  _drawAimLine(ballPos) {
    this.lineGfx.clear();
    const totalLen = 50 + this.currentPower * MAX_AIM_LINE_LEN;
    const cos = Math.cos(this.aimAngle);
    const sin = Math.sin(this.aimAngle);
    const radius = this.cueBall.radius || BALL_DEFAULT_RADIUS;

    // Raycast to find wall bounce point
    const bounce = this._raycastWall(ballPos.x, ballPos.y, cos, sin, totalLen, radius);

    if (bounce) {
      // Draw primary line (ball → bounce point)
      this._drawDottedSegment(ballPos.x, ballPos.y, bounce.x, bounce.y, radius + 4, 0xffffff, 0.7);

      // Draw bounce marker
      this.lineGfx.lineStyle(1, 0xffdd00, 0.4);
      this.lineGfx.strokeCircle(bounce.x, bounce.y, 3);

      // Draw reflected line (bounce → remainder)
      const remainLen = totalLen - bounce.dist;
      if (remainLen > 10) {
        const endX = bounce.x + bounce.rx * remainLen;
        const endY = bounce.y + bounce.ry * remainLen;
        this._drawDottedSegment(bounce.x, bounce.y, endX, endY, 0, 0xffdd00, 0.4);

        // Ghost ball at end of reflected line
        this.lineGfx.lineStyle(1, 0xffdd00, 0.15);
        this.lineGfx.strokeCircle(endX, endY, radius);
      }
    } else {
      // No wall hit — straight line
      const endX = ballPos.x + cos * totalLen;
      const endY = ballPos.y + sin * totalLen;
      this._drawDottedSegment(ballPos.x, ballPos.y, endX, endY, radius + 4, 0xffffff, 0.7);

      // Ghost ball at end
      this.lineGfx.lineStyle(1, 0xffffff, 0.25);
      this.lineGfx.strokeCircle(endX, endY, radius);
    }
  }

  /**
   * Draw a dotted line segment from (x0,y0) to (x1,y1).
   * skipStart: distance from start to skip (e.g., ball radius).
   */
  _drawDottedSegment(x0, y0, x1, y1, skipStart, color, maxAlpha) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen < 1) return;
    const nx = dx / segLen;
    const ny = dy / segLen;
    const spacing = 7;

    for (let d = skipStart; d < segLen; d += spacing) {
      const alpha = maxAlpha * (1 - d / segLen);
      this.lineGfx.fillStyle(color, Math.max(alpha, 0.05));
      this.lineGfx.fillCircle(x0 + nx * d, y0 + ny * d, 1.5);
    }
  }

  /**
   * Raycast from (x,y) in direction (dx,dy) and find the first wall hit.
   * Returns {x, y, dist, rx, ry} (hit point, distance, reflected direction) or null.
   */
  _raycastWall(x, y, dx, dy, maxDist, ballRadius) {
    let minT = maxDist + 1;
    let hitNx = 0, hitNy = 0;

    // Check all 4 walls (adjusted for ball radius)
    const walls = [
      { edge: LEFT + ballRadius,   nx:  1, ny:  0 }, // left wall
      { edge: RIGHT - ballRadius,  nx: -1, ny:  0 }, // right wall
      { edge: TOP + ballRadius,    nx:  0, ny:  1 }, // top wall
      { edge: BOTTOM - ballRadius, nx:  0, ny: -1 }, // bottom wall
    ];

    for (const w of walls) {
      let t;
      if (w.nx !== 0) {
        if (Math.abs(dx) < 0.001) continue;
        t = (w.edge - x) / dx;
      } else {
        if (Math.abs(dy) < 0.001) continue;
        t = (w.edge - y) / dy;
      }
      if (t > ballRadius && t < minT) {
        minT = t;
        hitNx = w.nx;
        hitNy = w.ny;
      }
    }

    if (minT > maxDist) return null;

    const hx = x + dx * minT;
    const hy = y + dy * minT;

    // Reflect direction: r = d - 2(d·n)n
    const dot = dx * hitNx + dy * hitNy;
    const rx = dx - 2 * dot * hitNx;
    const ry = dy - 2 * dot * hitNy;

    return { x: hx, y: hy, dist: minT, rx, ry };
  }

  _drawPowerBar(ballPos) {
    this.powerBarBg.clear();
    this.powerBarFill.clear();

    const barW = 44, barH = 6;
    const radius = this.cueBall.radius || BALL_DEFAULT_RADIUS;
    const bx = ballPos.x - barW / 2;
    const by = ballPos.y + radius + 12;

    this.powerBarBg.fillStyle(0x111111, 0.85);
    this.powerBarBg.fillRect(bx, by, barW, barH);
    this.powerBarBg.lineStyle(1, 0x444444, 0.6);
    this.powerBarBg.strokeRect(bx, by, barW, barH);

    // Green → Yellow → Red
    let r, g;
    if (this.currentPower < 0.5) {
      r = Math.floor(255 * this.currentPower * 2);
      g = 255;
    } else {
      r = 255;
      g = Math.floor(255 * (1 - (this.currentPower - 0.5) * 2));
    }
    const fillColor = Phaser.Display.Color.GetColor(r, g, 0);
    this.powerBarFill.fillStyle(fillColor, 1);
    this.powerBarFill.fillRect(bx + 1, by + 1, (barW - 2) * this.currentPower, barH - 2);
  }

  clear() {
    this.lineGfx.clear();
    this.powerBarBg.clear();
    this.powerBarFill.clear();
    this.currentPower = 0;
  }
}
