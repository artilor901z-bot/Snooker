import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(data) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1e, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Title
    this.add.text(cx, cy - 100, 'POCKET ROGUELITE', {
      fontSize: '32px',
      fontFamily: 'monospace',
      color: '#ffdd00',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(cx, cy - 60, 'A Billiard Roguelite', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Victory message
    if (data?.victory) {
      this.add.text(cx, cy - 20, 'CONGRATULATIONS! YOU WON!', {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#44ff44',
      }).setOrigin(0.5);
    }

    // Play button
    const playBtn = this.add.text(cx, cy + 40, '[ SINGLE PLAYER ]', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playBtn.on('pointerover', () => playBtn.setColor('#ffdd00'));
    playBtn.on('pointerout', () => playBtn.setColor('#ffffff'));
    playBtn.on('pointerdown', () => {
      this.scene.start('PlayScene', { levelIndex: 0, coins: 0 });
    });

    // Multiplayer button (greyed out)
    this.add.text(cx, cy + 80, '[ MULTIPLAYER ]', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#555555',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 100, '(Coming Soon)', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#444444',
    }).setOrigin(0.5);

    // Controls hint
    this.add.text(cx, cy + 160, 'Click & drag on cue ball to aim. Release to shoot.', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#666666',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 180, 'Press ` (backtick) for debug view', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#444444',
    }).setOrigin(0.5);

    // Animate title
    this.tweens.add({
      targets: playBtn,
      scaleX: { from: 1, to: 1.05 },
      scaleY: { from: 1, to: 1.05 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }
}
