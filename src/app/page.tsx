'use client';

import React, { useState, useRef } from 'react';
import { ValidatedAnalysisReport, Finding } from '@/types/contract';

// Pre-loaded realistic sample contract pairs for immediate testing & evaluation
const SAMPLE_CONTRACT_PAIRS = [
  {
    name: 'Payment Window Modification (Ex. 1)',
    focusQuestion: 'What changed regarding payment terms?',
    docA: {
      name: 'Original_MSA_v1.txt',
      content:
        'SECTION 1. SCOPE OF SERVICES\nThe Contractor shall deliver all consulting services in accordance with the project milestone schedule.\n\nSECTION 2. PAYMENT TERMS\nPayment shall be made within thirty (30) days of receipt of an invoice.\n\nSECTION 3. CONFIDENTIALITY\nConfidential Information includes any proprietary technical or business data disclosed by either party.',
    },
    docB: {
      name: 'Amended_MSA_v2.txt',
      content:
        'SECTION 1. SCOPE OF SERVICES\nThe Contractor shall deliver all consulting services in accordance with the project milestone schedule.\n\nSECTION 2. PAYMENT TERMS\nPayment shall be made within fifteen (15) days of receipt of an invoice.\n\nSECTION 3. CONFIDENTIALITY\nConfidential Information includes any proprietary technical or business data disclosed by either party.',
    },
  },
  {
    name: 'Termination Pathways (Addition, Ex. 2)',
    focusQuestion: 'Did the termination rights change?',
    docA: {
      name: 'Original_Lease_2024.txt',
      content:
        'SECTION 10. TERM AND RENEWAL\nThe initial lease term shall be twelve (12) months from the commencement date.\n\nSECTION 11. TERMINATION\nEither party may terminate this agreement upon thirty (30) days written notice to the other party.\n\nSECTION 12. GOVERNING LAW\nThis agreement shall be governed by the laws of the State of Delaware.',
    },
    docB: {
      name: 'Revised_Lease_2025.txt',
      content:
        'SECTION 10. TERM AND RENEWAL\nThe initial lease term shall be twelve (12) months from the commencement date.\n\nSECTION 11. TERMINATION FOR BREACH\nEither party may terminate this agreement immediately upon material breach by the other party.\n\nSECTION 12. GOVERNING LAW\nThis agreement shall be governed by the laws of the State of Delaware.',
    },
  },
  {
    name: 'Notice Claim Discrepancy (Apparent Conflict, Ex. 3)',
    focusQuestion: 'Compare claim notification periods.',
    docA: {
      name: 'Supply_Agreement_Original.txt',
      content:
        'SECTION 8. INSPECTION AND ACCEPTANCE\nThe Buyer shall inspect all delivered units within seven (7) days of arrival.\n\nSECTION 9. CLAIMS AND NOTICE\nNotice of a claim under this section must be delivered within thirty (30) days of the triggering event.\n\nSECTION 10. INDEMNIFICATION\nThe Supplier agrees to indemnify the Buyer for third-party patent infringement.',
    },
    docB: {
      name: 'Supply_Agreement_Revision.txt',
      content:
        'SECTION 8. INSPECTION AND ACCEPTANCE\nThe Buyer shall inspect all delivered units within seven (7) days of arrival.\n\nSECTION 9. CLAIMS AND NOTICE\nNotice of a claim under this section must be delivered within forty-five (45) days of the triggering event.\n\nSECTION 10. INDEMNIFICATION\nThe Supplier agrees to indemnify the Buyer for third-party patent infringement.',
    },
  },
  {
    name: 'Insurance Requirement Omission (Removal, Ex. 6)',
    focusQuestion: 'Did insurance obligations change?',
    docA: {
      name: 'Vendor_Agreement_Original.txt',
      content:
        'SECTION 4. STANDARD OF WORK\nThe Vendor is required to deliver within 14 days of order confirmation.\n\nSECTION 5. LIABILITY INSURANCE\nThe Contractor shall carry commercial general liability insurance with minimum coverage of $1,000,000 per occurrence, and shall provide proof of such coverage upon request.\n\nSECTION 6. SEVERABILITY\nIf any provision is found invalid, remaining provisions remain in full force.',
    },
    docB: {
      name: 'Vendor_Agreement_Amendment.txt',
      content:
        'SECTION 4. STANDARD OF WORK\nThe Vendor is required to deliver within 14 days of order confirmation.\n\nSECTION 6. SEVERABILITY\nIf any provision is found invalid, remaining provisions remain in full force.',
    },
  },
  {
    name: 'Peak Season Delivery (Conditional Modification, Ex. 8)',
    focusQuestion: 'Check delivery schedule exceptions.',
    docA: {
      name: 'Logistics_Contract_Original.txt',
      content:
        'SECTION 3. DELIVERY SCHEDULE\nThe Vendor shall deliver all goods within fourteen (14) days of order confirmation.\n\nSECTION 4. PACKAGING\nGoods must be packaged in tamper-evident containers.',
    },
    docB: {
      name: 'Logistics_Contract_Amended.txt',
      content:
        'SECTION 3. DELIVERY SCHEDULE\nThe Vendor shall deliver all goods within fourteen (14) days of order confirmation, except that during the November-December peak season, delivery shall occur within twenty-one (21) days.\n\nSECTION 4. PACKAGING\nGoods must be packaged in tamper-evident containers.',
    },
  },
];

