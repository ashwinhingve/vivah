"""
Smart Shaadi — Marketing Content Generation Tests (Unit 6.4)

Tests for the marketing content generation service:
- LLM-powered copy generation (en + hi)
- Redis caching
- Mock fallback
- JSON validation and retry logic
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.schemas.marketing import (
    GenerateMarketingRequest,
    GenerateMarketingResponse,
)
from src.services.marketing_service import (
    generate_campaign_content,
    _parse_marketing_response,
    _mock_content,
)


class TestMarketingParsing:
    """Test JSON parsing from LLM responses."""

    def test_parse_valid_response(self):
        """Parse valid marketing JSON response."""
        raw = json.dumps({
            "en": {
                "subjectLine": "Welcome!",
                "bodyShort": "Join us",
                "bodyLong": "Join Smart Shaadi",
                "ctaText": "Get Started",
            },
            "hi": {
                "subjectLine": "स्वागत है!",
                "bodyShort": "हमसे जुड़ें",
                "bodyLong": "स्मार्ट शादी से जुड़ें",
                "ctaText": "शुरुआत करें",
            },
            "modelVersion": "claude-sonnet-4-6",
        })

        result = _parse_marketing_response(raw)
        assert result is not None
        assert result.en.subjectLine == "Welcome!"
        assert result.hi.subjectLine == "स्वागत है!"
        assert result.modelVersion == "claude-sonnet-4-6"

    def test_parse_strips_markdown_fences(self):
        """Parse response with markdown JSON fences."""
        raw = """```json
{
  "en": {
    "subjectLine": "Test",
    "bodyShort": "Body",
    "bodyLong": "Long",
    "ctaText": "CTA"
  },
  "hi": {
    "subjectLine": "परीक्षण",
    "bodyShort": "बॉडी",
    "bodyLong": "लंबा",
    "ctaText": "सीटीए"
  },
  "modelVersion": "v1"
}
```"""

        result = _parse_marketing_response(raw)
        assert result is not None
        assert result.en.subjectLine == "Test"

    def test_parse_fails_on_missing_languages(self):
        """Parsing fails gracefully if en or hi is missing."""
        raw = json.dumps({
            "en": {
                "subjectLine": "Only EN",
                "bodyShort": "Body",
                "bodyLong": "Long",
                "ctaText": "CTA",
            },
            # Missing 'hi'
            "modelVersion": "v1",
        })

        result = _parse_marketing_response(raw)
        assert result is None

    def test_parse_fails_on_missing_fields(self):
        """Parsing fails if required fields are missing."""
        raw = json.dumps({
            "en": {
                "subjectLine": "Test",
                # Missing bodyShort, bodyLong, ctaText
            },
            "hi": {
                "subjectLine": "परीक्षण",
                "bodyShort": "बॉडी",
                "bodyLong": "लंबा",
                "ctaText": "सीटीए",
            },
            "modelVersion": "v1",
        })

        result = _parse_marketing_response(raw)
        assert result is None

    def test_parse_fails_on_invalid_json(self):
        """Parsing fails gracefully on invalid JSON."""
        raw = "{ this is not valid json }"
        result = _parse_marketing_response(raw)
        assert result is None


class TestMarketingMockContent:
    """Test mock content generation."""

    def test_mock_content_has_all_fields(self):
        """Mock content includes all required fields for en and hi."""
        mock = _mock_content()

        # English
        assert mock.en.subjectLine
        assert mock.en.bodyShort
        assert mock.en.bodyLong
        assert mock.en.ctaText

        # Hindi
        assert mock.hi.subjectLine
        assert mock.hi.bodyShort
        assert mock.hi.bodyLong
        assert mock.hi.ctaText

        # Model version
        assert mock.modelVersion == "mock-v1"

    def test_mock_content_has_devanagari(self):
        """Mock content includes real Devanagari Hindi, not transliteration."""
        mock = _mock_content()
        hi_text = f"{mock.hi.subjectLine}{mock.hi.bodyShort}"

        # Check for Devanagari script (U+0900 - U+097F)
        has_devanagari = any(0x0900 <= ord(c) <= 0x097F for c in hi_text)
        assert has_devanagari


class TestMarketingGeneration:
    """Test the main generation function with mocking."""

    @pytest.mark.asyncio
    async def test_generation_with_mock_mode(self):
        """In mock mode, generate_campaign_content returns mock instantly."""
        request = GenerateMarketingRequest(
            campaign_name="Test Campaign",
            segment_key="new_incomplete_48h",
            template_key="welcome_series",
        )

        result = await generate_campaign_content(request, use_mock=True)

        assert result.en.subjectLine
        assert result.hi.subjectLine
        assert result.modelVersion == "mock-v1"

    @pytest.mark.asyncio
    async def test_generation_with_llm_success(self):
        """Successful LLM call persists result to Redis and returns response."""
        request = GenerateMarketingRequest(
            campaign_name="Test Campaign",
            description="Test Description",
            segment_key="new_incomplete_48h",
            template_key="welcome_series",
            conversion_goal="PROFILE_COMPLETED",
        )

        mock_llm_response = {
            "en": {
                "subjectLine": "LLM Subject",
                "bodyShort": "LLM body",
                "bodyLong": "LLM long",
                "ctaText": "LLM CTA",
            },
            "hi": {
                "subjectLine": "एलएलएम विषय",
                "bodyShort": "एलएलएम शरीर",
                "bodyLong": "एलएलएम लंबा",
                "ctaText": "एलएलएम सीटीए",
            },
            "modelVersion": "claude-sonnet-4-6",
        }

        with patch('src.services.marketing_service._get_llm') as mock_get_llm, \
             patch('src.services.marketing_service._get_redis') as mock_get_redis:

            # Mock LLM client
            mock_llm = MagicMock()
            mock_llm.messages.create.return_value = MagicMock(
                content=[MagicMock(text=json.dumps(mock_llm_response))],
            )
            mock_get_llm.return_value = mock_llm

            # Mock Redis (async)
            mock_redis = AsyncMock()
            mock_redis.get.return_value = None
            mock_redis.setex = AsyncMock()
            mock_get_redis.return_value = mock_redis

            result = await generate_campaign_content(request, use_mock=False)

            # Verify result
            assert result.en.subjectLine == "LLM Subject"
            assert result.hi.subjectLine == "एलएलएम विषय"
            assert result.modelVersion == "claude-sonnet-4-6"

            # Verify Redis cache was written
            mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_generation_cache_hit(self):
        """Cached response is returned without calling LLM."""
        request = GenerateMarketingRequest(
            campaign_name="Cached Campaign",
            segment_key="inactive_14d",
            template_key="winback_inactive",
        )

        cached_response = {
            "en": {
                "subjectLine": "Cached Subject",
                "bodyShort": "Cached body",
                "bodyLong": "Cached long",
                "ctaText": "Cached CTA",
            },
            "hi": {
                "subjectLine": "कैश किया गया विषय",
                "bodyShort": "कैश किया गया शरीर",
                "bodyLong": "कैश किया गया लंबा",
                "ctaText": "कैश किया गया सीटीए",
            },
            "modelVersion": "claude-sonnet-4-6",
        }

        with patch('src.services.marketing_service._get_redis') as mock_get_redis:
            mock_redis = AsyncMock()
            mock_redis.get.return_value = json.dumps(cached_response)
            mock_get_redis.return_value = mock_redis

            result = await generate_campaign_content(request, use_mock=False)

            # Should return cached data
            assert result.en.subjectLine == "Cached Subject"
            assert result.hi.subjectLine == "कैश किया गया विषय"

    @pytest.mark.asyncio
    async def test_generation_llm_parse_retry(self):
        """On first parse failure, retries LLM once; succeeds on second attempt."""
        request = GenerateMarketingRequest(
            campaign_name="Retry Campaign",
            segment_key="high_intent_7d",
            template_key="seasonal_muhurat",
        )

        valid_response = {
            "en": {
                "subjectLine": "Valid Subject",
                "bodyShort": "Valid body",
                "bodyLong": "Valid long",
                "ctaText": "Valid CTA",
            },
            "hi": {
                "subjectLine": "मान्य विषय",
                "bodyShort": "मान्य शरीर",
                "bodyLong": "मान्य लंबा",
                "ctaText": "मान्य सीटीए",
            },
            "modelVersion": "claude-sonnet-4-6",
        }

        with patch('src.services.marketing_service._get_llm') as mock_get_llm, \
             patch('src.services.marketing_service._get_redis') as mock_get_redis:

            mock_llm = MagicMock()
            # First call returns malformed JSON, second returns valid
            mock_llm.messages.create.side_effect = [
                MagicMock(content=[MagicMock(text='{ invalid json }')]),
                MagicMock(content=[MagicMock(text=json.dumps(valid_response))]),
            ]
            mock_get_llm.return_value = mock_llm

            mock_redis = AsyncMock()
            mock_redis.get.return_value = None
            mock_get_redis.return_value = mock_redis

            result = await generate_campaign_content(request, use_mock=False)

            # Should eventually succeed after retry
            assert result.en.subjectLine == "Valid Subject"
            assert mock_llm.messages.create.call_count == 2  # Retried once

    @pytest.mark.asyncio
    async def test_generation_llm_persistent_failure(self):
        """When LLM fails both attempts, raises exception (502 to caller)."""
        request = GenerateMarketingRequest(
            campaign_name="Fail Campaign",
            segment_key="vendors_new_7d",
            template_key="vendor_onboarding",
        )

        with patch('src.services.marketing_service._get_llm') as mock_get_llm, \
             patch('src.services.marketing_service._get_redis') as mock_get_redis:

            mock_llm = MagicMock()
            # Both attempts return unparseable output
            mock_llm.messages.create.side_effect = [
                MagicMock(content=[MagicMock(text='{ broken }')]),
                MagicMock(content=[MagicMock(text='[ also broken ]')]),
            ]
            mock_get_llm.return_value = mock_llm

            mock_redis = AsyncMock()
            mock_redis.get.return_value = None
            mock_get_redis.return_value = mock_redis

            with pytest.raises(ValueError, match="Failed to parse"):
                await generate_campaign_content(request, use_mock=False)
