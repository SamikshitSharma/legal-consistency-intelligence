import { describe, it, expect } from 'vitest';
import { verifyRemovalCompleteness } from '../../src/validation/removal-verifier';
import { Finding, ProcessedDocument } from '../../src/types/contract';

describe('Pipeline Step 7: Removal-Evidence-Completeness (Change 2)', () => {
  const dummyDocA: ProcessedDocument = {
    id: 'doc_a',
    filename: 'original.txt',
    hash: 'hash_a',
    raw_text: 'sample',
    clauses: [
      {
        id: 'A-30',
        document_id: 'doc_a',
        text: 'The Contractor shall carry commercial general liability insurance.',
        normalized_text: 'the contractor shall carry commercial general liability insurance.',
        defined_terms: ['contractor'],
        shingles: ['contractor_shall_carry'],
        orphan_confirmed: true, // Confirmed by server counterpart search
      },
      {
        id: 'A-12',
        document_id: 'doc_a',
        text: 'Governing law shall be New York.',
        normalized_text: 'governing law shall be new york.',
        defined_terms: ['new york'],
        shingles: ['governing_law_shall'],
        orphan_confirmed: false, // NOT confirmed orphan
      },
    ],
  };

  it('sets removal_evidence_completeness = "full_document_search" when clause has orphan_confirmed status', () => {
    const findings: Finding[] = [
      {
        finding_id: 'f6',
        relationship: 'removal',
        description: 'Liability insurance removed.',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-30' }],
        ai_interpretation: 'Insurance requirement omitted.',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: null,
      },
    ];

    const verified = verifyRemovalCompleteness(findings, dummyDocA);
    expect(verified[0].relationship).toBe('removal');
    expect(verified[0].removal_evidence_completeness).toBe('full_document_search');
  });

  it('downgrades to uncertain and omits removal_evidence_completeness if clause is NOT orphan_confirmed', () => {
    const findings: Finding[] = [
      {
        finding_id: 'f7',
        relationship: 'removal',
        description: 'Governing law supposedly removed.',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-12' }],
        ai_interpretation: 'Governing law clause omitted.',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: null,
      },
    ];

    const verified = verifyRemovalCompleteness(findings, dummyDocA);
    expect(verified[0].relationship).toBe('uncertain');
    expect(verified[0].removal_evidence_completeness).toBeUndefined();
    expect(verified[0].uncertainty).toContain('counterpart search did not confirm complete omission');
  });
});
