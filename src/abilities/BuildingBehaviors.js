// ============================================================
//  BuildingBehaviors — keyed by data.action string
//  Each behavior can implement:
//    onCollision(building, ball, scene)
//    applyFieldEffect(building, allBalls, scene)  (per-frame)
// ============================================================
import Phaser from 'phaser';
import { audio } from '../systems/AudioSystem.js';
import { TABLE, MAX_SPEED } from '../constants.js';

export const buildingBehaviors = {

  // ---- TELEPORT (portal pair) ----
  teleport: {
    onCollision(building, ball, scene) {
      if (!building.linkedBuilding || !building.linkedBuilding.isActive) return;
      const p = building.data.params;
      if (Date.now() - ball.lastTeleportTime < (p.cooldownMs || 400)) return;
      ball.lastTeleportTime = Date.now();

      const target = building.linkedBuilding;
      const vel = ball.body.velocity;
      const offset = p.spawnOffset || 15;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      const angle = Math.atan2(vel.y, vel.x);

      scene.matter.body.setPosition(ball.body, {
        x: target.body.position.x + Math.cos(angle) * offset,
        y: target.body.position.y + Math.sin(angle) * offset,
      });
      scene.matter.body.setVelocity(ball.body, {
        x: vel.x * (p.preserveVelocityFactor ?? 1.0),
        y: vel.y * (p.preserveVelocityFactor ?? 1.0),
      });

      scene.effects.portalFlash(building.body.position, target.body.position);
      audio.play('portal');
    },
  },

  // ---- BOUNCE (bumper) ----
  bounce: {
    onCollision(building, ball, scene) {
      const p = building.data.params;
      const dx = ball.body.position.x - building.body.position.x;
      const dy = ball.body.position.y - building.body.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (p.baseForce || 0.025) * (p.impulseMultiplier || 2.0);
      scene.matter.body.applyForce(ball.body, ball.body.position, {
        x: (dx / dist) * force,
        y: (dy / dist) * force,
      });
      scene.effects.squashStretch(building.gfx, p.squashX || 1.4, p.squashY || 0.6, p.squashDuration || 120);
      scene.effects.collisionSpark(building.body.position.x, building.body.position.y, 1.2);
      audio.play('hit');
    },
  },

  // ---- SPLIT (splitter trap — spawns extra ball) ----
  split: {
    onCollision(building, ball, scene) {
      const p = building.data.params;
      if (!building.startCooldown(p.cooldownMs || 600)) return;

      const pos = building.body.position;
      for (let i = 0; i < (p.spawnCount || 1); i++) {
        const angle = Math.random() * Math.PI * 2;
        const spawnSpeed = p.spawnSpeed || 2.5;
        const newBall = scene.ballFactory.create(p.spawnBallId || 'ball_basic',
          pos.x + Math.cos(angle) * 20,
          pos.y + Math.sin(angle) * 20
        );
        scene.matter.body.setVelocity(newBall.body, {
          x: Math.cos(angle) * spawnSpeed,
          y: Math.sin(angle) * spawnSpeed,
        });
        scene.physicsSystem.addBall(newBall);
      }

      scene.effects.collisionSpark(pos.x, pos.y, 1.5);
      audio.play('hit');
    },
  },

  // ---- ABSORB — reduces speed, gives score, grows ----
  absorb: {
    onCollision(building, ball, scene) {
      const p = building.data.params;
      if (building._absorbCount >= (p.maxAbsorbs || 5)) return;
      building._absorbCount++;

      const vel = ball.body.velocity;
      scene.matter.body.setVelocity(ball.body, {
        x: vel.x * (p.speedReduction || 0.3),
        y: vel.y * (p.speedReduction || 0.3),
      });

      // Score bonus
      if (p.scoreBonus && scene.scoreSystem) {
        scene.scoreSystem.score += p.scoreBonus;
        scene.events.emit('score-changed', scene.scoreSystem.score, p.scoreBonus);
        scene.effects.floatingText(
          building.body.position.x, building.body.position.y - 15,
          `+${p.scoreBonus}`, '#66cccc'
        );
      }

      // Grow visual
      const grow = p.growPerAbsorb || 1.05;
      if (building.gfx) {
        building.gfx.setScale(
          (building.gfx.scaleX || 1) * grow,
          (building.gfx.scaleY || 1) * grow
        );
      }

      scene.effects.collisionSpark(building.body.position.x, building.body.position.y, 0.6);
    },
  },

  // ---- ACCELERATE — speed boost ----
  accelerate: {
    onCollision(building, ball, scene) {
      const p = building.data.params;
      const vel = ball.body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (speed < 0.1) return;

      const boost = p.boostMultiplier || 2.0;
      const maxExit = p.maxExitSpeed || MAX_SPEED * 0.8;
      const newSpeed = Math.min(speed * boost, maxExit);
      const angle = Math.atan2(vel.y, vel.x);

      scene.matter.body.setVelocity(ball.body, {
        x: Math.cos(angle) * newSpeed,
        y: Math.sin(angle) * newSpeed,
      });

      scene.effects.trailBurst(
        building.body.position.x, building.body.position.y,
        p.particleTrailCount || 8, p.particleColor || '#bbff66'
      );
      audio.play('hit');
    },
  },

  // ---- MULTIPLIER ZONE — passive area, checked at score time ----
  multiplierZone: {
    // Passive: ScoreSystem checks if ball is inside at pocket time
    // No collision handler needed
  },

  // ---- DEFLECT (rotator) — change ball direction ----
  deflect: {
    onCollision(building, ball, scene) {
      const p = building.data.params;
      const vel = ball.body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (speed < 0.1) return;

      const currentAngle = Math.atan2(vel.y, vel.x);
      const newAngle = currentAngle + (p.deflectAngle || 1.0472);
      const newSpeed = p.preserveSpeed ? speed : speed * 0.9;

      scene.matter.body.setVelocity(ball.body, {
        x: Math.cos(newAngle) * newSpeed,
        y: Math.sin(newAngle) * newSpeed,
      });

      scene.effects.squashStretch(building.gfx, 0.8, 1.2, 150);
      scene.effects.collisionSpark(building.body.position.x, building.body.position.y, 1);
      audio.play('hit');
    },
  },

  // ---- ATTRACT (mini black hole) — per-frame gravity well ----
  attract: {
    applyFieldEffect(building, allBalls, scene) {
      const p = building.data.params;
      const pos = building.body.position;
      const attractRadius = p.attractRadius || 100;

      for (const ball of allBalls) {
        if (!ball.isActive || !ball.body) continue;
        const dx = pos.x - ball.body.position.x;
        const dy = pos.y - ball.body.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < attractRadius && dist > 3) {
          // Attract
          const nx = dx / dist;
          const ny = dy / dist;
          const f = (p.attractStrength || 0.001) * (1 - dist / attractRadius);
          scene.matter.body.applyForce(ball.body, ball.body.position, {
            x: nx * f, y: ny * f,
          });

          // Slow
          const vel = ball.body.velocity;
          const slow = p.slowFactor || 0.94;
          scene.matter.body.setVelocity(ball.body, {
            x: vel.x * slow, y: vel.y * slow,
          });

          // Inner kill radius — pocket the ball for bonus score
          if (dist < (p.innerKillRadius || 8) && !ball.isCueBall) {
            scene.events.emit('ball-pocketed', ball.body);
          }
        }
      }
    },
  },

  // ---- DUPLICATE — clone the passing ball ----
  duplicate: {
    onCollision(building, ball, scene) {
      const p = building.data.params;
      if (!building.startCooldown(p.cooldownMs || 800)) return;
      if (building._dupCount >= (p.maxDuplicates || 2)) return;
      building._dupCount = (building._dupCount || 0) + 1;

      const pos = building.body.position;
      const vel = ball.body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      const angle = Math.atan2(vel.y, vel.x) + (p.offsetAngle || 0.5236);
      const dupSpeed = speed * (p.duplicateSpeedFactor || 0.7);

      const clone = scene.ballFactory.create(ball.data.id,
        pos.x + Math.cos(angle) * 20,
        pos.y + Math.sin(angle) * 20
      );
      scene.matter.body.setVelocity(clone.body, {
        x: Math.cos(angle) * dupSpeed,
        y: Math.sin(angle) * dupSpeed,
      });
      scene.physicsSystem.addBall(clone);

      scene.effects.portalFlash(pos, clone.body.position);
      audio.play('portal');
    },
  },

  // ---- CHAOS — randomize ball direction and speed ----
  chaos: {
    onCollision(building, ball, scene) {
      const p = building.data.params;
      const vel = ball.body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (speed < 0.1) return;

      const newAngle = Math.random() * (p.randomAngleRange || Math.PI * 2);
      const jitter = (p.speedJitterMin || 0.7) + Math.random() * ((p.speedJitterMax || 1.4) - (p.speedJitterMin || 0.7));
      const newSpeed = Math.min(speed * jitter, MAX_SPEED * 0.9);

      scene.matter.body.setVelocity(ball.body, {
        x: Math.cos(newAngle) * newSpeed,
        y: Math.sin(newAngle) * newSpeed,
      });

      scene.effects.screenShake(p.screenShakeIntensity || 4, p.screenShakeDuration || 120);
      const colors = p.particleColors || ['#ff00ff', '#00ffff', '#ffff00'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      scene.effects.trailBurst(
        building.body.position.x, building.body.position.y,
        p.particleCount || 12, color
      );
      audio.play('explosion');
    },
  },
};
