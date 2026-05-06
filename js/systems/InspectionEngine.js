import { RULES } from '../data/rules.js';

export function evaluatePod(pod) {
  return RULES
    .filter(rule => rule.test(pod))
    .map(rule => ({ ruleId: rule.id, severity: rule.severity, description: rule.description }));
}

export function isViolating(pod) {
  return RULES.some(rule => rule.test(pod));
}

export { RULES };
