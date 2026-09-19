import { ServerClause } from '../types/contract';
import { DocumentInvertedIndex, normalizeSectionRef } from './indexer';

export interface CounterpartSearchResult {
  clauseId: string;
  candidateIds: string[];
  matchedCounterpartId: string | null;
  orphanConfirmed: boolean;
}

/**
 * Calculates Jaccard similarity between two sets of strings
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Checks whether candidate clause in doc B is genuinely a counterpart to clause in doc A.
 */
function isSubstantiveCounterpart(clauseA: ServerClause, candidateB: ServerClause): boolean {
  // 1. Same normalized section reference and at least some shared terms/words
  const secA = normalizeSectionRef(clauseA.section_reference);
  const secB = normalizeSectionRef(candidateB.section_reference);
  if (secA && secB && secA === secB) {
    return true;
  }

  // 2. Token overlap similarity
  const wordsA = new Set(clauseA.normalized_text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(candidateB.normalized_text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const tokenSim = jaccardSimilarity(wordsA, wordsB);
  if (tokenSim >= 0.25) {
    return true;
  }

  // 3. Defined term overlap: multiple shared defined terms
  const termsA = new Set(clauseA.defined_terms);
  const termsB = new Set(candidateB.defined_terms);
  let sharedTerms = 0;
  for (const t of termsA) {
    if (termsB.has(t)) sharedTerms++;
  }
  if (sharedTerms >= 2 && tokenSim >= 0.15) {
    return true;
  }

  return false;
}

/**
 * Finds candidate counterparts in the revised document using the inverted index
 * and determines whether the original clause has orphan_confirmed status.
 */
export function findCounterpart(
  originalClause: ServerClause,
  revisedIndex: DocumentInvertedIndex
): CounterpartSearchResult {
  const candidateScores = new Map<string, number>();

  // 1. Lookup by section reference
  const normSec = normalizeSectionRef(originalClause.section_reference);
  if (normSec) {
    const matchingIds = revisedIndex.sectionRefMap.get(normSec) || [];
    for (const id of matchingIds) {
      candidateScores.set(id, (candidateScores.get(id) || 0) + 10);
    }
  }

  // 2. Lookup by defined terms
  for (const term of originalClause.defined_terms) {
    const matchingIds = revisedIndex.definedTermMap.get(term) || [];
    for (const id of matchingIds) {
      candidateScores.set(id, (candidateScores.get(id) || 0) + 2);
    }
  }

  // 3. Lookup by token shingles
  for (const shingle of originalClause.shingles) {
    const matchingIds = revisedIndex.shingleMap.get(shingle) || [];
    for (const id of matchingIds) {
      candidateScores.set(id, (candidateScores.get(id) || 0) + 1);
    }
  }

  // Sort candidate IDs by relevance score descending and bound to top candidates (O(1) per clause)
  const candidateIds = Array.from(candidateScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([id]) => id);

  // If 0 candidates in inverted index lookup, it is confirmed an orphan
  if (candidateIds.length === 0) {
    return {
      clauseId: originalClause.id,
      candidateIds: [],
      matchedCounterpartId: null,
      orphanConfirmed: true,
    };
  }

  // Run full comparison against candidate set
  let matchedId: string | null = null;
  for (const candId of candidateIds) {
    const candidateClause = revisedIndex.clauseMap.get(candId);
    if (candidateClause && isSubstantiveCounterpart(originalClause, candidateClause)) {
      matchedId = candId;
      break;
    }
  }

  return {
    clauseId: originalClause.id,
    candidateIds,
    matchedCounterpartId: matchedId,
    orphanConfirmed: matchedId === null,
  };
}

/**
 * Performs full deterministic counterpart search across all clauses of the original document.
 * Marks `orphan_confirmed` on clauses that have no counterpart in the revised document.
 */
export function runDeterministicCounterpartSearch(
  originalClauses: ServerClause[],
  revisedIndex: DocumentInvertedIndex
): Map<string, CounterpartSearchResult> {
  const results = new Map<string, CounterpartSearchResult>();

  for (const clause of originalClauses) {
    const searchRes = findCounterpart(clause, revisedIndex);
    clause.orphan_confirmed = searchRes.orphanConfirmed;
    results.set(clause.id, searchRes);
  }

  return results;
}
