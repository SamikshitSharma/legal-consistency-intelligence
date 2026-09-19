import { Finding, Obligation } from '../types/contract';

/**
 * Pipeline Step 11: Deduplication
 * Eliminates duplicate findings and obligations based on structural equivalence.
 */
export function deduplicateFindingsAndObligations(
  findings: Finding[],
  obligations: Obligation[]
): { dedupedFindings: Finding[]; dedupedObligations: Obligation[] } {
  const seenFindings = new Set<string>();
  const dedupedFindings: Finding[] = [];

  for (const f of findings) {
    const sortedEv = [...f.evidence]
      .sort((a, b) => `${a.document_id}:${a.clause_id}`.localeCompare(`${b.document_id}:${b.clause_id}`))
      .map((e) => `${e.document_id}:${e.clause_id}`)
      .join('|');

    const key = `${f.relationship}::${sortedEv}`;
    if (!seenFindings.has(key)) {
      seenFindings.add(key);
      dedupedFindings.push(f);
    }
  }

  const seenObligations = new Set<string>();
  const dedupedObligations: Obligation[] = [];

  for (const ob of obligations) {
    const sortedEv = [...ob.evidence]
      .sort((a, b) => `${a.document_id}:${a.clause_id}`.localeCompare(`${b.document_id}:${b.clause_id}`))
      .map((e) => `${e.document_id}:${e.clause_id}`)
      .join('|');

    const key = `${ob.text.trim().toLowerCase()}::${sortedEv}`;
    if (!seenObligations.has(key)) {
      seenObligations.add(key);
      dedupedObligations.push(ob);
    }
  }

  return {
    dedupedFindings,
    dedupedObligations,
  };
}
