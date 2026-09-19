import { describe, it, expect } from 'vitest';
import { filterPrescriptiveLanguage } from '../../src/validation/prescriptive';
import { Finding, Obligation } from '../../src/types/contract';

describe('Pipeline Step 8: Prescriptive-Language Filter (Change 5 / Test #43)', () => {
  const dummyFinding: Finding = {
    finding_id: 'f1',
    relationship: 'modification',
    description: 'The Contractor shall maintain insurance.',
    evidence: [{ document_id: 'doc_a', clause_id: 'A-30' }],
    ai_interpretation: 'The original agreement specified general liability insurance.',
    potential_consideration: null,
    uncertainty: null,
    suggested_question: null,
    coexistence_possible: null,
  };

  it('allows third-person document-reporting obligation with "shall" (Test #43a)', () => {
    // Fixture (a): "The Contractor shall maintain insurance."
    const obligations: Obligation[] = [
      {
        text: 'The Contractor shall maintain commercial general liability insurance.',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-30' }],
        deadline: null,
      },
    ];

    const { filteredObligations } = filterPrescriptiveLanguage([dummyFinding], obligations);
    expect(filteredObligations).toHaveLength(1);
    expect(filteredObligations[0].text).toBe(
      'The Contractor shall maintain commercial general liability insurance.'
    );
  });

  it('allows third-person document-grounded obligation with "must" and "is required to" (Test #43b)', () => {
    // Fixture (b): Phrased with "must" or "is required to" in third-person
    const obligations: Obligation[] = [
      {
        text: 'The Contractor is required to maintain commercial general liability insurance.',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-30' }],
        deadline: null,
      },
      {
        text: 'Payment must be made within thirty (30) days of invoice receipt.',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-8' }],
        deadline: 'within thirty (30) days of invoice receipt',
      },
    ];

    const { filteredObligations } = filterPrescriptiveLanguage([dummyFinding], obligations);
    expect(filteredObligations).toHaveLength(2);
  });

  it('rejects assistant-directed second-person imperative "You must maintain insurance." (Test #43c)', () => {
    // Fixture (c): Assistant addressing the user directly with an imperative
    const obligations: Obligation[] = [
      {
        text: 'You must maintain commercial general liability insurance.',
        evidence: [{ document_id: 'doc_a', clause_id: 'A-30' }],
        deadline: null,
      },
    ];

    const { filteredObligations } = filterPrescriptiveLanguage([dummyFinding], obligations);
    // Must be rejected by pipeline step 8!
    expect(filteredObligations).toHaveLength(0);
  });

  it('rejects second-person advice in findings ("You should sign this")', () => {
    const adviceFinding: Finding = {
      ...dummyFinding,
      description: 'You should sign this amendment immediately.',
    };
    const { filteredFindings } = filterPrescriptiveLanguage([adviceFinding], []);
    expect(filteredFindings).toHaveLength(0);
  });

  it('rejects unsupported legal conclusion assertions ("this is legal/enforceable")', () => {
    const conclusionFinding: Finding = {
      ...dummyFinding,
      ai_interpretation: 'This is legally binding and this is enforceable under state law.',
    };
    const { filteredFindings } = filterPrescriptiveLanguage([conclusionFinding], []);
    expect(filteredFindings).toHaveLength(0);
  });
});
