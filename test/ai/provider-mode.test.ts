import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LegalReasoningEngine } from '../../src/ai/engine';
import { GeminiProvider, SimulatedProvider } from '../../src/ai/provider';
import { ProcessedDocument } from '../../src/types/contract';

describe('P0: Production AI Provider & Fallback Prohibition Audit', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const dummyDocA: ProcessedDocument = {
    id: 'doc_a',
    filename: 'docA.txt',
    hash: 'hashA',
    raw_text: 'Text',
    clauses: [{ id: 'A-1', document_id: 'doc_a', text: 'Text A', normalized_text: 'text a', defined_terms: [], shingles: [] }],
  };

  const dummyDocB: ProcessedDocument = {
    id: 'doc_b',
    filename: 'docB.txt',
    hash: 'hashB',
    raw_text: 'Text',
    clauses: [{ id: 'B-1', document_id: 'doc_b', text: 'Text B', normalized_text: 'text b', defined_terms: [], shingles: [] }],
  };

  it('prohibits silent fallback to SimulatedProvider when AI_PROVIDER=production and GEMINI_API_KEY is missing', () => {
    process.env.AI_PROVIDER = 'production';
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;

    expect(() => new LegalReasoningEngine()).toThrow(
      /CRITICAL CONFIGURATION ERROR: AI_PROVIDER is set to production, but GEMINI_API_KEY is not configured/
    );
  });

  it('prohibits silent fallback to SimulatedProvider when NODE_ENV=production and GEMINI_API_KEY is missing', () => {
    delete process.env.AI_PROVIDER;
    (process.env as any).NODE_ENV = 'production';
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;

    expect(() => new LegalReasoningEngine()).toThrow(
      /Falling back to SimulatedProvider in production is strictly prohibited/
    );
  });

  it('uses currently supported production Gemini model (gemini-2.5-flash by default or GEMINI_MODEL env var)', () => {
    process.env.GEMINI_API_KEY = 'test-dummy-key-1234567890';
    delete process.env.GEMINI_MODEL;

    const providerDefault = new GeminiProvider();
    expect(providerDefault.getModelIdentifier()).toBe('google:gemini-2.5-flash');

    process.env.GEMINI_MODEL = 'gemini-2.5-pro';
    const providerCustom = new GeminiProvider();
    expect(providerCustom.getModelIdentifier()).toBe('google:gemini-2.5-pro');
  });

  it('executes real production-provider HTTP call when GEMINI_API_KEY is configured', async () => {
    process.env.AI_PROVIDER = 'production';
    process.env.GEMINI_API_KEY = 'test-key-for-dispatch-verification';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';

    // Mock global fetch to verify HTTP dispatch to Gemini endpoint
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    schema_version: '1.2',
                    document_relationship_assessment: { status: 'related', reasoning: 'Verified by production model' },
                    findings: [],
                    obligations: [],
                    unresolved_references: [],
                    overall_uncertainties: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    global.fetch = mockFetch;

    const engine = new LegalReasoningEngine();
    expect(engine.getModelIdentifier()).toBe('google:gemini-2.5-flash');

    const result = await engine.executeReasoning(dummyDocA, dummyDocB);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('models/gemini-2.5-flash:generateContent');
    expect(mockFetch.mock.calls[0][0]).toContain('key=test-key-for-dispatch-verification');
    expect(result.rawOutput.schema_version).toBe('1.2');
    expect(result.rawOutput.document_relationship_assessment.reasoning).toBe('Verified by production model');
  });
});
