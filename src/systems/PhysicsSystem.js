// ============================================================
//  PhysicsSystem — Arcade-Juicy Matter.js Wrapper
//  Handles: collision routing, speed cap, manual damping,
//  rest-snap, field effects, solver config
// ============================================================
import {
  MAX_SPEED, MANUAL_DAMPING, MIN_REST_SPEED, REST_FRAMES_REQUIRED,
  POSITION_ITERATIONS, VELOCITY_ITERATIONS, CONSTRAINT_ITERATIONS,
  IMPACT_AMPLIFIER,
} from '../constants.js';

export default class PhysicsSystem {
  constructor(scene) {
    this.scene = scene;
    this.activeBalls = [];
    this.activeBuildings = [];
    this.stoppedFrameCount = 0;
  }

  init() {
    // --- Solver iterations for stability at high speed ---
    const engine = this.scene.matter.world.engine;
    engine.positionIterations = POSITION_ITERATIONS;
    engine.velocityIterations = VELOCITY_ITERATIONS;
    engine.constraintIterations = CONSTRAINT_ITERATIONS;

    // --- Collision event routing ---
    this.scene.matter.world.on('collisionstart', (event) => {
      for (const pair of event.pairs) {
        this.handleCollision(pair.bodyA, pair.bodyB, pair);
      }
    });
  }

  // ---- Per-frame update (called from PlayScene.update) ----
  step() {
    for (const ball of this.activeBalls) {
      if (!ball.isActive || !ball.body) continue;
      const body = ball.body;
      let vx = body.velocity.x;
      let vy = body.velocity.y;

      // NaN / Infinity guard — snap to zero rather than corrupting physics
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) {
        this._safeSetVelocity(body, 0, 0);
        continue;
      }

      const speed = Math.sqrt(vx * vx + vy * vy);

      // 1) Hard speed cap — prevents tunneling (always applies)
      if (speed > MAX_SPEED) {
        const scale = MAX_SPEED / speed;
        vx *= scale;
        vy *= scale;
        this._safeSetVelocity(body, vx, vy);
      }

      // Shot cooldown: skip damping for a few frames after being shot
      // Prevents immediate velocity reduction that kills the initial impulse
      if (ball._justShotFrames > 0) {
        ball._justShotFrames--;
        continue;
      }

      // 2) Manual exponential damping — prevents perpetual sliding
      if (speed > MIN_REST_SPEED) {
        this._safeSetVelocity(body, vx * MANUAL_DAMPING, vy * MANUAL_DAMPING);
      }

      // 3) Post-collision jitter clamp: if barely moving, damp harder
      if (speed > 0 && speed < 0.08) {
        this._safeSetVelocity(body, vx * 0.95, vy * 0.95);
      }
    }

    // Field effects (black_hole attract, etc.)
    this.applyFieldEffects();
  }

  // ---- Collision routing by body.label ----
  handleCollision(bodyA, bodyB, pair) {
    const labelA = bodyA.label || '';
    const labelB = bodyB.label || '';

    // Ball ↔ Pocket
    if (this._is(labelA, labelB, 'ball', 'pocket')) {
      const ballBody = labelA.startsWith('ball') ? bodyA : bodyB;
      this.scene.events.emit('ball-pocketed', ballBody);
      return;
    }

    // Ball ↔ Ball
    if (labelA.startsWith('ball') && labelB.startsWith('ball')) {
      // Compute impact magnitude for VFX scaling
      const dvx = bodyA.velocity.x - bodyB.velocity.x;
      const dvy = bodyA.velocity.y - bodyB.velocity.y;
      const impact = Math.sqrt(dvx * dvx + dvy * dvy) * IMPACT_AMPLIFIER;
      this.scene.events.emit('ball-ball-collision', bodyA, bodyB, impact);
      return;
    }

    // Ball ↔ Wall
    if (this._is(labelA, labelB, 'ball', 'wall')) {
      const ballBody = labelA.startsWith('ball') ? bodyA : bodyB;
      const speed = Math.sqrt(ballBody.velocity.x ** 2 + ballBody.velocity.y ** 2);
      this.scene.events.emit('ball-wall-collision', ballBody, speed);
      return;
    }

    // Ball ↔ Building
    if (this._is(labelA, labelB, 'ball', 'building')) {
      const ballBody = labelA.startsWith('ball') ? bodyA : bodyB;
      const buildingBody = labelA.startsWith('building') ? bodyA : bodyB;
      this.scene.events.emit('ball-building-collision', ballBody, buildingBody);
      return;
    }
  }

  _is(a, b, type1, type2) {
    return (a.startsWith(type1) && b.startsWith(type2)) ||
           (a.startsWith(type2) && b.startsWith(type1));
  }

  // ---- Rest detection with frame-counting ----
  checkAllBallsStopped() {
    let allSlow = true;
    for (const ball of this.activeBalls) {
      if (!ball.isActive || !ball.body) continue;
      const vx = ball.body.velocity.x;
      const vy = ball.body.velocity.y;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > MIN_REST_SPEED) {
        allSlow = false;
        break;
      }
    }

    if (!allSlow) {
      this.stoppedFrameCount = 0;
      return false;
    }

    this.stoppedFrameCount++;
    if (this.stoppedFrameCount >= REST_FRAMES_REQUIRED) {
      // Snap all balls to zero velocity (kill micro-jitter)
      for (const ball of this.activeBalls) {
        if (!ball.isActive || !ball.body) continue;
        this.scene.matter.body.setVelocity(ball.body, { x: 0, y: 0 });
      }
      return true;
    }
    return false;
  }

  resetStopCounter() {
    this.stoppedFrameCount = 0;
  }

  // ---- Per-frame field effects from buildings & ball abilities ----
  applyFieldEffects() {
    for (const building of this.activeBuildings) {
      if (!building.isActive) continue;
      const action = building.data.action;
      if (action === 'attract' || action === 'deflect') {
        building.applyFieldEffect(this.activeBalls);
      }
    }
  }

  // ---- Entity management ----
  addBall(ball) {
    this.activeBalls.push(ball);
  }

  removeBall(ball) {
    const idx = this.activeBalls.indexOf(ball);
    if (idx !== -1) this.activeBalls.splice(idx, 1);
    ball.destroy();
  }

  removeBuilding(building) {
    const idx = this.activeBuildings.indexOf(building);
    if (idx !== -1) this.activeBuildings.splice(idx, 1);
    building.destroy();
  }

  // ---- Safe velocity setter (guards against NaN/Infinity) ----
  _safeSetVelocity(body, vx, vy) {
    if (!Number.isFinite(vx)) vx = 0;
    if (!Number.isFinite(vy)) vy = 0;
    this.scene.matter.body.setVelocity(body, { x: vx, y: vy });
  }

  clear() {
    // Destroy all tracked entities
    for (const b of [...this.activeBalls]) b.destroy();
    for (const b of [...this.activeBuildings]) b.destroy();
    this.activeBalls = [];
    this.activeBuildings = [];
    this.stoppedFrameCount = 0;
  }
}
