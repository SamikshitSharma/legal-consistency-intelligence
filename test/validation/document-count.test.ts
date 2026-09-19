import { describe, it, expect } from 'vitest';
import { validateDocumentCount, DocumentCountError } from '../../src/validation/document-count';

describe('Pipeline Step 1: Document-Count Gate (Change 3 / Test #41)', () => {
  it('rejects request with 0 documents before any model call', () => {
    expect(() => validateDocumentCount([])).toThrow(DocumentCountError);
    expect(() => validateDocumentCount([])).toThrow(/Invalid document count: Received 0 document\(s\)/);
  });

  it('rejects request with 1 document deterministically (Test #41)', () => {
    const singleDoc = [{ id: 'doc_1', filename: 'contract.txt' }];
    expect(() => validateDocumentCount(singleDoc)).toThrow(DocumentCountError);
    expect(() => validateDocumentCount(singleDoc)).toThrow(/Received 1 document\(s\)/);
  });

  it('rejects request with 3 documents deterministically (Test #41)', () => {
    const threeDocs = [
      { id: 'doc_1', filename: 'contract_a.txt' },
      { id: 'doc_2', filename: 'contract_b.txt' },
      { id: 'doc_3', filename: 'contract_c.txt' },
    ];
    expect(() => validateDocumentCount(threeDocs)).toThrow(DocumentCountError);
    expect(() => validateDocumentCount(threeDocs)).toThrow(/Received 3 document\(s\)/);
  });

  it('rejects request with 4+ documents deterministically', () => {
    const fourDocs = [
      { id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }
    ];
    expect(() => validateDocumentCount(fourDocs)).toThrow(DocumentCountError);
  });

  it('accepts request with exactly 2 documents', () => {
    const twoDocs = [
      { id: 'doc_1', filename: 'original.pdf' },
      { id: 'doc_2', filename: 'amendment.pdf' },
    ];
    expect(() => validateDocumentCount(twoDocs)).not.toThrow();
  });
});
