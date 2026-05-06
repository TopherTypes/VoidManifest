import { TILE_SIZE, RULES } from '../data/rules.js';

const SCAN_MS = 1800;
const TW = 2, TH = 2;

const WEIGHT_RULE_ID = 'sto-a-weight';

export class WeightScanner extends Phaser.GameObjects.Container {
  constructor(scene, tileX, tileY) {
    super(scene, tileX * TILE_SIZE + TILE_SIZE, tileY * TILE_SIZE + TILE_SIZE);

    this.tileX     = tileX;
    this.tileY     = tileY;
    this.podInside = null;
    this.scanning  = false;
    this.elapsed   = 0;

    this.solidTiles = [
      [tileX,   tileY],   [tileX+1, tileY],
      [tileX,   tileY+1], [tileX+1, tileY+1],
    ];

    // Output positions (pixel coords of ejection tile centers)
    this.passOutputPos = { x: this.x, y: (tileY - 1) * TILE_SIZE + TILE_SIZE / 2 };
    this.failOutputPos = { x: this.x, y: (tileY + 2) * TILE_SIZE + TILE_SIZE / 2 };

    this._build();
    scene.add.existing(this);
    this.setDepth(2);
    this.setVisible(false); // hidden until unlocked
  }

  _build() {
    const PW = TILE_SIZE * TW, PH = TILE_SIZE * TH;

    this._bg = this.scene.add.rectangle(0, 0, PW - 4, PH - 4, 0x0d1f0d)
      .setStrokeStyle(1.5, 0x2a7a2a);

    // Pass label (top)
    this._passLabel = this.scene.add.text(0, -PH/2 + 7, '▲  PASS', {
      fontSize: '8px', fontFamily: 'Courier New', color: '#2a7a2a', letterSpacing: 1,
    }).setOrigin(0.5);

    // Fail label (bottom)
    this._failLabel = this.scene.add.text(0, PH/2 - 7, '▼  FAIL', {
      fontSize: '8px', fontFamily: 'Courier New', color: '#7a2a2a', letterSpacing: 1,
    }).setOrigin(0.5);

    this._nameLabel = this.scene.add.text(0, -12, 'WEIGHT', {
      fontSize: '8px', fontFamily: 'Courier New', color: '#3a9a3a', letterSpacing: 2,
    }).setOrigin(0.5);

    this._nameLabel2 = this.scene.add.text(0, -2, 'SCANNER', {
      fontSize: '8px', fontFamily: 'Courier New', color: '#3a9a3a', letterSpacing: 2,
    }).setOrigin(0.5);

    // Progress bar track
    this._barBg = this.scene.add.rectangle(0, 14, 60, 7, 0x0a100a)
      .setStrokeStyle(1, 0x1a4a1a);

    // Progress bar fill (origin left-center)
    this._barFill = this.scene.add.rectangle(-30, 14, 0, 5, 0x44cc44)
      .setOrigin(0, 0.5);

    // Status light
    this._light = this.scene.add.circle(PW/2 - 10, -PH/2 + 10, 5, 0x112211)
      .setStrokeStyle(1, 0x224422);

    this.add([
      this._bg, this._passLabel, this._failLabel,
      this._nameLabel, this._nameLabel2,
      this._barBg, this._barFill, this._light,
    ]);
    this.setSize(PW, PH);
  }

  activate() {
    this.setVisible(true);
    // Register solid tiles with scene
    this.scene.addSolidMachineTiles(this.solidTiles);

    // Brief activation flash
    this.scene.tweens.add({
      targets: this._bg,
      alpha: { from: 0, to: 1 },
      duration: 600,
      ease: 'Power2',
    });
  }

  // Left face interaction point (player deposits here)
  inputPoint() {
    return { x: this.x - TILE_SIZE, y: this.y };
  }

  acceptPod(pod) {
    if (this.scanning) return false;
    this.podInside    = pod;
    pod.podState      = 'in_scanner';
    pod.setPosition(this.x, this.y);
    pod.setVisible(false);
    this.scanning     = true;
    this.elapsed      = 0;
    this._light.setFillStyle(0xffcc00).setStrokeStyle(1, 0xffee44);
    return true;
  }

  update(delta) {
    if (!this.scanning) return;

    this.elapsed += delta;
    const pct = Math.min(this.elapsed / SCAN_MS, 1);
    this._barFill.width = 60 * pct;

    if (this.elapsed >= SCAN_MS) this._eject();
  }

  _eject() {
    const pod        = this.podInside;
    const weightRule = RULES.find(r => r.id === WEIGHT_RULE_ID);
    const fail       = weightRule ? weightRule.test(pod) : false;

    this.scanning     = false;
    this.elapsed      = 0;
    this._barFill.width = 0;
    this.podInside    = null;

    pod.setVisible(true);
    pod.podState       = 'on_floor';
    pod.weightScanned  = true;
    pod.weightPassed   = !fail;

    const outPos = fail ? this.failOutputPos : this.passOutputPos;
    pod.setPosition(outPos.x, outPos.y);

    if (fail) {
      this._light.setFillStyle(0xcc2222).setStrokeStyle(1, 0xff4444);
      this._failLabel.setColor('#cc4444');
    } else {
      this._light.setFillStyle(0x22cc22).setStrokeStyle(1, 0x44ff44);
      this._passLabel.setColor('#44cc44');
    }

    this.scene.time.delayedCall(800, () => {
      this._light.setFillStyle(0x112211).setStrokeStyle(1, 0x224422);
      this._passLabel.setColor('#2a7a2a');
      this._failLabel.setColor('#7a2a2a');
    });
  }
}
