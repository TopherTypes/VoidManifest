import { WORLD_MAP, TILE, TILE_SIZE, PLANETS, SCAN_SIGNATURES } from '../data/rules.js';
import { generatePodBatch }  from '../data/pods.js';
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
const TOTAL_PODS   = 12;
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

export class Day1Scene extends Phaser.Scene {
  constructor() { super({ key: 'Day1Scene' }); }

  // ── create ──────────────────────────────────────────────────────────────────
  create() {
    this._economy     = new Economy(50);
    this._progression = new Progression(1);
    this._paused      = false;
    this._pods        = [];
    this._processedCount = 0;
    this._solidExtra  = [];

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

    this._showToast('Day 1 — Inspect each pod and route it to the correct planet', 'neutral', 4000);
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
    const data = generatePodBatch(TOTAL_PODS);
    for (let i = 0; i < data.length; i++) {
      const slot = SPAWN_SLOTS[i % SPAWN_SLOTS.length];
      const px   = slot[0] * TILE_SIZE + TILE_SIZE / 2;
      const py   = slot[1] * TILE_SIZE + TILE_SIZE / 2;
      const pod  = new CargoPod(this, px, py, data[i]);
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
    this._hudCreditsText = this.add.text(12, 8, '', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#66aaff',
    }).setDepth(20).setScrollFactor(0);

    this._hudProgressText = this.add.text(1044, 8, '', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#668888',
    }).setDepth(20).setScrollFactor(0).setOrigin(1, 0);

    this._hudDayText = this.add.text(528, 8, 'DAY 1', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#334455',
      letterSpacing: 3,
    }).setDepth(20).setScrollFactor(0).setOrigin(0.5, 0);

    this._promptText = this.add.text(528, 748, '', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#446688',
      letterSpacing: 1,
    }).setDepth(20).setScrollFactor(0).setOrigin(0.5, 1);

    this._unlockBanner = this.add.text(528, 40, '', {
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
            hint = needsDecision
              ? `[E] Deposit at ${bay.bayData.id} — inspect first!`
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
        const near = this._nearestFloorPod(player.x, player.y);
        if (near) hint = `[E] Pick up ${near.podData.id}`;
        else      hint = 'WASD / Arrow keys to move';
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

    // 2. Pick up floor pod
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

    const result = this._economy.scoreDeposit(
      { ...pod.podData, violations: pod.violations },
      bay.bayData.id
    );

    bay.deposit(pod);
    this._processedCount++;
    this._checkProgression();
    this._checkDayEnd();

    const cls = result.correct ? 'positive' : 'negative';
    this._showToast(result.reason, cls, 2200);
  }

  // ── Inspection panel (HTML overlay) ─────────────────────────────────────────
  _wireInspectionPanel() {
    const panel    = document.getElementById('inspection-panel');
    const btnRoute = document.getElementById('btn-route');
    const btnIncin = document.getElementById('btn-incinerate');

    this._panel               = panel;
    this._currentInspectPod   = null;

    btnRoute.addEventListener('click', () => this._onDecision('route'));
    btnIncin.addEventListener('click', () => this._onDecision('incinerate'));

    // Populate the static planet registry once
    this._populatePlanetRegistry();
  }

  _populatePlanetRegistry() {
    const regDiv = document.getElementById('planet-registry');
    regDiv.innerHTML = '';
    for (const planet of PLANETS.filter(p => p.flag)) {
      const row = document.createElement('div');
      row.className = 'registry-row';
      row.innerHTML =
        `<span class="reg-flag" style="color:${planet.flagColor}">${planet.flag}</span>` +
        `<span class="reg-code">${planet.id}</span>` +
        `<span class="reg-name">${planet.label}</span>`;
      regDiv.appendChild(row);
    }
  }

  _openInspectionPanel(pod) {
    this._paused = true;
    this._currentInspectPod = pod;

    // Evaluate violations internally — do NOT expose them to the player
    const violations = evaluatePod(pod.podData);
    pod.setInspectedResult(violations);

    // Manifest data — shown as-is, no highlighting of correct/incorrect
    document.getElementById('pod-id-label').textContent      = pod.podData.id;
    document.getElementById('prop-dest').textContent         = pod.podData.destinationCode;
    document.getElementById('prop-flag').textContent         = pod.podData.destinationFlag || '—';
    document.getElementById('prop-content').textContent      = pod.podData.contentCategory;
    document.getElementById('prop-weight').textContent       = pod.podData.weightClass;

    // Reset all prop-value classes — no violation coloring
    for (const id of ['prop-dest', 'prop-flag', 'prop-content', 'prop-weight']) {
      document.getElementById(id).className = 'prop-value';
    }

    // X-ray scan output — derived from actual contents, not declared category
    const scanText = SCAN_SIGNATURES[pod.podData.actualContent] || 'SCAN ERROR — NO SIGNATURE RETURNED';
    document.getElementById('prop-scan-output').textContent = scanText;

    // Weight scanner row (shown only if pod passed through scanner)
    const weightScanRow = document.getElementById('weight-scan-row');
    if (pod.weightScanned) {
      weightScanRow.style.display = '';
      document.getElementById('prop-weight-scan').textContent = `${pod.podData.weightClass} — confirmed`;
      document.getElementById('prop-weight-scan').className = 'prop-value';
    } else {
      weightScanRow.style.display = 'none';
    }

    // Route button shows declared destination
    document.getElementById('btn-route').textContent = `Route to ${pod.podData.destinationCode}`;

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

    const label = decision === 'route'
      ? `Route to ${pod.podData.destinationCode} — carry it to the matching planet bay`
      : 'Marked for incineration — carry to INCINERATION bay';
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
