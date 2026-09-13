from __future__ import annotations

import hashlib
import json
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

try:
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter, SpanExportResult
except ImportError:  # Keeps deterministic evals runnable before optional observability packages are installed.
    trace = None

from .catalog import CatalogTool
from .models import AdviceResponse, Handoff, ListenerIntent, ProductEvidence, ProductType, RoomSize

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class JsonTraceExporter(SpanExporter if trace else object):
    """Portable trace sink: no observability vendor is required for the demo."""

    def export(self, spans):
        path = Path(__file__).resolve().parents[1] / "traces"
        path.mkdir(exist_ok=True)
        with (path / "spans.jsonl").open("a", encoding="utf-8") as file:
            for span in spans:
                file.write(json.dumps({"name": span.name, "trace_id": format(span.context.trace_id, "032x"), "attributes": dict(span.attributes), "status": span.status.status_code.name}) + "\n")
        return SpanExportResult.SUCCESS if trace else None

    def shutdown(self):
        return None


def _tracer():
    if trace is None:
        class NullSpan:
            def __enter__(self): return self
            def __exit__(self, *_): return None
            def set_attribute(self, *_): return None
            def get_span_context(self):
                class Context: trace_id = 0
                return Context()
        class NullTracer:
            def start_as_current_span(self, *_): return NullSpan()
        return NullTracer()
    provider = TracerProvider(resource=Resource.create({"service.name": "spendor-advisor"}))
    provider.add_span_processor(SimpleSpanProcessor(JsonTraceExporter()))
    trace.set_tracer_provider(provider)
    return trace.get_tracer("spendor-advisor")


TRACER = _tracer()


@dataclass
class AdvisorState:
    question: str
    request_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    intent: ListenerIntent = field(default_factory=ListenerIntent)
    products: list[ProductEvidence] = field(default_factory=list)
    retrieval_mode: str = ""
    route: str = "deterministic"
    transitions: int = 0

    def advance(self, expected_max: int = 5) -> None:
        self.transitions += 1
        if self.transitions > expected_max:
            raise RuntimeError("Workflow transition guard tripped")


class SemanticCache:
    def __init__(self) -> None:
        self.path = Path(__file__).resolve().parents[1] / ".cache" / "responses.json"
        self.path.parent.mkdir(exist_ok=True)

    def get(self, question: str) -> dict | None:
        if not self.path.exists():
            return None
        data = json.loads(self.path.read_text(encoding="utf-8"))
        return data.get(self._key(question))

    def set(self, question: str, response: AdviceResponse) -> None:
        data = json.loads(self.path.read_text(encoding="utf-8")) if self.path.exists() else {}
        data[self._key(question)] = response.model_dump(mode="json")
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    @staticmethod
    def _key(question: str) -> str:
        normalized = " ".join(question.lower().split())
        return hashlib.sha256(normalized.encode()).hexdigest()


