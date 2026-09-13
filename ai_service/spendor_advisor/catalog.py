from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

from .models import ListenerIntent, ProductEvidence

ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = ROOT / "server" / "data" / "catalog.json"


class CatalogTool:
    """The only path from agent state to catalog data; suitable for MCP exposure."""

    def __init__(self, api_url: str | None = None) -> None:
        self.api_url = api_url or os.getenv("CATALOG_API_URL", "http://localhost:8787/api/products")
        self.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def search(self, question: str, intent: ListenerIntent, limit: int = 8) -> tuple[list[ProductEvidence], str]:
        params = {"q": question, "limit": str(limit)}
        if intent.room_size:
            params["room"] = intent.room_size.value
        if intent.product_type:
            params["category"] = intent.product_type.value
        if intent.series:
            params["series"] = intent.series
        try:
            response = httpx.get(self.api_url, params=params, timeout=2.5)
            response.raise_for_status()
            payload = response.json()
            return [self._evidence(product) for product in payload["data"]], payload["meta"]["retrievalMode"]
        except (httpx.HTTPError, KeyError, ValueError):
            # Deterministic local fallback keeps the workflow available during an API outage.
            terms = {term.lower() for term in question.replace(",", " ").split() if len(term) > 2}
            candidates = [product for product in self.catalog if self._matches_constraints(product, intent)]
            candidates.sort(key=lambda product: self._keyword_score(product, terms), reverse=True)
            return [self._evidence(product, self._keyword_score(product, terms)) for product in candidates[:limit]], "local deterministic fallback"

    def get_product(self, product_id: str) -> ProductEvidence | None:
        product = next((item for item in self.catalog if item["id"] == product_id), None)
        return self._evidence(product) if product else None

    @staticmethod
    def _matches_constraints(product: dict, intent: ListenerIntent) -> bool:
        return (
            (not intent.room_size or intent.room_size.value in product["roomSizes"])
            and (not intent.product_type or intent.product_type.value == product["category"])
            and (not intent.series or intent.series == product["series"])
        )

    @staticmethod
    def _keyword_score(product: dict, terms: set[str]) -> float:
        haystack = " ".join(str(value) for value in product.values()).lower()
        return sum(term in haystack for term in terms) / max(len(terms), 1)

    @staticmethod
    def _evidence(product: dict, score: float | None = None) -> ProductEvidence:
        retrieval = product.get("retrieval", {})
        return ProductEvidence(
            id=product["id"], model=product["model"], series=product["series"], category=product["category"],
            room_sizes=product["roomSizes"], frequency_response=product["frequencyResponse"],
            amplifier_power=product["amplifierPower"], summary=product["summary"], specification_pdf=product["specPdfUrl"],
            retrieval_score=score if score is not None else retrieval.get("score", 0), reasons=retrieval.get("reasons", []),
        )
