// ============================================================
//  PlayScene — Main Game Orchestrator (Arcade Juicy Edition)
//  Phases: BUILD → PLAY → RESULT
//  Separate level files, new data contracts
// ============================================================
import Phaser from 'phaser';
import {
  PHASE, TABLE, GAME_WIDTH, GAME_HEIGHT,
  VFX_SPARK_THRESHOLD, VFX_SHAKE_THRESHOLD, VFX_CHAIN_THRESHOLD,
  VFX_SLOWMO_THRESHOLD, VFX_WALL_SPARK_THRESH,
  CHAIN_PUSH_RADIUS, CHAIN_PUSH_FORCE,
} from '../constants.js';
import Table from '../entities/Table.js';
import BallFactory from '../entities/BallFactory.js';
import BuildingFactory from '../entities/BuildingFactory.js';
import PhysicsSystem from '../systems/PhysicsSystem.js';
import ScoreSystem from '../systems/ScoreSystem.js';
import { audio } from '../systems/AudioSystem.js';
import AimingUI from '../ui/AimingUI.js';
import ScoreUI from '../ui/ScoreUI.js';
import ShopUI from '../ui/ShopUI.js';
import DebugUI from '../ui/DebugUI.js';
import JuiceEffects from '../effects/JuiceEffects.js';
import TrailRenderer from '../effects/TrailRenderer.js';

// Import separate level files
import level1 from '../data/level1.json';
import level2 from '../data/level2.json';
import level3 from '../data/level3.json';

const LEVELS = [level1, level2, level3];

export default class PlayScene extends Phaser.Scene {
  constructor() {
    super('PlayScene');
  }

  init(data) {
    this.currentLevelIndex = data?.levelIndex ?? 0;
    this.carryOverCoins = data?.coins ?? 0;
  }

