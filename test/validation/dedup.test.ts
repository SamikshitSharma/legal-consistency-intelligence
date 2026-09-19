import { describe, it, expect } from 'vitest';
import { deduplicateFindingsAndObligations } from '../../src/validation/deduplicator';
import { Finding, Obligation } from '../../src/types/contract';

describe('Pipeline Step 11: Deduplication of Findings and Obligations', () => {
  it('deduplicates identical findings sharing the same relationship and evidence citations', () => {
    const findings: Finding[] = [
      {
        finding_id: 'f1',
        relationship: 'modification',
        description: 'First occurrence',
        evidence: [
          { document_id: 'doc_a', clause_id: 'A-1' },
          { document_id: 'doc_b', clause_id: 'B-1' },
        ],
        ai_interpretation: '',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: null,
      },
      {
        finding_id: 'f2',
        relationship: 'modification', // Duplicate relationship & evidence!
        description: 'Duplicate occurrence',
        evidence: [
          { document_id: 'doc_b', clause_id: 'B-1' },
          { document_id: 'doc_a', clause_id: 'A-1' },
        ],
        ai_interpretation: '',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: null,
      },
    ];

    const { dedupedFindings } = deduplicateFindingsAndObligations(findings, []);
    expect(dedupedFindings).toHaveLength(1);
    expect(dedupedFindings[0].finding_id).toBe('f1');
  });

  it('deduplicates identical obligations with the same text and citations', () => {
    const obligations: Obligation[] = [
      {
        text: 'The Vendor shall deliver within 14 days.',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-1' }],
        deadline: 'within 14 days',
      },
      {
        text: 'The Vendor shall deliver within 14 days.',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-1' }],
        deadline: 'within 14 days',
      },
    ];

    const { dedupedObligations } = deduplicateFindingsAndObligations([], obligations);
    expect(dedupedObligations).toHaveLength(1);
  });
});
