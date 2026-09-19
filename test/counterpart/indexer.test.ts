import { describe, it, expect } from 'vitest';
import { buildDocumentIndex } from '../../src/counterpart-index/indexer';
import { findCounterpart, runDeterministicCounterpartSearch } from '../../src/counterpart-index/searcher';
import { ServerClause } from '../../src/types/contract';

describe('Change 7: Inverted-Index Candidate Matching & Counterpart Search', () => {
  const originalClauses: ServerClause[] = [
    {
      id: 'A-1',
      document_id: 'doc_a',
      section_reference: 'Section 1.1',
      text: 'The Vendor shall deliver products within fourteen (14) days.',
      normalized_text: 'the vendor shall deliver products within fourteen (14) days.',
      defined_terms: ['vendor'],
      shingles: ['vendor_shall_deliver', 'shall_deliver_products'],
    },
    {
      id: 'A-2',
      document_id: 'doc_a',
      section_reference: 'Section 4.2',
      text: 'The Contractor shall carry commercial general liability insurance of $1,000,000.',
      normalized_text: 'the contractor shall carry commercial general liability insurance of $1,000,000.',
      defined_terms: ['contractor'],
      shingles: ['contractor_shall_carry', 'carry_commercial_general'],
    },
  ];

  const revisedClauses: ServerClause[] = [
    {
      id: 'B-1',
      document_id: 'doc_b',
      section_reference: 'Section 1.1',
      text: 'The Vendor shall deliver products within twenty-one (21) days.',
      normalized_text: 'the vendor shall deliver products within twenty-one (21) days.',
      defined_terms: ['vendor'],
      shingles: ['vendor_shall_deliver', 'shall_deliver_products'],
    },
    {
      id: 'B-2',
      document_id: 'doc_b',
      section_reference: 'Section 2.0',
      text: 'Payment terms shall be net 30 days from invoice receipt.',
      normalized_text: 'payment terms shall be net 30 days from invoice receipt.',
      defined_terms: ['payment terms'],
      shingles: ['payment_terms_shall'],
    },
  ];

  it('matches counterparts via index keys and does not mark matched clause as orphan', () => {
    const indexB = buildDocumentIndex('doc_b', revisedClauses);
    const resultA1 = findCounterpart(originalClauses[0], indexB);

    expect(resultA1.candidateIds).toContain('B-1');
    expect(resultA1.matchedCounterpartId).toBe('B-1');
    expect(resultA1.orphanConfirmed).toBe(false);
  });

  it('identifies genuine orphan clause with zero candidate counterparts as orphan_confirmed (Change 7/Phase 8)', () => {
    const indexB = buildDocumentIndex('doc_b', revisedClauses);
    const resultA2 = findCounterpart(originalClauses[1], indexB);

    // Insurance clause has no counterpart in B
    expect(resultA2.matchedCounterpartId).toBeNull();
    expect(resultA2.orphanConfirmed).toBe(true);
  });

  it('populates orphan_confirmed across all original clauses in bulk search', () => {
    const indexB = buildDocumentIndex('doc_b', revisedClauses);
    runDeterministicCounterpartSearch(originalClauses, indexB);

    expect(originalClauses[0].orphan_confirmed).toBe(false);
    expect(originalClauses[1].orphan_confirmed).toBe(true);
  });
});
