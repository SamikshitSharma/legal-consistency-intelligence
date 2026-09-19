import { Finding, Obligation, ProcessedDocument } from '../types/contract';

/**
 * Pipeline Step 4: Citation Existence Check
 * Validates that every citation in evidence corresponds to an actual document_id and clause_id
 * held in the server's processed document store.
 * Drops invalid citations; drops findings/obligations with no remaining valid citations.
 */
export function validateCitations(
  findings: Finding[],
  obligations: Obligation[],
  docA: ProcessedDocument,
  docB: ProcessedDocument
): { validFindings: Finding[]; validObligations: Obligation[] } {
  const validClausesByDoc = new Map<string, Set<string>>();
  validClausesByDoc.set(docA.id, new Set(docA.clauses.map((c) => c.id)));
  validClausesByDoc.set(docB.id, new Set(docB.clauses.map((c) => c.id)));

  const validFindings: Finding[] = [];
  for (const f of findings) {
    const verifiedEvidence = f.evidence.filter((ev) => {
      const clauseSet = validClausesByDoc.get(ev.document_id);
      return clauseSet && clauseSet.has(ev.clause_id);
    });

    if (verifiedEvidence.length > 0) {
      validFindings.push({
        ...f,
        evidence: verifiedEvidence,
      });
    }
  }

  const validObligations: Obligation[] = [];
  for (const ob of obligations) {
    const verifiedEvidence = ob.evidence.filter((ev) => {
      const clauseSet = validClausesByDoc.get(ev.document_id);
      return clauseSet && clauseSet.has(ev.clause_id);
    });

    if (verifiedEvidence.length > 0) {
      validObligations.push({
        ...ob,
        evidence: verifiedEvidence,
      });
    }
  }

  return { validFindings, validObligations };
}
