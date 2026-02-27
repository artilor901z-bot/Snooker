// ============================================================
//  ScoreSystem — scoring, combos, coins, level completion
//  New data contract: ball.scoreValue, multiplierZone action
// ============================================================
export default class ScoreSystem {
  constructor(scene) {
    this.scene = scene;
    this.score = 0;
    this.coins = 0;
    this.combo = 0;
    this.shotsRemaining = 0;
    this.targetScore = 0;
  }

  init(levelData) {
    this.score = 0;
    this.combo = 0;
    this.shotsRemaining = levelData.maxShots;
    this.targetScore = levelData.targetScore;
    this.coins = levelData.startCoins;
    this.scene.events.emit('score-changed', this.score, 0);
    this.scene.events.emit('shots-changed', this.shotsRemaining);
    this.scene.events.emit('coins-changed', this.coins);
  }

  scoreBall(ball) {
    this.combo++;

    // Base score from ball data
    let points = ball.scoreValue || 10;

    // Ball-type multiplier (e.g. multiplier ball = 2x)
    points *= (ball.scoreMultiplier || 1);

    // Combo bonus: +50% for each successive pocket in one shot
    points *= (1 + (this.combo - 1) * 0.5);

    // Multiplier zone check
    const zoneMultiplier = this._getZoneMultiplier(ball);
    points *= zoneMultiplier;

    points = Math.round(points);
    this.score += points;
    this.scene.events.emit('score-changed', this.score, points);
    return points;
  }

  _getZoneMultiplier(ball) {
    const bx = ball.body.position.x;
    const by = ball.body.position.y;
    const buildings = this.scene.physicsSystem?.activeBuildings || [];

    for (const building of buildings) {
      if (building.data.action !== 'multiplierZone' || !building.isActive) continue;
      const pos = building.body.position;
      const { w, h } = building.data.size;
      if (bx > pos.x - w / 2 && bx < pos.x + w / 2 &&
          by > pos.y - h / 2 && by < pos.y + h / 2) {
        return building.data.params?.multiplier || 2.0;
      }
    }
    return 1;
  }

  onShotFired() {
    this.combo = 0;
    this.shotsRemaining--;
    this.scene.events.emit('shots-changed', this.shotsRemaining);
  }

  addCoins(amount) {
    this.coins += amount;
    this.scene.events.emit('coins-changed', this.coins);
  }

  spendCoins(amount) {
    if (this.coins < amount) return false;
    this.coins -= amount;
    this.scene.events.emit('coins-changed', this.coins);
    return true;
  }

  isLevelComplete() {
    return this.score >= this.targetScore;
  }
}
