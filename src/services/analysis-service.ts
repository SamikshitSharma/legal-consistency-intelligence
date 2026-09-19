import {
  AnalysisMetadata,
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
import { generateAnalysisCacheKey, globalAnalysisCache } from '../cache/analysis-cache';
import { LegalReasoningEngine } from '../ai/engine';
import { runValidationPipeline } from '../validation/pipeline';
import { safeLog } from '../security/sanitizer';

export interface AnalysisInput {
  files: UploadedFile[];
  focusQuestion?: string;
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

    // 6. Advice-seeking check on optional focus question
    const adviceCheck = checkFocusQuestionForAdvice(input.focusQuestion);

    // 7. Check Cache (Phase 7)
    const promptVersion = 'v1.2.2';
    const schemaVersion = '1.2';
    const pipelineVersion = 'v1.2.2';

    const cacheKey = generateAnalysisCacheKey({
      docAHash: docA.hash,
      docBHash: docB.hash,
      focusQuestion: input.focusQuestion,
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

    // 9. Consolidated Validation Pipeline v1.2 (Steps 1 to 12)
    safeLog('info', 'AnalysisService', 'Executing consolidated validation pipeline...');
    const metadata: AnalysisMetadata = {
      pipeline_version: pipelineVersion,
      cache_hit: false,
      model_identifier: engineResult.modelIdentifier,
      execution_time_ms: Date.now() - startTime,
      model_call_count: engineResult.modelCallCount,
    };

    const finalReport = runValidationPipeline(engineResult.rawOutput, docA, docB, metadata);

    // 10. Store in Cache
    globalAnalysisCache.set(cacheKey, finalReport);

    safeLog('info', 'AnalysisService', `Analysis completed in ${Date.now() - startTime}ms.`);
    return finalReport;
  }
}
