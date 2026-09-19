import { describe, it, expect } from 'vitest';
import { checkHedgeLabelConsistency } from '../../src/validation/hedge-checker';
import { Finding } from '../../src/types/contract';

describe('Pipeline Step 9: Hedge/Label Consistency Check (Change 4)', () => {
  it('downgrades confident finding to uncertain if description contains hedge words', () => {
    const findings: Finding[] = [
      {
        finding_id: 'f1',
        relationship: 'modification',
        description: 'The payment period may possibly have changed from 30 to 15 days.',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-8' }],
        ai_interpretation: 'Payment schedule difference.',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: null,
      },
    ];

    const result = checkHedgeLabelConsistency(findings);
    expect(result[0].relationship).toBe('uncertain');
    expect(result[0].uncertainty).toContain('hedged phrasing');
  });

  it('downgrades confident finding if ai_interpretation contains hedge words', () => {
    const findings: Finding[] = [
      {
        finding_id: 'f2',
        relationship: 'addition',
        description: 'New termination provision added.',
        evidence: [{ document_id: 'doc_b', clause_id: 'B-7' }],
        ai_interpretation: 'It is unclear whether this alters the earlier agreement.',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: null,
      },
    ];

    const result = checkHedgeLabelConsistency(findings);
    expect(result[0].relationship).toBe('uncertain');
  });

  it('does NOT downgrade when hedge words appear in potential_consideration or uncertainty or questions', () => {
    const findings: Finding[] = [
      {
        finding_id: 'f3',
        relationship: 'modification',
        description: 'Payment period changed from 30 days to 15 days.',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-8' }],
        ai_interpretation: 'The revised agreement specifies 15 days.',
        potential_consideration: 'This may possibly affect cash flow scheduling.', // Hedge here is allowed!
        uncertainty: 'It is unclear whether existing invoices are grandfathered.', // Hedge here is allowed!
        suggested_question: 'Could this potentially impact current deliverables?', // Hedge here is allowed!
        coexistence_possible: null,
      },
    ];

    const result = checkHedgeLabelConsistency(findings);
    // Correct Change 4 rule: relationship remains confident!
    expect(result[0].relationship).toBe('modification');
  });
});
