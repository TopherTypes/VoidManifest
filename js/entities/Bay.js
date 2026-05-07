import { TILE_SIZE } from '../data/rules.js';

// Bay is 3 tiles wide × 2 tiles tall
const TW = 3, TH = 2;

export class Bay extends Phaser.GameObjects.Container {
  constructor(scene, tileX, tileY, bayData) {
    super(scene,
      tileX * TILE_SIZE + TILE_SIZE * (TW / 2),
      tileY * TILE_SIZE + TILE_SIZE * (TH / 2));

    this.tileX   = tileX;
    this.tileY   = tileY;
    this.bayData = bayData;
    this.count   = 0;

    this._build();
    scene.add.existing(this);
    this.setDepth(1);
  }

  _build() {
    const PW = TILE_SIZE * TW, PH = TILE_SIZE * TH;
    const c  = this.bayData.color;
    const bc = this.bayData.borderColor;

    this._bg = this.scene.add.rectangle(0, 0, PW - 2, PH - 2, c)
      .setStrokeStyle(1.5, bc);

    // Flag symbol (large, left anchor)
    if (this.bayData.flag) {
      this._flagLabel = this.scene.add.text(-PW / 2 + 14, 0, this.bayData.flag, {
        fontSize: '18px', fontFamily: 'Courier New',
        color: this.bayData.flagColor || '#cce0ff',
      }).setOrigin(0.5);
    }

    // Planet ID
    const labelOffsetX = this.bayData.flag ? 10 : 0;
    this._idLabel = this.scene.add.text(labelOffsetX, -10, this.bayData.id, {
      fontSize: '11px', fontFamily: 'Courier New', color: '#cce0ff',
      fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5);

    // Full planet name (sub-label)
    this._subLabel = this.scene.add.text(labelOffsetX, 6, this.bayData.label, {
      fontSize: '8px', fontFamily: 'Courier New', color: '#5577aa', letterSpacing: 1,
    }).setOrigin(0.5);

    // Deposit count indicator
    this._countText = this.scene.add.text(PW / 2 - 8, -PH / 2 + 6, '0', {
      fontSize: '9px', fontFamily: 'Courier New', color: '#446688',
    }).setOrigin(1, 0);

    const items = [this._bg, this._idLabel, this._subLabel, this._countText];
    if (this._flagLabel) items.push(this._flagLabel);
    this.add(items);
    this.setSize(PW, PH);
  }

  // Is the player close enough to deposit (just outside left edge)?
  playerCanDeposit(px, py) {
    const leftEdge = this.tileX * TILE_SIZE;
    const topEdge  = this.tileY * TILE_SIZE;
    const botEdge  = (this.tileY + TH) * TILE_SIZE;

    const dx = leftEdge - px;
    return dx > -10 && dx < TILE_SIZE * 1.4 && py > topEdge && py < botEdge;
  }

  deposit(pod) {
    this.count++;
    this._countText.setText(String(this.count));
    pod.setVisible(false);
    pod.podState = 'deposited';

    const origColor = this.bayData.borderColor;
    this._bg.setStrokeStyle(2, 0xffffff);
    this.scene.time.delayedCall(200, () => this._bg.setStrokeStyle(1.5, origColor));
  }
}
