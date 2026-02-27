import { POCKET_RADIUS, CATEGORY } from '../constants.js';

export default class Pocket {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    // Physics sensor (detects overlap, no physical collision)
    this.body = scene.matter.add.circle(x, y, POCKET_RADIUS, {
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        category: CATEGORY.POCKET,
        mask: CATEGORY.BALL,
      },
      label: 'pocket',
    });

    // Visual: deep pocket with graduated depth and wooden lip
    const gfx = scene.add.graphics();

    // Outer lip (brown wood — matches table frame)
    gfx.fillStyle(0x4a2a10, 1);
    gfx.fillCircle(x, y, POCKET_RADIUS + 5);

    // Lip bevel highlight (simulates top-left light source)
    gfx.fillStyle(0x6b4a2a, 0.4);
    gfx.fillCircle(x - 1, y - 1, POCKET_RADIUS + 4);

    // Lip edge ring
    gfx.lineStyle(1, 0x3d2b1f, 0.8);
    gfx.strokeCircle(x, y, POCKET_RADIUS + 3);

    // Graduated depth rings (dark green → near-black → black)
    gfx.fillStyle(0x0a1a0a, 1);
    gfx.fillCircle(x, y, POCKET_RADIUS + 1);

    gfx.fillStyle(0x050d05, 1);
    gfx.fillCircle(x, y, POCKET_RADIUS - 3);

    gfx.fillStyle(0x020502, 1);
    gfx.fillCircle(x, y, POCKET_RADIUS - 6);

    gfx.fillStyle(0x000000, 1);
    gfx.fillCircle(x, y, POCKET_RADIUS - 9);

    // Subtle light reflection on top-left of lip
    gfx.fillStyle(0xffffff, 0.06);
    gfx.fillCircle(x - 3, y - 3, POCKET_RADIUS * 0.5);

    gfx.setDepth(0);
  }
}
