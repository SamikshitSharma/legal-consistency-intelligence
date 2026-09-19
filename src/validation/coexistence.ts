import { Finding } from '../types/contract';

/**
 * Pipeline Step 6: coexistence_possible Null-Enforcement (Change 1 / Test #42)
 * Forces coexistence_possible = null on any finding where relationship != 'apparent_conflict'.
 * Defensively overwrites model outputs regardless of what the model emitted.
 */
export function enforceCoexistenceNulling(findings: Finding[]): Finding[] {
  return findings.map((f) => {
    if (f.relationship !== 'apparent_conflict') {
      return {
        ...f,
        coexistence_possible: null,
      };
    } else {
      // Ensure it is valid boolean or "uncertain"
      const val = f.coexistence_possible;
      const validVal = val === true || val === false || val === 'uncertain' ? val : 'uncertain';
      return {
        ...f,
        coexistence_possible: validVal,
      };
    }
  });
}
