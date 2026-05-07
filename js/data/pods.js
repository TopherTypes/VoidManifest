import { RULES, VALID_PLANET_IDS, INVALID_PLANET_NAMES, PLANETS, CONTENT_CATEGORIES, INCORRECT_FLAGS } from './rules.js';

const VALID_DESTINATIONS = [...VALID_PLANET_IDS];
const WEIGHT_CLASSES     = ['LIGHT', 'MEDIUM', 'HEAVY'];

let _idCounter = 1;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getFlag(planetId) {
  const planet = PLANETS.find(p => p.id === planetId);
  return planet?.flag ?? '?';
}

function podHasViolation(pod) {
  return RULES.some(r => r.test(pod));
}

function makePodBase() {
  const destCode = pick(VALID_DESTINATIONS);
  const content  = pick(CONTENT_CATEGORIES);
  return {
    id:               `POD-${String(_idCounter++).padStart(3, '0')}`,
    destinationCode:  destCode,
    destinationFlag:  getFlag(destCode),
    contentCategory:  content,
    actualContent:    content,
    weightClass:      pick(WEIGHT_CLASSES),
  };
}

function generateValid() {
  // Base pod is always valid: real destination, correct flag, matching actualContent
  return makePodBase();
}

function generateViolating() {
  const pod = makePodBase();
  const violationType = Math.floor(Math.random() * 3);

  switch (violationType) {
    case 0: {
      // Invalid destination — pod routed to an unrecognized planet
      pod.destinationCode = pick(INVALID_PLANET_NAMES);
      // Assign a random incorrect flag
      pod.destinationFlag = pick(INCORRECT_FLAGS);
      break;
    }
    case 1: {
      // Flag mismatch — valid planet but wrong flag declared on manifest
      const correctFlag = getFlag(pod.destinationCode);
      // Pick either an incorrect flag or a flag from another planet
      const allWrongFlags = [
        ...INCORRECT_FLAGS,
        ...PLANETS.filter(p => p.flag && p.flag !== correctFlag).map(p => p.flag),
      ];
      pod.destinationFlag = pick(allWrongFlags);
      break;
    }
    case 2: {
      // Content scan mismatch — declared content type differs from actual contents
      const others      = CONTENT_CATEGORIES.filter(c => c !== pod.contentCategory);
      pod.actualContent = pick(others);
      break;
    }
  }

  // Fallback: guarantee at least one violation
  if (!podHasViolation(pod)) {
    pod.destinationCode = pick(INVALID_PLANET_NAMES);
    pod.destinationFlag = pick(INCORRECT_FLAGS);
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

// Stage 1: Single valid pod for inspection tutorial
export function generateStage1() {
  return [generateValid()];
}

// Stage 2: Single invalid pod to teach denial
export function generateStage2() {
  return [generateViolating()];
}

// Stage 3: Three valid pods to same destination, teaching batch handling
export function generateStage3() {
  const dest = pick(VALID_DESTINATIONS);
  return [
    { ...makePodBase(), destinationCode: dest, destinationFlag: getFlag(dest) },
    { ...makePodBase(), destinationCode: dest, destinationFlag: getFlag(dest) },
    { ...makePodBase(), destinationCode: dest, destinationFlag: getFlag(dest) },
  ];
}
