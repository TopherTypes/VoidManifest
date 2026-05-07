import { TILE, TILE_SIZE, PLANETS, SCAN_SIGNATURES, WEIGHT_BOUNDS, WORLD_MAP } from '../data/rules.js';
import { generatePodBatch, generateStage1, generateStage2, generateStage3 }  from '../data/pods.js';
import { Economy }           from '../systems/Economy.js';
import { Progression }       from '../systems/Progression.js';
import { evaluatePod }       from '../systems/InspectionEngine.js';
import { Player }            from '../entities/Player.js';
import { CargoPod }          from '../entities/CargoPod.js';
import { InspectionTable }   from '../entities/InspectionTable.js';
import { WeightScanner }     from '../entities/WeightScanner.js';
import { Bay }               from '../entities/Bay.js';

// ── Layout constants ──────────────────────────────────────────────────────────
const COLS = 22, ROWS = 16;
const TOTAL_PODS   = 1 + 1 + 3 + 7; // Stages: 1 valid + 1 invalid + 3 batch + 7 free
const TABLE_TX = 9,  TABLE_TY = 6;
const SCANNER_TX = 4, SCANNER_TY = 6;

// Bay layout: [planetId, tileX, tileY]
const BAY_LAYOUT = [
  ['VERATH-IV', 18, 1],
  ['OSKAR-7',   18, 4],
  ['MIRA-3',    18, 7],
  ['DRAKON',    18, 10],
  ['INCIN',     18, 13],
];

// Pod spawn grid (column, row) within delivery zone
const SPAWN_SLOTS = [
  [1,1],[2,1],[1,3],[2,3],[1,5],[2,5],
  [1,7],[2,7],[1,9],[2,9],[1,11],[2,11],
  [1,13],[2,13],
];

// ── Handbook static data ──────────────────────────────────────────────────────
const CONTENT_RULES = {
  ORGANIC:    { desc: 'Plant matter, food, natural fibre goods.',       routing: 'Permitted on all routes. Temperature-sensitive.' },
  MECHANICAL: { desc: 'Machine parts, tools, structural metal goods.',  routing: 'Standard clearance. Avoid MIRA-3 conservation zone.' },
  CHEMICAL:   { desc: 'Industrial solvents, reactive compounds.',       routing: 'Hazmat seal required. Restricted on OSKAR-7.' },
  BIOLOGICAL: { desc: 'Living specimens, organic samples, cultures.',   routing: 'Life-support cert required. Preferred route: DRAKON.' },
  ELECTRONIC: { desc: 'Circuits, devices, data storage media.',         routing: 'Standard clearance. Restricted near DRAKON signal zone.' },
};

export class Day1Scene extends Phaser.Scene {
  constructor() { super({ key: 'Day1Scene' }); }

  onWindowResize(dims) {
    this.scale.resize(dims.width, dims.height);
    this._updateCameraZoom();
  }

  // ── create ──────────────────────────────────────────────────────────────────
  create() {
    this._economy     = new Economy(50);
    this._progression = new Progression(1);
    this._paused      = false;
    this._pods        = [];
    this._processedCount = 0;
    this._solidExtra  = [];
    this._walkthroughStage = 1;
    this._stagePodsSubmitted = 0;

    this.isSolid = this._isSolid.bind(this);
    this.addSolidMachineTiles = (tiles) => {
      this._solidExtra.push(...tiles);
    };

    this._drawWorld();
    this._createBays();
    this._createMachines();
    this._spawnPods();
    this._createPlayer();
    this._createHUD();
    this._wireProgression();
    this._wireInspectionPanel();

    // Set up camera to follow player with smooth damping
    this.cameras.main.startFollow(this._player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);

    this._updateCameraZoom();

    this._showToast('Day 1 — Inspect each pod and approve/deny based on manifest', 'neutral', 4000);
  }

  _updateCameraZoom() {
    const worldWidth = COLS * TILE_SIZE;
    const worldHeight = ROWS * TILE_SIZE;
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    // Calculate zoom to fit appropriate number of tiles
    const zoomX = screenWidth / worldWidth;
    const zoomY = screenHeight / worldHeight;
    const zoom = Math.min(zoomX, zoomY);

    this.cameras.main.setZoom(zoom);
  }

  // ── update ───────────────────────────────────────────────────────────────────
  update(_time, delta) {
    if (this._paused) return;

    this._player.update(delta);
    if (this._scanner) this._scanner.update(delta);

    this._updatePrompt();
    this._updateHUD();
  }

