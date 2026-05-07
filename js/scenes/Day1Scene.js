import { WORLD_MAP, TILE, TILE_SIZE, BAYS, RULES } from '../data/rules.js';
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
const TABLE_TX = 9,  TABLE_TY = 6;  // inspection table tile position
const SCANNER_TX = 4, SCANNER_TY = 6; // weight scanner tile position

// Bay layout: [bayId, tileX, tileY]
const BAY_LAYOUT = [
  ['STO-A',  18, 1],
  ['STO-B',  18, 4],
  ['CRYO-1', 18, 7],
  ['HAZ-1',  18, 10],
  ['INCIN',  18, 13],
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
    this._solidExtra  = []; // extra solid tile coords from machines

    // Bind isSolid so entities can call it as scene.isSolid(...)
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

    this._showToast('Day 1 — Inspect and route incoming cargo', 'neutral', 3500);
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
            // Hazard stripe hint
            g.fillStyle(0x1a2a1a, 0.6);
            g.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            g.lineStyle(0.5, 0x1e3a1e, 1);
            g.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
            break;

          case TILE.BAY:
          case TILE.INCIN:
            // Bays are drawn by the Bay entity, just lay down dark floor
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
      const bayData = BAYS.find(b => b.id === id);
      const bay     = new Bay(this, tx, ty, bayData);
      this._bays.push(bay);
    }
  }

  // ── Machines ─────────────────────────────────────────────────────────────────
  _createMachines() {
    this._table   = new InspectionTable(this, TABLE_TX, TABLE_TY);
    this._scanner = new WeightScanner(this, SCANNER_TX, SCANNER_TY);

    // Inspection table is always present — register its solid tiles
    this.addSolidMachineTiles(this._table.solidTiles);

    // Scanner is hidden until unlocked — solid tiles added in activate()
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
    // Overlay graphics (always on top, depth 20)
    this._hudCreditsText = this.add.text(12, 8, '', {
      fontSize: '13px', fontFamily: 'Courier New', color: '#66aaff',
    }).setDepth(20).setScrollFactor(0);

    this._hudProgressText = this.add.text(1044, 8, '', {
      fontSize: '13px', fontFamily: 'Courier New', color: '#668888',
    }).setDepth(20).setScrollFactor(0).setOrigin(1, 0);

    this._hudDayText = this.add.text(528, 8, 'DAY 1', {
      fontSize: '13px', fontFamily: 'Courier New', color: '#334455',
      letterSpacing: 3,
    }).setDepth(20).setScrollFactor(0).setOrigin(0.5, 0);

    // Interaction prompt
    this._promptText = this.add.text(528, 748, '', {
      fontSize: '11px', fontFamily: 'Courier New', color: '#446688',
      letterSpacing: 1,
    }).setDepth(20).setScrollFactor(0).setOrigin(0.5, 1);

    // Scanner unlock notification area
    this._unlockBanner = this.add.text(528, 40, '', {
      fontSize: '12px', fontFamily: 'Courier New', color: '#44cc88',
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
      // Check table
      const tip = this._table.interactPoint();
      if (!this._table.hasPod() && player.isNear(tip.x, tip.y)) {
        hint = '[E] Place pod on inspection table';
      }
      // Check scanner
      else if (this._scanner?.visible) {
        const ip = this._scanner.inputPoint();
        if (player.isNear(ip.x, ip.y) && !this._scanner.scanning) {
          hint = '[E] Insert pod into weight scanner';
        }
      }
      // Check bays
      else {
        for (const bay of this._bays) {
          if (bay.playerCanDeposit(player.x, player.y)) {
            const needsDecision = !carried.decision;
            if (needsDecision) {
              hint = `[E] Deposit at ${bay.bayData.id} — inspect first!`;
            } else {
              hint = `[E] Deposit at ${bay.bayData.id}`;
            }
            break;
          }
        }
      }
      if (!hint) hint = 'WASD / Arrow keys to move — carry pod to inspection table';
    } else {
      // Check table pod pick-up
      const tip = this._table.interactPoint();
      if (this._table.hasPod() && player.isNear(tip.x, tip.y)) {
        hint = '[E] Pick up pod from table';
      } else {
        // Check nearby floor pod
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
      this._showUnlockBanner('UNLOCK: Auto Weight Scanner placed in cargo bay');
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
    // 1. Inspection table (place pod)
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
    // Force inspection if not yet done (just evaluate silently — player still loses credits)
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

    this._panel      = panel;
    this._currentInspectPod = null;

    btnRoute.addEventListener('click', () => this._onDecision('route'));
    btnIncin.addEventListener('click', () => this._onDecision('incinerate'));
  }

  _openInspectionPanel(pod) {
    this._paused = true;
    this._currentInspectPod = pod;

    // Evaluate violations
    const violations = evaluatePod(pod.podData);
    pod.setInspectedResult(violations);

    // Populate DOM
    document.getElementById('pod-id-label').textContent = pod.podData.id;
    document.getElementById('prop-dest').textContent    = pod.podData.destinationCode;
    document.getElementById('prop-content').textContent = pod.podData.contentCategory;
    document.getElementById('prop-weight').textContent  = pod.podData.weightClass;

    const scanRow = document.getElementById('scan-result-row');
    if (pod.weightScanned) {
      scanRow.style.display = '';
      const scanSpan = document.getElementById('prop-scan');
      if (pod.weightPassed) {
        scanSpan.textContent  = 'PASS — weight compliant';
        scanSpan.className    = 'prop-value pass';
      } else {
        scanSpan.textContent  = 'FAIL — weight violation detected';
        scanSpan.className    = 'prop-value fail';
      }
    } else {
      scanRow.style.display = 'none';
    }

    // Content/weight highlights
    document.getElementById('prop-content').className =
      violations.some(v => v.ruleId !== 'sto-a-weight') ? 'prop-value highlight' : 'prop-value';
    document.getElementById('prop-weight').className =
      violations.some(v => v.ruleId === 'sto-a-weight') ? 'prop-value highlight' : 'prop-value';

    // Rules list
    const list = document.getElementById('rules-list');
    list.innerHTML = '';
    for (const rule of RULES) {
      const triggered = violations.some(v => v.ruleId === rule.id);
      const row = document.createElement('div');
      row.className = triggered ? 'rule-row triggered' : 'rule-row';
      row.innerHTML = `
        <span class="rule-sev">SEV ${rule.severity}</span>
        <span class="rule-text">${rule.description}</span>
      `;
      list.appendChild(row);
    }

    // Update route button label
    document.getElementById('btn-route').textContent =
      `Route to ${pod.podData.destinationCode}`;

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

    // Return pod to player from table
    const fromTable = this._table.hasPod() && this._table.podOnTable === pod;
    if (fromTable) {
      this._table.removePod();
      this._player.pickUp(pod);
    }

    const label = decision === 'route'
      ? `Route to ${pod.podData.destinationCode} — carry it to the matching bay`
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

  // Called by Player via scene.isSolid (bound in create)
  _isSolid(cx, cy, hw, hh) {
    // Check AABB against all solid tiles
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

        // Check extra machine tiles
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
