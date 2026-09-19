import { describe, it, expect } from 'vitest';
import { GeminiProvider } from '../../src/ai/provider';
import { LegalReasoningEngine } from '../../src/ai/engine';
import { AnalysisService } from '../../src/services/analysis-service';
import { UploadedFile } from '../../src/types/contract';

describe('P0 / P1 Final Production AI Path Verification', () => {
  function createDoc(filename: string, content: string): UploadedFile {
    const buffer = Buffer.from(content, 'utf-8');
    return { filename, buffer, mimeType: 'text/plain', size: buffer.length };
  }

  it('proves live network dispatch to Google Gemini API endpoint and records exact error when key is unauthenticated', async () => {
    // Uses real GeminiProvider without mocks, targeting Google's live production endpoint
    const provider = new GeminiProvider('AIzaSy_AUDIT_PROBE_DUMMY_KEY_FOR_VERIFICATION', 'gemini-2.5-flash');
    expect(provider.getModelIdentifier()).toBe('google:gemini-2.5-flash');

    let capturedError: any = null;
    try {
      await provider.generateReasoning('System prompt test', JSON.stringify({ documents: [] }));
    } catch (err: any) {
      capturedError = err;
    }

    // Proves that GeminiProvider makes a genuine outbound HTTPS call to Google's live endpoint
    expect(capturedError).not.toBeNull();
    expect(capturedError.message).toContain('Gemini API error [400]');
    expect(capturedError.message).toContain('API key not valid');
  });

  it('proves production mode strictly forbids SimulatedProvider activation', () => {
    const originalEnv = { ...process.env };
    try {
      process.env.AI_PROVIDER = 'production';
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_GENAI_API_KEY;

      expect(() => new LegalReasoningEngine()).toThrow(
        /CRITICAL CONFIGURATION ERROR: AI_PROVIDER is set to production, but GEMINI_API_KEY is not configured/
      );
    } finally {
      process.env = originalEnv;
    }
  });

  it('proves complete validation pipeline and cache behavior on production-compatible schema 1.2 payload', async () => {
    // Engine configured with standard production model output schema
    const productionOutputSchema12 = JSON.stringify({
      schema_version: '1.2',
      document_relationship_assessment: {
        status: 'related',
        reasoning: 'Both documents represent successive iterations of a commercial services agreement with substantive payment modifications.',
      },
      findings: [
        {
          finding_id: 'f1',
          relationship: 'modification',
          description: 'Payment terms changed from 30 days to 60 days following invoice receipt.',
          evidence: [
            { document_id: 'doc_a', clause_id: 'A-1' },
            { document_id: 'doc_b', clause_id: 'B-1' },
          ],
          ai_interpretation: 'The payment window is lengthened by 30 days.',
          potential_consideration: 'May adversely impact cash flow.',
          uncertainty: null,
          suggested_question: 'Does this apply retrospectively to pending invoices?',
          coexistence_possible: null,
        },
      ],
      obligations: [
        {
          obligation_id: 'ob-1',
          text: 'Contractor shall deliver monthly status report on the 5th business day of each month.',
          evidence: [{ document_id: 'doc_b', clause_id: 'B-2' }],
          party: 'Contractor',
          deadline: '5th business day of each month',
          source_document: 'doc_b',
          change_type: 'added',
        },
      ],
      unresolved_references: [],
      overall_uncertainties: [],
    });

    let networkCallCount = 0;
    const testProvider = {
      getModelIdentifier: () => 'google:gemini-2.5-flash',
      generateReasoning: async () => {
        networkCallCount++;
        return productionOutputSchema12;
      },
    };

    const engine = new LegalReasoningEngine(testProvider);
    const service = new AnalysisService(engine);

    const docA = createDoc(
      'docA.txt',
      'Section 1. Payment. Client shall pay all invoices within thirty (30) days of receipt.'
    );
    const docB = createDoc(
      'docB.txt',
      'Section 1. Payment. Client shall pay all invoices within sixty (60) days of receipt.\n\nSection 2. Reporting. Contractor shall deliver monthly status report on the 5th business day of each month.'
    );

    // Request 1: Fresh execution
    const report1 = await service.analyze({
      files: [docA, docB],
      userOrSessionId: 'prod-verification-session-1',
    });

    expect(report1.schema_version).toBe('1.2');
    expect(report1.document_relationship_assessment.status).toBe('related');
    expect(report1.findings.length).toBe(1);
    expect(report1.findings[0].evidence.length).toBe(2);
    expect(report1.findings[0].evidence[0].clause_id).toBe('A-1');
    expect(report1.findings[0].evidence[1].clause_id).toBe('B-1');
    expect(report1.obligations.length).toBe(1);
    expect(report1.obligations[0].evidence[0].clause_id).toBe('B-2');
    expect(report1.analysis_metadata.cache_hit).toBe(false);
    expect(report1.analysis_metadata.model_call_count).toBe(1);
    expect(report1.analysis_metadata.model_identifier).toBe('google:gemini-2.5-flash');
    expect(networkCallCount).toBe(1);

    // Request 2: Repeat identical request
    const report2 = await service.analyze({
      files: [docA, docB],
      userOrSessionId: 'prod-verification-session-1',
    });

    expect(report2.analysis_metadata.cache_hit).toBe(true);
    expect(report2.analysis_metadata.model_call_count).toBe(1);
    expect(networkCallCount).toBe(1); // ZERO additional model calls!
    expect(report2.findings).toEqual(report1.findings);
    expect(report2.obligations).toEqual(report1.obligations);
  });
});
