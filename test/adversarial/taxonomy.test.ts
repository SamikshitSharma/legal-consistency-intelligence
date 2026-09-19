import { describe, it, expect } from 'vitest';
import { AnalysisService } from '../../src/services/analysis-service';
import { SimulatedProvider } from '../../src/ai/provider';
import { LegalReasoningEngine } from '../../src/ai/engine';
import { UploadedFile } from '../../src/types/contract';

describe('Relationship Taxonomy & Few-Shot Cases (Examples 1–8)', () => {
  const engine = new LegalReasoningEngine(new SimulatedProvider());
  const service = new AnalysisService(engine);

  function createMockFile(filename: string, content: string): UploadedFile {
    const buffer = Buffer.from(content, 'utf-8');
    return { filename, buffer, mimeType: 'text/plain', size: buffer.length };
  }

  it('Example 2: Addition — immediate termination upon breach does NOT conflict with 30-day notice', async () => {
    const docA = createMockFile(
      'docA.txt',
      'Either party may terminate this agreement upon thirty (30) days written notice.'
    );
    const docB = createMockFile(
      'docB.txt',
      'Either party may terminate this agreement immediately upon material breach by the other party.'
    );

    const report = await service.analyze({ files: [docA, docB] });
    const addition = report.findings.find((f) => f.relationship === 'addition');

    expect(addition).toBeDefined();
    expect(addition?.coexistence_possible).toBeNull();
    expect(addition?.ai_interpretation).toContain('separate mechanisms');
  });

  it('Example 3: Apparent Conflict — genuine conflict has coexistence_possible = false', async () => {
    const docA = createMockFile(
      'docA.txt',
      'Notice of a claim under this section must be delivered within thirty (30) days of the triggering event.'
    );
    const docB = createMockFile(
      'docB.txt',
      'Notice of a claim under this section must be delivered within forty-five (45) days of the triggering event.'
    );

    const report = await service.analyze({ files: [docA, docB] });
    const conflict = report.findings.find((f) => f.relationship === 'apparent_conflict');

    expect(conflict).toBeDefined();
    expect(conflict?.coexistence_possible).toBe(false);
  });

  it('Example 4: Clarification — definition narrowed without substantive change', async () => {
    const docA = createMockFile(
      'docA.txt',
      'Confidential Information includes any information disclosed by either party.'
    );
    const docB = createMockFile(
      'docB.txt',
      'For the purposes of this agreement, Confidential Information means information disclosed by either party that is marked confidential.'
    );

    const report = await service.analyze({ files: [docA, docB] });
    const clar = report.findings.find((f) => f.relationship === 'clarification');

    expect(clar).toBeDefined();
    expect(clar?.coexistence_possible).toBeNull();
  });

  it('Example 8: Conditional Modification — seasonal delivery carve-out is NOT apparent_conflict', async () => {
    const docA = createMockFile(
      'docA.txt',
      'The Vendor shall deliver all goods within fourteen (14) days of order confirmation.'
    );
    const docB = createMockFile(
      'docB.txt',
      'The Vendor shall deliver all goods within fourteen (14) days of order confirmation, except that during the November-December peak season, delivery shall occur within twenty-one (21) days.'
    );

    const report = await service.analyze({ files: [docA, docB] });
    const mod = report.findings.find((f) => f.relationship === 'modification');

    expect(mod).toBeDefined();
    expect(mod?.relationship).not.toBe('apparent_conflict');
    expect(mod?.coexistence_possible).toBeNull();
  });

  it('Example 5: Missing referenced clause produces uncertain finding and unresolved_references entry', async () => {
    const docA = createMockFile(
      'docA.txt',
      'The Contractor shall perform the services outlined herein.'
    );
    const docB = createMockFile(
      'docB.txt',
      'The liability cap set forth in Section 9.4 shall be reduced to the amount specified in Schedule C.'
    );

    const report = await service.analyze({ files: [docA, docB] });
    const uncertain = report.findings.find((f) => f.relationship === 'uncertain');

    expect(uncertain).toBeDefined();
    expect(report.unresolved_references.length).toBeGreaterThan(0);
    expect(report.unresolved_references[0].referenced_identifier).toContain('Section 9.4');
  });
});
