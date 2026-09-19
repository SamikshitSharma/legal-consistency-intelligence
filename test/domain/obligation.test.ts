import { describe, it, expect } from 'vitest';
import { Obligation } from '../../src/types/contract';
import { validateOutputSchema, SchemaValidationError } from '../../src/validation/schema-validator';

describe('Domain: Obligations and Grounded Deadlines (Change 5)', () => {
  it('enforces deadline key presence on every obligation entry', () => {
    const validObligation: Obligation = {
      text: 'The Vendor shall deliver within 14 days.',
      evidence: [{ document_id: 'doc_a', clause_id: 'A-1' }],
      deadline: 'within 14 days',
    };

    const validPayload = {
      schema_version: '1.2',
      document_relationship_assessment: { status: 'related', reasoning: 'Ok' },
      findings: [],
      obligations: [validObligation],
      unresolved_references: [],
      overall_uncertainties: [],
    };

    expect(() => validateOutputSchema(validPayload)).not.toThrow();
  });

  it('allows deadline: null explicitly when no deadline is stated in clause', () => {
    const nullDeadlineObligation: Obligation = {
      text: 'The Contractor shall maintain confidentiality.',
      evidence: [{ document_id: 'doc_a', clause_id: 'A-2' }],
      deadline: null, // Explicit null allowed!
    };

    const validPayload = {
      schema_version: '1.2',
      document_relationship_assessment: { status: 'related', reasoning: 'Ok' },
      findings: [],
      obligations: [nullDeadlineObligation],
      unresolved_references: [],
      overall_uncertainties: [],
    };

    expect(() => validateOutputSchema(validPayload)).not.toThrow();
  });

  it('rejects obligations where deadline key is omitted entirely', () => {
    const omittedDeadline = {
      text: 'The Contractor shall deliver goods.',
      evidence: [{ document_id: 'doc_a', clause_id: 'A-1' }],
      // deadline key missing!
    };

    const invalidPayload = {
      schema_version: '1.2',
      document_relationship_assessment: { status: 'related', reasoning: 'Ok' },
      findings: [],
      obligations: [omittedDeadline],
      unresolved_references: [],
      overall_uncertainties: [],
    };

    expect(() => validateOutputSchema(invalidPayload)).toThrow(SchemaValidationError);
    expect(() => validateOutputSchema(invalidPayload)).toThrow(/deadline must be present/);
  });
});
