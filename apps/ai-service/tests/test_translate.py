"""
Tests for the Hindi/English translation router.

Uses a fake pipeline injected via _set_pipeline_for_testing() so no model
download is needed at CI time.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.main import app
from src.schemas.translate import TranslateRequest, TranslateResponse
from src.services import translate_service


HEADERS = {"X-Internal-Key": "dev-internal-key-change-in-prod"}


@pytest.fixture(autouse=True)
def _reset_pipelines():
    translate_service._reset_pipelines_for_testing()
    yield
    translate_service._reset_pipelines_for_testing()


@pytest.fixture
def fake_hi():
    def pipe(text: str):
        return [{"translation_text": f"hi::{text}"}]
    return pipe


@pytest.fixture
def fake_en():
    def pipe(text: str):
        return [{"translation_text": f"en::{text}"}]
    return pipe


def test_request_schema_rejects_empty_text():
    with pytest.raises(ValidationError):
        TranslateRequest(text="", target="hi")


def test_request_schema_rejects_too_long_text():
    with pytest.raises(ValidationError):
        TranslateRequest(text="x" * 2001, target="hi")


def test_request_schema_rejects_unknown_target():
    with pytest.raises(ValidationError):
        TranslateRequest(text="hello", target="fr")  # type: ignore[arg-type]


async def test_service_translates_en_to_hi(fake_hi):
    translate_service._set_pipeline_for_testing("hi", fake_hi)
    out = await translate_service.translate(TranslateRequest(text="hello", target="hi"))
    assert isinstance(out, TranslateResponse)
    assert out.translated == "hi::hello"
    assert out.target == "hi"
    assert out.model == "Helsinki-NLP/opus-mt-en-hi"


async def test_service_translates_hi_to_en(fake_en):
    translate_service._set_pipeline_for_testing("en", fake_en)
    out = await translate_service.translate(TranslateRequest(text="नमस्ते", target="en"))
    assert out.translated == "en::नमस्ते"
    assert out.target == "en"
    assert out.model == "Helsinki-NLP/opus-mt-hi-en"


async def test_service_falls_back_to_input_on_empty_pipeline_output():
    def empty_pipe(_text: str):
        return []
    translate_service._set_pipeline_for_testing("hi", empty_pipe)
    out = await translate_service.translate(TranslateRequest(text="hello", target="hi"))
    assert out.translated == "hello"


def test_router_returns_403_without_internal_key(fake_hi):
    translate_service._set_pipeline_for_testing("hi", fake_hi)
    client = TestClient(app)
    resp = client.post("/ai/translate", json={"text": "hello", "target": "hi"})
    assert resp.status_code in (401, 403)


def test_router_translates_with_internal_key(fake_hi):
    translate_service._set_pipeline_for_testing("hi", fake_hi)
    client = TestClient(app)
    resp = client.post(
        "/ai/translate",
        headers=HEADERS,
        json={"text": "hello", "target": "hi"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["translated"] == "hi::hello"
    assert body["target"] == "hi"
    assert body["model"] == "Helsinki-NLP/opus-mt-en-hi"
