import { describe, it, expect } from 'vitest';
import { redactSentryEvent } from './sentry-redactor';

describe('redactSentryEvent (API)', () => {
  it('should redact Indian phone numbers in message', () => {
    const event = {
      message: 'User called with phone +919876543210',
    };
    const result = redactSentryEvent(event);
    expect(result.message).toBe('User called with phone [redacted-phone]');
  });

  it('should redact bare 10-digit Indian phone numbers', () => {
    const event = {
      message: 'Phone: 9876543210 is invalid',
    };
    const result = redactSentryEvent(event);
    expect(result.message).toBe('Phone: [redacted-phone] is invalid');
  });

  it('should redact email addresses in message', () => {
    const event = {
      message: 'Error from user ashwin.hingave123@gmail.com',
    };
    const result = redactSentryEvent(event);
    expect(result.message).toBe('Error from user [redacted-email]');
  });

  it('should redact phone in exception value', () => {
    const event = {
      exception: {
        values: [
          {
            value: 'Duplicate key error: phone +919876543210 already exists',
          },
        ],
      },
    };
    const result = redactSentryEvent(event);
    const excVal = (result.exception as Record<string, unknown>).values as Array<Record<string, unknown>>;
    const firstVal = excVal[0];
    expect(firstVal?.value).toBe('Duplicate key error: phone [redacted-phone] already exists');
  });

  it('should redact email in breadcrumb message', () => {
    const event = {
      breadcrumbs: [
        {
          message: 'User login for ashwin.hingave123@gmail.com',
          level: 'info',
        },
      ],
    };
    const result = redactSentryEvent(event);
    const bcs = result.breadcrumbs as Array<Record<string, unknown>>;
    const bc = bcs[0];
    expect(bc?.message).toBe('User login for [redacted-email]');
  });

  it('should redact nested objects in extra', () => {
    const event = {
      extra: {
        userData: {
          email: 'test@example.com',
          nested: {
            phone: '9876543210',
          },
        },
      },
    };
    const result = redactSentryEvent(event);
    const extra = result.extra as Record<string, unknown>;
    const userData = extra.userData as Record<string, unknown>;
    const nested = userData.nested as Record<string, unknown>;
    expect(userData.email).toBe('[redacted-email]');
    expect(nested.phone).toBe('[redacted-phone]');
  });

  it('should pass through strings with no PII unchanged', () => {
    const event = {
      message: 'This is a normal error with no sensitive data',
    };
    const result = redactSentryEvent(event);
    expect(result.message).toBe('This is a normal error with no sensitive data');
  });

  it('should handle multiple phones and emails in one string', () => {
    const event = {
      message: 'Phones: +919876543210 and 8765432109, emails: a@b.com and c@d.co.uk',
    };
    const result = redactSentryEvent(event);
    expect(result.message).toBe('Phones: [redacted-phone] and [redacted-phone], emails: [redacted-email] and [redacted-email]');
  });
});
