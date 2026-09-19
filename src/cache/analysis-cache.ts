import crypto from 'crypto';
import { ValidatedAnalysisReport } from '../types/contract';

export interface CacheKeyParams {
  docAHash: string;
  docBHash: string;
  focusQuestion?: string;
  modelIdentifier: string;
  promptVersion: string;
  schemaVersion: string;
  pipelineVersion: string;
  /**
   * User, session, or tenant identifier to prevent cross-user legal document data leakage
   */
  userOrSessionId?: string;
}

export function generateAnalysisCacheKey(params: CacheKeyParams): string {
  const normalizedQuestion = (params.focusQuestion || '').trim().toLowerCase();
  
  // Canonical hashing using length-prefixed parts to eliminate delimiter collision or key injection
  const h = crypto.createHash('sha256');
  h.update(`user:${params.userOrSessionId || 'default-session'}\n`);
  h.update(`docA:${params.docAHash}\n`);
  h.update(`docB:${params.docBHash}\n`);
  h.update(`q:${normalizedQuestion}\n`);
  h.update(`model:${params.modelIdentifier}\n`);
  h.update(`prompt:${params.promptVersion}\n`);
  h.update(`schema:${params.schemaVersion}\n`);
  h.update(`pipeline:${params.pipelineVersion}\n`);

  return h.digest('hex');
}

export class AnalysisCache {
  private cache = new Map<string, { report: ValidatedAnalysisReport; timestamp: number }>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries: number = 100, ttlMs: number = 24 * 60 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: string): ValidatedAnalysisReport | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Return a clone with cache_hit = true
    const cloned = JSON.parse(JSON.stringify(entry.report)) as ValidatedAnalysisReport;
    cloned.analysis_metadata.cache_hit = true;
    return cloned;
  }

  set(key: string, report: ValidatedAnalysisReport): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { report, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const globalAnalysisCache = new AnalysisCache();
