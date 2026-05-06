const SPEED        = 190; // px/s
const INTERACT_R   = 58;  // px — general proximity for table/scanner
const CARRY_OFFSET = -34; // px above player center

export class Player extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);

    this.carriedPod      = null;
    this._wasInteract    = false;
    this._facing         = 1; // 1=right, -1=left

    this._build();

    this.keys = scene.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      upA:   Phaser.Input.Keyboard.KeyCodes.UP,
      downA: Phaser.Input.Keyboard.KeyCodes.DOWN,
      leftA: Phaser.Input.Keyboard.KeyCodes.LEFT,
      rightA:Phaser.Input.Keyboard.KeyCodes.RIGHT,
      e:     Phaser.Input.Keyboard.KeyCodes.E,
    });

    scene.add.existing(this);
    this.setDepth(6);
  }

  _build() {
    // Suit body
    this._body = this.scene.add.rectangle(0, 3, 18, 26, 0x2255aa)
      .setStrokeStyle(1, 0x4488ff);
    // Helmet
    this._head = this.scene.add.circle(0, -11, 9, 0x3366cc)
      .setStrokeStyle(1, 0x66aaff);
    // Visor
    this._visor = this.scene.add.rectangle(0, -11, 10, 6, 0x88ddff, 0.7);
    // Carry indicator (ring shown when holding)
    this._ring = this.scene.add.circle(0, CARRY_OFFSET - 14, 20, 0x000000, 0)
      .setStrokeStyle(1.5, 0x44aa88);
    this._ring.setVisible(false);

    this.add([this._body, this._head, this._visor, this._ring]);
    this.setSize(18, 36);
  }

  update(delta) {
    const k  = this.keys;
    let vx = 0, vy = 0;

    if (k.left.isDown  || k.leftA.isDown)  vx = -SPEED;
    else if (k.right.isDown || k.rightA.isDown) vx = SPEED;
    if (k.up.isDown    || k.upA.isDown)    vy = -SPEED;
    else if (k.down.isDown  || k.downA.isDown)  vy = SPEED;

    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }

    if (vx) this._facing = vx > 0 ? 1 : -1;

    const dt = delta / 1000;
    if (vx || vy) this._tryMove(vx * dt, vy * dt);

    if (this.carriedPod) {
      this.carriedPod.setPosition(this.x, this.y + CARRY_OFFSET);
    }

    // Edge-triggered interact
    const eDown = k.e.isDown;
    if (eDown && !this._wasInteract) {
      this.scene.onPlayerInteract(this);
    }
    this._wasInteract = eDown;
  }

  _tryMove(dx, dy) {
    const { isSolid } = this.scene;
    const hw = 8, hh = 13;

    if (!isSolid(this.x + dx, this.y + dy, hw, hh)) {
      this.x += dx; this.y += dy;
    } else if (!isSolid(this.x + dx, this.y, hw, hh)) {
      this.x += dx;
    } else if (!isSolid(this.x, this.y + dy, hw, hh)) {
      this.y += dy;
    }
  }

  pickUp(pod) {
    this.carriedPod = pod;
    pod.setCarried(true);
    this._ring.setVisible(true);
  }

  putDown() {
    const pod = this.carriedPod;
    this.carriedPod = null;
    if (pod) pod.setCarried(false);
    this._ring.setVisible(false);
    return pod;
  }

  isNear(x, y) {
    const dx = this.x - x, dy = this.y - y;
    return Math.sqrt(dx * dx + dy * dy) < INTERACT_R;
  }
}
