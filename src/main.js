import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import PlayScene from './scenes/PlayScene.js';

const config = {
  type: Phaser.WEBGL,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#0e1e12',

  // ---- Fullscreen scaling: FIT maintains 16:9 at any window size ----
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },

  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 0 },
      enableSleeping: true,
      debug: false,
    }
  },
  // PostFX pipelines registered at runtime in BootScene via addPostPipeline()
  scene: [BootScene, MenuScene, PlayScene],
};

const game = new Phaser.Game(config);

// ---- Keep HTML overlay in sync with scaled canvas position ----
function syncOverlay() {
  const canvas = game.canvas;
  if (!canvas) return;
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return;
  const rect = canvas.getBoundingClientRect();
  overlay.style.left = rect.left + 'px';
  overlay.style.top = rect.top + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';
}

window.addEventListener('resize', syncOverlay);
// Initial sync after first render
game.events.once('ready', () => {
  syncOverlay();
  // Re-sync after scale manager settles
  setTimeout(syncOverlay, 100);
});
