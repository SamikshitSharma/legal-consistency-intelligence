import path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { normalizeText } from '../domain/document';

export class DocumentExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentExtractionError';
  }
}

/**
 * Extracts raw and normalized text from PDF, DOCX, or TXT buffer.
 * Rejects empty or scanned/image-only documents that have no extractable text.
 */
export async function extractDocumentText(
  filename: string,
  buffer: Buffer
): Promise<{ text: string; pageCount?: number }> {
  const ext = path.extname(filename).toLowerCase();

  let rawText = '';
  let pageCount: number | undefined;

  try {
    if (ext === '.pdf') {
      const parsed = await pdf(buffer);
      rawText = parsed.text || '';
      pageCount = parsed.numpages;
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value || '';
    } else if (ext === '.txt') {
      rawText = buffer.toString('utf-8');
    } else {
      throw new DocumentExtractionError(`Unsupported extension: ${ext}`);
    }
  } catch (err: any) {
    if (err instanceof DocumentExtractionError) throw err;
    throw new DocumentExtractionError(
      `Failed to parse document "${filename}": ${err.message || 'Unknown parser error'}`
    );
  }

  const normalized = normalizeText(rawText);

  // Check for scanned / image-only / empty documents
  // Strip non-printable or whitespace characters to ensure there is genuine legal text
  const cleanCharCount = normalized.replace(/[^a-zA-Z0-9]/g, '').length;
  if (cleanCharCount < 20) {
    throw new DocumentExtractionError(
      'This document does not contain extractable text. Please provide a text-based PDF, DOCX, or TXT file.'
    );
  }

  return {
    text: normalized,
    pageCount,
  };
}
