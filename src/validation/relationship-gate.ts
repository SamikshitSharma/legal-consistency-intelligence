import { ModelRawOutput } from '../types/contract';

/**
 * Pipeline Step 3: Document-Relationship Gate
 * - unrelated -> drop findings[] (returns empty findings array)
 * - uncertain -> flag for Step 10 downgrade
 * - related -> proceed normally
 */
export function applyRelationshipGate(output: ModelRawOutput): {
  output: ModelRawOutput;
  isUncertainFlagged: boolean;
} {
  const status = output.document_relationship_assessment.status;

  if (status === 'unrelated') {
    output.findings = [];
    return { output, isUncertainFlagged: false };
  }

  if (status === 'uncertain') {
    return { output, isUncertainFlagged: true };
  }

  return { output, isUncertainFlagged: false };
}
