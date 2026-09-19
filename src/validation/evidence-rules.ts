import { Finding, ProcessedDocument } from '../types/contract';

/**
 * Pipeline Step 5: Evidence-Count-Per-Relationship + Coexistence Relabel
 */
export function applyEvidenceRulesAndCoexistenceRelabel(
  findings: Finding[],
  docA: ProcessedDocument,
  docB: ProcessedDocument
): Finding[] {
  const result: Finding[] = [];

  for (const f of findings) {
    const docIds = new Set(f.evidence.map((e) => e.document_id));
    const hasDocA = docIds.has(docA.id);
    const hasDocB = docIds.has(docB.id);

    let updated = { ...f };

    switch (updated.relationship) {
      case 'modification': {
        // Must have at least one clause from each of the two documents
        if (!hasDocA || !hasDocB) {
          if (hasDocB && !hasDocA) {
            updated.relationship = 'addition';
          } else if (hasDocA && !hasDocB) {
            updated.relationship = 'removal';
          } else {
            updated.relationship = 'uncertain';
          }
        }
        break;
      }

      case 'apparent_conflict': {
        // Exactly one clause from each of the two documents at minimum
        if (!hasDocA || !hasDocB) {
          updated.relationship = 'uncertain';
          updated.coexistence_possible = null;
        } else if (updated.coexistence_possible === true) {
          // If coexistence is possible, it is NOT an apparent conflict
          // Relabel to modification or addition or uncertain
          updated.relationship = 'modification';
          updated.coexistence_possible = null;
        }
        break;
      }

      case 'addition': {
        // If it cites clauses from both documents and appears to alter original, may be modification
        if (hasDocA && hasDocB) {
          // Both documents cited
        }
        break;
      }

      case 'removal': {
        // Removal requires citation from earlier document (docA)
        if (!hasDocA) {
          updated.relationship = 'uncertain';
        }
        break;
      }

      case 'clarification':
      case 'uncertain':
        break;
    }

    result.push(updated);
  }

  return result;
}
