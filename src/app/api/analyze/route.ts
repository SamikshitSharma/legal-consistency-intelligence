import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/services/analysis-service';
import { UploadedFile } from '@/types/contract';
import { safeLog } from '@/security/sanitizer';

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

    const service = new AnalysisService();
    const report = await service.analyze({
      files: uploadedFiles,
      focusQuestion,
    });

    return NextResponse.json(report, { status: 200 });
  } catch (err: any) {
    safeLog('error', 'API:Analyze', err.message);

    // Return clean user-facing error response
    const status =
      err.name === 'DocumentCountError' ||
      err.message.includes('Invalid document count') ||
      err.message.includes('validation failed')
        ? 400
        : 500;

    return NextResponse.json(
      {
        error: err.message || 'An error occurred during legal consistency analysis.',
        error_type: err.name || 'AnalysisError',
      },
      { status }
    );
  }
}
