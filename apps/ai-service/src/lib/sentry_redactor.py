"""
Redaction utility for Sentry before_send hook in FastAPI.
Scrubs Indian phone numbers and email addresses from error events.

Patterns:
- Indian phone: +91-10 digits starting 6-9, or bare 10 digits starting 6-9
- Email: standard RFC-ish pattern
"""

import re
from typing import Any

# Patterns for PII detection
PHONE_PATTERN = re.compile(r'(\+91\s?)?[6-9]\d{9}')
EMAIL_PATTERN = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')


def redact_value(value: Any) -> Any:
    """
    Recursively redact PII from any value (string, dict, list).
    """
    if isinstance(value, str):
        value = PHONE_PATTERN.sub('[redacted-phone]', value)
        value = EMAIL_PATTERN.sub('[redacted-email]', value)
        return value
    elif isinstance(value, dict):
        redacted = {}
        for k, v in value.items():
            redacted[k] = redact_value(v)
        return redacted
    elif isinstance(value, list):
        return [redact_value(item) for item in value]
    else:
        return value


def redact_sentry_event(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any]:
    """
    Redact PII from a Sentry event.
    Scrubs: message, exception values, breadcrumb messages, request data, extra/contexts.

    This is designed to be passed as the before_send callback to sentry_sdk.init().
    """
    if not event:
        return event

    # Redact top-level message
    if isinstance(event.get('message'), str):
        event['message'] = PHONE_PATTERN.sub('[redacted-phone]', event['message'])
        event['message'] = EMAIL_PATTERN.sub('[redacted-email]', event['message'])

    # Redact exception values
    if 'exception' in event and isinstance(event['exception'], dict):
        exc = event['exception']
        if 'values' in exc and isinstance(exc['values'], list):
            for ex_val in exc['values']:
                if isinstance(ex_val, dict) and isinstance(ex_val.get('value'), str):
                    ex_val['value'] = PHONE_PATTERN.sub('[redacted-phone]', ex_val['value'])
                    ex_val['value'] = EMAIL_PATTERN.sub('[redacted-email]', ex_val['value'])

    # Redact breadcrumbs
    if 'breadcrumbs' in event and isinstance(event['breadcrumbs'], list):
        for bc in event['breadcrumbs']:
            if isinstance(bc, dict):
                if isinstance(bc.get('message'), str):
                    bc['message'] = PHONE_PATTERN.sub('[redacted-phone]', bc['message'])
                    bc['message'] = EMAIL_PATTERN.sub('[redacted-email]', bc['message'])
                if isinstance(bc.get('data'), dict):
                    bc['data'] = redact_value(bc['data'])

    # Redact request (query, data, url, etc.)
    if 'request' in event and isinstance(event['request'], dict):
        event['request'] = redact_value(event['request'])

    # Redact extra context
    if 'extra' in event and isinstance(event['extra'], dict):
        event['extra'] = redact_value(event['extra'])

    # Redact contexts
    if 'contexts' in event and isinstance(event['contexts'], dict):
        event['contexts'] = redact_value(event['contexts'])

    return event
