import { ModelRawOutput, ProcessedDocument } from '../types/contract';
import { AIProvider, GeminiProvider, SimulatedProvider } from './provider';
import { SYSTEM_PROMPT_V1_2_2, buildModelContext } from './prompts';
import { safeLog } from '../security/sanitizer';

export interface EngineResult {
  rawOutput: ModelRawOutput;
  modelCallCount: number;
  modelIdentifier: string;
}

export class LegalReasoningEngine {
  private provider: AIProvider;

  constructor(customProvider?: AIProvider) {
    if (customProvider) {
      this.provider = customProvider;
    } else {
      const isExplicitSimulation =
        process.env.AI_PROVIDER === 'simulation' || process.env.TEST_MODE === 'true';
      const isProductionMode =
        process.env.AI_PROVIDER === 'production' ||
        (process.env.NODE_ENV === 'production' && !isExplicitSimulation);

      const gemini = new GeminiProvider();

      if (isProductionMode) {
        if (!gemini.isConfigured()) {
          throw new Error(
            'CRITICAL CONFIGURATION ERROR: AI_PROVIDER is set to production, but GEMINI_API_KEY is not configured. Falling back to SimulatedProvider in production is strictly prohibited.'
          );
        }
        this.provider = gemini;
      } else if (gemini.isConfigured() && !isExplicitSimulation) {
        this.provider = gemini;
      } else if (isExplicitSimulation || process.env.NODE_ENV === 'test' || !process.env.NODE_ENV) {
        safeLog(
          'info',
          'LegalReasoningEngine',
          'Running with SimulatedProvider in non-production test/development mode.'
        );
        this.provider = new SimulatedProvider();
      } else {
        throw new Error(
          'CRITICAL CONFIGURATION ERROR: Production AI provider required. GEMINI_API_KEY must be configured, or set AI_PROVIDER=simulation for offline test mode.'
        );
      }
    }
  }

  getModelIdentifier(): string {
    return this.provider.getModelIdentifier();
  }

  /**
   * Executes reasoning across exactly two processed documents.
   * Strictly enforces model call budget: max 1 normal call, max 1 retry on malformed JSON.
   * Hard ceiling: 2 model calls.
   */
  async executeReasoning(
    docA: ProcessedDocument,
    docB: ProcessedDocument,
    focusQuestion?: string
  ): Promise<EngineResult> {
    const userContext = buildModelContext(docA, docB, focusQuestion);
    let modelCallCount = 0;
    let lastError: Error | null = null;

    while (modelCallCount < 2) {
      modelCallCount++;
      try {
        safeLog('info', 'LegalReasoningEngine', `Dispatching model call attempt ${modelCallCount}...`);
        const rawResponse = await this.provider.generateReasoning(SYSTEM_PROMPT_V1_2_2, userContext);

        // Strip any markdown code fences if emitted by provider
        let cleaned = rawResponse.trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const parsed = JSON.parse(cleaned) as ModelRawOutput;
        return {
          rawOutput: parsed,
          modelCallCount,
          modelIdentifier: this.provider.getModelIdentifier(),
        };
      } catch (err: any) {
        lastError = err;
        safeLog('warn', 'LegalReasoningEngine', `Attempt ${modelCallCount} failed: ${err.message}`);
        if (modelCallCount >= 2) break; // Reached hard ceiling
      }
    }

    throw new Error(
      `Legal reasoning engine failed after ${modelCallCount} call(s): ${lastError?.message || 'Unknown error'}`
    );
  }
}
