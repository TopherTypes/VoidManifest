import { TILE_SIZE } from '../data/rules.js';

const TW = 2, TH = 2; // tile footprint

export class InspectionTable extends Phaser.GameObjects.Container {
  constructor(scene, tileX, tileY) {
    // Container origin at center of 2×2 machine
    super(scene, tileX * TILE_SIZE + TILE_SIZE, tileY * TILE_SIZE + TILE_SIZE);

    this.tileX = tileX;
    this.tileY = tileY;
    this.podOnTable = null;

    // Which grid tiles this machine occupies (for collision)
    this.solidTiles = [
      [tileX,   tileY],   [tileX+1, tileY],
      [tileX,   tileY+1], [tileX+1, tileY+1],
    ];

    this._build();
    scene.add.existing(this);
    this.setDepth(2);
  }

  _build() {
    const PW = TILE_SIZE * TW, PH = TILE_SIZE * TH;

    this._bg = this.scene.add.rectangle(0, 0, PW - 4, PH - 4, 0x0e1e30)
      .setStrokeStyle(1.5, 0x2255aa);

    this._surface = this.scene.add.rectangle(0, 8, PW - 16, PH - 24, 0x162840)
      .setStrokeStyle(1, 0x1e3a5a);

    this._label = this.scene.add.text(0, -28, 'INSPECTION', {
      fontSize: '8px', fontFamily: 'Courier New', color: '#446688', letterSpacing: 2,
    }).setOrigin(0.5);

    this._label2 = this.scene.add.text(0, -18, 'TABLE', {
      fontSize: '8px', fontFamily: 'Courier New', color: '#446688', letterSpacing: 2,
    }).setOrigin(0.5);

    // Status light — dims when idle, glows when pod is present
    this._light = this.scene.add.circle(PW/2 - 12, -PH/2 + 12, 5, 0x112233)
      .setStrokeStyle(1, 0x224455);

    this.add([this._bg, this._surface, this._label, this._label2, this._light]);
    this.setSize(PW, PH);
  }

  placePod(pod) {
    this.podOnTable = pod;
    pod.setPosition(this.x, this.y + 8);
    pod.podState = 'on_table';
    pod.setDepth(4);
    pod.setScale(1);
    this._light.setFillStyle(0x44aaff).setStrokeStyle(1, 0x66ccff);
  }

  removePod() {
    const pod = this.podOnTable;
    this.podOnTable = null;
    this._light.setFillStyle(0x112233).setStrokeStyle(1, 0x224455);
    return pod;
  }

  hasPod() { return this.podOnTable !== null; }

  // The point a player should be near to trigger interaction
  interactPoint() {
    return { x: this.x - TILE_SIZE, y: this.y }; // left face
  }
}
