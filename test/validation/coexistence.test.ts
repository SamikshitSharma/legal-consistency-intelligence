import { describe, it, expect } from 'vitest';
import { enforceCoexistenceNulling } from '../../src/validation/coexistence';
import { Finding } from '../../src/types/contract';

describe('Pipeline Step 6: coexistence_possible Null-Enforcement (Change 1 / Test #42)', () => {
  it('overwrites coexistence_possible to null on a modification finding (Test #42)', () => {
    // Deliberately non-conformant model fixture where relationship == "modification"
    // and coexistence_possible is erroneously set to true by the model
    const nonConformantFixture: Finding[] = [
      {
        finding_id: 'f1',
        relationship: 'modification',
        description: 'Payment period changed from 30 to 15 days.',
        evidence: [
          { document_id: 'doc_a', clause_id: 'A-8' },
          { document_id: 'doc_b', clause_id: 'B-3' },
        ],
        ai_interpretation: 'Payment window was shortened.',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: true as any, // Non-conformant
      },
    ];

    const result = enforceCoexistenceNulling(nonConformantFixture);

    // The validator must overwrite it to null in the rendered result, regardless of model emission
    expect(result[0].coexistence_possible).toBeNull();
    expect(result[0].relationship).toBe('modification');
  });

  it('forces null on addition, removal, clarification, and uncertain findings', () => {
    const fixture: Finding[] = [
      {
        finding_id: 'f2',
        relationship: 'addition',
        description: 'Added clause',
        evidence: [{ document_id: 'doc_b', clause_id: 'B-7' }],
        ai_interpretation: 'New provision',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: 'uncertain' as any,
      },
      {
        finding_id: 'f3',
        relationship: 'removal',
        description: 'Removed clause',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-30' }],
        ai_interpretation: 'Omitted requirement',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: false as any,
      },
    ];

    const result = enforceCoexistenceNulling(fixture);
    expect(result[0].coexistence_possible).toBeNull();
    expect(result[1].coexistence_possible).toBeNull();
  });

  it('preserves valid coexistence_possible values on apparent_conflict findings', () => {
    const conflictFixture: Finding[] = [
      {
        finding_id: 'f4',
        relationship: 'apparent_conflict',
        description: 'Discrepancy in notice periods',
        evidence: [
          { document_id: 'doc_a', clause_id: 'A-22' },
          { document_id: 'doc_b', clause_id: 'B-15' },
        ],
        ai_interpretation: 'Incompatible 30 vs 45 day notice',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: 'Which notice applies?',
        coexistence_possible: false,
      },
    ];

    const result = enforceCoexistenceNulling(conflictFixture);
    expect(result[0].coexistence_possible).toBe(false);
  });
});
