"""Phase-E/RAG additions: page-context rendering, prompt v3 selection, and the
search_knowledge tool gate."""

from __future__ import annotations

import pytest

from src.schemas.assistant import AssistantChatRequest, PageContext, RagContext
from src.services.assistant_service import build_system_prompt, render_page_context
from src.services.assistant_tools import get_tool_names, get_tool_schemas


def _ctx() -> RagContext:
    return RagContext(
        completeness_pct=60,
        tier="STANDARD",
        top_matches=[],
        pending_requests=0,
        unread_messages=0,
        gaps=[],
        last_active_iso=None,
    )


class TestRenderPageContext:
    def test_none_renders_none(self) -> None:
        assert render_page_context(None) is None

    def test_entity_page(self) -> None:
        rendered = render_page_context(
            PageContext(pathname="/vendors/v1", entity_type="vendor", entity_id="v1")
        )
        assert rendered is not None
        assert "/vendors/v1" in rendered
        assert "vendor id: v1" in rendered

    def test_discover_filters(self) -> None:
        rendered = render_page_context(
            PageContext(
                pathname="/matches",
                entity_type="discover",
                filters={"city": "Bhopal", "age_min": "25"},
            )
        )
        assert rendered is not None
        assert "city=Bhopal" in rendered
        assert "age_min=25" in rendered


class TestSystemPromptV3:
    def test_default_prompt_is_v3_with_knowledge_rules(self) -> None:
        prompt = build_system_prompt(_ctx())
        assert "search_knowledge" in prompt
        assert "{{USER_CONTEXT}}" not in prompt
        assert "{{PAGE_CONTEXT}}" not in prompt
        assert "(not provided)" in prompt  # page-context placeholder filled

    def test_page_context_injected(self) -> None:
        prompt = build_system_prompt(_ctx(), "User is currently viewing: /vendors/v1")
        assert "User is currently viewing: /vendors/v1" in prompt

    def test_v2_rollback_via_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("ASSISTANT_PROMPT_VERSION", "v2")
        prompt = build_system_prompt(_ctx())
        assert "search_knowledge" not in prompt
        assert "{{USER_CONTEXT}}" not in prompt


class TestKnowledgeToolGate:
    def test_enabled_by_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("ASSISTANT_KNOWLEDGE_ENABLED", raising=False)
        assert "search_knowledge" in get_tool_names()

    def test_kill_switch(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("ASSISTANT_KNOWLEDGE_ENABLED", "false")
        assert "search_knowledge" not in get_tool_names()
        assert all(t["name"] != "search_knowledge" for t in get_tool_schemas())


class TestRequestSchema:
    def test_page_context_optional(self) -> None:
        req = AssistantChatRequest(
            user_id="u", profile_id="p", message="hi", context=_ctx()
        )
        assert req.page_context is None

    def test_page_context_accepted(self) -> None:
        req = AssistantChatRequest(
            user_id="u",
            profile_id="p",
            message="hi",
            context=_ctx(),
            page_context={"pathname": "/vendors/v1", "entity_type": "vendor", "entity_id": "v1"},
        )
        assert req.page_context is not None
        assert req.page_context.entity_type == "vendor"
