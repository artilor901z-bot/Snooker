import { GAME_WIDTH } from '../constants.js';

export default class ScoreUI {
  constructor(scene) {
    this.scene = scene;

    const rX = GAME_WIDTH - 115; // right panel X

    // Background panels (drawn once, behind all text)
    this.panelGfx = scene.add.graphics().setDepth(99);

    // Top-left panel (Score / Target / Shots)
    this.panelGfx.fillStyle(0x000000, 0.55);
    this.panelGfx.fillRoundedRect(6, 4, 155, 68, 6);
    this.panelGfx.lineStyle(1, 0xffffff, 0.1);
    this.panelGfx.strokeRoundedRect(6, 4, 155, 68, 6);

    // Top-right panel (Coins / Level)
    this.panelGfx.fillStyle(0x000000, 0.55);
    this.panelGfx.fillRoundedRect(rX, 4, 110, 48, 6);
    this.panelGfx.lineStyle(1, 0xffffff, 0.1);
    this.panelGfx.strokeRoundedRect(rX, 4, 110, 48, 6);

    // Top-center phase badge
    this.panelGfx.fillStyle(0x000000, 0.45);
    this.panelGfx.fillRoundedRect(GAME_WIDTH / 2 - 50, 4, 100, 26, 4);

    const style = {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    };

    this.scoreText = scene.add.text(15, 10, 'Score: 0', style).setDepth(100);
    this.targetText = scene.add.text(15, 30, 'Target: 0', { ...style, fontSize: '12px', color: '#cccccc' }).setDepth(100);
    this.shotsText = scene.add.text(15, 50, 'Shots: 0', { ...style, fontSize: '12px', color: '#ffaa44' }).setDepth(100);
    this.coinsText = scene.add.text(rX + 10, 10, 'Coins: 0', { ...style, color: '#ffdd00' }).setDepth(100);
    this.levelText = scene.add.text(rX + 10, 30, '', { ...style, fontSize: '11px', color: '#aaaaaa' }).setDepth(100);
    this.phaseText = scene.add.text(GAME_WIDTH / 2, 10, '', {
      ...style, fontSize: '14px', color: '#ffdd00', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(100);

    scene.events.on('score-changed', (total, earned) => {
      this.scoreText.setText(`Score: ${total}`);
    });
    scene.events.on('shots-changed', (shots) => {
      this.shotsText.setText(`Shots: ${shots}`);
    });
    scene.events.on('coins-changed', (coins) => {
      this.coinsText.setText(`Coins: ${coins}`);
    });
  }

  setTarget(target) { this.targetText.setText(`Target: ${target}`); }
  setLevel(name) { this.levelText.setText(name); }
  setPhase(phaseName) { this.phaseText.setText(phaseName); }

  destroy() {
    this.panelGfx.destroy();
    this.scoreText.destroy();
    this.targetText.destroy();
    this.shotsText.destroy();
    this.coinsText.destroy();
    this.levelText.destroy();
    this.phaseText.destroy();
  }
}
