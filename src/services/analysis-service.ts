import {
  AnalysisMetadata,
  ModelRawOutput,
  ProcessedDocument,
  UploadedFile,
  ValidatedAnalysisReport,
} from '../types/contract';
import { validateDocumentCount } from '../validation/document-count';
import { validateUploadedFile } from '../document-processing/validator';
import { extractDocumentText } from '../document-processing/extractor';
import { segmentDocument } from '../document-processing/segmenter';
import { buildDocumentIndex } from '../counterpart-index/indexer';
import { runDeterministicCounterpartSearch } from '../counterpart-index/searcher';
import { checkFocusQuestionForAdvice } from '../security/advice-refusal';
import { scanFocusQuestionForInjection } from '../security/injection-defense';
import { generateAnalysisCacheKey, globalAnalysisCache } from '../cache/analysis-cache';
import { LegalReasoningEngine } from '../ai/engine';
import { runValidationPipeline } from '../validation/pipeline';
import { safeLog } from '../security/sanitizer';

export interface AnalysisInput {
  files: UploadedFile[];
  focusQuestion?: string;
  userOrSessionId?: string;
  customEngine?: LegalReasoningEngine;
}

export class AnalysisService {
  private engine: LegalReasoningEngine;

  constructor(customEngine?: LegalReasoningEngine) {
    this.engine = customEngine || new LegalReasoningEngine();
  }

