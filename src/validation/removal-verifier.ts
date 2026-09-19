import { Finding, ProcessedDocument } from '../types/contract';

/**
 * Pipeline Step 7: Removal-Evidence-Completeness (Change 2)
 * Fully server-derived.
 * - If cited clause carries orphan_confirmed status from deterministic counterpart search:
 *   sets removal_evidence_completeness = "full_document_search".
 * - If not orphan_confirmed:
 *   downgrades relationship to "uncertain" and deletes removal_evidence_completeness.
 */
export function verifyRemovalCompleteness(
  findings: Finding[],
  docA: ProcessedDocument
): Finding[] {
  const clauseMap = new Map<string, boolean>();
  for (const c of docA.clauses) {
    clauseMap.set(c.id, Boolean(c.orphan_confirmed));
  }

  return findings.map((f) => {
    if (f.relationship === 'removal') {
      const citedClauseA = f.evidence.find((e) => e.document_id === docA.id);
      const isConfirmedOrphan = citedClauseA ? Boolean(clauseMap.get(citedClauseA.clause_id)) : false;

      if (isConfirmedOrphan) {
        return {
          ...f,
          removal_evidence_completeness: 'full_document_search' as const,
        };
      } else {
        // Downgrade to uncertain
        const updated = { ...f };
        updated.relationship = 'uncertain';
        delete updated.removal_evidence_completeness;
        updated.uncertainty = updated.uncertainty || 'Server-side full document counterpart search did not confirm complete omission of this provision in the revised document.';
        return updated;
      }
    } else {
      // Remove field if inadvertently present on non-removal finding
      const updated = { ...f };
      delete updated.removal_evidence_completeness;
      return updated;
    }
  });
}
