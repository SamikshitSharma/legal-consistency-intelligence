import {
  AnalysisMetadata,
  ModelRawOutput,
  ProcessedDocument,
  ValidatedAnalysisReport,
} from '../types/contract';
import { validateDocumentCount } from './document-count';
import { validateOutputSchema } from './schema-validator';
import { applyRelationshipGate } from './relationship-gate';
import { validateCitations } from './citation-checker';
import { applyEvidenceRulesAndCoexistenceRelabel } from './evidence-rules';
import { enforceCoexistenceNulling } from './coexistence';
import { verifyRemovalCompleteness } from './removal-verifier';
import { filterPrescriptiveLanguage } from './prescriptive';
import { checkHedgeLabelConsistency } from './hedge-checker';
import { applyDocumentUncertainDowngrade } from './uncertain-downgrade';
import { deduplicateFindingsAndObligations } from './deduplicator';
import { injectDisclaimerAndSecurityFlags } from './disclaimer-injection';

/**
 * Consolidated Validation Pipeline (v1.2, full order)
 * Coordinates all 12 steps in exact frozen specification sequence.
 */
export function runValidationPipeline(
  rawModelOutput: any,
  docA: ProcessedDocument,
  docB: ProcessedDocument,
  metadata: AnalysisMetadata
): ValidatedAnalysisReport {
  // Step 1: Document-count gate
  validateDocumentCount([docA, docB]);

  // Step 2: Schema validation
  const validOutput: ModelRawOutput = validateOutputSchema(rawModelOutput);

  // Step 3: Document-relationship gate
  const { output: gatedOutput, isUncertainFlagged } = applyRelationshipGate(validOutput);

  // Step 4: Citation existence check
  const { validFindings, validObligations } = validateCitations(
    gatedOutput.findings,
    gatedOutput.obligations,
    docA,
    docB
  );

  // Step 5: Evidence-count-per-relationship + coexistence relabel
  const evidenceVerifiedFindings = applyEvidenceRulesAndCoexistenceRelabel(
    validFindings,
    docA,
    docB
  );

  // Step 6: coexistence_possible null-enforcement (Change 1 / Test #42)
  const coexistenceEnforcedFindings = enforceCoexistenceNulling(evidenceVerifiedFindings);

  // Step 7: Removal-evidence-completeness (Change 2)
  const removalVerifiedFindings = verifyRemovalCompleteness(
    coexistenceEnforcedFindings,
    docA
  );

  // Step 8: Prescriptive-language filter (Change 5 / Test #43)
  const { filteredFindings, filteredObligations } = filterPrescriptiveLanguage(
    removalVerifiedFindings,
    validObligations
  );

  // Step 9: Hedge/label consistency check (Change 4)
  const hedgeCheckedFindings = checkHedgeLabelConsistency(filteredFindings);

  // Step 10: Document-uncertain blanket downgrade
  const downgradedFindings = applyDocumentUncertainDowngrade(
    hedgeCheckedFindings,
    isUncertainFlagged
  );

  // Step 11: Dedup
  const { dedupedFindings, dedupedObligations } = deduplicateFindingsAndObligations(
    downgradedFindings,
    filteredObligations
  );

  const finalModelOutput: ModelRawOutput = {
    ...gatedOutput,
    findings: dedupedFindings,
    obligations: dedupedObligations,
  };

  // Step 12: Disclaimer + injected_content_flags injection
  return injectDisclaimerAndSecurityFlags(finalModelOutput, docA, docB, metadata);
}
