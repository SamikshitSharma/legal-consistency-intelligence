import { describe, it, expect } from 'vitest';
import { validateOutputSchema, SchemaValidationError } from '../../src/validation/schema-validator';

describe('Pipeline Step 2: Schema Validation', () => {
  it('accepts a valid v1.2 model output', () => {
    const validOutput = {
      schema_version: '1.2',
      document_relationship_assessment: {
        status: 'related',
        reasoning: 'Both documents share subject matter.',
      },
      findings: [
        {
          finding_id: 'f1',
          relationship: 'modification',
          description: 'Payment terms changed.',
          evidence: [{ document_id: 'doc_a', clause_id: 'A-8' }],
          ai_interpretation: 'Shortened window.',
          potential_consideration: null,
          uncertainty: null,
          suggested_question: null,
          coexistence_possible: null,
        },
      ],
      obligations: [
        {
          text: 'The Vendor shall deliver goods.',
          evidence: [{ document_id: 'doc_a', clause_id: 'A-1' }],
          deadline: 'within 14 days',
        },
      ],
      unresolved_references: [],
      overall_uncertainties: [],
    };

    expect(() => validateOutputSchema(validOutput)).not.toThrow();
  });

  it('rejects schema_version mismatch (e.g. 1.0 or 1.1)', () => {
    const invalidVersion = {
      schema_version: '1.1',
      document_relationship_assessment: { status: 'related', reasoning: '' },
      findings: [],
      obligations: [],
      unresolved_references: [],
      overall_uncertainties: [],
    };
    expect(() => validateOutputSchema(invalidVersion)).toThrow(SchemaValidationError);
    expect(() => validateOutputSchema(invalidVersion)).toThrow(/Expected "1.2"/);
  });

  it('rejects obligation missing the required deadline key', () => {
    const missingDeadline = {
      schema_version: '1.2',
      document_relationship_assessment: { status: 'related', reasoning: '' },
      findings: [],
      obligations: [
        {
          text: 'The Vendor shall deliver goods.',
          evidence: [{ document_id: 'doc_a', clause_id: 'A-1' }],
          // deadline omitted!
        },
      ],
      unresolved_references: [],
      overall_uncertainties: [],
    };
    expect(() => validateOutputSchema(missingDeadline)).toThrow(SchemaValidationError);
    expect(() => validateOutputSchema(missingDeadline)).toThrow(/deadline must be present/);
  });

  it('rejects invalid relationship taxonomy label', () => {
    const invalidLabel = {
      schema_version: '1.2',
      document_relationship_assessment: { status: 'related', reasoning: '' },
      findings: [
        {
          finding_id: 'f1',
          relationship: 'contradiction', // Invalid label! Must be apparent_conflict
          description: 'Test',
          evidence: [{ document_id: 'doc_a', clause_id: 'A-1' }],
          ai_interpretation: 'Test',
          coexistence_possible: null,
        },
      ],
      obligations: [],
      unresolved_references: [],
      overall_uncertainties: [],
    };
    expect(() => validateOutputSchema(invalidLabel)).toThrow(SchemaValidationError);
    expect(() => validateOutputSchema(invalidLabel)).toThrow(/relationship "contradiction" is invalid/);
  });
});
