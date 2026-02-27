// ============================================================
//  Building Entity — New data contract: trigger / action / params
// ============================================================
import Phaser from 'phaser';
import { CATEGORY } from '../constants.js';
import { buildingBehaviors } from '../abilities/BuildingBehaviors.js';

let nextBuildingId = 0;

export default class Building {
  constructor(scene, x, y, data, opts = {}) {
    this.scene = scene;
    this.data = data;
    this.instanceId = nextBuildingId++;
    this.isActive = true;
    this.linkedBuilding = null;   // for portal pairing
    this._cooldown = false;       // per-building cooldown flag
    this._absorbCount = 0;        // for absorber

    const { w, h } = data.size;

    // Physics body
    this.body = scene.matter.add.rectangle(x, y, w, h, {
      isStatic: data.isStatic !== false,
      isSensor: data.isSensor === true,
      restitution: 0.8,
      collisionFilter: {
        category: data.isSensor ? CATEGORY.SENSOR : CATEGORY.BUILDING,
        mask: CATEGORY.BALL,
      },
      label: `building_${data.id}_${this.instanceId}`,
    });

    if (opts.angle) {
      scene.matter.body.setAngle(this.body, opts.angle);
    }

    // Visual
    const color = Phaser.Display.Color.HexStringToColor(data.color || '#888888').color;
    this.gfx = scene.add.graphics();
    this.gfx.fillStyle(color, 0.85);
    this.gfx.fillRect(-w / 2, -h / 2, w, h);
    this.gfx.lineStyle(1.5, 0xffffff, 0.4);
    this.gfx.strokeRect(-w / 2, -h / 2, w, h);

    // Icon letter
    this.label = scene.add.text(0, 0, data.name.charAt(0).toUpperCase(), {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5).setDepth(6);

    this.gfx.x = x;
    this.gfx.y = y;
    this.gfx.setDepth(5);
    this.label.x = x;
    this.label.y = y;
  }

  update() {
    if (!this.isActive || !this.body) return;
    this.gfx.x = this.body.position.x;
    this.gfx.y = this.body.position.y;
    this.gfx.rotation = this.body.angle;
    this.label.x = this.body.position.x;
    this.label.y = this.body.position.y;
  }

  onBallCollision(ball) {
    if (!this.isActive) return;
    const handler = buildingBehaviors[this.data.action];
    if (handler && handler.onCollision) {
      handler.onCollision(this, ball, this.scene);
    }
  }

  applyFieldEffect(allBalls) {
    if (!this.isActive) return;
    const handler = buildingBehaviors[this.data.action];
    if (handler && handler.applyFieldEffect) {
      handler.applyFieldEffect(this, allBalls, this.scene);
    }
  }

  startCooldown(ms) {
    if (this._cooldown) return false;
    this._cooldown = true;
    this.scene.time.delayedCall(ms || 400, () => {
      this._cooldown = false;
    });
    return true;
  }

  destroy() {
    this.isActive = false;
    if (this.body) {
      this.scene.matter.world.remove(this.body);
      this.body = null;
    }
    if (this.gfx) this.gfx.destroy();
    if (this.label) this.label.destroy();
  }
}
