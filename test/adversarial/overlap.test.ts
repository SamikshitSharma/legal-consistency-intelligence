import { describe, it, expect } from 'vitest';
import { AnalysisService } from '../../src/services/analysis-service';
import { SimulatedProvider } from '../../src/ai/provider';
import { LegalReasoningEngine } from '../../src/ai/engine';
import { UploadedFile } from '../../src/types/contract';

describe('Adversarial Test #40 (Change 6): Low Lexical Overlap Semantic Equivalence', () => {
  const engine = new LegalReasoningEngine(new SimulatedProvider());
  const service = new AnalysisService(engine);

  function createMockFile(filename: string, content: string): UploadedFile {
    const buffer = Buffer.from(content, 'utf-8');
    return { filename, buffer, mimeType: 'text/plain', size: buffer.length };
  }

  it('evaluates low-lexical-overlap documents with shared underlying substance as related or uncertain, NEVER unrelated', async () => {
    // Document A drafted with formal defined terms
    const docAContent = `
    SECTION 1. PROPRIETARY RIGHTS
    The Client shall not disclose any proprietary business methods, trade secrets, or technical know-how of the Contractor to any third party without prior written consent.
    
    SECTION 2. SETTLEMENT OF ACCOUNTS
    Payment shall be made within thirty (30) days of receipt of an invoice.
    `;

    // Document B drafted in plain-language restatement with renamed roles
    const docBContent = `
    ARTICLE I. CONFIDENTIALITY PROTOCOL
    Recipient agrees to keep confidential all non-public methodologies, secret processes, and technical expertise belonging to Discloser, and shall not share such information with outside parties absent express written permission.
    
    ARTICLE II. DISBURSEMENT SCHEDULE
    Payment shall be made within fifteen (15) days of receipt of an invoice.
    `;

    const fileA = createMockFile('formal_version.txt', docAContent);
    const fileB = createMockFile('plain_version.txt', docBContent);

    const report = await service.analyze({ files: [fileA, fileB] });

    // Under contract Change 6, unrelated is reserved strictly for complete absence of connection.
    // Low-overlap documents with substantive relationship must NOT be discarded as unrelated!
    expect(report.document_relationship_assessment.status).not.toBe('unrelated');
    expect(['related', 'uncertain']).toContain(report.document_relationship_assessment.status);

    // Findings must not be discarded
    expect(report.findings.length).toBeGreaterThan(0);
  });
});
