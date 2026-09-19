import { describe, it, expect } from 'vitest';
import { applyEvidenceRulesAndCoexistenceRelabel } from '../../src/validation/evidence-rules';
import { Finding, ProcessedDocument } from '../../src/types/contract';

describe('Pipeline Step 5: Evidence-Count-Per-Relationship & Coexistence Relabel', () => {
  const docA: ProcessedDocument = {
    id: 'doc_a',
    filename: 'original.txt',
    hash: 'hA',
    raw_text: '',
    clauses: [{ id: 'A-1', document_id: 'doc_a', text: '', normalized_text: '', defined_terms: [], shingles: [] }],
  };

  const docB: ProcessedDocument = {
    id: 'doc_b',
    filename: 'revised.txt',
    hash: 'hB',
    raw_text: '',
    clauses: [{ id: 'B-1', document_id: 'doc_b', text: '', normalized_text: '', defined_terms: [], shingles: [] }],
  };

  it('modification requires evidence from both documents; relabels if only one document cited', () => {
    const findings: Finding[] = [
      {
        finding_id: 'f1',
        relationship: 'modification',
        description: 'Modified with only doc B cited',
        evidence: [{ document_id: 'doc_b', clause_id: 'B-1' }], // Missing doc A!
        ai_interpretation: '',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: null,
      },
    ];

    const result = applyEvidenceRulesAndCoexistenceRelabel(findings, docA, docB);
    // When only revised document cited, relabels to addition
    expect(result[0].relationship).toBe('addition');
  });

  it('apparent_conflict requires evidence from both documents; relabels to uncertain if only one document cited', () => {
    const findings: Finding[] = [
      {
        finding_id: 'f2',
        relationship: 'apparent_conflict',
        description: 'Conflict with only doc A cited',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-1' }], // Only 1 doc!
        ai_interpretation: '',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: false,
      },
    ];

    const result = applyEvidenceRulesAndCoexistenceRelabel(findings, docA, docB);
    expect(result[0].relationship).toBe('uncertain');
    expect(result[0].coexistence_possible).toBeNull();
  });

  it('relabels apparent_conflict if coexistence_possible is true (failed coexistence test)', () => {
    const findings: Finding[] = [
      {
        finding_id: 'f3',
        relationship: 'apparent_conflict',
        description: 'Provisions that can coexist',
        evidence: [
          { document_id: 'doc_a', clause_id: 'A-1' },
          { document_id: 'doc_b', clause_id: 'B-1' },
        ],
        ai_interpretation: '',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: true, // Failed conflict condition!
      },
    ];

    const result = applyEvidenceRulesAndCoexistenceRelabel(findings, docA, docB);
    // Relabeled away from apparent_conflict
    expect(result[0].relationship).not.toBe('apparent_conflict');
    expect(result[0].coexistence_possible).toBeNull();
  });
});
