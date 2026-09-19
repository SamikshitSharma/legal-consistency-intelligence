import { describe, it, expect } from 'vitest';
import { segmentDocument } from '../../src/document-processing/segmenter';
import { extractDocumentText, DocumentExtractionError } from '../../src/document-processing/extractor';
import { validateUploadedFile } from '../../src/document-processing/validator';

describe('Document Processing & Deterministic Clause Segmentation', () => {
  it('deterministically segments clauses with stable IDs and section references', () => {
    const legalText = `
    SECTION 1.0 SERVICES AND TERM
    The Contractor shall provide professional software engineering services.
    
    SECTION 2.1 PAYMENT SCHEDULE
    Payment must be made within thirty (30) days of receipt of an invoice.
    
    SECTION 3.0 CONFIDENTIALITY
    Confidential Information includes all proprietary and non-public data.
    `;

    const docA = segmentDocument('doc_a', 'contract_v1.txt', legalText, 'A');

    expect(docA.id).toBe('doc_a');
    expect(docA.clauses.length).toBe(3);

    // Verify stable IDs
    expect(docA.clauses[0].id).toBe('A-1');
    expect(docA.clauses[1].id).toBe('A-2');
    expect(docA.clauses[2].id).toBe('A-3');

    // Verify section references extracted
    expect(docA.clauses[0].section_reference).toBe('1.0');
    expect(docA.clauses[1].section_reference).toBe('2.1');
    expect(docA.clauses[2].section_reference).toBe('3.0');

    // Verify verbatim text preservation
    expect(docA.clauses[1].text).toContain('Payment must be made within thirty (30) days');
  });

  it('generates identical clause IDs on repeated segmentation of the same text', () => {
    const text = 'Clause 1: Term.\n\nClause 2: Notice period shall be 14 days.';
    const run1 = segmentDocument('doc_a', 'test.txt', text, 'A');
    const run2 = segmentDocument('doc_a', 'test.txt', text, 'A');

    expect(run1.hash).toBe(run2.hash);
    expect(run1.clauses.map((c) => c.id)).toEqual(run2.clauses.map((c) => c.id));
  });

  it('rejects empty documents with a clear extraction error', async () => {
    const emptyBuffer = Buffer.from('', 'utf-8');
    await expect(extractDocumentText('empty.txt', emptyBuffer)).rejects.toThrow(
      /does not contain extractable text/
    );
  });

  it('detects scanned / image-only PDFs with zero extractable text', async () => {
    // A document containing only whitespace or non-printable chars (simulating image-only scan)
    const scannedBuffer = Buffer.from('       \n\n\t\t   ', 'utf-8');
    await expect(extractDocumentText('scanned.txt', scannedBuffer)).rejects.toThrow(
      /This document does not contain extractable text/
    );
  });

  it('validates file extension allow-list and rejects unauthorized formats (.exe, .sh)', () => {
    const exeBuffer = Buffer.from('malicious', 'utf-8');
    const valExe = validateUploadedFile('malware.exe', exeBuffer);
    expect(valExe.valid).toBe(false);
    expect(valExe.error).toContain('Unsupported file format ".exe"');

    const shBuffer = Buffer.from('#!/bin/bash', 'utf-8');
    const valSh = validateUploadedFile('script.sh', shBuffer);
    expect(valSh.valid).toBe(false);
  });

  it('validates file size limit (rejects files over 10MB)', () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    const valBig = validateUploadedFile('large.txt', bigBuffer);
    expect(valBig.valid).toBe(false);
    expect(valBig.error).toContain('exceeds the 10MB limit');
  });
});
