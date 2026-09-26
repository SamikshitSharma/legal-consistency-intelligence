# Legal Consistency & Change Intelligence
> **PromptWars Virtual — Special/Exclusive Edition**  
> **Challenge**: AI for Legal Assistance & Access  
> **Specification Version**: v1.2.2 (Contract Frozen)  
> **Target Release**: September 2026

---

## 1. Product Overview & Purpose
**Legal Consistency & Change Intelligence** is a specialized cross-document legal text reasoning workspace. Rather than serving as an open-ended chatbot or ungrounded generative assistant, it performs deterministic, evidence-grounded comparative analysis between exactly two related legal instruments (such as an original agreement and its amendment, revision, or renewal).

The system maps semantic relationships across provisions, extracts binding obligations and grounded deadlines, flags unresolved section citations, surfaces prompt injection attempts, and generates targeted questions for human attorney review.

---

## 2. Core Two-Document Workflow

```
Original Legal Document (Doc A)  +  Revised Legal Document (Doc B)
                             │
                             ▼
              Deterministic Pre-Call Gates
                • Exactly-two-document rule (len == 2)
                • Magic byte format validation (PDF / DOCX / TXT)
                • Text extraction & character volume ceiling
                             │
                             ▼
              Clause Segmentation (A-1..A-n, B-1..B-n)
                             │
                             ▼
              Inverted Index & Counterpart Matching
                             │
                             ▼
         Structured Gemini Reasoning Call (v1.2.2)
         (Normally uses 1 structured call; bounded retry on malformed output; gemini-3.6-flash, temp 0.0, JSON mode)
                             │
                             ▼
     Consolidated Validation Pipeline (Steps 1 to 12)
       1. Document-count gate
       2. Strict JSON Schema v1.2 enforcement
       3. Relationship taxonomy gate
       4. Citation existence validation (server-side check rejects unsupported clause references)
       5. Evidence-count-per-relationship validation
       6. Coexistence test enforcement (null on non-conflict)
       7. Full-document removal completeness verification
       8. Prescriptive advice language filter (2nd-person drop)
       9. Hedge and label consistency check
      10. Document-uncertain blanket downgrade
      11. Finding and obligation deduplication
      12. Mandatory server legal disclaimer & injection flag injection
                             │
                             ▼
     Evidence-Grounded Cross-Document Change Intelligence Report
```

---

## 3. Allowed Semantic Relationship Taxonomy
Every finding is strictly classified into exactly one of six frozen taxonomy labels:

1. **`modification`**: A provision in one document restates, revalues, or changes terms of a provision addressing the same circumstance in the other document. (Requires citations from both Doc A and Doc B).
2. **`addition`**: A provision exists in one document with no corresponding provision in the other document.
3. **`removal`**: A provision present in the earlier document is omitted in the later document. Verified via inverted-index full-document search across all clauses in Doc B.
4. **`apparent_conflict`**: Two provisions describe requirements that cannot both be true or operative under the same conditions as written. (Requires citations from both documents; `coexistence_possible` evaluated).
5. **`clarification`**: One provision restates or narrows another without altering substantive effect.
6. **`uncertain`**: The text does not permit confident assignment of one of the above relationships.

---

## 4. Supported File Formats & Input Guardrails
- **PDF (`.pdf`)**: Real PDF files validated via `%PDF` (0x25 0x50 0x44 0x46) header magic bytes. Scanned/image-only PDFs (< 20 extractable text characters) are rejected cleanly.
- **Word (`.docx`)**: Word OpenXML documents validated via `PK` (0x50 0x4B) ZIP magic bytes.
- **Plain Text (`.txt`)**: UTF-8 encoded text files.
- **File Size Ceiling**: Maximum 10MB per document.
- **Text Volume Ceiling**: Maximum 500,000 characters per document to prevent denial-of-service or memory bloat.
- **Filename Sanitization**: Unicode letters and digits (`\p{L}\p{N}`) are preserved; directory traversal sequences (`../`, `..\`) and shell injection tokens are strictly neutralized.
- **Focus Question Limit**: Maximum 1,000 characters.

---

## 5. Security & Legal-Safety Boundaries

### Untrusted Source Data Isolation
Document clauses and user inputs are strictly isolated as untrusted data. Clauses containing override directives (e.g., `IGNORE ALL PREVIOUS INSTRUCTIONS`, `ACT AS SYSTEM ADMIN`, `REVEAL SYSTEM PROMPT`) are:
1. Detected and surfaced in `injected_content_flags`.
2. Evaluated strictly as legal contract text by the model.
3. Forbidden from altering system constraints, personas, or output structures.

### Advice-Seeking Focus Question Interception
Queries requesting legal advice, validity determinations, or signing decisions (e.g., *"Should I sign?"*, *"Is this legal?"*, *"Can we sue?"*) trigger a deterministic pre-call advisory warning and are supplemented with attorney briefing questions rather than legal conclusions.

### Server-Controlled Disclaimer
The mandatory legal information notice is injected server-side by the pipeline and cannot be suppressed or altered by model output:
> *"LEGAL INFORMATION NOTICE: This analysis is an informational cross-document consistency assessment provided by an AI reasoning engine. It does not constitute legal advice, a legal opinion, or an assessment of enforceability. No attorney-client relationship is formed. All interpretations, potential considerations, and suggested questions should be reviewed by a qualified legal professional."*

---

## 6. Performance & Multi-Tenant Caching
- **Deterministic Token Hashing**: Doc A and Doc B text are normalized and hashed with SHA-256.
- **Length-Prefixed Namespaced Cache Keys**: Combines `userOrSessionId`, `docAHash`, `docBHash`, `focusQuestion`, `modelIdentifier`, `promptVersion`, `schemaVersion`, and `pipelineVersion` to prevent cross-tenant cache pollution or delimiter collision.
- **Zero-Call Repeat Queries**: Repeat identical analyses are served from the server-side LRU cache with `cache_hit: true` and `model_call_count: 0` (measured `< 5ms` in test benchmarks).
- **Identical Document Detection**: Uploading identical copies as Document A and Document B is detected deterministically (0 model calls), returning zero modifications and an informative parity notice.

---

## 7. Configuration & Environment Variables

Create `.env.local` (gitignored, never committed or exposed):
```bash
AI_PROVIDER=production
GEMINI_MODEL=gemini-3.6-flash
GEMINI_API_KEY=your_google_gemini_api_key_here
```

### Fallback Prohibition
When `AI_PROVIDER=production` or `NODE_ENV=production`:
- The application selects `GeminiProvider` (`google:gemini-3.6-flash`).
- Silent fallback to `SimulatedProvider` is strictly prohibited. Missing or invalid keys throw a critical configuration error.

---

## 8. Verification & Test Commands

```bash
# Run complete offline test suite (25 test suites, 116 tests: 96 unit/integration + 20 acceptance)
npm test

# Run TypeScript type check
npm run typecheck

# Run production build
npm run build

# Start local production server
npm start
```
