// ============================================================
//  BallAbilities — keyed by data.special.action string
//  Each ability object can implement:
//    onBallCollision(self, other, scene, impact)
//    onWallCollision(self, scene, speed)
//    onPocketed(self, scene)
// ============================================================
import { audio } from '../systems/AudioSystem.js';
import { BALL_DEFAULT_RADIUS, TABLE } from '../constants.js';

export const ballAbilities = {

  // ---- none (basic ball) ----
  none: {},

  // ---- EXPLODE — AoE blast on collision ----
  explode: {
    onBallCollision(self, other, scene) {
      if (!self.startCooldown()) return;
      const p = self.data.special.params;
      const pos = self.body.position;

      for (const ball of scene.physicsSystem.activeBalls) {
        if (ball === self || !ball.isActive) continue;
        const dx = ball.body.position.x - pos.x;
        const dy = ball.body.position.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < p.blastRadius && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          const f = p.blastForce * (1 - dist / p.blastRadius);
          scene.matter.body.applyForce(ball.body, ball.body.position, {
            x: nx * f, y: ny * f,
          });
        }
      }

      scene.effects.explosionAt(pos.x, pos.y, p.blastRadius);
      scene.effects.screenShake(p.screenShakeIntensity, p.screenShakeDuration);
      scene.effects.slowMo(p.slowMoScale, p.slowMoDuration);
      scene.effects.hitFlash(self.gfx);
      audio.play('explosion');
    },
  },

  // ---- SPLIT — spawn smaller child balls ----
  split: {
    onBallCollision(self, other, scene) {
      if (self._hasSplit) return;
      if (!self.startCooldown()) return;
      self._hasSplit = true;
      const p = self.data.special.params;
      const pos = self.body.position;
      const vel = self.body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

      for (let i = 0; i < p.count; i++) {
        const angle = (Math.PI * 2 * i) / p.count + Math.atan2(vel.y, vel.x) + Math.PI / 2;
        const offset = (p.childRadius || BALL_DEFAULT_RADIUS * 0.7) * p.spawnOffsetMultiplier;
        const childSpeed = speed * p.inheritVelocityFactor;

        const newBall = scene.ballFactory.create('ball_basic',
          pos.x + Math.cos(angle) * offset,
          pos.y + Math.sin(angle) * offset,
          { radius: p.childRadius }
        );
        scene.matter.body.setVelocity(newBall.body, {
          x: Math.cos(angle) * childSpeed,
          y: Math.sin(angle) * childSpeed,
        });
        scene.physicsSystem.addBall(newBall);
      }

      scene.effects.collisionSpark(pos.x, pos.y, 2.5);
      audio.play('hit');
    },
  },

  // ---- KNOCKBACK — heavy ball extra push ----
  knockback: {
    onBallCollision(self, other, scene) {
      const p = self.data.special.params;
      const dx = other.body.position.x - self.body.position.x;
      const dy = other.body.position.y - self.body.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = p.extraForce * p.knockbackMultiplier;
      scene.matter.body.applyForce(other.body, other.body.position, {
        x: (dx / dist) * force,
        y: (dy / dist) * force,
      });
      scene.effects.screenShake(p.screenShakeIntensity, p.screenShakeDuration);
      scene.effects.hitFlash(other.gfx);
      audio.play('hit');
    },
  },

  // ---- PHASE — ghost ball passes through buildings ----
  phase: {
    // Handled in PlayScene.onBallBuildingCollision via ghostPassesRemaining
  },

  // ---- SCORE MULTIPLIER — bonus on pocket ----
  scoreMultiplier: {
    onPocketed(self, scene) {
      const p = self.data.special.params;
      scene.effects.floatingText(
        self.body.position.x, self.body.position.y - 20,
        `${p.multiplier}x!`,
        p.popTextColor || '#ffdd00',
        p.popTextScale || 1.5
      );
    },
  },

  // ---- DASH — burst of speed on collision ----
  dash: {
    onBallCollision(self, other, scene) {
      if (!self.startCooldown()) return;
      const p = self.data.special.params;
      const vel = self.body.velocity;
      const angle = Math.atan2(vel.y, vel.x) + (Math.random() - 0.5) * p.dashAngleSpread;

      scene.matter.body.applyForce(self.body, self.body.position, {
        x: Math.cos(angle) * p.dashForce,
        y: Math.sin(angle) * p.dashForce,
      });

      scene.effects.trailBurst(
        self.body.position.x, self.body.position.y,
        p.trailParticleCount, p.trailColor
      );
      audio.play('hit');
    },
  },

  // ---- SLOW — sticky ball slows target ----
  slow: {
    onBallCollision(self, other, scene) {
      if (!self.startCooldown()) return;
      const p = self.data.special.params;
      const vel = other.body.velocity;
      scene.matter.body.setVelocity(other.body, {
        x: vel.x * p.slowFactor,
        y: vel.y * p.slowFactor,
      });

      if (other.gfx) {
        other.gfx.setAlpha(0.5);
        scene.time.delayedCall(p.slowDuration, () => {
          if (other.gfx && other.isActive) other.gfx.setAlpha(1);
        });
      }

      scene.effects.collisionSpark(
        (self.body.position.x + other.body.position.x) / 2,
        (self.body.position.y + other.body.position.y) / 2,
        0.8
      );
    },
  },

  // ---- TELEPORT RANDOM — warp to random table position ----
  teleportRandom: {
    onBallCollision(self, other, scene) {
      if (!self.startCooldown()) return;
      if (Date.now() - self.lastTeleportTime < 600) return;
      self.lastTeleportTime = Date.now();
      const p = self.data.special.params;

      const oldPos = { x: self.body.position.x, y: self.body.position.y };
      const vel = self.body.velocity;

      const newX = TABLE.X + 40 + Math.random() * (TABLE.W - 80);
      const newY = TABLE.Y + 40 + Math.random() * (TABLE.H - 80);

      scene.matter.body.setPosition(self.body, { x: newX, y: newY });
      scene.matter.body.setVelocity(self.body, {
        x: vel.x * p.preserveVelocityFactor,
        y: vel.y * p.preserveVelocityFactor,
      });

      scene.effects.portalFlash(oldPos, { x: newX, y: newY });
      audio.play('portal');
    },
  },

  // ---- CHAIN — lightning arc to nearby balls ----
  chain: {
    onBallCollision(self, other, scene) {
      if (!self.startCooldown()) return;
      const p = self.data.special.params;
      let current = other;
      const hit = new Set([self, other]);

      for (let i = 0; i < p.chainCount; i++) {
        let nearest = null, nearestDist = Infinity;
        for (const ball of scene.physicsSystem.activeBalls) {
          if (hit.has(ball) || !ball.isActive) continue;
          const dx = ball.body.position.x - current.body.position.x;
          const dy = ball.body.position.y - current.body.position.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < p.chainRange && d < nearestDist) {
            nearest = ball;
            nearestDist = d;
          }
        }
        if (!nearest) break;
        hit.add(nearest);

        const dx = nearest.body.position.x - current.body.position.x;
        const dy = nearest.body.position.y - current.body.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        scene.matter.body.applyForce(nearest.body, nearest.body.position, {
          x: (dx / dist) * p.chainForce,
          y: (dy / dist) * p.chainForce,
        });

        scene.effects.lightningBolt(
          current.body.position, nearest.body.position,
          p.boltColor, p.boltWidth, p.boltSegments
        );
        scene.effects.hitFlash(nearest.gfx);
        current = nearest;
      }

      scene.effects.screenShake(p.screenShakeIntensity, p.screenShakeDuration);
      audio.play('lightning');
    },
  },
};
