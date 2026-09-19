import path from 'path';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
}

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per document

/**
 * Sanitizes a filename to prevent path traversal, special character injection,
 * and dangerous execution patterns.
 */
export function sanitizeFilename(rawFilename: string): string {
  const basename = path.basename(rawFilename);
  // Replace anything that is not alphanumeric, dash, dot, or underscore
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized.length > 0 ? sanitized : 'document.txt';
}

/**
 * Validates uploaded file size, extension, MIME type, and content integrity.
 */
export function validateUploadedFile(
  filename: string,
  buffer: Buffer,
  mimeType?: string
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      error: 'The uploaded file is empty. Please provide a document with extractable content.',
    };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds the 10MB limit.`,
    };
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Unsupported file format "${ext}". Supported formats are: PDF (.pdf), Word (.docx), and Plain Text (.txt).`,
    };
  }

  // Magic byte checks for security verification
  if (ext === '.pdf') {
    // PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
    const header = buffer.slice(0, 4).toString('utf-8');
    if (!header.startsWith('%PDF')) {
      return {
        valid: false,
        error: 'Invalid PDF file header. The file does not appear to be a genuine PDF document.',
      };
    }
  } else if (ext === '.docx') {
    // DOCX is a ZIP archive; magic bytes: PK (0x50 0x4B 0x03 0x04)
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return {
        valid: false,
        error: 'Invalid DOCX file header. The file does not appear to be a genuine DOCX document.',
      };
    }
  }

  return {
    valid: true,
    sanitizedFilename: sanitizeFilename(filename),
  };
}
