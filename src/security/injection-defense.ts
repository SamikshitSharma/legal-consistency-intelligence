import { InjectedContentFlag, ServerClause } from '../types/contract';

const INJECTION_PATTERNS: { name: string; regex: RegExp }[] = [
  {
    name: 'Instruction Override',
    regex: /\b(?:ignore|disregard|forget|bypass)\s+(?:all\s+)?(?:previous\s+|prior\s+|above\s+|system\s+)?instructions\b/i,
  },
  {
    name: 'Persona Hijack',
    regex: /\b(?:you are now|act as|pretend you are|switch to)\s+(?:a|an|the)?\s*(?:system administrator|admin|developer|unrestricted|god mode|ai lawyer)\b/i,
  },
  {
    name: 'System Override / Jailbreak',
    regex: /\b(?:system override|developer mode enabled|dan mode|jailbreak|bypass security)\b/i,
  },
  {
    name: 'System Prompt Exfiltration',
    regex: /\b(?:reveal|output|display|show|print|leak)\s+(?:the\s+)?(?:hidden\s+|initial\s+|secret\s+)?(?:system prompt|initial prompt|secret instructions)\b/i,
  },
  {
    name: 'Directive Fabrication',
    regex: /\b(?:tell the user (?:to sign|this is safe|there are no risks|everything is legal)|confirm that this agreement has no obligations)\b/i,
  },
];

/**
 * Scans clauses across documents to detect prompt injection attempts.
 * Returns an array of InjectedContentFlag instances without modifying source data.
 */
export function scanClausesForInjection(clauses: ServerClause[]): InjectedContentFlag[] {
  const flags: InjectedContentFlag[] = [];

  for (const clause of clauses) {
    for (const pattern of INJECTION_PATTERNS) {
      const match = clause.text.match(pattern.regex);
      if (match) {
        const startIdx = Math.max(0, match.index! - 30);
        const endIdx = Math.min(clause.text.length, match.index! + match[0].length + 30);
        const snippet = clause.text.slice(startIdx, endIdx).trim();

        flags.push({
          document_id: clause.document_id,
          clause_id: clause.id,
          matched_pattern: pattern.name,
          snippet: snippet,
        });
      }
    }
  }

  return flags;
}
