"""
Unit tests for Sentry event redaction.
"""

import pytest
from src.lib.sentry_redactor import redact_sentry_event, redact_value


def test_redact_phone_in_message():
    """Test redaction of Indian phone numbers in event message."""
    event = {
        'message': 'User called with phone +919876543210',
    }
    result = redact_sentry_event(event, {})
    assert result['message'] == 'User called with phone [redacted-phone]'


def test_redact_bare_phone():
    """Test redaction of bare 10-digit Indian phone numbers."""
    event = {
        'message': 'Phone: 9876543210 is invalid',
    }
    result = redact_sentry_event(event, {})
    assert result['message'] == 'Phone: [redacted-phone] is invalid'


def test_redact_email_in_message():
    """Test redaction of email addresses."""
    event = {
        'message': 'Error from user ashwin.hingave123@gmail.com',
    }
    result = redact_sentry_event(event, {})
    assert result['message'] == 'Error from user [redacted-email]'


def test_redact_phone_in_exception():
    """Test redaction of phone in exception value."""
    event = {
        'exception': {
            'values': [
                {
                    'value': 'Duplicate key error: phone +919876543210 already exists',
                },
            ],
        },
    }
    result = redact_sentry_event(event, {})
    assert result['exception']['values'][0]['value'] == 'Duplicate key error: phone [redacted-phone] already exists'


def test_redact_email_in_breadcrumb():
    """Test redaction of email in breadcrumb message."""
    event = {
        'breadcrumbs': [
            {
                'message': 'User login for ashwin.hingave123@gmail.com',
                'level': 'info',
            },
        ],
    }
    result = redact_sentry_event(event, {})
    assert result['breadcrumbs'][0]['message'] == 'User login for [redacted-email]'


def test_redact_nested_objects():
    """Test recursive redaction in nested structures."""
    event = {
        'extra': {
            'userData': {
                'email': 'test@example.com',
                'nested': {
                    'phone': '9876543210',
                },
            },
        },
    }
    result = redact_sentry_event(event, {})
    assert result['extra']['userData']['email'] == '[redacted-email]'
    assert result['extra']['userData']['nested']['phone'] == '[redacted-phone]'


def test_redact_value_passes_through_no_pii():
    """Test that strings with no PII pass through unchanged."""
    value = 'This is a normal string with no sensitive data'
    result = redact_value(value)
    assert result == 'This is a normal string with no sensitive data'


def test_redact_value_handles_arrays():
    """Test redaction of arrays."""
    value = [
        'Contact: +919876543210',
        'Email: test@example.com',
        'Name: John',
    ]
    result = redact_value(value)
    assert result[0] == 'Contact: [redacted-phone]'
    assert result[1] == 'Email: [redacted-email]'
    assert result[2] == 'Name: John'


def test_redact_value_handles_dicts():
    """Test redaction of dictionaries."""
    value = {
        'phone': '+919876543210',
        'email': 'test@example.com',
        'name': 'John',
    }
    result = redact_value(value)
    assert result['phone'] == '[redacted-phone]'
    assert result['email'] == '[redacted-email]'
    assert result['name'] == 'John'


def test_redact_event_with_none_message():
    """Test that None message doesn't cause errors."""
    event = {
        'message': None,
    }
    result = redact_sentry_event(event, {})
    assert result['message'] is None


def test_multiple_phones_and_emails():
    """Test redaction of multiple PII in one string."""
    event = {
        'message': 'Phones: +919876543210 and 8765432109, emails: a@b.com and c@d.co.uk',
    }
    result = redact_sentry_event(event, {})
    assert result['message'] == 'Phones: [redacted-phone] and [redacted-phone], emails: [redacted-email] and [redacted-email]'


def test_request_redaction():
    """Test redaction in request context."""
    event = {
        'request': {
            'url': 'https://api.example.com/search',
            'query_string': 'phone=+919876543210&email=test@example.com',
        },
    }
    result = redact_sentry_event(event, {})
    assert '[redacted-phone]' in result['request']['query_string']
    assert '[redacted-email]' in result['request']['query_string']
