import { ModelRawOutput } from '../types/contract';

export interface AIProvider {
  generateReasoning(systemPrompt: string, userContext: string): Promise<string>;
  getModelIdentifier(): string;
}

/**
 * Gemini Provider: Communicates with Google Gemini API via REST with zero external dependencies
 */
export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey =
      apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY ||
      '';
    // Use currently supported production Gemini model from environment or default to gemini-2.5-flash
    this.model = model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  getModelIdentifier(): string {
    return `google:${this.model}`;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async generateReasoning(systemPrompt: string, userContext: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userContext }],
        },
      ],
      generationConfig: {
        temperature: 0.0,
        responseMimeType: 'application/json',
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error [${response.status}]: ${errText}`);
    }

    const json = (await response.json()) as any;
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No candidate content received from Gemini API.');
    }

    return text;
  }
}

/**
 * SimulatedProvider: Deterministic semantic cross-document analysis engine.
 * Used exclusively for automated test suites and offline verification.
 * Strictly prohibited from being used as a production fallback.
 */
export class SimulatedProvider implements AIProvider {
  private modelName: string;

  constructor(modelName: string = 'simulated-reasoning-engine-v1.2.2') {
    this.modelName = modelName;
  }

  getModelIdentifier(): string {
    return this.modelName;
  }

  async generateReasoning(_systemPrompt: string, userContext: string): Promise<string> {
    const input = JSON.parse(userContext) as {
      documents: { document_id: string; filename: string; clauses: { clause_id: string; section_reference?: string; text: string }[] }[];
      focus_question?: string;
    };

    const docA = input.documents[0];
    const docB = input.documents[1];

    const findings: any[] = [];
    const obligations: any[] = [];
    const unresolvedReferences: any[] = [];
    const overallUncertainties: string[] = [];

    let findingIdx = 1;

    // Semantic matching across clauses
    for (const cA of docA.clauses) {
      // Look for counterpart in B
      const textA = cA.text.toLowerCase();

      // Check payment period: e.g. "30 days" vs "15 days"
      if (textA.includes('payment') || textA.includes('invoice')) {
        const cB = docB.clauses.find((c) => {
          const t = c.text.toLowerCase();
          return t.includes('payment') || t.includes('invoice');
        });
        if (cB) {
          const textB = cB.text.toLowerCase();
          const matchA = textA.match(/(?:\((\d+)\)|\b(\d+))\s*days/i);
          const matchB = textB.match(/(?:\((\d+)\)|\b(\d+))\s*days/i);
          const daysA = matchA ? (matchA[1] || matchA[2]) : null;
          const daysB = matchB ? (matchB[1] || matchB[2]) : null;

          if (daysA && daysB && daysA !== daysB) {
            findings.push({
              finding_id: `f${findingIdx++}`,
              relationship: 'modification',
              description: `The payment period following invoice receipt has been changed from ${daysA} days to ${daysB} days.`,
              evidence: [
                { document_id: docA.document_id, clause_id: cA.clause_id },
                { document_id: docB.document_id, clause_id: cB.clause_id },
              ],
              ai_interpretation: `The original agreement allowed ${daysA} days to pay after invoice receipt; the revised version shortens this window to ${daysB} days.`,
              potential_consideration: 'This shortens the time available to arrange payment and may impact cash-flow scheduling.',
              uncertainty: null,
              suggested_question: 'Does the shortened payment period apply to invoices already received or only to future invoices?',
              coexistence_possible: null,
            });
          }
        }
      }

      // Check delivery period / conditional peak season (Example 8)
      if (textA.includes('deliver') && textA.includes('days')) {
        const cB = docB.clauses.find((c) => c.text.toLowerCase().includes('deliver'));
        if (cB) {
          const textB = cB.text.toLowerCase();
          if (textB.includes('except') || textB.includes('peak season') || textB.includes('unless')) {
            findings.push({
              finding_id: `f${findingIdx++}`,
              relationship: 'modification',
              description: 'The revised document adds a conditional exception to the standard delivery window for the peak season.',
              evidence: [
                { document_id: docA.document_id, clause_id: cA.clause_id },
                { document_id: docB.document_id, clause_id: cB.clause_id },
              ],
              ai_interpretation: 'The original agreement set a flat delivery window; the revised version preserves that rule with a specific seasonal carve-out.',
              potential_consideration: 'Orders placed near the boundary of the peak-season window may need clear date-stamping.',
              uncertainty: null,
              suggested_question: 'What are the exact start and end dates of the peak season exception?',
              coexistence_possible: null,
            });
          }
        }
      }

      // Check notice of claim discrepancy: e.g. 30 days vs 45 days (Example 3 - genuine conflict)
      if (textA.includes('notice of a claim') || textA.includes('notice of claim')) {
        const cB = docB.clauses.find((c) => c.text.toLowerCase().includes('notice of a claim') || c.text.toLowerCase().includes('notice of claim'));
        if (cB) {
          const matchA = textA.match(/(?:\((\d+)\)|\b(\d+))\s*days/i);
          const matchB = cB.text.toLowerCase().match(/(?:\((\d+)\)|\b(\d+))\s*days/i);
          const daysA = matchA ? (matchA[1] || matchA[2]) : null;
          const daysB = matchB ? (matchB[1] || matchB[2]) : null;
          if (daysA && daysB && daysA !== daysB) {
            findings.push({
              finding_id: `f${findingIdx++}`,
              relationship: 'apparent_conflict',
              description: `The two documents state different notice periods (${daysA} days vs. ${daysB} days) for claims under the same section, with no language reconciling them.`,
              evidence: [
                { document_id: docA.document_id, clause_id: cA.clause_id },
                { document_id: docB.document_id, clause_id: cB.clause_id },
              ],
              ai_interpretation: `The original document requires notice within ${daysA} days; the revised document requires notice within ${daysB} days. As written, a notice delivered between day ${daysA} and ${daysB} would be valid under one provision and late under the other.`,
              potential_consideration: 'This discrepancy could cause dispute over whether a claim notice was timely delivered.',
              uncertainty: null,
              suggested_question: `Which notice period — ${daysA} days or ${daysB} days — is intended to govern claims under this section?`,
              coexistence_possible: false,
            });
          }
        }
      }

      // Check termination: 30 days notice vs immediate breach (Example 2 - addition, not conflict!)
      if (textA.includes('terminate') && textA.includes('written notice')) {
        const cB = docB.clauses.find((c) => c.text.toLowerCase().includes('terminate') && c.text.toLowerCase().includes('breach'));
        if (cB) {
          findings.push({
            finding_id: `f${findingIdx++}`,
            relationship: 'addition',
            description: 'The revised document introduces an additional termination pathway: immediate termination upon material breach.',
            evidence: [
              { document_id: docA.document_id, clause_id: cA.clause_id },
              { document_id: docB.document_id, clause_id: cB.clause_id },
            ],
            ai_interpretation: 'The original agreement allows termination with advance notice; the revised document adds immediate termination if a material breach occurs. These provide two separate mechanisms that operate under different circumstances.',
            potential_consideration: 'The documents do not state whether the new immediate-termination mechanism replaces or supplements the 30-day notice provision.',
            uncertainty: 'It is not established from the text whether these two termination pathways are cumulative or whether the breach provision replaces general termination.',
            suggested_question: 'How is the new immediate-termination-for-breach provision intended to interact with the existing 30-day notice right?',
            coexistence_possible: null,
          });
        }
      }

      // Check confidentiality definition narrowing (Example 4 - clarification)
      if (textA.includes('confidential information includes') || textA.includes('proprietary business methods')) {
        const cB = docB.clauses.find((c) => {
          const t = c.text.toLowerCase();
          return t.includes('confidential information means') || t.includes('non-public methodologies');
        });
        if (cB) {
          findings.push({
            finding_id: `f${findingIdx++}`,
            relationship: 'clarification',
            description: 'The revised document restates and narrows the definition of Confidential Information.',
            evidence: [
              { document_id: docA.document_id, clause_id: cA.clause_id },
              { document_id: docB.document_id, clause_id: cB.clause_id },
            ],
            ai_interpretation: 'The revised provision clarifies the scope of protected information without altering the core non-disclosure expectation.',
            potential_consideration: 'Information previously treated as confidential under an open definition should be reviewed against the updated marking criteria.',
            uncertainty: null,
            suggested_question: 'Should information previously shared under the original agreement now be marked to confirm confidential status?',
            coexistence_possible: null,
          });
        }
      }

      // Check removal candidate (Example 6 - liability insurance in A, not in B)
      if (textA.includes('insurance') || textA.includes('liability insurance')) {
        const cB = docB.clauses.find((c) => c.text.toLowerCase().includes('insurance'));
        if (!cB) {
          findings.push({
            finding_id: `f${findingIdx++}`,
            relationship: 'removal',
            description: 'No provision requiring the Contractor to carry liability insurance was found in the revised document.',
            evidence: [{ document_id: docA.document_id, clause_id: cA.clause_id }],
            ai_interpretation: 'The original agreement required the Contractor to maintain liability insurance coverage; this requirement does not appear in the revised document.',
            potential_consideration: 'The absence of an insurance requirement in the revised document removes the obligation to maintain coverage and provide proof.',
            uncertainty: null,
            suggested_question: 'Was the liability insurance requirement intentionally omitted from the revised agreement?',
            coexistence_possible: null,
          });
        }
      }
    }

    // Check for unresolved references in doc B (Example 5)
    for (const cB of docB.clauses) {
      const match = cB.text.match(/(?:Section|Schedule|Exhibit)\s+([0-9A-Z.]+)/i);
      if (match) {
        const refId = match[0];
        // Check if exists in doc A
        const existsInA = docA.clauses.some((c) => c.section_reference && c.section_reference.includes(match[1]));
        const existsInB = docB.clauses.some((c) => c.section_reference && c.section_reference.includes(match[1]));
        if (!existsInA && !existsInB) {
          findings.push({
            finding_id: `f${findingIdx++}`,
            relationship: 'uncertain',
            description: `The revised document references ${refId}, but this provision is not present in the supplied documents.`,
            evidence: [{ document_id: docB.document_id, clause_id: cB.clause_id }],
            ai_interpretation: `The clause modifies or conditions terms by reference to ${refId}, which cannot be located in the provided texts.`,
            potential_consideration: null,
            uncertainty: `The terms referenced in ${refId} cannot be verified from the supplied text.`,
            suggested_question: `Can the complete text of ${refId} be provided so this provision can be evaluated?`,
            coexistence_possible: null,
          });

          unresolvedReferences.push({
            referencing_document_id: docB.document_id,
            referencing_clause_id: cB.clause_id,
            referenced_identifier: refId,
          });
        }
      }
    }

    // Extract obligations from clauses across both documents
    const allClauses = [
      ...docA.clauses.map((c) => ({ ...c, doc_id: docA.document_id })),
      ...docB.clauses.map((c) => ({ ...c, doc_id: docB.document_id })),
    ];

    for (const c of allClauses) {
      const text = c.text;
      // Match obligation patterns: third-person normative language
      if (/\b(?:shall|must|is required to|agrees to)\b/i.test(text)) {
        // Extract deadline if present
        const deadlineMatch = text.match(/\b(?:within\s+\d+\s+days(?:\s+of\s+[^.,;\n]+)?|upon\s+[^.,;\n]+|prior\s+to\s+[^.,;\n]+|before\s+[^.,;\n]+)\b/i);
        const deadline = deadlineMatch ? deadlineMatch[0].trim() : null;

        // Keep obligation third-person and grounded
        const sentenceMatch = text.match(/[^.!?\n]+(?:shall|must|is required to|agrees to)[^.!?\n]+[.!?]?/i);
        const obText = sentenceMatch ? sentenceMatch[0].trim() : text.slice(0, 120);

        // Don't add duplicate obligations
        if (!obligations.some((o) => o.text === obText)) {
          obligations.push({
            text: obText,
            evidence: [{ document_id: c.doc_id, clause_id: c.clause_id }],
            deadline: deadline,
          });
        }
      }
    }

    // Document relationship assessment
    let status: 'related' | 'unrelated' | 'uncertain' = 'related';
    let reasoning =
      'Both documents share legal subject matter, governing provisions, and contractual structure consistent with an agreement and its revision or amendment.';

    if (findings.length === 0 && obligations.length === 0) {
      status = 'uncertain';
      reasoning = 'No direct clause correspondences or shared legal terms could be confirmed between the documents.';
      overallUncertainties.push('Insufficient shared context to establish cross-document relationship with certainty.');
    }

    const output: ModelRawOutput = {
      schema_version: '1.2',
      document_relationship_assessment: {
        status,
        reasoning,
      },
      findings,
      obligations,
      unresolved_references: unresolvedReferences,
      overall_uncertainties: overallUncertainties,
    };

    return JSON.stringify(output, null, 2);
  }
}
