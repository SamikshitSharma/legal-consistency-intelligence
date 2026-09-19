export class DocumentCountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentCountError';
  }
}

/**
 * Pipeline Step 1: Document-Count Gate (Change 3 / Test #41)
 * Rejects any request with len(documents) != 2 before extraction or any model call occurs.
 */
export function validateDocumentCount(documents: any[]): void {
  if (!documents || documents.length !== 2) {
    const count = documents ? documents.length : 0;
    throw new DocumentCountError(
      `Invalid document count: Received ${count} document(s). Exactly two documents (Document A and Document B) are required for comparison.`
    );
  }
}
