/**
 * Redaction utility for Sentry beforeSend hook in Express API.
 * Scrubs Indian phone numbers and email addresses from error events.
 *
 * Patterns:
 * - Indian phone: +91-10 digits starting 6-9, or bare 10 digits starting 6-9
 * - Email: standard RFC-ish pattern
 */

const PHONE_PATTERN = /(\+91\s?)?[6-9]\d{9}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Recursively redact PII from any value (string, object, array).
 */
function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(PHONE_PATTERN, '[redacted-phone]')
      .replace(EMAIL_PATTERN, '[redacted-email]');
  }
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map(redactValue);
    }
    const obj = value as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      redacted[k] = redactValue(v);
    }
    return redacted;
  }
  return value;
}

/**
 * Redact PII from a Sentry event.
 * Scrubs: message, exception values, breadcrumb messages, request data, extra/contexts.
 */
export function redactSentryEvent(event: Record<string, unknown>): Record<string, unknown> {
  const redacted = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;

  // Redact top-level message
  if (typeof redacted.message === 'string') {
    redacted.message = redacted.message
      .replace(PHONE_PATTERN, '[redacted-phone]')
      .replace(EMAIL_PATTERN, '[redacted-email]');
  }

  // Redact exception values
  if (redacted.exception && typeof redacted.exception === 'object') {
    const exc = redacted.exception as Record<string, unknown>;
    if (Array.isArray(exc.values)) {
      exc.values = (exc.values as Array<Record<string, unknown>>).map((exVal) => {
        if (exVal.value && typeof exVal.value === 'string') {
          exVal.value = exVal.value
            .replace(PHONE_PATTERN, '[redacted-phone]')
            .replace(EMAIL_PATTERN, '[redacted-email]');
        }
        return exVal;
      });
    }
  }

  // Redact breadcrumbs
  if (redacted.breadcrumbs && Array.isArray(redacted.breadcrumbs)) {
    redacted.breadcrumbs = (redacted.breadcrumbs as Array<Record<string, unknown>>).map((bc) => {
      if (bc.message && typeof bc.message === 'string') {
        bc.message = bc.message
          .replace(PHONE_PATTERN, '[redacted-phone]')
          .replace(EMAIL_PATTERN, '[redacted-email]');
      }
      if (bc.data && typeof bc.data === 'object') {
        bc.data = redactValue(bc.data);
      }
      return bc;
    });
  }

  // Redact request (query, data, url, etc.)
  if (redacted.request && typeof redacted.request === 'object') {
    redacted.request = redactValue(redacted.request);
  }

  // Redact extra context
  if (redacted.extra && typeof redacted.extra === 'object') {
    redacted.extra = redactValue(redacted.extra);
  }

  // Redact contexts
  if (redacted.contexts && typeof redacted.contexts === 'object') {
    redacted.contexts = redactValue(redacted.contexts);
  }

  return redacted;
}
