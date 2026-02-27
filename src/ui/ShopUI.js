import Phaser from 'phaser';
import ballsData from '../data/balls.json';
import buildingsData from '../data/buildings.json';

export default class ShopUI {
  constructor(scene) {
    this.scene = scene;
    this.overlay = document.getElementById('ui-overlay');
    this.shopItems = [];
    this.onPurchase = null;
    this.onStartPlay = null;
    this.isOpen = false;
  }

  open(coins, slotCount, shopPool) {
    // Build item pool from shopPool ids
    const allBalls = ballsData.reduce((m, b) => { m[b.id] = { ...b, itemType: 'ball' }; return m; }, {});
    const allBuildings = buildingsData.reduce((m, b) => { m[b.id] = { ...b, itemType: 'building' }; return m; }, {});
    const allItems = { ...allBalls, ...allBuildings };

    // Filter to shopPool, then shuffle and pick
    let pool = shopPool
      ? shopPool.map(id => allItems[id]).filter(Boolean)
      : Object.values(allItems).filter(i => (i.cost || 0) > 0);

    const shuffled = Phaser.Utils.Array.Shuffle([...pool]);
    this.shopItems = shuffled.slice(0, slotCount);
    this.currentCoins = coins;

    this.overlay.innerHTML = this._buildHTML(coins);
    this.overlay.style.display = 'block';
    this.overlay.classList.add('active');
    this.isOpen = true;

    this.overlay.querySelectorAll('.shop-item').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        const item = this.shopItems[idx];
        if (item && item.cost <= this.currentCoins && this.onPurchase) {
          this.onPurchase(item);
        }
      });
    });

    const startBtn = this.overlay.querySelector('#btn-start-play');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (this.onStartPlay) this.onStartPlay();
      });
    }
  }

  _buildHTML(coins) {
    let itemsHTML = '';
    this.shopItems.forEach((item, i) => {
      const typeLabel = item.itemType === 'ball' ? 'Ball' : 'Building';
      const disabled = (item.cost || 0) > coins ? 'disabled' : '';
      const dot = `<span style="display:inline-block;width:10px;height:10px;background:${item.color};border-radius:50%;margin-right:4px;vertical-align:middle;"></span>`;
      itemsHTML += `
        <div class="shop-item ${disabled}" data-index="${i}">
          <div class="item-name">${dot}${item.name}</div>
          <div class="item-type">${typeLabel}</div>
          <div class="item-cost">${item.cost} coins</div>
          <div class="item-desc">${item.description}</div>
        </div>
      `;
    });

    return `
      <div class="shop-panel">
        <h2>BUILD PHASE</h2>
        <div class="shop-coins">Coins: <span id="shop-coins">${coins}</span></div>
        <div class="shop-grid">${itemsHTML}</div>
        <button id="btn-start-play" class="shop-button">START</button>
      </div>
    `;
  }

  updateCoins(coins) {
    this.currentCoins = coins;
    const el = document.getElementById('shop-coins');
    if (el) el.textContent = coins;
    this.overlay.querySelectorAll('.shop-item').forEach((el) => {
      const idx = parseInt(el.dataset.index);
      const item = this.shopItems[idx];
      if (item && item.cost > coins) {
        el.classList.add('disabled');
      } else {
        el.classList.remove('disabled');
      }
    });
  }

  close() {
    this.overlay.innerHTML = '';
    this.overlay.style.display = 'none';
    this.overlay.classList.remove('active');
    this.isOpen = false;
    this.onPurchase = null;
    this.onStartPlay = null;
  }
}
