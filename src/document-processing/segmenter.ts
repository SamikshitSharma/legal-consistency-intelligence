import { ServerClause, ProcessedDocument } from '../types/contract';
import { extractDefinedTerms, extractTokenShingles, hashText, normalizeText } from '../domain/document';

/**
 * Regex patterns to detect section headings and legal clause beginnings:
 * e.g. "1. Term", "Section 2.4", "ARTICLE III", "Schedule C", "10.1(a)", "Clause 5"
 */
const SECTION_HEADING_REGEX =
  /^(?:(?:SECTION|ARTICLE|CLAUSE|SCHEDULE|EXHIBIT|PARAGRAPH)\s+[\w.-]+|(?:[0-9]{1,3}(?:\.[0-9]{1,3})*(?:\([a-z0-9]+\))*|[A-Z]\.[0-9]+)\.?)\s*(?:[-–—:]\s*|[A-Z\s]{3,}|[A-Z][a-z]+|\n)/i;

const SECTION_NUM_CAPTURE =
  /^(?:(?:SECTION|ARTICLE|CLAUSE|SCHEDULE|EXHIBIT|PARAGRAPH)\s+([\w.-]+)|([0-9]{1,3}(?:\.[0-9]{1,3})*(?:\([a-z0-9]+\))*|[A-Z]\.[0-9]+))/i;

/**
 * Segments raw legal document text into deterministic clauses with stable IDs.
 * Stable prefix: e.g. "A" for doc 1, "B" for doc 2.
 */
export function segmentDocument(
  docId: string,
  filename: string,
  rawText: string,
  prefix: string = 'A'
): ProcessedDocument {
  const normalized = normalizeText(rawText);
  const hash = hashText(normalized);

  // Split into candidate blocks based on double newlines
  const rawParagraphs = normalized.split(/\n\s*\n+/).map((p) => p.trim()).filter((p) => p.length > 0);

  const clauses: ServerClause[] = [];
  let currentSectionRef: string | undefined = undefined;
  let clauseIndex = 1;

  for (let i = 0; i < rawParagraphs.length; i++) {
    const paragraph = rawParagraphs[i];

    // Check if the paragraph starts with a legal section heading
    const headingMatch = paragraph.match(SECTION_NUM_CAPTURE);
    if (headingMatch) {
      currentSectionRef = headingMatch[1] || headingMatch[2];
    }

    // Check if paragraph is very short (e.g. just a heading title like "SECTION 3. CONFIDENTIALITY")
    // and can be prepended to next paragraph, or kept as a clause.
    let textToUse = paragraph;
    if (
      paragraph.length < 80 &&
      i + 1 < rawParagraphs.length &&
      !paragraph.endsWith('.') &&
      !paragraph.endsWith(';')
    ) {
      // It's a heading line, attach next paragraph
      i++;
      textToUse = `${paragraph}\n${rawParagraphs[i]}`;
    }

    const clauseId = `${prefix}-${clauseIndex++}`;
    const definedTerms = extractDefinedTerms(textToUse);
    const shingles = extractTokenShingles(textToUse);

    clauses.push({
      id: clauseId,
      document_id: docId,
      section_reference: currentSectionRef,
      text: textToUse,
      normalized_text: normalizeText(textToUse),
      defined_terms: definedTerms,
      shingles: shingles,
    });
  }

  // Fallback: If no paragraphs could be split (e.g. single block of text), split by sentence boundaries
  if (clauses.length === 0 && normalized.length > 0) {
    const clauseId = `${prefix}-1`;
    clauses.push({
      id: clauseId,
      document_id: docId,
      text: normalized,
      normalized_text: normalized,
      defined_terms: extractDefinedTerms(normalized),
      shingles: extractTokenShingles(normalized),
    });
  }

  return {
    id: docId,
    filename,
    hash,
    clauses,
    raw_text: normalized,
  };
}
