// ── Planet definitions ────────────────────────────────────────────────────────
export const PLANETS = [
  { id: 'VERATH-IV', label: 'Verath IV',    flag: '⬠', flagColor: '#4488dd', color: 0x0e1a30, borderColor: 0x3366cc },
  { id: 'OSKAR-7',   label: 'Oskar-7',      flag: '⬟', flagColor: '#9955cc', color: 0x1a0e2a, borderColor: 0x8844bb },
  { id: 'MIRA-3',    label: 'Mira-3',       flag: '●', flagColor: '#22bbaa', color: 0x0a1e1e, borderColor: 0x229988 },
  { id: 'DRAKON',    label: 'Drakon Prime',  flag: '★', flagColor: '#dd8833', color: 0x221408, borderColor: 0xaa5522 },
  { id: 'INCIN',     label: 'INCINERATION', flag: null, flagColor: null,      color: 0x200808, borderColor: 0x882222 },
];

// ── Incorrect flag options (for falsely-marked parcels) ────────────────────────
export const INCORRECT_FLAGS = [
  '◆', '◇', '▢', '▪', '■', '□', '◈', '◊', '◌', '○',
];

// Planet IDs valid for routing (excludes INCIN)
export const VALID_PLANET_IDS = new Set(['VERATH-IV', 'OSKAR-7', 'MIRA-3', 'DRAKON']);

// Fake destination codes that appear on violating pods
export const INVALID_PLANET_NAMES = ['XENOS-9', 'VOID-PRIME', 'SECTOR-77', 'NULLGATE', 'THE-VOID'];

// ── Content categories and their x-ray scan signatures ────────────────────────
export const CONTENT_CATEGORIES = ['ORGANIC', 'MECHANICAL', 'CHEMICAL', 'BIOLOGICAL', 'ELECTRONIC'];

export const SCAN_SIGNATURES = {
  ORGANIC:    'DENSE ORGANIC COMPOUNDS — IRREGULAR MASS DISTRIBUTION',
  MECHANICAL: 'RIGID METALLIC STRUCTURES — HIGH DENSITY CORE DETECTED',
  CHEMICAL:   'CONTAINED FLUID CLUSTERS — MOLECULAR DISPERSION PATTERN',
  BIOLOGICAL: 'ACTIVE CELLULAR MASS — THERMAL SIGNATURE PRESENT',
  ELECTRONIC: 'CIRCUIT LATTICE — ELECTROMAGNETIC INTERFERENCE READING',
};

// ── Weight class bounds (kg, gross shipping weight including container) ────────
export const WEIGHT_BOUNDS = {
  LIGHT:  { min: 0,   max: 99,   label: '0 – 99 kg',    note: 'Courier parcels. No hazmat protocols.' },
  MEDIUM: { min: 100, max: 499,  label: '100 – 499 kg',  note: 'Commercial freight. Standard inspection.' },
  HEAVY:  { min: 500, max: 2000, label: '500 – 2000 kg', note: 'Industrial cargo. Enhanced scan required.' },
};

// ── Inspection rules ──────────────────────────────────────────────────────────
// test(pod) → true means the pod is in VIOLATION of this rule
export const RULES = [
  {
    id: 'invalid-destination',
    description: 'Destination not found in authorized planet registry',
    severity: 8,
    relatedProperty: 'destinationCode',
    test: (pod) => !VALID_PLANET_IDS.has(pod.destinationCode),
  },
  {
    id: 'flag-mismatch',
    description: 'Declared flag identifier does not match destination planet',
    severity: 7,
    relatedProperty: 'destinationFlag',
    test: (pod) => {
      const planet = PLANETS.find(p => p.id === pod.destinationCode);
      // If destination is already invalid, that violation covers it
      if (!planet || !planet.flag) return false;
      return pod.destinationFlag !== planet.flag;
    },
  },
  {
    id: 'scan-mismatch',
    description: 'X-ray scan signature does not match declared content category',
    severity: 9,
    relatedProperty: 'contentCategory',
    test: (pod) => pod.actualContent !== pod.contentCategory,
  },
];

// ── World tile constants ──────────────────────────────────────────────────────
export const TILE = {
  FLOOR:    0,
  WALL:     1,
  DELIVERY: 2,
  BAY:      3,
  INCIN:    4,
};

export const TILE_SIZE = 48;

// ── World map: 22 cols × 16 rows ──────────────────────────────────────────────
// Row 0 and 15 = outer walls. Cols 0 and 21 = outer walls.
// Cols 1–2  = delivery zone  (walkable)
// Cols 3–17 = open floor     (walkable)
// Cols 18–20 = bay alcoves   (solid — player approaches from col 17)
// Rows 3,6,9,12 at cols 18–21 = dividers between bays
export const WORLD_MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // row 0
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 1  VERATH-IV ↑
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 2  VERATH-IV ↓
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1], // row 3  divider
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 4  OSKAR-7 ↑
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 5  OSKAR-7 ↓
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1], // row 6  divider
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 7  MIRA-3 ↑
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 8  MIRA-3 ↓
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1], // row 9  divider
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 10 DRAKON ↑
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 11 DRAKON ↓
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1], // row 12 divider
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,1], // row 13 INCIN ↑
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,1], // row 14 INCIN ↓
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // row 15
];
