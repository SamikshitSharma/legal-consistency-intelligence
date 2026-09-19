import { ServerClause } from '../types/contract';

export interface DocumentInvertedIndex {
  documentId: string;
  sectionRefMap: Map<string, string[]>; // normalized sectionRef -> clauseIds
  definedTermMap: Map<string, string[]>; // term -> clauseIds
  shingleMap: Map<string, string[]>; // shingle -> clauseIds
  clauseMap: Map<string, ServerClause>;
}

/**
 * Normalizes section references for index lookup (e.g., "Section 1.2" -> "1.2", "Art. III" -> "iii")
 */
export function normalizeSectionRef(ref?: string): string | null {
  if (!ref) return null;
  const clean = ref
    .toLowerCase()
    .replace(/^(?:section|article|clause|paragraph|schedule|exhibit)\s*/i, '')
    .replace(/[^a-z0-9.]/g, '')
    .trim();
  return clean.length > 0 ? clean : null;
}

/**
 * Builds an inverted index for a document's clauses.
 */
export function buildDocumentIndex(documentId: string, clauses: ServerClause[]): DocumentInvertedIndex {
  const sectionRefMap = new Map<string, string[]>();
  const definedTermMap = new Map<string, string[]>();
  const shingleMap = new Map<string, string[]>();
  const clauseMap = new Map<string, ServerClause>();

  for (const clause of clauses) {
    clauseMap.set(clause.id, clause);

    // 1. Index normalized section reference
    const normSec = normalizeSectionRef(clause.section_reference);
    if (normSec) {
      const list = sectionRefMap.get(normSec) || [];
      list.push(clause.id);
      sectionRefMap.set(normSec, list);
    }

    // 2. Index defined terms
    for (const term of clause.defined_terms) {
      const list = definedTermMap.get(term) || [];
      list.push(clause.id);
      definedTermMap.set(term, list);
    }

    // 3. Index shingles (sample or full set)
    for (const shingle of clause.shingles) {
      const list = shingleMap.get(shingle) || [];
      list.push(clause.id);
      shingleMap.set(shingle, list);
    }
  }

  return {
    documentId,
    sectionRefMap,
    definedTermMap,
    shingleMap,
    clauseMap,
  };
}
