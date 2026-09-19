/**
 * Deterministic pre-call advice-seeking focus question interception.
 * Enforces the strict Legal-Advice Boundary defined in contract §2 & System Prompt v1.2.2.
 */

const ADVICE_PATTERNS: RegExp[] = [
  /\bshould\s+(?:i|we)\s+sign\b/i,
  /\b(?:is|are)\s+(?:this|that|these|those|it|the\s+[\w\s-]+)\b.*?\b(?:legal|illegal|enforceable|unenforceable|valid|void)\b/i,
  /\bcan\s+(?:i|we)\s+sue\b/i,
  /\bwhat\s+should\s+(?:i|we)\s+do\b/i,
  /\bdo\s+(?:i|we)\s+have\s+(?:a|the)\s+(?:legal\s+)?right\b/i,
  /\bwill\s+(?:i|we)\s+win\s+(?:in\s+court|a\s+lawsuit|an\s+arbitration)\b/i,
  /\bgive\s+me\s+legal\s+advice\b/i,
  /\bhow\s+to\s+terminate\s+without\s+liability\b/i,
];

export interface AdviceCheckResult {
  isAdviceSeeking: boolean;
  refusalReason?: string;
  suggestedQuestions?: string[];
}

export function checkFocusQuestionForAdvice(focusQuestion?: string): AdviceCheckResult {
  if (!focusQuestion || focusQuestion.trim().length === 0) {
    return { isAdviceSeeking: false };
  }

  for (const pattern of ADVICE_PATTERNS) {
    if (pattern.test(focusQuestion)) {
      return {
        isAdviceSeeking: true,
        refusalReason:
          'The provided focus question requests legal advice, a decision recommendation, or a legal validity judgment ("is legal/enforceable", "should I sign"). As a cross-document consistency intelligence tool, the system cannot provide legal counsel, predict legal outcomes, or advise whether you should enter into or terminate an agreement.',
        suggestedQuestions: [
          'What are the commercial and operational differences between the provisions across both documents?',
          'What specific terms should be discussed with a qualified legal professional regarding this topic?',
        ],
      };
    }
  }

  return { isAdviceSeeking: false };
}
