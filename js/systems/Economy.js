function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class Economy {
  constructor(startingCredits = 50) {
    this.credits = startingCredits;
    this.history = [];
  }

  // Returns { delta, reason, correct }
  scoreDeposit(pod, bayId) {
    const violations     = pod.violations ?? [];
    const isViolating    = violations.length > 0;
    const isIncineration = bayId === 'INCIN';
    const severity       = isViolating
      ? Math.max(...violations.map(v => v.severity))
      : 0;

    let delta, reason, correct;

    if (!isViolating && !isIncineration) {
      if (bayId === pod.destinationCode) {
        delta   = randBetween(3, 7);
        reason  = `Correct routing (+${delta} CR)`;
        correct = true;
      } else {
        delta   = -randBetween(3, 8);
        reason  = `Wrong bay! (${delta} CR)`;
        correct = false;
      }
    } else if (isViolating && isIncineration) {
      delta   = Math.round(2 + (severity / 10) * 8);
      reason  = `Violation correctly flagged (+${delta} CR)`;
      correct = true;
    } else if (isViolating && !isIncineration) {
      delta   = -Math.round(2 + (severity / 10) * 8);
      reason  = `Violation slipped through! (${delta} CR)`;
      correct = false;
    } else {
      // Valid pod incinerated
      delta   = -randBetween(5, 15);
      reason  = `Valid cargo destroyed (${delta} CR)`;
      correct = false;
    }

    this.credits += delta;
    this.history.push({ delta, reason, correct, timestamp: Date.now() });
    return { delta, reason, correct };
  }
}
