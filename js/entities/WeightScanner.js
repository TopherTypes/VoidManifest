import { TILE_SIZE, WEIGHT_BOUNDS } from '../data/rules.js';

const SCAN_MS = 1800;
const TW = 2, TH = 2;

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
    this.setVisible(false);
  }

  _build() {
    const PW = TILE_SIZE * TW, PH = TILE_SIZE * TH;

    this._bg = this.scene.add.rectangle(0, 0, PW - 4, PH - 4, 0x0d1f0d)
      .setStrokeStyle(1.5, 0x2a7a2a);

    // INPUT ZONE label (left face)
    this._inputLabel = this.scene.add.text(-TILE_SIZE, 0, 'INPUT', {
      fontSize: '7px', fontFamily: 'Courier New', color: '#3a9a3a', letterSpacing: 1,
    }).setOrigin(0.5).setAngle(-90);

    this._nameLabel = this.scene.add.text(0, -12, 'WEIGHT', {
      fontSize: '8px', fontFamily: 'Courier New', color: '#3a9a3a', letterSpacing: 2,
    }).setOrigin(0.5);

    this._nameLabel2 = this.scene.add.text(0, -2, 'SCANNER', {
      fontSize: '8px', fontFamily: 'Courier New', color: '#3a9a3a', letterSpacing: 2,
    }).setOrigin(0.5);

    // Progress bar track
    this._barBg   = this.scene.add.rectangle(0, 14, 60, 7, 0x0a100a)
      .setStrokeStyle(1, 0x1a4a1a);

    // Progress bar fill (origin left-center)
    this._barFill = this.scene.add.rectangle(-30, 14, 0, 5, 0x44cc44)
      .setOrigin(0, 0.5);

    // Status light
    this._light = this.scene.add.circle(PW/2 - 10, -PH/2 + 10, 5, 0x112211)
      .setStrokeStyle(1, 0x224422);

    // Interaction zone indicator (left face) with label
    this._interactionZone = this.scene.add.rectangle(-TILE_SIZE, 0, TILE_SIZE - 2, PH - 4, 0x227722)
      .setStrokeStyle(1.5, 0x44dd44)
      .setAlpha(0.2);

    // VALID OUTPUT zone label (top)
    this._validLabel = this.scene.add.text(0, -(PH/2 + TILE_SIZE + 8), '✓ VALID', {
      fontSize: '7px', fontFamily: 'Courier New', color: '#44cc44', letterSpacing: 1,
    }).setOrigin(0.5);

    // INVALID OUTPUT zone label (bottom)
    this._invalidLabel = this.scene.add.text(0, (PH/2 + TILE_SIZE + 8), '✗ INVALID', {
      fontSize: '7px', fontFamily: 'Courier New', color: '#cc4444', letterSpacing: 1,
    }).setOrigin(0.5);

    this.add([
      this._bg, this._inputLabel,
      this._nameLabel, this._nameLabel2,
      this._barBg, this._barFill, this._light, this._interactionZone,
      this._validLabel, this._invalidLabel,
    ]);
    this.setSize(PW, PH);
  }

  activate() {
    this.setVisible(true);
    this.scene.addSolidMachineTiles(this.solidTiles);

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
    this.podInside = pod;
    pod.podState   = 'in_scanner';
    pod.setPosition(this.x, this.y);
    pod.setVisible(false);
    this.scanning  = true;
    this.elapsed   = 0;
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
    const pod = this.podInside;

    this.scanning      = false;
    this.elapsed       = 0;
    this._barFill.width = 0;
    this.podInside     = null;

    // Calculate actual weight from pod ID
    const bounds  = WEIGHT_BOUNDS[pod.podData.weightClass];
    const frac    = ((parseInt(pod.podData.id.replace('POD-', ''), 10) * 2654435761) >>> 0) / 4294967296;
    const measKg  = bounds
      ? Math.floor(bounds.min + frac * (bounds.max - bounds.min))
      : 0;

    // Validate: actual weight must fall within declared weight class bounds
    const isValid = bounds && measKg >= bounds.min && measKg <= bounds.max;

    pod.setVisible(true);
    pod.podState      = 'on_floor';
    pod.weightScanned = true;
    pod.weightPassed  = isValid;

    // Eject to appropriate output zone
    const outputPos = isValid ? this.passOutputPos : this.failOutputPos;
    pod.setPosition(outputPos.x, outputPos.y);

    // Visual feedback
    if (isValid) {
      this._light.setFillStyle(0x22cc22).setStrokeStyle(1, 0x44ff44);
      this._validLabel.setColor('#44ff44').setAlpha(1);
      this.scene.time.delayedCall(800, () => {
        this._light.setFillStyle(0x112211).setStrokeStyle(1, 0x224422);
        this._validLabel.setColor('#44cc44').setAlpha(0.6);
      });
    } else {
      this._light.setFillStyle(0xcc2222).setStrokeStyle(1, 0xff4444);
      this._invalidLabel.setColor('#ff4444').setAlpha(1);
      this.scene.time.delayedCall(800, () => {
        this._light.setFillStyle(0x112211).setStrokeStyle(1, 0x224422);
        this._invalidLabel.setColor('#cc4444').setAlpha(0.6);
      });
    }
  }
}
