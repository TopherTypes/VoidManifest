const W = 44, H = 32;

export class CargoPod extends Phaser.GameObjects.Container {
  constructor(scene, x, y, data) {
    super(scene, x, y);

    this.podData   = { ...data };
    this.violations = [];
    this.inspected  = false;
    this.decision   = null;
    this.podState   = 'on_floor';
    this.weightScanned = false;
    this.weightPassed  = null;

    this._build();
    scene.add.existing(this);
    this.setDepth(3);
  }

  _build() {
    this._box = this.scene.add.rectangle(0, 0, W, H, 0x2244668, 1)
      .setStrokeStyle(1.5, 0x88aadd);

    // Flag symbol — small, left edge
    this._flagText = this.scene.add.text(-W / 2 + 4, 0, this.podData.destinationFlag || '?', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#aabbdd',
    }).setOrigin(0, 0.5);

    // Destination code
    this._destText = this.scene.add.text(5, -7, this.podData.destinationCode, {
      fontSize: '8px', fontFamily: 'Courier New', color: '#ddeeff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Pod ID
    this._idText = this.scene.add.text(5, 6, this.podData.id, {
      fontSize: '6px', fontFamily: 'Courier New', color: '#7799bb',
    }).setOrigin(0.5);

    this.add([this._box, this._flagText, this._destText, this._idText]);
    this.setSize(W, H);
    this.setInteractive();
  }

  markDecision(decision) {
    this.decision = decision;
    if (decision === 'route') {
      this._box.setFillStyle(0x1a3a1a).setStrokeStyle(1.5, 0x44cc77);
      this._destText.setColor('#66ffaa');
    } else {
      this._box.setFillStyle(0x3a1a1a).setStrokeStyle(1.5, 0xcc4444);
      this._destText.setColor('#ff8888');
    }
  }

  setInspectedResult(violations) {
    this.inspected  = true;
    this.violations = violations;
  }

  setCarried(yes) {
    this.podState = yes ? 'carried' : 'on_floor';
    this.setDepth(yes ? 10 : 3);
    this.setScale(yes ? 1.1 : 1);
  }
}
