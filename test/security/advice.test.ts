import { describe, it, expect } from 'vitest';
import { checkFocusQuestionForAdvice } from '../../src/security/advice-refusal';
import { filterPrescriptiveLanguage } from '../../src/validation/prescriptive';
import { Finding, Obligation } from '../../src/types/contract';

describe('P1 Security: Advice Refusal & Independent Output Guardrails', () => {
  it('intercepts various direct legal advice queries on focus_question', () => {
    const q1 = checkFocusQuestionForAdvice('Should I sign this amended contract?');
    expect(q1.isAdviceSeeking).toBe(true);

    const q2 = checkFocusQuestionForAdvice('Can we sue the vendor for breach?');
    expect(q2.isAdviceSeeking).toBe(true);

    const q3 = checkFocusQuestionForAdvice('Is this non-compete clause valid and enforceable?');
    expect(q3.isAdviceSeeking).toBe(true);

    const q4 = checkFocusQuestionForAdvice('What should we do regarding termination?');
    expect(q4.isAdviceSeeking).toBe(true);

    const q5 = checkFocusQuestionForAdvice('Do I have the legal right to cancel?');
    expect(q5.isAdviceSeeking).toBe(true);

    // Non-advice queries are allowed:
    const qSafe = checkFocusQuestionForAdvice('What changed regarding payment terms?');
    expect(qSafe.isAdviceSeeking).toBe(false);
  });

  it('independently rejects assistant-directed advice in model output even if focus question bypasses filter', () => {
    // Suppose a hostile prompt injection or model hallucination produces advice in output:
    const rogueFinding: Finding = {
      finding_id: 'f1',
      relationship: 'modification',
      description: 'You should terminate this agreement immediately.', // Prohibited directive!
      evidence: [{ document_id: 'doc_a', clause_id: 'A-1' }],
      ai_interpretation: 'You must not accept the revised payment window.', // Prohibited directive!
      potential_consideration: 'You have to consult an accountant.',
      uncertainty: null,
      suggested_question: null,
      coexistence_possible: null,
    };

    const rogueObligation: Obligation = {
      text: 'You are required to accept these revised terms within 10 days.', // Prohibited 2nd-person!
      evidence: [{ document_id: 'doc_a', clause_id: 'A-1' }],
      deadline: null,
    };

    const legitimateObligation: Obligation = {
      text: 'The Vendor shall deliver within 14 days.', // Legitimate 3rd-person
      evidence: [{ document_id: 'doc_a', clause_id: 'A-1' }],
      deadline: '14 days',
    };

    const { filteredFindings, filteredObligations } = filterPrescriptiveLanguage(
      [rogueFinding],
      [rogueObligation, legitimateObligation]
    );

    // Rogue finding dropped by pipeline step 8!
    expect(filteredFindings).toHaveLength(0);

    // Rogue obligation dropped, legitimate obligation preserved!
    expect(filteredObligations).toHaveLength(1);
    expect(filteredObligations[0].text).toBe('The Vendor shall deliver within 14 days.');
  });
});
