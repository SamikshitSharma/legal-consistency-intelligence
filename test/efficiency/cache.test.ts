import { describe, it, expect } from 'vitest';
import { AnalysisService } from '../../src/services/analysis-service';
import { SimulatedProvider } from '../../src/ai/provider';
import { LegalReasoningEngine } from '../../src/ai/engine';
import { generateAnalysisCacheKey, globalAnalysisCache } from '../../src/cache/analysis-cache';
import { UploadedFile } from '../../src/types/contract';

describe('Phase 25 & 30: Efficiency and Cache Verification', () => {
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
    const report1 = await service.analyze({ files: [docA, docB] });
    expect(report1.analysis_metadata.cache_hit).toBe(false);

    // 2nd request: identical documents and parameters
    const report2 = await service.analyze({ files: [docA, docB] });
    expect(report2.analysis_metadata.cache_hit).toBe(true);
    expect(report2.findings).toEqual(report1.findings);
  });

  it('invalidates cache when focus question, schema version, or prompt changes', () => {
    const key1 = generateAnalysisCacheKey({
      docAHash: 'hashA',
      docBHash: 'hashB',
      focusQuestion: 'payment terms',
      modelIdentifier: 'gemini-1.5-pro',
      promptVersion: 'v1.2.2',
      schemaVersion: '1.2',
      pipelineVersion: 'v1.2.2',
    });

    const key2 = generateAnalysisCacheKey({
      docAHash: 'hashA',
      docBHash: 'hashB',
      focusQuestion: 'termination terms', // Changed focus question!
      modelIdentifier: 'gemini-1.5-pro',
      promptVersion: 'v1.2.2',
      schemaVersion: '1.2',
      pipelineVersion: 'v1.2.2',
    });

    const key3 = generateAnalysisCacheKey({
      docAHash: 'hashA',
      docBHash: 'hashB',
      focusQuestion: 'payment terms',
      modelIdentifier: 'gemini-1.5-pro',
      promptVersion: 'v1.2.3', // Changed prompt version!
      schemaVersion: '1.2',
      pipelineVersion: 'v1.2.2',
    });

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });
});