  create() {
    const levelData = LEVELS[this.currentLevelIndex];
    this.levelData = levelData;

    // --- Systems ---
    this.effects = new JuiceEffects(this);
    this.effects.setupCameraFX();
    this.trailRenderer = new TrailRenderer(this);
    this.physicsSystem = new PhysicsSystem(this);
    this.physicsSystem.init();
    this.scoreSystem = new ScoreSystem(this);
    this.scoreSystem.init(levelData);
    if (this.carryOverCoins > 0) {
      this.scoreSystem.addCoins(this.carryOverCoins);
    }

    // --- Entities ---
    this.table = new Table(this);
    this.ballFactory = new BallFactory(this);
    this.buildingFactory = new BuildingFactory(this);

    // Place initial target balls
    for (const ballDef of levelData.initialBalls) {
      const ball = this.ballFactory.create(ballDef.id, ballDef.x, ballDef.y);
      this.physicsSystem.addBall(ball);
    }

    // Place pre-placed buildings
    if (levelData.preplacedBuildings) {
      for (const bDef of levelData.preplacedBuildings) {
        const building = this.buildingFactory.create(bDef.id, bDef.x, bDef.y, {
          angle: bDef.angle || 0,
        });
        if (building) {
          this.physicsSystem.activeBuildings.push(building);
        }
      }
    }

    // Create cue ball
    const cuePos = levelData.cueBallPosition || { x: 280, y: 270 };
    this.cueBall = this.ballFactory.createCueBall(
      levelData.cueBallId || 'ball_basic', cuePos.x, cuePos.y
    );
    this.physicsSystem.addBall(this.cueBall);

    // --- UI ---
    this.scoreUI = new ScoreUI(this);
    this.scoreUI.setTarget(levelData.targetScore);
    this.scoreUI.setLevel(`Lv${levelData.id}: ${levelData.name}`);
    this.aimingUI = new AimingUI(this);
    this.shopUI = new ShopUI(this);
    this.debugUI = new DebugUI(this);

    // --- Level banner ---
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2,
      `Level ${levelData.id}: ${levelData.name}`, {
        fontSize: '24px', fontFamily: 'monospace', color: '#ffdd00',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(150);

    const subtitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30,
      levelData.description || '', {
        fontSize: '12px', fontFamily: 'monospace', color: '#aaaaaa',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(150);

    this.tweens.add({
      targets: [banner, subtitle],
      alpha: 0, y: '-=30',
      delay: 1200, duration: 500,
      onComplete: () => { banner.destroy(); subtitle.destroy(); },
    });

    // --- Event wiring ---
    this.events.on('ball-pocketed', this.onBallPocketed, this);
    this.events.on('ball-ball-collision', this.onBallBallCollision, this);
    this.events.on('ball-wall-collision', this.onBallWallCollision, this);
    this.events.on('ball-building-collision', this.onBallBuildingCollision, this);
    this.events.on('shoot', this.onShoot, this);

    // --- Start ---
    this.phase = null;
    this.shotInProgress = false;
    this.placementMode = null;

    this.time.delayedCall(1700, () => {
      this.setPhase(PHASE.BUILD);
    });
  }

  // ===== PHASE MANAGEMENT =====

  setPhase(newPhase) {
    this.phase = newPhase;
    this.scoreUI.setPhase(newPhase.toUpperCase());

    switch (newPhase) {
      case PHASE.BUILD:  this.enterBuildPhase(); break;
      case PHASE.PLAY:   this.enterPlayPhase();  break;
      case PHASE.RESULT: this.enterResultPhase(); break;
    }
  }

  enterBuildPhase() {
    this.matter.world.pause();
    this.openShop();
  }

  openShop() {
    this.shopUI.open(
      this.scoreSystem.coins,
      this.levelData.shopSlots,
      this.levelData.shopPool
    );

    this.shopUI.onPurchase = (item) => this.handlePurchase(item);
    this.shopUI.onStartPlay = () => {
      this.shopUI.close();
      this.setPhase(PHASE.PLAY);
    };
  }

  handlePurchase(item) {
    if (!this.scoreSystem.spendCoins(item.cost)) return;
    this.shopUI.updateCoins(this.scoreSystem.coins);
    audio.play('purchase');

    if (item.itemType === 'ball') {
      const cuePos = this.levelData.cueBallPosition || { x: 280, y: 270 };
      const ox = (Math.random() - 0.5) * 60;
      const oy = (Math.random() - 0.5) * 60;
      const ball = this.ballFactory.create(item.id, cuePos.x + ox, cuePos.y + oy);
      this.physicsSystem.addBall(ball);
    } else {
      this.shopUI.close();
      this.enterPlacementMode(item);
    }
  }

  enterPlacementMode(buildingData) {
    const { w, h } = buildingData.size;
    const color = Phaser.Display.Color.HexStringToColor(buildingData.color || '#888888').color;

    const ghost = this.add.graphics();
    ghost.fillStyle(color, 0.4);
    ghost.fillRect(-w / 2, -h / 2, w, h);
    ghost.lineStyle(1, 0xffffff, 0.6);
    ghost.strokeRect(-w / 2, -h / 2, w, h);
    ghost.setDepth(50);

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20,
      'Click to place. Right-click to cancel.', {
        fontSize: '12px', fontFamily: 'monospace', color: '#ffdd00',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(150);

    const moveHandler = (pointer) => {
      ghost.x = Phaser.Math.Clamp(pointer.worldX, TABLE.X + w / 2, TABLE.X + TABLE.W - w / 2);
      ghost.y = Phaser.Math.Clamp(pointer.worldY, TABLE.Y + h / 2, TABLE.Y + TABLE.H - h / 2);
    };

    const clickHandler = (pointer) => {
      if (pointer.rightButtonDown()) {
        this.scoreSystem.addCoins(buildingData.cost);
        cleanup();
        this.openShop();
        return;
      }
      const x = Phaser.Math.Clamp(pointer.worldX, TABLE.X + w / 2, TABLE.X + TABLE.W - w / 2);
      const y = Phaser.Math.Clamp(pointer.worldY, TABLE.Y + h / 2, TABLE.Y + TABLE.H - h / 2);
      const building = this.buildingFactory.create(buildingData.id, x, y);
      if (building) {
        this.physicsSystem.activeBuildings.push(building);
        this.effects.collisionSpark(x, y, 1.2);
      }
      cleanup();
      this.openShop();
    };

    const cleanup = () => {
      ghost.destroy();
      hint.destroy();
      this.input.off('pointermove', moveHandler);
      this.input.off('pointerdown', clickHandler);
      this.placementMode = null;
    };

    this.input.on('pointermove', moveHandler);
    this.input.on('pointerdown', clickHandler);
    this.placementMode = { cleanup };
  }

  enterPlayPhase() {
    this.matter.world.resume();
    this.aimingUI.enable(this.cueBall);
    this.shotInProgress = false;
    this.physicsSystem.resetStopCounter();
    // TrailRenderer handles all ball trails via RT stamping — no per-ball setup needed
  }

  enterResultPhase() {
    this.aimingUI.disable();
    this.matter.world.pause();

    const won = this.scoreSystem.isLevelComplete();
    const earnedCoins = Math.floor(this.scoreSystem.score * 0.5);

    const text = won ? 'LEVEL COMPLETE!' : 'OUT OF SHOTS!';
    const clr = won ? '#44ff44' : '#ff4444';

    const resultBanner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, text, {
      fontSize: '28px', fontFamily: 'monospace', color: clr,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(200);

    const scoreDisp = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20,
      `Score: ${this.scoreSystem.score} / ${this.scoreSystem.targetScore}`, {
        fontSize: '16px', fontFamily: 'monospace', color: '#ffffff',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(200);

    if (won) {
      audio.play('level-complete');
      this.effects.screenShake(4, 300);
      this.effects.explosionAt(GAME_WIDTH / 2, GAME_HEIGHT / 2, 120);
    }

    this.time.delayedCall(2500, () => {
      resultBanner.destroy();
      scoreDisp.destroy();

      if (won && this.currentLevelIndex < LEVELS.length - 1) {
        this.scene.restart({ levelIndex: this.currentLevelIndex + 1, coins: earnedCoins });
      } else if (won) {
        this.shopUI.close();
        this.scene.start('MenuScene', { victory: true });
      } else {
        this.scene.restart({ levelIndex: this.currentLevelIndex, coins: 0 });
      }
    });
  }

  // ===== EVENT HANDLERS =====

  onShoot({ fx, fy, power }) {
    if (this.shotInProgress || this.phase !== PHASE.PLAY) return;
    if (!this.cueBall || !this.cueBall.body) return;
    this.shotInProgress = true;
    this.scoreSystem.onShotFired();
    this.physicsSystem.resetStopCounter();

    const cueBod = this.cueBall.body;

    // Guard force values against NaN
    const safeFx = Number.isFinite(fx) ? fx : 0;
    const safeFy = Number.isFinite(fy) ? fy : 0;

    // FIX A: Wake body — sleeping bodies ignore applyForce
    const Matter = Phaser.Physics.Matter.Matter;
    if (cueBod.isSleeping) {
      Matter.Sleeping.set(cueBod, false);
    }

    // FIX B: Nudge away from overlapping balls to prevent solver pushback
    const cueR = this.cueBall.radius;
    for (const ball of this.physicsSystem.activeBalls) {
      if (ball === this.cueBall || !ball.isActive || !ball.body) continue;
      const dx = cueBod.position.x - ball.body.position.x;
      const dy = cueBod.position.y - ball.body.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = cueR + ball.radius;
      if (dist < minDist) {
        // Nudge cue ball away from overlapping body along separation axis
        const overlap = minDist - dist + 0.5;
        const nx = dist > 0.01 ? dx / dist : (safeFx > 0 ? 1 : -1);
        const ny = dist > 0.01 ? dy / dist : (safeFy > 0 ? 1 : -1);
        Matter.Body.setPosition(cueBod, {
          x: cueBod.position.x + nx * overlap,
          y: cueBod.position.y + ny * overlap,
        });
      }
    }

    // FIX C: Mark shot cooldown — PhysicsSystem skips damping for a few frames
    this.cueBall._justShotFrames = 5;

    // Apply force at body center
    Matter.Body.applyForce(cueBod, cueBod.position, { x: safeFx, y: safeFy });
    this.aimingUI.disable();

    this.effects.squashStretch(this.cueBall.gfx, 1.7, 0.5, 140);
    this.effects.shockwaveRing(this.cueBall.body.position.x, this.cueBall.body.position.y, 25 + power * 30, 0xffffff, 2);
    // Always give some feedback on shot
    if (power > 0.2) {
      this.effects.screenShake(power * 6, 120);
      this.effects.chromaticPunch(power * 0.005, 140);
    }
    if (power > 0.6) {
      this.effects.slowMo(0.4, 100);
    }
    audio.play('hit');
  }

  onBallPocketed(ballBody) {
    const ball = this._findBallByBody(ballBody);
    if (!ball || !ball.isActive) return;

    if (ball.isCueBall) {
      const cuePos = this.levelData.cueBallPosition || { x: 280, y: 270 };
      this.matter.body.setPosition(ball.body, cuePos);
      this.matter.body.setVelocity(ball.body, { x: 0, y: 0 });
      this.effects.screenShake(3, 200);
      return;
    }

    ball.onPocketed();

    const points = this.scoreSystem.scoreBall(ball);
    this.effects.pocketBurst(ball.body.position.x, ball.body.position.y);
    this.effects.floatingText(
      ball.body.position.x, ball.body.position.y - 15,
      `+${points}`, '#ffdd00', 1.2
    );
    audio.play('pocket');

    this.physicsSystem.removeBall(ball);
  }

  onBallBallCollision(bodyA, bodyB, impact) {
    const ballA = this._findBallByBody(bodyA);
    const ballB = this._findBallByBody(bodyB);
    if (!ballA || !ballB) return;

    // Brief damping cooldown — preserves collision impulse for a few frames
    ballA._justShotFrames = Math.max(ballA._justShotFrames, 3);
    ballB._justShotFrames = Math.max(ballB._justShotFrames, 3);

    ballA.onBallCollision(ballB, impact);
    ballB.onBallCollision(ballA, impact);

    const midX = (bodyA.position.x + bodyB.position.x) / 2;
    const midY = (bodyA.position.y + bodyB.position.y) / 2;

    // Sparks + star burst on any visible hit (low threshold for cartoon punch)
    if (impact > VFX_SPARK_THRESHOLD) {
      this.effects.collisionSpark(midX, midY, Math.min(impact / 1.5, 4));
      this.effects.impactStar(midX, midY, 8 + impact * 4, 0xffffff);
    }

    // Big squash + shockwave + shake on medium hits
    if (impact > VFX_SHAKE_THRESHOLD) {
      this.effects.screenShake(Math.min(impact * 2, 8), 120);
      this.effects.chromaticPunch(Math.min(impact * 0.002, 0.008), 140);
      this.effects.squashStretch(ballA.gfx, 1.6, 0.5, 120);
      this.effects.squashStretch(ballB.gfx, 1.6, 0.5, 120);
      this.effects.shockwaveRing(midX, midY, 30 + impact * 10, 0xffffff, 2);
      this.effects.impactFlash(ballA.gfx, 40);
      this.effects.impactFlash(ballB.gfx, 40);
    }

    // Chain reaction: push nearby balls on strong hits
    if (impact > VFX_CHAIN_THRESHOLD) {
      this._chainReactionAt(midX, midY, impact, [ballA, ballB]);
      this.effects.shockwaveRing(midX, midY, 60 + impact * 12, 0xffdd00, 3);
    }

    // Hit-stop + explosion on big impacts
    if (impact > VFX_SLOWMO_THRESHOLD) {
      this.effects.hitStop(55);
      this.effects.explosionAt(midX, midY, 50 + impact * 10);
      this.effects.screenShake(Math.min(impact * 3, 12), 200);
    }

    // Audio volume scales with impact
    audio.play('hit', Math.min(0.15 + impact * 0.1, 0.7));
  }

  onBallWallCollision(ballBody, speed) {
    const ball = this._findBallByBody(ballBody);
    if (ball) {
      ball._justShotFrames = Math.max(ball._justShotFrames, 2);
      ball.onWallCollision(speed);
    }

    if (speed > VFX_WALL_SPARK_THRESH) {
      this.effects.collisionSpark(ballBody.position.x, ballBody.position.y, Math.min(speed / 2, 4));
      if (ball && ball.gfx) this.effects.squashStretch(ball.gfx, 0.5, 1.6, 100);
      this.effects.shockwaveRing(ballBody.position.x, ballBody.position.y, 20 + speed * 5, 0xffffff, 2);
      this.effects.impactStar(ballBody.position.x, ballBody.position.y, 6 + speed * 2, 0xffffcc);
    }
    if (speed > 3) {
      this.effects.screenShake(Math.min(speed * 1.2, 7), 100);
    }
    audio.play('wall', Math.min(0.1 + speed * 0.06, 0.6));
  }

  onBallBuildingCollision(ballBody, buildingBody) {
    const ball = this._findBallByBody(ballBody);
    const building = this._findBuildingByBody(buildingBody);

    if (ball && ball.ghostPassesRemaining > 0) {
      ball.ghostPassesRemaining--;
      if (ball.ghostPassesRemaining <= 0 && ball.gfx) {
        ball.gfx.setAlpha(1);
      }
      return;
    }

    if (ball && building) {
      building.onBallCollision(ball);
    }
  }

  // ===== HELPERS =====

  /**
   * Chain reaction: radial impulse pushes nearby balls away from impact point.
   * Creates cascade feel — one strong hit scatters the whole cluster.
   */
  _chainReactionAt(x, y, impact, excludeBalls) {
    const excludeIds = new Set(excludeBalls.map(b => b.instanceId));
    for (const ball of this.physicsSystem.activeBalls) {
      if (!ball.isActive || !ball.body || excludeIds.has(ball.instanceId)) continue;
      const dx = ball.body.position.x - x;
      const dy = ball.body.position.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > CHAIN_PUSH_RADIUS || dist < 1) continue;

      // Force falls off with distance, scales with impact
      const strength = CHAIN_PUSH_FORCE * (1 - dist / CHAIN_PUSH_RADIUS) * Math.min(impact / 3, 2);
      const nx = dx / dist;
      const ny = dy / dist;
      this.matter.body.applyForce(ball.body, ball.body.position, {
        x: nx * strength,
        y: ny * strength,
      });

      // Visual feedback per pushed ball
      this.effects.hitFlash(ball.gfx, 60);
    }
  }

  _findBallByBody(body) {
    return this.physicsSystem.activeBalls.find(b => b.body && b.body.id === body.id);
  }

  _findBuildingByBody(body) {
    return this.physicsSystem.activeBuildings.find(b => b.body && b.body.id === body.id);
  }

  // ===== UPDATE LOOP =====

  update(time, delta) {
    for (const ball of this.physicsSystem.activeBalls) ball.update();
    for (const building of this.physicsSystem.activeBuildings) building.update();

    // RT-based trail rendering (stamps + fades every frame)
    if (this.phase === PHASE.PLAY) {
      this.trailRenderer.update(this.physicsSystem.activeBalls);
    }

    this.debugUI.update();

    if (this.phase === PHASE.PLAY) {
      this.physicsSystem.step();

      if (this.shotInProgress && this.physicsSystem.checkAllBallsStopped()) {
        this.shotInProgress = false;

        if (this.scoreSystem.isLevelComplete()) {
          this.setPhase(PHASE.RESULT);
        } else if (this.scoreSystem.shotsRemaining <= 0) {
          this.setPhase(PHASE.RESULT);
        } else {
          this.aimingUI.enable(this.cueBall);
        }
      }
    }
  }

  shutdown() {
    this.effects.destroyTrails();
    if (this.trailRenderer) this.trailRenderer.destroy();
    this.shopUI.close();
    this.aimingUI.disable();
    if (this.placementMode) {
      this.placementMode.cleanup();
    }
  }
}
