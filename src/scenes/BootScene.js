import Phaser from 'phaser';
import { audio } from '../systems/AudioSystem.js';
import BloomPipeline from '../pipelines/BloomPipeline.js';
import ChromaticAberrationPipeline from '../pipelines/ChromaticAberrationPipeline.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const barW = 300, barH = 20;
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(cx - barW / 2, cy - barH / 2, barW, barH);
    const progressBar = this.add.graphics();

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0x44ff44, 1);
      progressBar.fillRect(cx - barW / 2 + 4, cy - barH / 2 + 4, (barW - 8) * value, barH - 8);
    });
    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
    });

    this.generatePlaceholderTextures();
  }

  generatePlaceholderTextures() {
    // Particle texture (4×4 white square) — maximum batching
    const particleGfx = this.make.graphics({ x: 0, y: 0, add: false });
    particleGfx.fillStyle(0xffffff, 1);
    particleGfx.fillRect(0, 0, 4, 4);
    particleGfx.generateTexture('particle', 4, 4);
    particleGfx.destroy();

    // Ball shadow texture (harder edge for cartoon style)
    const shW = 32, shH = 24;
    const shadowGfx = this.make.graphics({ x: 0, y: 0, add: false });
    shadowGfx.fillStyle(0x000000, 0.6);
    shadowGfx.fillEllipse(shW / 2, shH / 2, shW, shH);
    shadowGfx.fillStyle(0x000000, 0.9);
    shadowGfx.fillEllipse(shW / 2, shH / 2, shW - 6, shH - 6);
    shadowGfx.generateTexture('ball_shadow', shW, shH);
    shadowGfx.destroy();

    // Soft circle texture (16×16) — for trail dots and glow effects
    const softGfx = this.make.graphics({ x: 0, y: 0, add: false });
    softGfx.fillStyle(0xffffff, 0.2);
    softGfx.fillCircle(8, 8, 8);
    softGfx.fillStyle(0xffffff, 0.5);
    softGfx.fillCircle(8, 8, 5);
    softGfx.fillStyle(0xffffff, 1);
    softGfx.fillCircle(8, 8, 3);
    softGfx.generateTexture('soft_circle', 16, 16);
    softGfx.destroy();

    // ---- Ball lit texture (64×64 Canvas2D sphere with gradient shading) ----
    // Greyscale sphere — Phaser tint multiplies to produce any ball color.
    // White center → ball color, dark edges → near-black.
    // Separate 'highlight' Image on each ball adds white specular.
    this._generateBallLitTexture();
  }

  _generateBallLitTexture() {
    const size = 64;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 2; // 30px visual radius in 64×64

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // CARTOON STYLE: flat 2-step shading with sharp terminator line
    // Bright flat face → sharp drop → dark shadow side
    const base = ctx.createRadialGradient(
      cx - r * 0.1, cy - r * 0.1, 0,
      cx + r * 0.05, cy + r * 0.05, r
    );
    base.addColorStop(0.0,  '#e8e8e8'); // bright flat face
    base.addColorStop(0.48, '#dcdcdc'); // stays bright most of the way
    base.addColorStop(0.60, '#888888'); // sharp terminator step
    base.addColorStop(0.78, '#555555'); // shadow side
    base.addColorStop(1.0,  '#2a2a2a'); // dark rim

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = base;
    ctx.fill();

    // Sharp highlight dot (small, hard-edged — cartoon specular)
    ctx.globalCompositeOperation = 'lighter';
    const hlR = r * 0.16;
    const hlX = cx - r * 0.30;
    const hlY = cy - r * 0.33;
    const hl = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlR);
    hl.addColorStop(0.0, 'rgba(255,255,255,0.95)');
    hl.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    hl.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = hl;
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // THICK dark outline (cartoon defining edge — stays black under any tint)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    this.textures.addCanvas('ball_lit', canvas);
  }

  create() {
    audio.init();

    // Register PostFX pipelines at runtime (safer than config key)
    try {
      const pm = this.renderer?.pipelines;
      if (pm && typeof pm.addPostPipeline === 'function') {
        pm.addPostPipeline('BloomPipeline', BloomPipeline);
        pm.addPostPipeline('ChromaticAberrationPipeline', ChromaticAberrationPipeline);
        console.log('[BootScene] PostFX pipelines registered OK');
      } else {
        console.warn('[BootScene] PipelineManager not available — PostFX disabled');
      }
    } catch (e) {
      console.error('[BootScene] Failed to register PostFX pipelines:', e);
    }

    this.scene.start('MenuScene');
  }
}
