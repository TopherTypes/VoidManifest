import { RULES } from './rules.js';

const DESTINATIONS   = ['STO-A', 'STO-B', 'CRYO-1', 'HAZ-1'];
const CONTENTS       = ['FOOD', 'EQUIPMENT', 'MEDICAL', 'HAZMAT'];
const WEIGHT_CLASSES = ['LIGHT', 'MEDIUM', 'HEAVY'];

let _idCounter = 1;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function podHasViolation(pod) {
  return RULES.some(r => r.test(pod));
}

function makePod() {
  return {
    id: `POD-${String(_idCounter++).padStart(3, '0')}`,
    destinationCode:   pick(DESTINATIONS),
    contentCategory:   pick(CONTENTS),
    weightClass:       pick(WEIGHT_CLASSES),
  };
}

function generateValid() {
  let pod;
  let attempts = 0;
  do { pod = makePod(); attempts++; } while (podHasViolation(pod) && attempts < 60);

  if (podHasViolation(pod)) {
    // Guaranteed-valid fallback
    pod.contentCategory = 'FOOD';
    pod.destinationCode = 'STO-B';
    pod.weightClass = 'LIGHT';
  }
  return pod;
}

function generateViolating() {
  let pod;
  let attempts = 0;
  do { pod = makePod(); attempts++; } while (!podHasViolation(pod) && attempts < 60);

  if (!podHasViolation(pod)) {
    // Guaranteed-violation fallback: HAZMAT routed to wrong bay
    pod.contentCategory = 'HAZMAT';
    pod.destinationCode = 'STO-A';
    pod.weightClass = pick(WEIGHT_CLASSES);
  }
  return pod;
}

// count: total pods. ~35% will be violations.
export function generatePodBatch(count) {
  const violationCount = Math.round(count * 0.35);
  const validCount     = count - violationCount;

  const pods = [
    ...Array.from({ length: violationCount }, generateViolating),
    ...Array.from({ length: validCount },     generateValid),
  ];

  // Fisher-Yates shuffle
  for (let i = pods.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pods[i], pods[j]] = [pods[j], pods[i]];
  }

  return pods;
}
