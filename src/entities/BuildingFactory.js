import Building from './Building.js';
import buildingsData from '../data/buildings.json';

export default class BuildingFactory {
  constructor(scene) {
    this.scene = scene;
    this.dataMap = {};
    for (const b of buildingsData) {
      this.dataMap[b.id] = b;
    }
    this.portalQueue = null;
  }

  create(typeId, x, y, opts = {}) {
    const data = this.dataMap[typeId];
    if (!data) {
      console.warn(`Unknown building type: ${typeId}`);
      return null;
    }

    const building = new Building(this.scene, x, y, data, opts);

    // Auto-pair portals
    if (data.requiresPair) {
      if (this.portalQueue && this.portalQueue.isActive) {
        this.portalQueue.linkedBuilding = building;
        building.linkedBuilding = this.portalQueue;
        this.portalQueue = null;
      } else {
        this.portalQueue = building;
      }
    }

    return building;
  }

  getData(typeId) {
    return this.dataMap[typeId];
  }

  getAllData() {
    return buildingsData;
  }
}