  // ── World rendering ──────────────────────────────────────────────────────────
  _drawWorld() {
    const g = this.add.graphics().setDepth(0);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tile = WORLD_MAP[row][col];
        const x    = col * TILE_SIZE;
        const y    = row * TILE_SIZE;

        switch (tile) {
          case TILE.WALL:
            g.fillStyle(0x0a0e14, 1);
            g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            g.lineStyle(0.5, 0x141e28, 1);
            g.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
            break;

          case TILE.FLOOR:
            g.fillStyle(0x0d1520, 1);
            g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            g.lineStyle(0.5, 0x111a24, 1);
            g.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
            break;

          case TILE.DELIVERY:
            g.fillStyle(0x0f1a10, 1);
            g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            g.fillStyle(0x1a2a1a, 0.6);
            g.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            g.lineStyle(0.5, 0x1e3a1e, 1);
            g.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
            break;

          case TILE.BAY:
          case TILE.INCIN:
            g.fillStyle(0x080c10, 1);
            g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            break;
        }
      }
    }

    // Delivery zone label
    this.add.text(TILE_SIZE / 2, ROWS * TILE_SIZE / 2, 'DELIVERY\nZONE', {
      fontSize: '8px', fontFamily: 'Courier New', color: '#2a5a2a',
      align: 'center', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(1).setAngle(-90);

    // Arrow hints pointing right from delivery zone
    for (let r = 2; r < 14; r += 3) {
      this.add.text(3 * TILE_SIZE - 6, r * TILE_SIZE + TILE_SIZE / 2, '›', {
        fontSize: '14px', fontFamily: 'Courier New', color: '#1e3a1e',
      }).setOrigin(0.5).setDepth(1);
    }
  }

  // ── Bays ─────────────────────────────────────────────────────────────────────
  _createBays() {
    this._bays = [];
    for (const [id, tx, ty] of BAY_LAYOUT) {
      const planetData = PLANETS.find(p => p.id === id);
      const bay        = new Bay(this, tx, ty, planetData);
      this._bays.push(bay);
    }
  }

  // ── Machines ─────────────────────────────────────────────────────────────────
  _createMachines() {
    this._table   = new InspectionTable(this, TABLE_TX, TABLE_TY);
    this._scanner = new WeightScanner(this, SCANNER_TX, SCANNER_TY);

    this.addSolidMachineTiles(this._table.solidTiles);
  }

  // ── Pod spawning ─────────────────────────────────────────────────────────────
  _spawnPods() {
    this._spawnPodsForStage(1);
  }

  _spawnPodsForStage(stage) {
    let stageData = [];
    switch (stage) {
      case 1:
        stageData = generateStage1();
        this._showToast('Stage 1: Inspect this pod and make a decision', 'neutral', 3000);
        break;
      case 2:
        stageData = generateStage2();
        this._showToast('Stage 2: This pod has a problem — learn to deny it', 'neutral', 3000);
        break;
      case 3:
        stageData = generateStage3();
        this._showToast('Stage 3: Three packages to the same destination — batch them together', 'neutral', 3000);
        break;
      case 4:
        stageData = generatePodBatch(7);
        this._showToast('Stage 4: Continue with mixed packages', 'neutral', 3000);
        break;
      default:
        return;
    }

    for (let i = 0; i < stageData.length; i++) {
      const slot = SPAWN_SLOTS[i % SPAWN_SLOTS.length];
      const px   = slot[0] * TILE_SIZE + TILE_SIZE / 2;
      const py   = slot[1] * TILE_SIZE + TILE_SIZE / 2;
      const pod  = new CargoPod(this, px, py, stageData[i]);
      this._pods.push(pod);
    }
  }

  // ── Player ───────────────────────────────────────────────────────────────────
  _createPlayer() {
    const startX = 2 * TILE_SIZE + TILE_SIZE / 2;
    const startY = 8 * TILE_SIZE + TILE_SIZE / 2;
    this._player = new Player(this, startX, startY);
  }

  // ── HUD ──────────────────────────────────────────────────────────────────────
  _createHUD() {
    const cam = this.cameras.main;

    this._hudCreditsText = this.add.text(12, 8, '', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#66aaff',
    }).setDepth(20).setScrollFactor(0).setFixedSize(200, 0);

    this._hudProgressText = this.add.text(cam.width - 12, 8, '', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#668888',
    }).setDepth(20).setScrollFactor(0).setOrigin(1, 0).setFixedSize(200, 0);

    this._hudDayText = this.add.text(cam.width / 2, 8, 'DAY 1', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#334455',
      letterSpacing: 3,
    }).setDepth(20).setScrollFactor(0).setOrigin(0.5, 0);

    this._promptText = this.add.text(cam.width / 2, cam.height - 20, '', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#446688',
      letterSpacing: 1,
    }).setDepth(20).setScrollFactor(0).setOrigin(0.5, 1).setFixedSize(600, 0);

    this._unlockBanner = this.add.text(cam.width / 2, 40, '', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#44cc88',
      backgroundColor: '#0d1f0d', padding: { x: 10, y: 6 }, letterSpacing: 1,
    }).setDepth(21).setScrollFactor(0).setOrigin(0.5, 0).setAlpha(0);
  }

  _updateHUD() {
    const done  = this._processedCount;
    const total = TOTAL_PODS;
    this._hudCreditsText.setText(`CR: ${this._economy.credits}`);
    this._hudProgressText.setText(`${done} / ${total} PROCESSED`);
  }

  _updatePrompt() {
    const player  = this._player;
    const carried = player.carriedPod;
    let hint = '';

    if (carried) {
      const tip = this._table.interactPoint();
      if (!this._table.hasPod() && player.isNear(tip.x, tip.y)) {
        hint = '[E] Place pod on inspection table';
      } else if (this._scanner?.visible) {
        const ip = this._scanner.inputPoint();
        if (player.isNear(ip.x, ip.y) && !this._scanner.scanning) {
          hint = '[E] Insert pod into weight scanner';
        }
      } else {
        for (const bay of this._bays) {
          if (bay.playerCanDeposit(player.x, player.y)) {
            const needsDecision = !carried.decision;
            const isFull = bay.count >= 6;
            hint = isFull
              ? `Bay full (6/6) — submit to continue`
              : needsDecision
                ? `[E] Deposit at ${bay.bayData.id} — must approve/deny first!`
                : `[E] Deposit at ${bay.bayData.id}`;
            break;
          }
        }
      }
      if (!hint) hint = 'WASD / Arrow keys to move — carry pod to inspection table';
    } else {
      const tip = this._table.interactPoint();
      if (this._table.hasPod() && player.isNear(tip.x, tip.y)) {
        hint = '[E] Pick up pod from table';
      } else {
        // Check for bay with parcels to submit
        for (const bay of this._bays) {
          if (bay.playerCanDeposit(player.x, player.y) && bay.parcels.length > 0) {
            hint = `[E] Submit ${bay.parcels.length} parcel${bay.parcels.length !== 1 ? 's' : ''} from ${bay.bayData.id}`;
            break;
          }
        }

        if (!hint) {
          const near = this._nearestFloorPod(player.x, player.y);
          if (near) hint = `[E] Pick up ${near.podData.id}`;
          else      hint = 'WASD / Arrow keys to move';
        }
      }
    }

    this._promptText.setText(hint);
  }

  // ── Progression / unlocks ────────────────────────────────────────────────────
  _wireProgression() {
    this._progression.onUnlock('auto-weight-scanner', () => {
      this._scanner.activate();
      this._showUnlockBanner('UNLOCK: Weight Scanner placed in cargo bay');
      this._showToast('Weight scanner activated — load pods from the left face', 'neutral', 4000);
    });
  }

  _checkProgression() {
    const pct = this._processedCount / TOTAL_PODS;
    this._progression.check('pods_processed_pct', { pct });
  }

  _checkDayEnd() {
    const remaining = this._pods.filter(p => p.podState !== 'deposited');
    if (remaining.length === 0) {
      this.time.delayedCall(1200, () => this._endDay());
    }
  }

  _endDay() {
    this.scene.start('SummaryScene', {
      credits:  this._economy.credits,
      history:  this._economy.history,
      total:    TOTAL_PODS,
      processed: this._processedCount,
    });
  }

  // ── Interaction handler (called by Player on E press) ────────────────────────
  onPlayerInteract(player) {
    if (this._paused) return;

    const carried = player.carriedPod;
    if (carried) {
      this._interactCarrying(player, carried);
    } else {
      this._interactEmpty(player);
    }
  }

  _interactCarrying(player, pod) {
    // 1. Inspection table
    const tip = this._table.interactPoint();
    if (!this._table.hasPod() && player.isNear(tip.x, tip.y)) {
      player.putDown();
      this._table.placePod(pod);
      this._openInspectionPanel(pod);
      return;
    }

    // 2. Weight scanner input
    if (this._scanner?.visible && !this._scanner.scanning) {
      const ip = this._scanner.inputPoint();
      if (player.isNear(ip.x, ip.y)) {
        player.putDown();
        this._scanner.acceptPod(pod);
        return;
      }
    }

    // 3. Bay deposit
    for (const bay of this._bays) {
      if (bay.playerCanDeposit(player.x, player.y)) {
        this._depositAtBay(player, pod, bay);
        return;
      }
    }
  }

  _interactEmpty(player) {
    // 1. Pick up from inspection table
    const tip = this._table.interactPoint();
    if (this._table.hasPod() && player.isNear(tip.x, tip.y)) {
      const pod = this._table.removePod();
      player.pickUp(pod);
      return;
    }

    // 2. Submit parcels at bay
    for (const bay of this._bays) {
      if (bay.playerCanDeposit(player.x, player.y) && bay.parcels.length > 0) {
        this._submitBayParcels(player, bay);
        return;
      }
    }

    // 3. Pick up floor pod
    const near = this._nearestFloorPod(player.x, player.y);
    if (near) {
      player.pickUp(near);
    }
  }

  _depositAtBay(player, pod, bay) {
    if (!pod.inspected) {
      const violations = evaluatePod(pod.podData);
      pod.setInspectedResult(violations);
    }

    player.putDown();
    pod.setPosition(bay.x, bay.y);

    const placed = bay.placePod(pod);
    if (!placed) {
      this._showToast(`Bay full — max 6 packages. Submit batch to continue.`, 'negative', 2200);
    } else {
      this._showToast(`Placed in bay. Collect more to submit batch, or [E] to submit now.`, 'neutral', 2200);
    }
  }

  _submitBayParcels(player, bay) {
    const parcels = bay.submitParcels();
    if (parcels.length === 0) return;

    let correct = 0, incorrect = 0;
    const reasons = [];

    for (const pod of parcels) {
      const result = this._economy.scoreDeposit(
        { ...pod.podData, violations: pod.violations },
        bay.bayData.id
      );
      if (result.correct) {
        correct++;
      } else {
        incorrect++;
      }
      reasons.push(result.reason);
      this._processedCount++;
    }

    this._stagePodsSubmitted += parcels.length;
    this._checkWalkthroughProgression();
    this._checkProgression();
    this._checkDayEnd();

    const summary = `SUBMISSION REPORT: ${correct} approved, ${incorrect} denied | ${reasons.join(' | ')}`;
    this._showToast(summary, 'neutral', 4000);
  }

  _checkWalkthroughProgression() {
    const stageRequirements = { 1: 1, 2: 1, 3: 3 };
    const required = stageRequirements[this._walkthroughStage];

    if (required && this._stagePodsSubmitted >= required) {
      this._walkthroughStage++;
      this._stagePodsSubmitted = 0;

      if (this._walkthroughStage <= 4) {
        this.time.delayedCall(1000, () => this._spawnPodsForStage(this._walkthroughStage));
      }
    }
  }

  // ── Inspection panel (HTML overlay) ─────────────────────────────────────────
  _wireInspectionPanel() {
    const panel      = document.getElementById('inspection-panel');
    const btnApprove = document.getElementById('btn-approve');
    const btnDeny    = document.getElementById('btn-deny');

    this._panel             = panel;
    this._currentInspectPod = null;

    btnApprove.addEventListener('click', () => this._onDecision('approve'));
    btnDeny.addEventListener('click', () => this._onDecision('deny'));

    // Tab switching
    panel.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        panel.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      });
    });

    // Populate static handbook content once
    this._populateWeightTab();
    this._populatePlanetsTab();
    this._populateContentsTab();
  }

  // ── Handbook population ───────────────────────────────────────────────────────
  _populateWeightTab() {
    const tab = document.getElementById('tab-weight');
    const rows = Object.entries(WEIGHT_BOUNDS).map(([cls, b]) =>
      `<tr>
        <td><span class="weight-class-chip">${cls}</span></td>
        <td>${b.label}</td>
        <td>${b.note}</td>
      </tr>`
    ).join('');
    tab.innerHTML =
      `<table class="weight-table">
        <thead><tr><th>CLASS</th><th>RANGE</th><th>NOTES</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="hb-note">
        All weights are gross shipping weight including container.<br>
        Declared class must match scanner readout. Discrepancy → incinerate.
      </div>`;
  }

  _populatePlanetsTab() {
    const tab = document.getElementById('tab-planets');
    tab.innerHTML = '';

    const PLANET_NOTES = {
      'VERATH-IV': 'Central hub. Accepts all standard cargo.',
      'OSKAR-7':   'Research station. No hazardous chemicals.',
      'MIRA-3':    'Conservation world. Restricted mechanical imports.',
      'DRAKON':    'Industrial colony. Signal blackout for electronics.',
    };

    for (const planet of PLANETS.filter(p => p.flag)) {
      const row = document.createElement('div');
      row.className = 'hb-planet-row';

      const flagSlot = document.createElement('div');
      flagSlot.className = 'hb-flag-slot';
      const flagCanvas = document.createElement('canvas');
      flagCanvas.width  = 72;
      flagCanvas.height = 48;
      this._drawPlanetFlag(flagCanvas, planet);
      flagSlot.appendChild(flagCanvas);

      const info = document.createElement('div');
      info.className = 'hb-planet-info';
      info.innerHTML =
        `<div class="hb-planet-id" style="color:${planet.flagColor}">${planet.id}</div>` +
        `<div class="hb-planet-name">${planet.label}</div>` +
        `<div class="hb-planet-note">${PLANET_NOTES[planet.id] ?? ''}</div>`;

      row.appendChild(flagSlot);
      row.appendChild(info);
      tab.appendChild(row);
    }
  }

  _populateContentsTab() {
    const tab = document.getElementById('tab-contents');
    tab.innerHTML = Object.entries(CONTENT_RULES).map(([type, rule]) =>
      `<div class="content-entry">
        <div class="content-type-label">${type}</div>
        <div class="content-desc">${rule.desc}</div>
        <div class="content-routing">${rule.routing}</div>
      </div>`
    ).join('');
  }

  // ── Planet flag canvas ────────────────────────────────────────────────────────
  _drawPlanetFlag(canvas, planet) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    // Unpack planet hex colors
    const bg   = planet.color;
    const bdr  = planet.borderColor;
    const bgR  = Math.min(((bg >> 16) & 0xff) * 3 + 8, 55);
    const bgG  = Math.min(((bg >> 8)  & 0xff) * 3 + 8, 55);
    const bgB  = Math.min(( bg        & 0xff) * 3 + 8, 55);
    const bdrR =  (bdr >> 16) & 0xff;
    const bdrG =  (bdr >> 8)  & 0xff;
    const bdrB =   bdr        & 0xff;

    // Background
    ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
    ctx.fillRect(0, 0, W, H);

    // Top accent band
    ctx.fillStyle = `rgba(${bdrR},${bdrG},${bdrB},0.35)`;
    ctx.fillRect(0, 0, W, Math.ceil(H * 0.28));

    // Subtle scanline texture
    for (let y = 0; y < H; y += 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, y, W, 1);
    }

    // Left edge stripe (flag-pole side)
    ctx.fillStyle = `rgba(${bdrR},${bdrG},${bdrB},0.7)`;
    ctx.fillRect(0, 0, 3, H);

    // Planet symbol — large, centred, with glow
    ctx.save();
    ctx.shadowColor  = planet.flagColor;
    ctx.shadowBlur   = 10;
    ctx.fillStyle    = planet.flagColor;
    ctx.font         = `${Math.floor(H * 0.52)}px Courier New`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(planet.flag, W / 2 + 2, H / 2);
    ctx.restore();

    // Border
    ctx.strokeStyle = `rgba(${bdrR},${bdrG},${bdrB},0.65)`;
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5);
  }

  // ── X-ray canvas ─────────────────────────────────────────────────────────────
  _seededRand(seed) {
    let s = (seed ^ 0xdeadbeef) >>> 0;
    return () => {
      s = Math.imul(1664525, s) + 1013904223 | 0;
      return (s >>> 0) / 4294967296;
    };
  }

  _drawXrayCanvas(canvas, contentType, podId) {
    const ctx  = canvas.getContext('2d');
    const W    = canvas.width;
    const H    = canvas.height;
    const seed = parseInt(podId.replace('POD-', ''), 10) || 7;
    const rand = this._seededRand(seed * 31 + 17);
    const pad  = 16;

    // Background
    ctx.fillStyle = '#050c07';
    ctx.fillRect(0, 0, W, H);

    // Scanlines
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = 'rgba(0,90,25,0.07)';
      ctx.fillRect(0, y, W, 1);
    }

    // Pod shell outline
    ctx.strokeStyle = '#1a4422';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

    // Corner bracket marks
    ctx.strokeStyle = '#2aaa55';
    ctx.lineWidth   = 1.5;
    for (const [cx, cy] of [[pad, pad],[W-pad, pad],[pad, H-pad],[W-pad, H-pad]]) {
      const dx = cx < W / 2 ? 7 : -7;
      const dy = cy < H / 2 ? 7 : -7;
      ctx.beginPath();
      ctx.moveTo(cx - dx, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy - dy);
      ctx.stroke();
    }

    // Clip to interior before drawing content
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad + 2, pad + 18, W - pad * 2 - 4, H - pad * 2 - 22);
    ctx.clip();
    ctx.shadowColor = '#33ff77';
    ctx.shadowBlur  = 5;

    this._drawXrayContent(ctx, W, H, pad, contentType, rand);

    ctx.restore();

    // Corner labels
    ctx.fillStyle = '#1a4422';
    ctx.font      = '8px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('X-RAY', pad + 4, pad + 13);
    ctx.textAlign = 'right';
    ctx.fillText(contentType, W - pad - 4, pad + 13);
    ctx.textAlign = 'left';

    // Bottom intensity bar
    const bar = ctx.createLinearGradient(pad + 4, 0, W - pad - 4, 0);
    bar.addColorStop(0,   'rgba(0,0,0,0)');
    bar.addColorStop(0.5, 'rgba(0,200,80,0.18)');
    bar.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = bar;
    ctx.fillRect(pad + 4, H - pad - 6, W - pad * 2 - 8, 4);
  }

  _drawXrayContent(ctx, W, H, pad, contentType, rand) {
    const ix = pad + 4, iy = pad + 18;
    const iw = W - pad * 2 - 8, ih = H - pad * 2 - 22;
    const cx = ix + iw / 2,    cy = iy + ih / 2;

    const g  = (a) => `rgba(68,255,136,${a})`;
    const dg = (a) => `rgba(30,180,80,${a})`;

    switch (contentType) {

      case 'ORGANIC': {
        // Amorphous blobs with tendril connections
        for (let i = 0; i < 6; i++) {
          const bx = ix + 12 + rand() * (iw - 24);
          const by = iy + 8  + rand() * (ih - 16);
          const r  = 10 + rand() * 22;
          ctx.beginPath();
          const steps = 8;
          for (let j = 0; j <= steps; j++) {
            const a      = (j / steps) * Math.PI * 2;
            const jitter = 0.55 + rand() * 0.9;
            const px     = bx + Math.cos(a) * r * jitter;
            const py     = by + Math.sin(a) * r * jitter;
            j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.strokeStyle = g(0.45 + rand() * 0.45);
          ctx.lineWidth   = 0.8 + rand() * 0.5;
          ctx.stroke();
          ctx.fillStyle = dg(0.12 + rand() * 0.18);
          ctx.fill();
        }
        // Tendrils
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          const ax = ix + 8 + rand() * (iw - 16);
          const ay = iy + 8 + rand() * (ih - 16);
          const bx = ix + 8 + rand() * (iw - 16);
          const by = iy + 8 + rand() * (ih - 16);
          ctx.moveTo(ax, ay);
          ctx.quadraticCurveTo(
            ix + rand() * iw, iy + rand() * ih,
            bx, by
          );
          ctx.strokeStyle = g(0.15 + rand() * 0.2);
          ctx.lineWidth   = 0.5 + rand() * 0.4;
          ctx.stroke();
        }
        break;
      }

      case 'MECHANICAL': {
        // Central chassis block
        const mw = 56 + rand() * 28, mh = 34 + rand() * 18;
        const mx = cx - mw / 2,      my = cy - mh / 2;
        ctx.strokeStyle = g(0.9);
        ctx.lineWidth   = 1.5;
        ctx.strokeRect(mx, my, mw, mh);
        ctx.fillStyle = dg(0.12);
        ctx.fillRect(mx, my, mw, mh);
        // Internal layer lines
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(mx,      my + (mh / 4) * i);
          ctx.lineTo(mx + mw, my + (mh / 4) * i);
          ctx.strokeStyle = g(0.2);
          ctx.lineWidth   = 0.5;
          ctx.stroke();
        }
        // Attached sub-components
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + rand() * 0.6;
          const dist  = 30 + rand() * 22;
          const cw    = 10 + rand() * 18;
          const ch    = 8  + rand() * 12;
          const compX = cx + Math.cos(angle) * dist - cw / 2;
          const compY = cy + Math.sin(angle) * dist - ch / 2;
          ctx.strokeStyle = g(0.6 + rand() * 0.35);
          ctx.lineWidth   = 1;
          ctx.strokeRect(compX, compY, cw, ch);
          ctx.fillStyle = dg(0.1);
          ctx.fillRect(compX, compY, cw, ch);
          // Connecting arm to chassis
          ctx.beginPath();
          ctx.moveTo(compX + cw / 2, compY + ch / 2);
          ctx.lineTo(cx, cy);
          ctx.strokeStyle = g(0.28);
          ctx.lineWidth   = 0.7;
          ctx.stroke();
          // Joint dot
          ctx.beginPath();
          ctx.arc(compX + cw / 2, compY + ch / 2, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = g(0.85);
          ctx.fill();
        }
        break;
      }

      case 'CHEMICAL': {
        // Fluid containers of varying sizes
        for (let i = 0; i < 7; i++) {
          const r  = 8 + rand() * 20;
          const bx = ix + r + 6 + rand() * (iw - r * 2 - 12);
          const by = iy + r + 4 + rand() * (ih - r * 2 - 8);
          ctx.beginPath();
          ctx.arc(bx, by, r, 0, Math.PI * 2);
          ctx.strokeStyle = g(0.65 + rand() * 0.35);
          ctx.lineWidth   = 1.2;
          ctx.stroke();
          // Radial gradient fill (bright centre)
          const grd = ctx.createRadialGradient(bx, by, 0, bx, by, r);
          grd.addColorStop(0, 'rgba(44,255,100,0.25)');
          grd.addColorStop(1, 'rgba(44,255,100,0.03)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(bx, by, r, 0, Math.PI * 2);
          ctx.fill();
          // Pressure ring on larger vessels
          if (r > 14) {
            ctx.beginPath();
            ctx.arc(bx, by, r * 0.72, 0, Math.PI * 2);
            ctx.strokeStyle = g(0.25);
            ctx.lineWidth   = 0.5;
            ctx.stroke();
          }
        }
        // Dispersed particulate
        for (let i = 0; i < 22; i++) {
          ctx.beginPath();
          ctx.arc(
            ix + 4 + rand() * (iw - 8),
            iy + 4 + rand() * (ih - 8),
            1 + rand(),
            0, Math.PI * 2
          );
          ctx.fillStyle = g(0.15 + rand() * 0.35);
          ctx.fill();
        }
        break;
      }

      case 'BIOLOGICAL': {
        // Cellular pattern — overlapping ellipses with nuclei
        const cells = [];
        for (let i = 0; i < 8; i++) {
          cells.push({
            x:  ix + 14 + rand() * (iw - 28),
            y:  iy + 8  + rand() * (ih - 16),
            rx: 14 + rand() * 16,
            ry: 9  + rand() * 13,
            a:  rand() * Math.PI,
          });
        }
        for (const c of cells) {
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(c.a);
          ctx.beginPath();
          ctx.ellipse(0, 0, c.rx, c.ry, 0, 0, Math.PI * 2);
          ctx.strokeStyle = g(0.45 + rand() * 0.3);
          ctx.lineWidth   = 0.9;
          ctx.stroke();
          ctx.fillStyle = dg(0.10 + rand() * 0.12);
          ctx.fill();
          ctx.restore();
          // Nucleus
          ctx.beginPath();
          ctx.arc(c.x, c.y, 2.5 + rand() * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = g(0.55 + rand() * 0.35);
          ctx.fill();
        }
        // Membrane / vascular lines between cells
        for (let i = 0; i + 1 < cells.length; i++) {
          ctx.beginPath();
          ctx.moveTo(cells[i].x, cells[i].y);
          ctx.lineTo(cells[i + 1].x, cells[i + 1].y);
          ctx.strokeStyle = g(0.12 + rand() * 0.1);
          ctx.lineWidth   = 0.5;
          ctx.stroke();
        }
        break;
      }

      case 'ELECTRONIC': {
        // PCB traces, IC chips, via holes
        const gx = ix + 6, gy = iy + 4;
        const gw = iw - 12, gh = ih - 8;
        const ROWS_G = 4, COLS_G = 5;

        // Horizontal traces
        for (let r = 0; r <= ROWS_G; r++) {
          if (rand() < 0.25) continue;
          const ty = gy + (r / ROWS_G) * gh;
          ctx.beginPath();
          ctx.moveTo(gx,      ty);
          ctx.lineTo(gx + gw, ty);
          ctx.strokeStyle = g(0.25 + rand() * 0.2);
          ctx.lineWidth   = 0.7 + rand() * 0.5;
          ctx.stroke();
        }
        // Vertical traces
        for (let c = 0; c <= COLS_G; c++) {
          if (rand() < 0.25) continue;
          const tx = gx + (c / COLS_G) * gw;
          ctx.beginPath();
          ctx.moveTo(tx, gy);
          ctx.lineTo(tx, gy + gh);
          ctx.strokeStyle = g(0.25 + rand() * 0.2);
          ctx.lineWidth   = 0.7 + rand() * 0.5;
          ctx.stroke();
        }
        // IC chips at grid intersections
        for (let r = 0; r <= ROWS_G; r++) {
          for (let c = 0; c <= COLS_G; c++) {
            if (rand() < 0.58) continue;
            const tx = gx + (c / COLS_G) * gw;
            const ty = gy + (r / ROWS_G) * gh;
            const cw = 13 + rand() * 15;
            const ch = 9  + rand() * 10;
            ctx.strokeStyle = g(0.65 + rand() * 0.35);
            ctx.lineWidth   = 1;
            ctx.strokeRect(tx - cw / 2, ty - ch / 2, cw, ch);
            ctx.fillStyle = dg(0.14);
            ctx.fillRect(tx - cw / 2, ty - ch / 2, cw, ch);
            // Internal pin lines
            for (let p = 1; p < 3; p++) {
              ctx.beginPath();
              ctx.moveTo(tx - cw / 2, ty - ch / 2 + (p / 3) * ch);
              ctx.lineTo(tx + cw / 2, ty - ch / 2 + (p / 3) * ch);
              ctx.strokeStyle = g(0.18);
              ctx.lineWidth   = 0.4;
              ctx.stroke();
            }
          }
        }
        // Via holes
        for (let i = 0; i < 14; i++) {
          const vx = gx + 4 + rand() * (gw - 8);
          const vy = gy + 4 + rand() * (gh - 8);
          ctx.beginPath();
          ctx.arc(vx, vy, 2 + rand() * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = g(0.6 + rand() * 0.4);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(vx, vy, 0.9, 0, Math.PI * 2);
          ctx.fillStyle = '#050c07';
          ctx.fill();
        }
        break;
      }
    }
  }

  // ── Open / close panel ────────────────────────────────────────────────────────
  _openInspectionPanel(pod) {
    this._paused = true;
    this._currentInspectPod = pod;

    // Evaluate violations internally — do NOT expose them to the player
    const violations = evaluatePod(pod.podData);
    pod.setInspectedResult(violations);

    // Calculate actual weight from pod ID and weight class bounds
    const bounds  = WEIGHT_BOUNDS[pod.podData.weightClass];
    const frac    = ((parseInt(pod.podData.id.replace('POD-', ''), 10) * 2654435761) >>> 0) / 4294967296;
    const measKg  = bounds
      ? Math.floor(bounds.min + frac * (bounds.max - bounds.min))
      : '—';

    // Declared manifest — shown as declared, no violation colouring
    document.getElementById('pod-id-label').textContent = pod.podData.id;
    document.getElementById('prop-weight').textContent  = pod.podData.weightClass;
    document.getElementById('prop-content').textContent = pod.podData.contentCategory;
    document.getElementById('prop-dest').textContent    = pod.podData.destinationCode;
    document.getElementById('prop-flag').textContent    = pod.podData.destinationFlag || '—';

    // Display actual weight in scan readouts for comparison against declared class
    document.getElementById('prop-weight-scan').textContent = `${measKg} kg`;

    // Draw declared flag colour preview
    const flagCanvas = document.getElementById('declared-flag-canvas');
    const declaredPlanet = PLANETS.find(p => p.flag === pod.podData.destinationFlag);
    if (declaredPlanet && declaredPlanet.flag) {
      this._drawPlanetFlag(flagCanvas, declaredPlanet);
    } else {
      const ctx = flagCanvas.getContext('2d');
      ctx.fillStyle = '#0b0c0d';
      ctx.fillRect(0, 0, flagCanvas.width, flagCanvas.height);
      ctx.fillStyle = '#334455';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('UNKNOWN FLAG', flagCanvas.width / 2, flagCanvas.height / 2);
      ctx.strokeStyle = '#1a2e40';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0.5, 0.5, flagCanvas.width - 1, flagCanvas.height - 1);
    }

    for (const id of ['prop-weight', 'prop-content', 'prop-dest', 'prop-flag']) {
      document.getElementById(id).className = 'prop-value';
    }

    // X-ray canvas — drawn from actual content (not declared)
    const xrayCanvas = document.getElementById('xray-canvas');
    this._drawXrayCanvas(xrayCanvas, pod.podData.actualContent, pod.podData.id);

    // Signature text beneath canvas
    document.getElementById('prop-scan-output').textContent =
      SCAN_SIGNATURES[pod.podData.actualContent] ?? 'SCAN ERROR — NO SIGNATURE RETURNED';

    // Approve button label shows destination
    document.getElementById('btn-approve').textContent = `Approve for ${pod.podData.destinationCode}`;

    // Always open on Weight tab
    this._panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    this._panel.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    this._panel.querySelector('[data-tab="weight"]').classList.add('active');
    document.getElementById('tab-weight').classList.add('active');

    this._panel.classList.add('visible');
  }

  _closeInspectionPanel() {
    this._panel.classList.remove('visible');
    this._paused = false;
    this._currentInspectPod = null;
  }

  _onDecision(decision) {
    const pod = this._currentInspectPod;
    if (!pod) return;
    pod.markDecision(decision);
    this._closeInspectionPanel();

    const fromTable = this._table.hasPod() && this._table.podOnTable === pod;
    if (fromTable) {
      this._table.removePod();
      this._player.pickUp(pod);
    }

    const label = decision === 'approve'
      ? `Approved for ${pod.podData.destinationCode} — carry it to the matching planet bay`
      : 'Denied — carry to DENIAL bay (incineration)';
    this._showToast(label, 'neutral', 3000);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  _nearestFloorPod(px, py) {
    let best = null, bestDist = 55;
    for (const pod of this._pods) {
      if (pod.podState !== 'on_floor') continue;
      const dx = pod.x - px, dy = pod.y - py;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) { bestDist = d; best = pod; }
    }
    return best;
  }

  _isSolid(cx, cy, hw, hh) {
    const left   = cx - hw, right  = cx + hw - 0.1;
    const top    = cy - hh, bottom = cy + hh - 0.1;

    const colL = Math.floor(left   / TILE_SIZE);
    const colR = Math.floor(right  / TILE_SIZE);
    const rowT = Math.floor(top    / TILE_SIZE);
    const rowB = Math.floor(bottom / TILE_SIZE);

    for (let r = rowT; r <= rowB; r++) {
      for (let c = colL; c <= colR; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
        const tile = WORLD_MAP[r][c];
        if (tile === TILE.WALL || tile === TILE.BAY || tile === TILE.INCIN) return true;

        for (const [mc, mr] of this._solidExtra) {
          if (mc === c && mr === r) return true;
        }
      }
    }
    return false;
  }

  // ── Toast / unlock banner ────────────────────────────────────────────────────
  _showToast(msg, cls = 'neutral', duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className   = `show ${cls}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.className = cls; }, duration);
  }

  _showUnlockBanner(msg) {
    this._unlockBanner.setText(msg).setAlpha(1);
    this.tweens.add({
      targets: this._unlockBanner,
      alpha: { from: 1, to: 0 },
      duration: 4000,
      delay: 3000,
      ease: 'Power2',
    });
  }
}
