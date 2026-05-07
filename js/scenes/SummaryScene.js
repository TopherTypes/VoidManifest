export class SummaryScene extends Phaser.Scene {
  constructor() { super({ key: 'SummaryScene' }); }

  init(data) {
    this._credits   = data.credits   ?? 50;
    this._history   = data.history   ?? [];
    this._total     = data.total     ?? 0;
    this._processed = data.processed ?? 0;
  }

  create() {
    const cx = 528, W = 1056, H = 768;

    // Dark overlay
    this.add.rectangle(cx, H/2, W, H, 0x060810, 1);

    // Header
    this.add.text(cx, 80, '// END OF DAY 1', {
      fontSize: '22px', fontFamily: 'Courier New', color: '#446688',
      letterSpacing: 4,
    }).setOrigin(0.5);

    this.add.text(cx, 116, 'SHIFT COMPLETE — CARGO BAY SECURED', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#2a4a6a', letterSpacing: 2,
    }).setOrigin(0.5);

    // Divider
    this.add.rectangle(cx, 140, 600, 1, 0x1e3050);

    // Credits
    this.add.text(cx, 175, `FINAL BALANCE`, {
      fontSize: '14px', fontFamily: 'Courier New', color: '#334455', letterSpacing: 2,
    }).setOrigin(0.5);

    this.add.text(cx, 210, `${this._credits} CR`, {
      fontSize: '38px', fontFamily: 'Courier New',
      color: this._credits >= 50 ? '#44cc88' : '#cc4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Log
    this.add.text(cx, 268, 'TRANSACTION LOG', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#334455', letterSpacing: 2,
    }).setOrigin(0.5);

    const startY = 296;
    const shown  = this._history.slice(-10);
    for (let i = 0; i < shown.length; i++) {
      const entry = shown[i];
      const col   = entry.correct ? '#3a8a5a' : '#8a3a3a';
      this.add.text(cx, startY + i * 26, `${entry.reason}`, {
        fontSize: '14px', fontFamily: 'Courier New', color: col,
      }).setOrigin(0.5);
    }

    // Continue prompt
    const promptY = 700;
    const prompt  = this.add.text(cx, promptY, '[ PRESS SPACE — Day 2 coming soon ]', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#334455', letterSpacing: 2,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: prompt, alpha: { from: 1, to: 0.2 },
      duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.input.keyboard.once('keydown-SPACE', () => {
      // Day 2 is not yet implemented — restart Day 1
      this.scene.start('Day1Scene');
    });

    // Also allow click
    this.input.once('pointerdown', () => this.scene.start('Day1Scene'));
  }
}
