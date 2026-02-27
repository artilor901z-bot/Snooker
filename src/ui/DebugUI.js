export default class DebugUI {
  constructor(scene) {
    this.scene = scene;
    this.enabled = false;

    this.debugText = scene.add.text(10, 520, '', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#44ff44',
    }).setDepth(200).setVisible(false);

    // Toggle with backtick key
    scene.input.keyboard.on('keydown-BACKTICK', () => this.toggle());
  }

  toggle() {
    this.enabled = !this.enabled;

    if (this.enabled) {
      this.scene.matter.world.drawDebug = true;
      if (this.scene.matter.world.debugGraphic) {
        this.scene.matter.world.debugGraphic.setVisible(true);
      } else {
        this.scene.matter.world.createDebugGraphic();
      }
      this.debugText.setVisible(true);
    } else {
      this.scene.matter.world.drawDebug = false;
      if (this.scene.matter.world.debugGraphic) {
        this.scene.matter.world.debugGraphic.setVisible(false);
      }
      this.debugText.setVisible(false);
    }
  }

  update() {
    if (!this.enabled) return;
    const balls = this.scene.physicsSystem?.activeBalls || [];
    const buildings = this.scene.physicsSystem?.activeBuildings || [];
    const fps = this.scene.game.loop.actualFps?.toFixed(1) || 'N/A';
    const draws = this.scene.renderer?.drawCount ?? 'N/A';
    this.debugText.setText(
      `FPS: ${fps} | Draws: ${draws} | Balls: ${balls.length} | Buildings: ${buildings.length} | Phase: ${this.scene.phase || 'N/A'}`
    );
  }
}
