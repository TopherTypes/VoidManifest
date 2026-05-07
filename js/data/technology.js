export const TECHNOLOGY = [
  {
    id: 'auto-weight-scanner',
    name: 'Auto Weight Scanner',
    description: 'A physical scanning unit placed in the cargo bay. Load a pod into the input face — it ejects to the PASS side if weight is compliant, FAIL side if not.',
    unlockedOnDay: 1,
    trigger: 'pods_processed_pct',
    threshold: 0.42,
    effect: 'PLACE_WEIGHT_SCANNER',
  },
  {
    id: 'conveyor-kit',
    name: 'Conveyor Tile Kit',
    description: 'Purchase and place directional conveyor belts to automate cargo flow between machines.',
    unlockedOnDay: 2,
    trigger: 'day_start',
    threshold: null,
    effect: 'ENABLE_CONVEYOR_BUILD',
  },
  {
    id: 'content-scanner',
    name: 'Content Scanner',
    description: 'Automatically detects content category violations without manual inspection.',
    unlockedOnDay: 2,
    trigger: 'pods_processed_pct',
    threshold: 0.5,
    effect: 'PLACE_CONTENT_SCANNER',
  },
];
