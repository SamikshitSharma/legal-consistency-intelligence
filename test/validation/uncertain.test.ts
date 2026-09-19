import { describe, it, expect } from 'vitest';
import { applyDocumentUncertainDowngrade } from '../../src/validation/uncertain-downgrade';
import { Finding } from '../../src/types/contract';

describe('Pipeline Step 10: Document-Uncertain Blanket Downgrade', () => {
  const sampleFindings: Finding[] = [
    {
      finding_id: 'f1',
      relationship: 'modification',
      description: 'Payment terms changed',
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
      relationship: 'apparent_conflict',
      description: 'Conflict in notice days',
      evidence: [
        { document_id: 'doc_a', clause_id: 'A-2' },
        { document_id: 'doc_b', clause_id: 'B-2' },
      ],
      ai_interpretation: '',
      potential_consideration: null,
      uncertainty: null,
      suggested_question: null,
      coexistence_possible: false,
    },
  ];

  it('downgrades all finding relationships to uncertain when document relationship is uncertain', () => {
    const result = applyDocumentUncertainDowngrade(sampleFindings, true);

    expect(result[0].relationship).toBe('uncertain');
    expect(result[1].relationship).toBe('uncertain');
    expect(result[1].coexistence_possible).toBeNull();
    expect(result[0].uncertainty).toContain('cannot be confirmed with confidence');
  });

  it('leaves findings unchanged when document relationship is confident (not uncertain)', () => {
    const result = applyDocumentUncertainDowngrade(sampleFindings, false);

    expect(result[0].relationship).toBe('modification');
    expect(result[1].relationship).toBe('apparent_conflict');
    expect(result[1].coexistence_possible).toBe(false);
  });
});
