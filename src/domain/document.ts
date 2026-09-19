import crypto from 'crypto';

/**
 * Normalizes text for comparison and fingerprinting:
 * Standardizes line endings, collapses excessive whitespace, trims.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Generates SHA-256 hash of normalized text for caching and deduplication.
 */
export function hashText(text: string): string {
  const normalized = normalizeText(text);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Extracts capitalized/defined terms from legal text (e.g. "Confidential Information", "Party A", "Services")
 */
export function extractDefinedTerms(text: string): string[] {
  const termMatches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g);
  if (!termMatches) return [];
  const stopwords = new Set([
    'The', 'This', 'That', 'These', 'Those', 'In', 'On', 'At', 'By', 'For', 'With',
    'From', 'Under', 'Section', 'Article', 'Paragraph', 'Schedule', 'Exhibit', 'Agreement',
    'Shall', 'Must', 'May', 'Will', 'Either', 'Neither', 'All', 'Any', 'Each', 'Every'
  ]);
  const terms = new Set<string>();
  for (const term of termMatches) {
    if (term.length > 2 && !stopwords.has(term)) {
      terms.add(term.toLowerCase());
    }
  }
  return Array.from(terms);
}

/**
 * Extracts 3-word token shingles for lexical overlap calculation
 */
export function extractTokenShingles(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  
  if (words.length < 3) return words;
  
  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - 3; i++) {
    shingles.add(`${words[i]}_${words[i + 1]}_${words[i + 2]}`);
  }
  return Array.from(shingles);
}
