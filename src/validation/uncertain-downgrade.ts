import { Finding } from '../types/contract';

/**
 * Pipeline Step 10: Document-Uncertain Blanket Downgrade
 * When document_relationship_assessment.status == "uncertain", all finding relationships
 * are downgraded to "uncertain" to preserve epistemic modesty, and coexistence_possible is set to null.
 */
export function applyDocumentUncertainDowngrade(
  findings: Finding[],
  isDocumentRelationshipUncertain: boolean
): Finding[] {
  if (!isDocumentRelationshipUncertain) {
    return findings;
  }

  return findings.map((f) => ({
    ...f,
    relationship: 'uncertain',
    coexistence_possible: null,
    uncertainty:
      f.uncertainty ||
      'Finding relationship capped at uncertain because overall document relationship cannot be confirmed with confidence.',
  }));
}
