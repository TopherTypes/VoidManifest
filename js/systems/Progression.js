import { TECHNOLOGY } from '../data/technology.js';

export class Progression {
  constructor(day = 1) {
    this.day        = day;
    this.unlocked   = new Set();
    this._callbacks = new Map();
  }

  onUnlock(techId, fn) {
    this._callbacks.set(techId, fn);
  }

  check(trigger, data = {}) {
    for (const tech of TECHNOLOGY) {
      if (this.unlocked.has(tech.id)) continue;
      if (tech.unlockedOnDay > this.day)  continue;
      if (tech.trigger !== trigger)        continue;
      if (this._meetsTrigger(tech, data))  this._unlock(tech.id);
    }
  }

  _meetsTrigger(tech, data) {
    if (tech.trigger === 'pods_processed_pct') return (data.pct ?? 0) >= tech.threshold;
    if (tech.trigger === 'day_start')           return true;
    return false;
  }

  _unlock(techId) {
    this.unlocked.add(techId);
    const cb = this._callbacks.get(techId);
    if (cb) cb();
  }

  has(techId) { return this.unlocked.has(techId); }
}
