import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/services/analysis-service';
import { UploadedFile } from '@/types/contract';
import { safeLog, sanitizeLogMessage } from '@/security/sanitizer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const uploadedFiles: UploadedFile[] = [];
    let focusQuestion: string | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      focusQuestion = (formData.get('focus_question') as string) || undefined;

      // Extract all file fields
      const fileA = formData.get('file_a') as File | null;
      const fileB = formData.get('file_b') as File | null;
      const genericFiles = formData.getAll('files') as File[];

      if (fileA && typeof fileA === 'object' && 'arrayBuffer' in fileA) {
        const buffer = Buffer.from(await fileA.arrayBuffer());
        uploadedFiles.push({
          filename: fileA.name,
          buffer,
          mimeType: fileA.type,
          size: fileA.size,
        });
      }

      if (fileB && typeof fileB === 'object' && 'arrayBuffer' in fileB) {
        const buffer = Buffer.from(await fileB.arrayBuffer());
        uploadedFiles.push({
          filename: fileB.name,
          buffer,
          mimeType: fileB.type,
          size: fileB.size,
        });
      }

      for (const gf of genericFiles) {
        if (gf && typeof gf === 'object' && 'arrayBuffer' in gf) {
          const buffer = Buffer.from(await gf.arrayBuffer());
          uploadedFiles.push({
            filename: gf.name,
            buffer,
            mimeType: gf.type,
            size: gf.size,
          });
        }
      }
    } else if (contentType.includes('application/json')) {
      const json = await req.json();
      focusQuestion = json.focus_question;

      if (Array.isArray(json.documents)) {
        for (const d of json.documents) {
          const buffer = d.content ? Buffer.from(d.content, d.is_base64 ? 'base64' : 'utf-8') : Buffer.alloc(0);
          uploadedFiles.push({
            filename: d.filename || 'document.txt',
            buffer,
            mimeType: d.mime_type || 'text/plain',
            size: buffer.length,
          });
        }
      }
    }

    // Secure Session Resolution:
    // 1. Authenticated Bearer token (hashed)
    // 2. Cryptographic session cookie (legal_session_id)
    // 3. Newly issued cryptographically random UUID session cookie
    const authHeader = req.headers.get('authorization');
    let userOrSessionId: string;
    let newSessionCookie: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      userOrSessionId = `auth:${crypto.createHash('sha256').update(authHeader).digest('hex').substring(0, 32)}`;
    } else {
      const cookieSession = req.cookies.get('legal_session_id')?.value;
      if (cookieSession && /^[a-zA-Z0-9_-]{16,64}$/.test(cookieSession)) {
        userOrSessionId = `sess:${cookieSession}`;
      } else {
        const generated = crypto.randomUUID();
        userOrSessionId = `sess:${generated}`;
        newSessionCookie = generated;
      }
    }

    const service = new AnalysisService();
    const report = await service.analyze({
      files: uploadedFiles,
      focusQuestion,
      userOrSessionId,
    });

    const response = NextResponse.json(report, { status: 200 });
    if (newSessionCookie) {
      response.cookies.set('legal_session_id', newSessionCookie, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    return response;
  } catch (err: any) {
    safeLog('error', 'API:Analyze', err.message);

    const msg = (err.message || '').toLowerCase();
    let status = 500;

    if (
      err.name === 'DocumentCountError' ||
      err.name === 'DocumentExtractionError' ||
      err.name === 'FocusQuestionLengthError' ||
      err.name === 'InvalidInputError' ||
      msg.includes('invalid document count') ||
      msg.includes('validation failed') ||
      msg.includes('exceeds') ||
      msg.includes('unsupported') ||
      msg.includes('empty') ||
      msg.includes('does not contain extractable text') ||
      msg.includes('exactly two documents') ||
      msg.includes('invalid input')
    ) {
      status = 400;
    } else if (msg.includes('[429]') || msg.includes('rate limit') || msg.includes('quota') || msg.includes('too many requests')) {
      status = 429;
    } else if (msg.includes('[503]') || msg.includes('service unavailable') || msg.includes('overloaded') || msg.includes('temporarily unavailable')) {
      status = 503;
    } else if (err.name === 'SchemaValidationError' || msg.includes('schema validation') || msg.includes('malformed')) {
      status = 502;
    }

    const cleanError = sanitizeLogMessage(err.message || 'An error occurred during legal consistency analysis.');

    return NextResponse.json(
      {
        error: cleanError,
        error_type: err.name || 'AnalysisError',
      },
      { status }
    );
  }
}