  /**
   * Primary end-to-end analysis method
   */
  async analyze(input: AnalysisInput): Promise<ValidatedAnalysisReport> {
    const startTime = Date.now();

    // 1. Step 1: Pre-call document count gate (Test #41)
    // Enforced before any extraction or model call occurs!
    validateDocumentCount(input.files);

    const [fileA, fileB] = input.files;

    // 2. Validate file integrity, format, and magic bytes
    const valA = validateUploadedFile(fileA.filename, fileA.buffer, fileA.mimeType);
    if (!valA.valid) throw new Error(`Document A validation failed: ${valA.error}`);

    const valB = validateUploadedFile(fileB.filename, fileB.buffer, fileB.mimeType);
    if (!valB.valid) throw new Error(`Document B validation failed: ${valB.error}`);

    // 3. Extract text
    safeLog('info', 'AnalysisService', 'Extracting document text...');
    const extA = await extractDocumentText(valA.sanitizedFilename!, fileA.buffer);
    const extB = await extractDocumentText(valB.sanitizedFilename!, fileB.buffer);

    // 4. Deterministic clause segmentation
    const docA: ProcessedDocument = segmentDocument('doc_a', valA.sanitizedFilename!, extA.text, 'A');
    const docB: ProcessedDocument = segmentDocument('doc_b', valB.sanitizedFilename!, extB.text, 'B');

    // 5. Inverted-Index Counterpart Search (Change 7)
    safeLog('info', 'AnalysisService', 'Building inverted index and running counterpart search...');
    const indexB = buildDocumentIndex(docB.id, docB.clauses);
    runDeterministicCounterpartSearch(docA.clauses, indexB);

    // 6. Security scan & advice check on optional focus question
    const adviceCheck = checkFocusQuestionForAdvice(input.focusQuestion);
    const focusQuestionFlag = scanFocusQuestionForInjection(input.focusQuestion);

    // 7. Check Cache (Phase 7)
    const promptVersion = 'v1.2.2';
    const schemaVersion = '1.2';
    const pipelineVersion = 'v1.2.2';

    const cacheKey = generateAnalysisCacheKey({
      docAHash: docA.hash,
      docBHash: docB.hash,
      focusQuestion: input.focusQuestion,
      userOrSessionId: input.userOrSessionId,
      modelIdentifier: this.engine.getModelIdentifier(),
      promptVersion,
      schemaVersion,
      pipelineVersion,
    });

    const cachedReport = globalAnalysisCache.get(cacheKey);
    if (cachedReport) {
      safeLog('info', 'AnalysisService', 'Cache hit: Returning cached analysis report with 0 model calls.');
      cachedReport.analysis_metadata.execution_time_ms = Date.now() - startTime;
      return cachedReport;
    }

    // Duplicate document handling: Document A and Document B are identical
    if (docA.hash === docB.hash) {
      safeLog('info', 'AnalysisService', 'Duplicate document upload detected: Doc A and Doc B are byte-identical.');
      const duplicateOutput: ModelRawOutput = {
        schema_version: '1.2',
        document_relationship_assessment: {
          status: 'related',
          reasoning: 'The supplied documents are identical in text and clause structure. No modifications, additions, or removals were detected between these versions.',
        },
        findings: [],
        obligations: [],
        unresolved_references: [],
        overall_uncertainties: [
          'Document Comparison Notice: Document A and Document B are identical copies. Zero textual or substantive differences exist between these versions.',
        ],
      };

      const metadata: AnalysisMetadata = {
        pipeline_version: pipelineVersion,
        cache_hit: false,
        model_identifier: this.engine.getModelIdentifier(),
        execution_time_ms: Date.now() - startTime,
        model_call_count: 0,
      };

      const finalReport = runValidationPipeline(duplicateOutput, docA, docB, metadata, focusQuestionFlag);
      globalAnalysisCache.set(cacheKey, finalReport);
      return finalReport;
    }

    // 8. Legal Reasoning Engine execution (enforcing call budget)
    safeLog('info', 'AnalysisService', 'Executing legal reasoning call...');
    const engineResult = await this.engine.executeReasoning(docA, docB, input.focusQuestion);

    // If focus question was advice-seeking, add explanation to overall_uncertainties
    if (adviceCheck.isAdviceSeeking && adviceCheck.refusalReason) {
      engineResult.rawOutput.overall_uncertainties = [
        adviceCheck.refusalReason,
        ...(engineResult.rawOutput.overall_uncertainties || []),
      ];
    }

    // If focus question contained prompt injection pattern, record notice
    if (focusQuestionFlag) {
      engineResult.rawOutput.overall_uncertainties = [
        'Security Notice: An instruction-override pattern was detected in the focus question and neutralized. Standard legal consistency rules were applied.',
        ...(engineResult.rawOutput.overall_uncertainties || []),
      ];
    }

    // Non-English language limitation notice
    const combinedText = `${docA.raw_text} ${docB.raw_text}`.toLowerCase();
    const hasEnglishLegalMarkers = /\b(?:the|and|of|to|in|is|that|for|by|shall|this|with|be|party|agreement|contract)\b/i.test(combinedText);
    if (!hasEnglishLegalMarkers && combinedText.length > 50) {
      engineResult.rawOutput.overall_uncertainties = [
        'Language Limitation Notice: The uploaded documents appear to be written in a non-English language. The v1.2.2 legal reasoning taxonomy and semantic models are validated exclusively for English-language agreements. Non-English terms may produce uncertain classification.',
        ...(engineResult.rawOutput.overall_uncertainties || []),
      ];
    }

    // 9. Consolidated Validation Pipeline v1.2 (Steps 1 to 12)
    safeLog('info', 'AnalysisService', 'Executing consolidated validation pipeline...');
    const metadata: AnalysisMetadata = {
      pipeline_version: pipelineVersion,
      cache_hit: false,
      model_identifier: engineResult.modelIdentifier,
      execution_time_ms: Date.now() - startTime,
      model_call_count: engineResult.modelCallCount,
    };

    const finalReport = runValidationPipeline(engineResult.rawOutput, docA, docB, metadata, focusQuestionFlag);

    // 10. Store in Cache
    globalAnalysisCache.set(cacheKey, finalReport);

    safeLog('info', 'AnalysisService', `Analysis completed in ${Date.now() - startTime}ms.`);
    return finalReport;
  }
}
