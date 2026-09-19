import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    application: 'Legal Consistency & Change Intelligence',
    version: '1.2.2',
    contract_version: '1.2.2',
    system_prompt_version: '1.2.2',
    schema_version: '1.2',
    supported_formats: ['PDF', 'DOCX', 'TXT'],
    document_constraint: 'exactly_2_documents',
    timestamp: new Date().toISOString(),
  });
}
