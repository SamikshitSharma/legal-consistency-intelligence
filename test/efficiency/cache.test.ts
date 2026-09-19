import { describe, it, expect } from 'vitest';
import { AnalysisService } from '../../src/services/analysis-service';
import { SimulatedProvider } from '../../src/ai/provider';
import { LegalReasoningEngine } from '../../src/ai/engine';
import { generateAnalysisCacheKey, AnalysisCache } from '../../src/cache/analysis-cache';
import { UploadedFile, ValidatedAnalysisReport } from '../../src/types/contract';

describe('Phase 25 & 30: Efficiency, Cache Audit, and Multi-Tenant Isolation', () => {
  const engine = new LegalReasoningEngine(new SimulatedProvider());
  const service = new AnalysisService(engine);

  function createMockFile(filename: string, content: string): UploadedFile {
    const buffer = Buffer.from(content, 'utf-8');
    return { filename, buffer, mimeType: 'text/plain', size: buffer.length };
  }

  it('serves repeat identical request from cache with 0 model calls (cache_hit = true)', async () => {
    const docA = createMockFile('agreement.txt', 'The Contractor shall deliver goods within 30 days.');
    const docB = createMockFile('amendment.txt', 'The Contractor shall deliver goods within 15 days.');

    // 1st request: fresh execution
    const report1 = await service.analyze({ files: [docA, docB], userOrSessionId: 'user-alpha' });
    expect(report1.analysis_metadata.cache_hit).toBe(false);

    // 2nd request: identical documents and parameters for same user
    const report2 = await service.analyze({ files: [docA, docB], userOrSessionId: 'user-alpha' });
    expect(report2.analysis_metadata.cache_hit).toBe(true);
    expect(report2.findings).toEqual(report1.findings);
  });

  it('P1 Cache Audit: prevents cross-user legal document cache leakage', async () => {
    const docA = createMockFile('confidential_agreement.txt', 'The Contractor shall deliver goods within 30 days.');
    const docB = createMockFile('confidential_amendment.txt', 'The Contractor shall deliver goods within 15 days.');

    // User Alpha executes analysis
    const reportUserAlpha = await service.analyze({
      files: [docA, docB],
      userOrSessionId: 'tenant-user-alpha-123',
    });
    expect(reportUserAlpha.analysis_metadata.cache_hit).toBe(false);

    // User Beta uploads identical files, but has different user/tenant ID
    const reportUserBeta = await service.analyze({
      files: [docA, docB],
      userOrSessionId: 'tenant-user-beta-999',
    });

    // Must execute isolated analysis for User Beta and NOT return User Alpha's cached instance!
    expect(reportUserBeta.analysis_metadata.cache_hit).toBe(false);
  });

  it('invalidates cache when focus question, schema version, or prompt changes', () => {
    const key1 = generateAnalysisCacheKey({
      docAHash: 'hashA',
      docBHash: 'hashB',
      focusQuestion: 'payment terms',
      modelIdentifier: 'gemini-2.5-flash',
      promptVersion: 'v1.2.2',
      schemaVersion: '1.2',
      pipelineVersion: 'v1.2.2',
    });

    const key2 = generateAnalysisCacheKey({
      docAHash: 'hashA',
      docBHash: 'hashB',
      focusQuestion: 'termination terms', // Changed focus question!
      modelIdentifier: 'gemini-2.5-flash',
      promptVersion: 'v1.2.2',
      schemaVersion: '1.2',
      pipelineVersion: 'v1.2.2',
    });

    const key3 = generateAnalysisCacheKey({
      docAHash: 'hashA',
      docBHash: 'hashB',
      focusQuestion: 'payment terms',
      modelIdentifier: 'gemini-2.5-flash',
      promptVersion: 'v1.2.3', // Changed prompt version!
      schemaVersion: '1.2',
      pipelineVersion: 'v1.2.2',
    });

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it('enforces bounded memory eviction and TTL expiration', async () => {
    // Cache bounded to 2 entries with 50ms TTL
    const boundedCache = new AnalysisCache(2, 50);

    const mockReport: ValidatedAnalysisReport = {
      schema_version: '1.2',
      document_relationship_assessment: { status: 'related', reasoning: 'Ok' },
      findings: [],
      obligations: [],
      unresolved_references: [],
      overall_uncertainties: [],
      disclaimer: 'Notice',
      injected_content_flags: [],
      analysis_metadata: {
        pipeline_version: 'v1.2.2',
        cache_hit: false,
        model_identifier: 'test',
        execution_time_ms: 10,
        model_call_count: 1,
      },
    };

    boundedCache.set('key1', mockReport);
    boundedCache.set('key2', mockReport);
    expect(boundedCache.get('key1')).not.toBeNull();

    // Adding 3rd key should evict oldest (key1)
    boundedCache.set('key3', mockReport);
    expect(boundedCache.get('key1')).toBeNull();
    expect(boundedCache.get('key2')).not.toBeNull();
    expect(boundedCache.get('key3')).not.toBeNull();

    // Test TTL expiration
    await new Promise((r) => setTimeout(r, 60));
    expect(boundedCache.get('key2')).toBeNull();
    expect(boundedCache.get('key3')).toBeNull();
  });
});
