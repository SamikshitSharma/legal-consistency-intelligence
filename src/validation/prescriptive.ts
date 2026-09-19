import { Finding, Obligation } from '../types/contract';

/**
 * Regex detecting assistant-directed second-person imperatives:
 * "You must", "You should", "You need to", "You are required to", "You have the right to",
 * "You ought to", "Make sure you", etc.
 */
const SECOND_PERSON_DIRECTIVE_REGEX =
  /\b(?:you\s+(?:must|should|need\s+to|are\s+required\s+to|have\s+(?:the|a)\s+(?:legal\s+)?right\s+to|ought\s+to|have\s+to)|(?:make\s+sure\s+you|ensure\s+you\s+do\s+not))\b/i;

/**
 * Regex detecting banned legal-conclusion assertions:
 * "this is legal", "this is illegal", "is enforceable", "is unenforceable", "is valid", "is void", etc.
 */
const LEGAL_CONCLUSION_REGEX =
  /\b(?:this\s+is\s+(?:legal|illegal|enforceable|unenforceable|valid|void)|is\s+(?:legally\s+)?(?:binding|void\s+ab\s+initio))\b/i;

export function containsImperativeOrLegalConclusion(text?: string | null): boolean {
  if (!text) return false;
  return SECOND_PERSON_DIRECTIVE_REGEX.test(text) || LEGAL_CONCLUSION_REGEX.test(text);
}

/**
 * Pipeline Step 8: Prescriptive-Language Filter (Change 5 / Test #43)
 * Rejects assistant-directed second-person imperatives and legal conclusions.
 * Permits third-person, document-grounded normative language ("Contractor shall...", "Vendor must...").
 */
export function filterPrescriptiveLanguage(
  findings: Finding[],
  obligations: Obligation[]
): { filteredFindings: Finding[]; filteredObligations: Obligation[] } {
  const filteredFindings: Finding[] = [];

  for (const f of findings) {
    // Check fields: description, ai_interpretation, potential_consideration, suggested_question
    if (
      containsImperativeOrLegalConclusion(f.description) ||
      containsImperativeOrLegalConclusion(f.ai_interpretation)
    ) {
      // If core finding description or interpretation violates legal advice boundary, drop the finding
      continue;
    }

    const cleanedFinding = { ...f };

    if (containsImperativeOrLegalConclusion(cleanedFinding.potential_consideration)) {
      cleanedFinding.potential_consideration = null;
    }

    if (containsImperativeOrLegalConclusion(cleanedFinding.suggested_question)) {
      cleanedFinding.suggested_question = null;
    }

    filteredFindings.push(cleanedFinding);
  }

  // Filter obligations: Drop any obligation addressed to second person ("You must...", "You should...")
  const filteredObligations = obligations.filter((ob) => !containsImperativeOrLegalConclusion(ob.text));

  return {
    filteredFindings,
    filteredObligations,
  };
}
