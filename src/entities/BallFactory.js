import Ball from './Ball.js';
import ballsData from '../data/balls.json';

export default class BallFactory {
  constructor(scene) {
    this.scene = scene;
    this.dataMap = {};
    for (const b of ballsData) {
      this.dataMap[b.id] = b;
    }
  }

  create(typeId, x, y, opts = {}) {
    const data = this.dataMap[typeId];
    if (!data) {
      console.warn(`Unknown ball type: ${typeId}, falling back to ball_basic`);
      return this.create('ball_basic', x, y, opts);
    }
    return new Ball(this.scene, x, y, data, opts);
  }

  createCueBall(typeId, x, y) {
    return this.create(typeId, x, y, { isCueBall: true });
  }

  getData(typeId) {
    return this.dataMap[typeId];
  }

  getAllData() {
    return ballsData;
  }
}
