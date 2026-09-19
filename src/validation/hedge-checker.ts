import { Finding } from '../types/contract';

const HEDGE_WORDS_REGEX = /\b(?:may(?:\s+be)?|possibly|unclear|not\s+certain|could\s+potentially)\b/i;

/**
 * Pipeline Step 9: Hedge/Label Consistency Check (Change 4)
 * Evaluates ONLY description and ai_interpretation.
 * If either field contains hedge language while relationship is a confident non-uncertain label,
 * downgrade the finding to "uncertain".
 * Hedge language in potential_consideration, uncertainty, or suggested_question triggers nothing.
 */
export function checkHedgeLabelConsistency(findings: Finding[]): Finding[] {
  return findings.map((f) => {
    if (f.relationship === 'uncertain') {
      return f;
    }

    const descHasHedge = HEDGE_WORDS_REGEX.test(f.description);
    const interpHasHedge = HEDGE_WORDS_REGEX.test(f.ai_interpretation);

    if (descHasHedge || interpHasHedge) {
      return {
        ...f,
        relationship: 'uncertain',
        coexistence_possible: null,
        uncertainty:
          f.uncertainty ||
          'Downgraded to uncertain due to hedged phrasing in the finding description or interpretation.',
      };
    }

    return f;
  });
}
