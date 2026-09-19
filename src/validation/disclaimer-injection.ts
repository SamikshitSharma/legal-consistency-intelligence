import {
  AnalysisMetadata,
  InjectedContentFlag,
  ModelRawOutput,
  ProcessedDocument,
  ValidatedAnalysisReport,
} from '../types/contract';
import { scanClausesForInjection } from '../security/injection-defense';

export const MANDATORY_LEGAL_DISCLAIMER =
  'LEGAL INFORMATION NOTICE: This analysis is an informational cross-document consistency assessment provided by an AI reasoning engine. It does not constitute legal advice, a legal opinion, or an assessment of enforceability. No attorney-client relationship is formed. All interpretations, potential considerations, and suggested questions should be reviewed by a qualified legal professional.';

/**
 * Pipeline Step 12: Disclaimer + injected_content_flags Injection
 * Server controls disclaimer injection and surfaces detected injection patterns.
 */
export function injectDisclaimerAndSecurityFlags(
  modelOutput: ModelRawOutput,
  docA: ProcessedDocument,
  docB: ProcessedDocument,
  metadata: AnalysisMetadata
): ValidatedAnalysisReport {
  const allClauses = [...docA.clauses, ...docB.clauses];
  const injectedFlags: InjectedContentFlag[] = scanClausesForInjection(allClauses);

  return {
    schema_version: '1.2',
    document_relationship_assessment: modelOutput.document_relationship_assessment,
    findings: modelOutput.findings,
    obligations: modelOutput.obligations,
    unresolved_references: modelOutput.unresolved_references,
    overall_uncertainties: modelOutput.overall_uncertainties,
    disclaimer: MANDATORY_LEGAL_DISCLAIMER,
    injected_content_flags: injectedFlags,
    analysis_metadata: metadata,
  };
}
