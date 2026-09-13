from __future__ import annotations

import json
from pathlib import Path

from spendor_advisor.catalog import CatalogTool
from spendor_advisor.models import ListenerIntent

CASES = json.loads((Path(__file__).parent / "golden_queries.json").read_text(encoding="utf-8"))


def evaluate() -> dict:
    tool = CatalogTool(api_url="http://127.0.0.1:1")
    hits = 0
    constraints = 0
    results = []
    for case in CASES:
        intent = ListenerIntent.model_validate({
            "room_size": case.get("room"), "product_type": case.get("category"), "series": case.get("series"),
        })
        products, mode = tool.search(case["query"], intent, limit=5)
        ids = [product.id for product in products]
        matched = bool(set(ids) & set(case["expected_ids"]))
        valid = all(
            (not case.get("room") or case["room"] in product.room_sizes)
            and (not case.get("category") or case["category"] == product.category)
            and (not case.get("series") or case["series"] == product.series)
            for product in products
        )
        hits += matched
        constraints += valid
        results.append({"query": case["query"], "matched": matched, "constraints_preserved": valid, "mode": mode, "returned_ids": ids})
    return {"cases": len(CASES), "recall_at_5": hits / len(CASES), "constraint_pass_rate": constraints / len(CASES), "results": results}


if __name__ == "__main__":
    print(json.dumps(evaluate(), indent=2))