export default function LegalIntelligenceApp() {
  // File state
  const [fileA, setFileA] = useState<{ name: string; content?: string; file?: File } | null>(null);
  const [fileB, setFileB] = useState<{ name: string; content?: string; file?: File } | null>(null);
  const [focusQuestion, setFocusQuestion] = useState<string>('');

  // Processing state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progressStage, setProgressStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [report, setReport] = useState<ValidatedAnalysisReport | null>(null);

  // Active UI tab
  const [activeTab, setActiveTab] = useState<string>('all');
  const [expandedClauseId, setExpandedClauseId] = useState<string | null>(null);

  // File input refs
  const fileInputRefA = useRef<HTMLInputElement>(null);
  const fileInputRefB = useRef<HTMLInputElement>(null);

  // Advice warning detection
  const isAdviceSeeking =
    /\b(?:should (?:i|we) sign|is (?:this|that|it) (?:legal|enforceable|valid)|can (?:i|we) sue|what should (?:i|we) do)\b/i.test(
      focusQuestion
    );

  const handleSelectSample = (index: number) => {
    const sample = SAMPLE_CONTRACT_PAIRS[index];
    setFileA({ name: sample.docA.name, content: sample.docA.content });
    setFileB({ name: sample.docB.name, content: sample.docB.content });
    setFocusQuestion(sample.focusQuestion);
    setReport(null);
    setErrorMessage(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, slot: 'A' | 'B') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (slot === 'A') {
      setFileA({ name: file.name, file });
    } else {
      setFileB({ name: file.name, file });
    }
    setReport(null);
    setErrorMessage(null);
  };

  const handleReset = () => {
    setFileA(null);
    setFileB(null);
    setFocusQuestion('');
    setReport(null);
    setErrorMessage(null);
    setActiveTab('all');
  };

  const handleRunAnalysis = async () => {
    if (!fileA || !fileB) {
      setErrorMessage('Exactly two documents are required. Please upload or select Document A and Document B.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setReport(null);

    try {
      setProgressStage('Validating documents & pre-call count gate...');
      await new Promise((r) => setTimeout(r, 200));

      setProgressStage('Extracting text & normalising clause structures...');
      await new Promise((r) => setTimeout(r, 200));

      setProgressStage('Building inverted index & running deterministic counterpart search...');
      await new Promise((r) => setTimeout(r, 200));

      setProgressStage('Executing semantic reasoning engine (v1.2.2)...');

      let response: Response;

      // Handle raw files or sample text
      if (fileA.file || fileB.file) {
        const formData = new FormData();
        if (fileA.file) formData.append('file_a', fileA.file);
        else formData.append('file_a', new Blob([fileA.content || ''], { type: 'text/plain' }), fileA.name);

        if (fileB.file) formData.append('file_b', fileB.file);
        else formData.append('file_b', new Blob([fileB.content || ''], { type: 'text/plain' }), fileB.name);

        if (focusQuestion.trim()) formData.append('focus_question', focusQuestion.trim());

        response = await fetch('/api/analyze', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Send as JSON text documents
        response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documents: [
              { filename: fileA.name, content: fileA.content },
              { filename: fileB.name, content: fileB.content },
            ],
            focus_question: focusQuestion.trim() || undefined,
          }),
        });
      }

      setProgressStage('Applying Consolidated Validation Pipeline (Steps 1–12)...');

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || `Analysis failed with status ${response.status}`);
      }

      const result = (await response.json()) as ValidatedAnalysisReport;
      setReport(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
      setProgressStage('');
    }
  };

  // Filter findings according to active tab
  const filteredFindings = report
    ? activeTab === 'all'
      ? report.findings
      : report.findings.filter((f) => f.relationship === activeTab)
    : [];

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <header className="header-wrapper" role="banner">
        <div className="header-inner">
          <div className="brand-badge">
            <div className="brand-icon" aria-hidden="true">
              §
            </div>
            <div>
              <h1 className="brand-title">Legal Consistency & Change Intelligence</h1>
              <p className="brand-subtitle">Cross-Document AI Reasoning Engine</p>
            </div>
          </div>
          <div className="header-status">
            <span className="contract-version-tag">
              <span className="status-dot" aria-hidden="true"></span>
              v1.2.2 CONTRACT FROZEN
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="main-content" role="main">
        {/* Hero Banner */}
        <section className="hero-section" aria-labelledby="hero-title">
          <span className="hero-tag">Evidence-Grounded Legal Comparison</span>
          <h2 id="hero-title" className="hero-heading">
            Understand Exactly What Changed Between Two Legal Documents
          </h2>
          <p className="hero-lead">
            Detects modifications, additions, verified removals, and apparent conflicts across original and revised
            agreements — strictly grounded in source clause citations with deterministic safety guardrails.
          </p>
        </section>

        {/* Quick-Select Sample Contracts */}
        <section className="sample-docs-panel" aria-label="Sample contracts">
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Try Benchmark Cases:
          </span>
          <div className="sample-buttons-row">
            {SAMPLE_CONTRACT_PAIRS.map((pair, idx) => (
              <button
                key={idx}
                type="button"
                className="sample-btn"
                onClick={() => handleSelectSample(idx)}
                aria-label={`Load sample: ${pair.name}`}
              >
                {pair.name}
              </button>
            ))}
          </div>
        </section>

        {/* Dual Document Upload Workspace */}
        <section className="upload-grid" aria-label="Document upload inputs">
          {/* Document A */}
          <div className="upload-card">
            <div className="upload-card-header">
              <span className="doc-role-pill">Document A · Original / Earlier</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Prefix: [A-#]
              </span>
            </div>
            <div
              className="dropzone-area"
              onClick={() => fileInputRefA.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRefA.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Upload original legal document A (PDF, DOCX, or TXT)"
            >
              <input
                ref={fileInputRefA}
                type="file"
                className="file-input-hidden"
                accept=".pdf,.docx,.txt"
                onChange={(e) => handleFileChange(e, 'A')}
              />
              <span className="dropzone-icon" aria-hidden="true">
                📄
              </span>
              <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Select or drop original document</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supports PDF, Word (.docx), Plain Text (.txt)</p>
            </div>
            {fileA && (
              <div className="selected-file-pill">
                <span className="selected-file-name" title={fileA.name}>
                  ✓ {fileA.name}
                </span>
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => setFileA(null)}
                  aria-label="Remove Document A"
                >
                  ✕ Remove
                </button>
              </div>
            )}
          </div>

          {/* Document B */}
          <div className="upload-card">
            <div className="upload-card-header">
              <span className="doc-role-pill" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#67e8f9', borderColor: 'rgba(6, 182, 212, 0.3)' }}>
                Document B · Revised / Amended
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Prefix: [B-#]
              </span>
            </div>
            <div
              className="dropzone-area"
              onClick={() => fileInputRefB.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRefB.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Upload revised legal document B (PDF, DOCX, or TXT)"
            >
              <input
                ref={fileInputRefB}
                type="file"
                className="file-input-hidden"
                accept=".pdf,.docx,.txt"
                onChange={(e) => handleFileChange(e, 'B')}
              />
              <span className="dropzone-icon" aria-hidden="true">
                📑
              </span>
              <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Select or drop revised document</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supports PDF, Word (.docx), Plain Text (.txt)</p>
            </div>
            {fileB && (
              <div className="selected-file-pill">
                <span className="selected-file-name" title={fileB.name}>
                  ✓ {fileB.name}
                </span>
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => setFileB(null)}
                  aria-label="Remove Document B"
                >
                  ✕ Remove
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Optional Focus Question */}
        <section className="focus-question-box" aria-labelledby="focus-q-label">
          <label id="focus-q-label" htmlFor="focus-input" style={{ fontWeight: 600, fontSize: '0.9rem', color: '#e2e8f0' }}>
            Optional Focus Question (Single-Turn Guidance)
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            What would you like this comparison to pay particular attention to? (e.g. "What changed regarding payment
            terms?"). Changes presentation order without suppressing other material findings.
          </p>
          <input
            id="focus-input"
            type="text"
            className="focus-question-input"
            placeholder="e.g. Focus on termination rights or indemnification limits"
            value={focusQuestion}
            onChange={(e) => setFocusQuestion(e.target.value)}
          />
          {isAdviceSeeking && (
            <div className="advice-warning-alert" role="alert">
              <span aria-hidden="true">⚠️</span>
              <div>
                <strong>Legal-Advice Boundary Active:</strong> Your query asks for legal advice or a signing decision.
                This engine provides semantic consistency intelligence and will suggest questions for legal counsel,
                but will never advise whether to sign or declare provisions legally binding.
              </div>
            </div>
          )}
        </section>

        {/* Action Bar */}
        <div className="action-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              id="analyze-btn"
              type="button"
              className="btn-primary"
              disabled={isAnalyzing || !fileA || !fileB}
              onClick={handleRunAnalysis}
              aria-busy={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <span className="status-dot" style={{ background: '#60a5fa' }} aria-hidden="true"></span>
                  Analyzing Documents...
                </>
              ) : (
                <>Analyze Two Documents →</>
              )}
            </button>
            {(fileA || fileB || report) && (
              <button type="button" className="btn-secondary" onClick={handleReset}>
                Reset / Clear
              </button>
            )}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            🔒 Isolated Processing · Zero Public Model Training · Strictly Grounded
          </span>
        </div>

        {/* Progress State */}
        {isAnalyzing && (
          <section className="progress-card" aria-live="polite">
            <div className="spinner" aria-hidden="true"></div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Comparing Legal Documents</h3>
            <p style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
              {progressStage}
            </p>
            <div className="progress-steps">
              <span className="step-indicator active">1. Pre-Call Gate</span>
              <span className="step-indicator active">2. Text Extraction</span>
              <span className="step-indicator active">3. Clause Inverted Index</span>
              <span className="step-indicator active">4. Semantic Reasoning</span>
              <span className="step-indicator active">5. 12-Step Validation</span>
            </div>
          </section>
        )}

        {/* Error State */}
        {errorMessage && (
          <div className="error-banner" role="alert">
            <div>
              <strong>Analysis Notice:</strong> {errorMessage}
            </div>
            <button
              type="button"
              className="clear-btn"
              onClick={() => setErrorMessage(null)}
              style={{ color: '#fda4af' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Analysis Results View */}
        {report && (
          <section id="results-view" aria-labelledby="results-title">
            {/* Executive Document Relationship Assessment Banner */}
            <div className="assessment-banner">
              <div>
                <div className="assessment-tag-wrapper">
                  <h3 id="results-title" style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                    Cross-Document Assessment
                  </h3>
                  <span className={`status-badge status-${report.document_relationship_assessment.status}`}>
                    {report.document_relationship_assessment.status}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '850px' }}>
                  {report.document_relationship_assessment.reasoning}
                </p>
              </div>
              <div className="meta-stats-row">
                <span>⏱ {report.analysis_metadata.execution_time_ms}ms</span>
                <span>{report.analysis_metadata.cache_hit ? '⚡ Cache Hit (0 model calls)' : '🤖 1 Reasoning Call'}</span>
                <span>📋 {report.findings.length} Findings</span>
              </div>
            </div>

            {/* Injected Content Security Banner (if any prompt injection detected) */}
            {report.injected_content_flags && report.injected_content_flags.length > 0 && (
              <div className="injection-alert-card" role="alert">
                <h4 style={{ color: '#fb7185', fontWeight: 700, marginBottom: '0.5rem' }}>
                  🛡️ Security Notice: Prompt Injection Pattern Neutralized
                </h4>
                <p style={{ fontSize: '0.85rem', color: '#fca5a5' }}>
                  The server security scanner detected directive patterns in source clauses. The model analyzed these
                  strictly as document text and did not execute them.
                </p>
                {report.injected_content_flags.map((flag, idx) => (
                  <div key={idx} className="injection-flag-item">
                    <strong>
                      Clause [{flag.clause_id}] ({flag.matched_pattern}):
                    </strong>{' '}
                    <span style={{ fontStyle: 'italic' }}>"{flag.snippet}"</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab Navigation */}
            <nav className="tabs-container" aria-label="Findings category filter">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All Findings <span className="badge-count">{report.findings.length}</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'modification' ? 'active' : ''}`}
                onClick={() => setActiveTab('modification')}
              >
                Modifications{' '}
                <span className="badge-count">
                  {report.findings.filter((f) => f.relationship === 'modification').length}
                </span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'addition' ? 'active' : ''}`}
                onClick={() => setActiveTab('addition')}
              >
                Additions{' '}
                <span className="badge-count">
                  {report.findings.filter((f) => f.relationship === 'addition').length}
                </span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'removal' ? 'active' : ''}`}
                onClick={() => setActiveTab('removal')}
              >
                Removals{' '}
                <span className="badge-count">
                  {report.findings.filter((f) => f.relationship === 'removal').length}
                </span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'apparent_conflict' ? 'active' : ''}`}
                onClick={() => setActiveTab('apparent_conflict')}
              >
                Apparent Conflicts{' '}
                <span className="badge-count">
                  {report.findings.filter((f) => f.relationship === 'apparent_conflict').length}
                </span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'clarification' ? 'active' : ''}`}
                onClick={() => setActiveTab('clarification')}
              >
                Clarifications{' '}
                <span className="badge-count">
                  {report.findings.filter((f) => f.relationship === 'clarification').length}
                </span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'uncertain' ? 'active' : ''}`}
                onClick={() => setActiveTab('uncertain')}
              >
                Uncertainties{' '}
                <span className="badge-count">
                  {report.findings.filter((f) => f.relationship === 'uncertain').length}
                </span>
              </button>
            </nav>

            {/* Findings List */}
            <div className="findings-list">
              {filteredFindings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No findings in this category.
                </div>
              ) : (
                filteredFindings.map((finding: Finding) => (
                  <article key={finding.finding_id} className="finding-card">
                    <div className="finding-header">
                      <span className={`relationship-badge rel-${finding.relationship}`}>
                        {finding.relationship.replace('_', ' ')}
                      </span>
                      <div className="evidence-pill-group">
                        {finding.evidence.map((ev, i) => (
                          <span key={i} className="evidence-pill" title={`Document ${ev.document_id}, Clause ${ev.clause_id}`}>
                            {ev.clause_id}
                          </span>
                        ))}
                        {finding.removal_evidence_completeness && (
                          <span
                            className="evidence-pill"
                            style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                          >
                            ✓ Full-Doc Search Verified
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="finding-desc">{finding.description}</h4>

                    {/* AI Interpretation */}
                    <div className="finding-section">
                      <p className="section-label">Plain Language Interpretation</p>
                      <p className="section-text">{finding.ai_interpretation}</p>
                    </div>

                    {/* Potential Consideration */}
                    {finding.potential_consideration && (
                      <div className="finding-section">
                        <p className="section-label">Commercial / Operational Consideration</p>
                        <p className="section-text">{finding.potential_consideration}</p>
                      </div>
                    )}

                    {/* Coexistence check on Apparent Conflicts */}
                    {finding.relationship === 'apparent_conflict' && (
                      <div className="coexistence-badge">
                        Coexistence Test Evaluation:{' '}
                        {finding.coexistence_possible === false
                          ? 'Incompatible (Cannot both be true under same conditions)'
                          : String(finding.coexistence_possible)}
                      </div>
                    )}

                    {/* Uncertainty */}
                    {finding.uncertainty && (
                      <div className="finding-section">
                        <p className="section-label" style={{ color: 'var(--accent-amber)' }}>
                          Identified Uncertainty
                        </p>
                        <p className="section-text" style={{ color: '#fcd34d' }}>
                          {finding.uncertainty}
                        </p>
                      </div>
                    )}

                    {/* Suggested Question */}
                    {finding.suggested_question && (
                      <div className="question-box">
                        <strong>Suggested Question for Legal Counsel:</strong> "{finding.suggested_question}"
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>

            {/* Obligations & Deadlines Matrix */}
            <section style={{ marginTop: '3rem' }} aria-labelledby="obligations-title">
              <h3 id="obligations-title" style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Extracted Obligations & Grounded Deadlines
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Contractual commitments grounded directly in cited evidence. Relative deadlines are preserved as stated
                without unsupported calendar inferences.
              </p>

              <div className="obligations-table-wrapper">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th style={{ width: '55%' }}>Obligation Statement (Document-Reported)</th>
                      <th style={{ width: '25%' }}>Grounded Deadline</th>
                      <th style={{ width: '20%' }}>Cited Clause</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.obligations.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          No explicit obligation clauses detected in the provided excerpts.
                        </td>
                      </tr>
                    ) : (
                      report.obligations.map((ob, idx) => (
                        <tr key={idx}>
                          <td>{ob.text}</td>
                          <td>
                            {ob.deadline ? (
                              <span className="deadline-tag">{ob.deadline}</span>
                            ) : (
                              <span className="deadline-none">None stated</span>
                            )}
                          </td>
                          <td>
                            {ob.evidence.map((ev, i) => (
                              <span key={i} className="evidence-pill">
                                {ev.clause_id}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Unresolved References (if any) */}
            {report.unresolved_references && report.unresolved_references.length > 0 && (
              <section style={{ marginTop: '2.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fca5a5' }}>
                  Unresolved Clause & Schedule References
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1rem' }}>
                  Provisions in the supplied documents cite external sections or exhibits that were not located in either
                  text.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {report.unresolved_references.map((unres, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.9rem',
                      }}
                    >
                      Clause <strong>[{unres.referencing_clause_id}]</strong> references{' '}
                      <span style={{ color: '#f87171', fontWeight: 600 }}>"{unres.referenced_identifier}"</span> which
                      cannot be found in the supplied documents.
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Export & Action Footer */}
            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `legal-consistency-report-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                📥 Export JSON Report
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Mandatory Server-Controlled Legal Disclaimer Footer */}
      <footer className="footer-disclaimer" role="contentinfo">
        <div className="footer-inner">
          <p style={{ fontWeight: 600, marginBottom: '0.4rem', color: '#9ca3af' }}>
            LEGAL INFORMATION NOTICE & BOUNDARY
          </p>
          <p>
            {report?.disclaimer ||
              'This application is an informational cross-document consistency assessment workspace provided by an AI reasoning engine. It does not constitute legal advice, a legal opinion, or an assessment of enforceability. No attorney-client relationship is formed. All interpretations, potential considerations, and suggested questions should be reviewed by a qualified legal professional.'}
          </p>
        </div>
      </footer>
    </div>
  );
}
