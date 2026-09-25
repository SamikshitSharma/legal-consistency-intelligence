/**
 * Implementation-security requirements:
 * 1. No raw document bodies in ordinary logs.
 * 2. No full AI request/response bodies in ordinary logs.
 * 3. Never expose internal stack traces or API keys to client.
 */

export function sanitizeLogMessage(message: string): string {
  return message
    .replace(/([?&]key=)[^&\s"'`]+/gi, '$1[REDACTED_API_KEY]')
    .replace(/AIza[0-9A-Za-z-_]+/g, '[REDACTED_API_KEY]')
    .replace(/(?:bearer\s+)[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/("?(?:text|raw_text|content)"?\s*:\s*")[^"]{100,}(")/g, '$1[DOCUMENT_CONTENT_REDACTED]$2');
}

export function safeLog(level: 'info' | 'warn' | 'error', context: string, details?: any): void {
  const timestamp = new Date().toISOString();
  let detailStr = '';
  if (details) {
    try {
      if (typeof details === 'string') {
        detailStr = sanitizeLogMessage(details);
      } else {
        detailStr = sanitizeLogMessage(JSON.stringify(details));
      }
    } catch {
      detailStr = '[Unserializable details]';
    }
  }
  const output = `[${timestamp}] [${level.toUpperCase()}] [${context}] ${detailStr}`;
  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}
