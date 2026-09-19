import { describe, it, expect } from 'vitest';
import { validateCitations } from '../../src/validation/citation-checker';
import { Finding, Obligation, ProcessedDocument } from '../../src/types/contract';

describe('Pipeline Step 4: Citation Existence Check', () => {
  const docA: ProcessedDocument = {
    id: 'doc_a',
    filename: 'doc_a.txt',
    hash: 'ha',
    raw_text: '',
    clauses: [
      { id: 'A-1', document_id: 'doc_a', text: 'Text A1', normalized_text: '', defined_terms: [], shingles: [] },
      { id: 'A-2', document_id: 'doc_a', text: 'Text A2', normalized_text: '', defined_terms: [], shingles: [] },
    ],
  };

  const docB: ProcessedDocument = {
    id: 'doc_b',
    filename: 'doc_b.txt',
    hash: 'hb',
    raw_text: '',
    clauses: [
      { id: 'B-1', document_id: 'doc_b', text: 'Text B1', normalized_text: '', defined_terms: [], shingles: [] },
    ],
  };

  it('drops hallucinated clause citations that do not exist in server clause store', () => {
    const findings: Finding[] = [
      {
        finding_id: 'f1',
        relationship: 'modification',
        description: 'Valid finding with real citations',
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
        relationship: 'modification',
        description: 'Finding with one valid and one fake citation',
        evidence: [
          { document_id: 'doc_a', clause_id: 'A-1' },
          { document_id: 'doc_b', clause_id: 'B-999' }, // Fake!
        ],
        ai_interpretation: '',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: null,
      },
      {
        finding_id: 'f3',
        relationship: 'addition',
        description: 'Finding with only fake citations',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-999' }],
        ai_interpretation: '',
        potential_consideration: null,
        uncertainty: null,
        suggested_question: null,
        coexistence_possible: null,
      },
    ];

    const { validFindings } = validateCitations(findings, [], docA, docB);

    expect(validFindings).toHaveLength(2); // f1 and f2 survive, f3 completely dropped
    expect(validFindings[0].evidence).toHaveLength(2);
    expect(validFindings[1].evidence).toEqual([{ document_id: 'doc_a', clause_id: 'A-1' }]); // B-999 removed
  });

  it('drops obligations citing nonexistent clauses', () => {
    const obligations: Obligation[] = [
      {
        text: 'Valid obligation',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-2' }],
        deadline: null,
      },
      {
        text: 'Fake obligation citing phantom clause',
        evidence: [{ document_id: 'doc_b', clause_id: 'B-99' }],
        deadline: null,
      },
    ];

    const { validObligations } = validateCitations([], obligations, docA, docB);
    expect(validObligations).toHaveLength(1);
    expect(validObligations[0].text).toBe('Valid obligation');
  });
});
