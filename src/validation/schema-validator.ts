import { ModelRawOutput, RelationshipTaxonomy } from '../types/contract';

export const VALID_RELATIONSHIPS: Set<RelationshipTaxonomy> = new Set([
  'modification',
  'addition',
  'removal',
  'apparent_conflict',
  'clarification',
  'uncertain',
]);

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

/**
 * Pipeline Step 2: Schema Validation
 * Strictly validates that the model output conforms to the v1.2 output format.
 */
export function validateOutputSchema(output: any): ModelRawOutput {
  if (!output || typeof output !== 'object') {
    throw new SchemaValidationError('Model output must be a non-null JSON object.');
  }

  if (output.schema_version !== '1.2') {
    throw new SchemaValidationError(
      `Invalid schema_version: Expected "1.2", received "${output.schema_version}".`
    );
  }

  // document_relationship_assessment check
  const dra = output.document_relationship_assessment;
  if (!dra || typeof dra !== 'object') {
    throw new SchemaValidationError('Missing document_relationship_assessment object.');
  }
  if (!['related', 'unrelated', 'uncertain'].includes(dra.status)) {
    throw new SchemaValidationError(`Invalid document relationship status: "${dra.status}".`);
  }
  if (typeof dra.reasoning !== 'string') {
    throw new SchemaValidationError('document_relationship_assessment.reasoning must be a string.');
  }

  // findings check
  if (!Array.isArray(output.findings)) {
    throw new SchemaValidationError('findings must be an array.');
  }

  for (let i = 0; i < output.findings.length; i++) {
    const f = output.findings[i];
    if (!f.finding_id || typeof f.finding_id !== 'string') {
      throw new SchemaValidationError(`findings[${i}].finding_id must be a string.`);
    }
    if (!VALID_RELATIONSHIPS.has(f.relationship)) {
      throw new SchemaValidationError(`findings[${i}].relationship "${f.relationship}" is invalid.`);
    }
    if (typeof f.description !== 'string') {
      throw new SchemaValidationError(`findings[${i}].description must be a string.`);
    }
    if (!Array.isArray(f.evidence)) {
      throw new SchemaValidationError(`findings[${i}].evidence must be an array.`);
    }
    for (let e = 0; e < f.evidence.length; e++) {
      const ev = f.evidence[e];
      if (!ev.document_id || !ev.clause_id) {
        throw new SchemaValidationError(`findings[${i}].evidence[${e}] missing document_id or clause_id.`);
      }
    }
    if (typeof f.ai_interpretation !== 'string') {
      throw new SchemaValidationError(`findings[${i}].ai_interpretation must be a string.`);
    }
  }

  // obligations check
  if (!Array.isArray(output.obligations)) {
    throw new SchemaValidationError('obligations must be an array.');
  }

  for (let i = 0; i < output.obligations.length; i++) {
    const ob = output.obligations[i];
    if (typeof ob.text !== 'string') {
      throw new SchemaValidationError(`obligations[${i}].text must be a string.`);
    }
    if (!Array.isArray(ob.evidence)) {
      throw new SchemaValidationError(`obligations[${i}].evidence must be an array.`);
    }
    // deadline key presence check: must be string or null, never omitted/undefined
    if (!('deadline' in ob) || (ob.deadline !== null && typeof ob.deadline !== 'string')) {
      throw new SchemaValidationError(
        `obligations[${i}].deadline must be present and typed string | null.`
      );
    }
  }

  // unresolved_references check
  if (!Array.isArray(output.unresolved_references)) {
    throw new SchemaValidationError('unresolved_references must be an array.');
  }

  // overall_uncertainties check
  if (!Array.isArray(output.overall_uncertainties)) {
    throw new SchemaValidationError('overall_uncertainties must be an array.');
  }

  return output as ModelRawOutput;
}
