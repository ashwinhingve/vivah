"""
Hindi <-> English translation schemas.

Pydantic models matching the contract the Node API sends from
apps/api/src/chat/router.ts: `{ text, target }` -> `{ translated }`.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

TranslateTarget = Literal["hi", "en"]


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    target: TranslateTarget


class TranslateResponse(BaseModel):
    translated: str
    model: str
    target: TranslateTarget