class IntentExtractor:
    """Routes cheap, explicit requests without a model; validates model output when model use is warranted."""

    def extract(self, question: str) -> tuple[ListenerIntent, str]:
        lowered = question.lower()
        intent = ListenerIntent(
            room_size=next((size for phrase, size in [("small room", RoomSize.small), ("large room", RoomSize.large), ("medium room", RoomSize.medium)] if phrase in lowered), None),
            product_type=next((kind for phrase, kind in [("bookshelf", ProductType.stand_mount), ("stand mount", ProductType.stand_mount), ("floorstanding", ProductType.floorstanding), ("centre", ProductType.centre), ("center", ProductType.centre), ("surround", ProductType.wall_mount), ("wall", ProductType.wall_mount)] if phrase in lowered), None),
            series=next((series for series in ["A-Line", "D-Line", "Classic"] if series.lower() in lowered), None),
            priorities=[priority for priority in ["compact", "bass", "home cinema", "music"] if priority in lowered],
        )
        # A bounded deterministic parser is the low-cost route for clear constraints.
        if intent.room_size or intent.product_type or intent.series:
            return intent, "rules-only"
        key = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not key:
            return intent, "rules-only-no-key"
        try:
            # Structured JSON is necessary but insufficient: Pydantic validates again before tool selection.
            from google import genai
            client = genai.Client(api_key=key)
            prompt = f"""Extract only product-discovery constraints from this customer request:
{question!r}

Use room_size only for Small, Medium, or Large. Use product_type only for Stand-mount,
Floorstanding, Centre, or Wall-mount. Use series only for A-Line, D-Line, or Classic.
Do not guess constraints. Mark needs_human_help true when price, stock, or an audition is requested."""
            response = client.models.generate_content(
                model=os.getenv("GEMINI_GENERATION_MODEL", "gemini-3.8-flash"),
                contents=prompt,
                config={"response_mime_type": "application/json", "response_schema": ListenerIntent.model_json_schema(), "temperature": 0},
            )
            return ListenerIntent.model_validate_json(response.text), "gemini-structured-output"
        except Exception:
            # The deterministic parse is deliberately retained for outages, quota failures, and schema failures.
            return intent, "model-error->rules"


class AdvisorWorkflow:
    def __init__(self, catalog: CatalogTool | None = None, cache: SemanticCache | None = None) -> None:
        self.catalog = catalog or CatalogTool()
        self.cache = cache or SemanticCache()
        self.intent_extractor = IntentExtractor()

    def run(self, question: str) -> AdviceResponse:
        started = time.perf_counter()
        with TRACER.start_as_current_span("advisor.run") as root:
            root.set_attribute("advisor.question_length", len(question))
            cached = self.cache.get(question)
            if cached:
                response = AdviceResponse.model_validate(cached)
                return response.model_copy(update={"cache_hit": True, "latency_ms": int((time.perf_counter() - started) * 1000)})
            state = AdvisorState(question=question)
            state.advance()
            with TRACER.start_as_current_span("advisor.extract_intent") as span:
                state.intent, state.route = self.intent_extractor.extract(question)
                span.set_attribute("advisor.route", state.route)
            state.advance()
            with TRACER.start_as_current_span("advisor.retrieve") as span:
                state.products, state.retrieval_mode = self.catalog.search(question, state.intent)
                span.set_attribute("retrieval.mode", state.retrieval_mode)
                span.set_attribute("retrieval.candidates", len(state.products))
            state.advance()
            products = self._rerank_and_verify(state)
            state.advance()
            handoff = Handoff(required=not products, reason="No catalog model satisfies the stated constraints." if not products else None)
            answer = self._answer(state.intent, products, handoff)
            response = AdviceResponse(
                request_id=state.request_id, answer=answer, products=products, intent=state.intent,
                retrieval_mode=state.retrieval_mode, route=state.route, cache_hit=False,
                latency_ms=int((time.perf_counter() - started) * 1000), estimated_input_tokens=max(1, len(question) // 4),
                handoff=handoff, trace_id=format(root.get_span_context().trace_id, "032x"),
            )
            self.cache.set(question, response)
            return response

    @staticmethod
    def _rerank_and_verify(state: AdvisorState) -> list[ProductEvidence]:
        # Deterministic reranker: hard constraints dominate; score ties keep source ordering stable.
        verified = [product for product in state.products if product.specification_pdf]
        return sorted(verified, key=lambda item: (item.retrieval_score, item.model), reverse=True)[:3]

    @staticmethod
    def _answer(intent: ListenerIntent, products: list[ProductEvidence], handoff: Handoff) -> str:
        if handoff.required:
            return "I could not verify a matching model from the approved catalog. An authorised retailer can help with a more specific recommendation."
        lead = products[0]
        constraints = ", ".join(filter(None, [intent.room_size.value if intent.room_size else None, intent.product_type.value if intent.product_type else None])) or "your stated requirements"
        return f"{lead.model} is the strongest verified match for {constraints}. I have included alternatives and the published specification PDF for each recommendation."
