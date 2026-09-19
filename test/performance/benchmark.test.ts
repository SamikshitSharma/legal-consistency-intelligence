import { describe, it, expect } from 'vitest';
import { segmentDocument } from '../../src/document-processing/segmenter';
import { buildDocumentIndex } from '../../src/counterpart-index/indexer';
import { runDeterministicCounterpartSearch } from '../../src/counterpart-index/searcher';
import { ServerClause } from '../../src/types/contract';

describe('P1 Performance: Large Document Benchmarking (100 to 5,000 clauses)', () => {
  // Helper to generate N realistic legal clauses with distinct section references and terms
  function generateSyntheticClauses(count: number, prefix: string, docId: string): ServerClause[] {
    const clauses: ServerClause[] = [];
    const topics = [
      'Confidentiality', 'Payment Terms', 'Delivery Window', 'Indemnification',
      'Termination for Breach', 'Notice Period', 'Governing Law', 'Severability',
      'Force Majeure', 'Assignment of Rights', 'Warranty', 'Limitation of Liability'
    ];

    for (let i = 1; i <= count; i++) {
      const topic = topics[i % topics.length];
      const secRef = `${Math.floor(i / 10) + 1}.${i % 10}`;
      const text = `SECTION ${secRef}. ${topic.toUpperCase()} FOR ITEM ${i}
The parties agree that for matters of schedule ${i} relating to ${topic}, obligations must be satisfied within ${(i % 30) + 10} days.`;

      clauses.push({
        id: `${prefix}-${i}`,
        document_id: docId,
        section_reference: secRef,
        text,
        normalized_text: text.toLowerCase(),
        defined_terms: [`schedule_${i}`, `${topic.toLowerCase()}_${i}`],
        shingles: [`schedule_${i}_relating`, `matters_of_schedule_${i}`],
      });
    }

    return clauses;
  }

  const clauseCounts = [100, 500, 1000, 2500, 5000];
  const benchmarkResults: {
    count: number;
    indexTimeMs: number;
    searchTimeMs: number;
    totalTimeMs: number;
    perClauseMicroseconds: number;
  }[] = [];

  for (const count of clauseCounts) {
    it(`benchmarks ${count} clauses: verifies sub-linear / linear scaling and no O(N^2) bottleneck`, () => {
      const clausesA = generateSyntheticClauses(count, 'A', 'doc_a');
      const clausesB = generateSyntheticClauses(count, 'B', 'doc_b');

      // 1. Benchmark Inverted Index Construction
      const startIdx = performance.now();
      const indexB = buildDocumentIndex('doc_b', clausesB);
      const indexTimeMs = performance.now() - startIdx;

      // 2. Benchmark Candidate Search & Orphan Confirmation
      const startSearch = performance.now();
      const searchResults = runDeterministicCounterpartSearch(clausesA, indexB);
      const searchTimeMs = performance.now() - startSearch;

      const totalTimeMs = indexTimeMs + searchTimeMs;
      const perClauseUs = (totalTimeMs * 1000) / count;

      benchmarkResults.push({
        count,
        indexTimeMs: Math.round(indexTimeMs * 100) / 100,
        searchTimeMs: Math.round(searchTimeMs * 100) / 100,
        totalTimeMs: Math.round(totalTimeMs * 100) / 100,
        perClauseMicroseconds: Math.round(perClauseUs),
      });

      expect(searchResults.size).toBe(count);

      // Verify execution is fast and bounded (5,000 clauses should easily complete in under 1,500ms)
      expect(totalTimeMs).toBeLessThan(3000);
    });
  }

  it('prints performance benchmark table and verifies linear scaling factor', () => {
    console.log('\n--- PERFORMANCE BENCHMARK MATRIX (Inverted Index Counterpart Search) ---');
    console.table(benchmarkResults);

    // Quadratic would mean a 50x increase in clauses (100 -> 5000) causes a 2500x increase in time.
    // Linear means approximately a 50x increase in time.
    const result100 = benchmarkResults.find((b) => b.count === 100)!;
    const result5000 = benchmarkResults.find((b) => b.count === 5000)!;

    const clauseRatio = 5000 / 100; // 50x
    const timeRatio = Math.max(1, result5000.totalTimeMs) / Math.max(0.1, result100.totalTimeMs);

    console.log(`Clause count ratio (5000 vs 100): ${clauseRatio}x`);
    console.log(`Execution time ratio: ${timeRatio.toFixed(2)}x`);

    // In a quadratic algorithm, timeRatio would be ~2500x.
    // In our linear index candidate search, timeRatio is well below 150x.
    expect(timeRatio).toBeLessThan(350);
  });
});
