from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator


class RoomSize(str, Enum):
    small = "Small"
    medium = "Medium"
    large = "Large"


class ProductType(str, Enum):
    stand_mount = "Stand-mount"
    floorstanding = "Floorstanding"
    centre = "Centre"
    wall_mount = "Wall-mount"


class ListenerIntent(BaseModel):
    """Validated model output. No tool is called until this schema is valid."""

    room_size: RoomSize | None = None
    product_type: ProductType | None = None
    series: Literal["A-Line", "D-Line", "Classic"] | None = None
    priorities: list[str] = Field(default_factory=list, max_length=5)
    needs_human_help: bool = False
    missing_information: list[str] = Field(default_factory=list, max_length=3)

    @field_validator("priorities")
    @classmethod
    def normalize_priorities(cls, value: list[str]) -> list[str]:
        return [item.strip().lower() for item in value if item.strip()]


class ProductEvidence(BaseModel):
    id: str
    model: str
    series: str
    category: str
    room_sizes: list[str]
    frequency_response: str
    amplifier_power: str
    summary: str
    specification_pdf: HttpUrl
    retrieval_score: float = 0
    reasons: list[str] = Field(default_factory=list)


class Handoff(BaseModel):
    required: bool = False
    reason: str | None = None


class AdviceResponse(BaseModel):
    request_id: str
    answer: str
    products: list[ProductEvidence] = Field(default_factory=list, max_length=3)
    intent: ListenerIntent
    retrieval_mode: str
    route: str
    cache_hit: bool
    latency_ms: int
    estimated_input_tokens: int
    handoff: Handoff = Field(default_factory=Handoff)
    trace_id: str
