from spendor_advisor.catalog import CatalogTool
from spendor_advisor.models import ListenerIntent, RoomSize
from spendor_advisor.workflow import AdvisorWorkflow, SemanticCache


def test_small_room_request_keeps_hard_constraint(tmp_path):
    workflow = AdvisorWorkflow(catalog=CatalogTool(api_url="http://127.0.0.1:1"), cache=SemanticCache())
    workflow.cache.path = tmp_path / "cache.json"
    response = workflow.run("I need a compact speaker for a small room")
    assert response.products
    assert all("Small" in product.room_sizes for product in response.products)
    assert response.route == "rules-only"


def test_schema_rejects_invalid_room_size():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        ListenerIntent(room_size="stadium")


def test_same_question_uses_cache(tmp_path):
    workflow = AdvisorWorkflow(catalog=CatalogTool(api_url="http://127.0.0.1:1"), cache=SemanticCache())
    workflow.cache.path = tmp_path / "cache.json"
    first = workflow.run("floorstanding speaker for a large room")
    second = workflow.run("floorstanding speaker for a large room")
    assert not first.cache_hit
    assert second.cache_hit
