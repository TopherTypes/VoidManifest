// ── Bay definitions ──────────────────────────────────────────────────────────
export const BAYS = [
  { id: 'STO-A',  label: 'STORAGE A',   color: 0x1a2e3e, borderColor: 0x3366aa, description: 'General — EQUIPMENT/FOOD, max MEDIUM weight' },
  { id: 'STO-B',  label: 'STORAGE B',   color: 0x1a2e3e, borderColor: 0x3366aa, description: 'Food cargo only, any weight class' },
  { id: 'CRYO-1', label: 'CRYO BAY 1',  color: 0x0e1e30, borderColor: 0x2255aa, description: 'MEDICAL cargo only — refrigerated' },
  { id: 'HAZ-1',  label: 'HAZMAT BAY',  color: 0x2a1800, borderColor: 0xaa5500, description: 'HAZMAT cargo only — sealed bay' },
  { id: 'INCIN',  label: 'INCINERATION', color: 0x200808, borderColor: 0x882222, description: 'Destroy violating or condemned cargo' },
];

// ── Inspection rules ──────────────────────────────────────────────────────────
// test(pod) → true means the pod is in VIOLATION of this rule
export const RULES = [
  {
    id: 'hazmat-routing',
    description: 'HAZMAT cargo must be routed to HAZMAT BAY exclusively',
    severity: 9,
    relatedProperty: 'contentCategory',
    test: (pod) => pod.contentCategory === 'HAZMAT' && pod.destinationCode !== 'HAZ-1',
  },
  {
    id: 'non-hazmat-in-haz-bay',
    description: 'HAZMAT BAY must not receive non-hazardous cargo',
    severity: 6,
    relatedProperty: 'contentCategory',
    test: (pod) => pod.destinationCode === 'HAZ-1' && pod.contentCategory !== 'HAZMAT',
  },
  {
    id: 'medical-routing',
    description: 'MEDICAL cargo must be routed to CRYO BAY 1 exclusively',
    severity: 7,
    relatedProperty: 'contentCategory',
    test: (pod) => pod.contentCategory === 'MEDICAL' && pod.destinationCode !== 'CRYO-1',
  },
  {
    id: 'sto-a-weight',
    description: 'STORAGE A is rated LIGHT/MEDIUM only — HEAVY cargo prohibited',
    severity: 5,
    relatedProperty: 'weightClass',
    test: (pod) => pod.destinationCode === 'STO-A' && pod.weightClass === 'HEAVY',
  },
  {
    id: 'sto-b-food-only',
    description: 'STORAGE B is designated for FOOD cargo only',
    severity: 6,
    relatedProperty: 'contentCategory',
    test: (pod) => pod.destinationCode === 'STO-B' && pod.contentCategory !== 'FOOD',
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
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 1  STO-A ↑
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 2  STO-A ↓
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1], // row 3  divider
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 4  STO-B ↑
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 5  STO-B ↓
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1], // row 6  divider
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 7  CRYO-1 ↑
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 8  CRYO-1 ↓
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1], // row 9  divider
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 10 HAZ-1 ↑
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,1], // row 11 HAZ-1 ↓
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1], // row 12 divider
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,1], // row 13 INCIN ↑
  [1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,1], // row 14 INCIN ↓
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // row 15
];
