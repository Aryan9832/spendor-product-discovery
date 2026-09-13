from mcp.server.fastmcp import FastMCP

from .catalog import CatalogTool
from .models import ListenerIntent

mcp = FastMCP("spendor-catalog-tools")
catalog = CatalogTool()


@mcp.tool()
def search_catalog(query: str, room: str | None = None, category: str | None = None) -> list[dict]:
    """Search only approved Spendor catalog data; returns verifiable PDF citations."""
    intent = ListenerIntent.model_validate({"room_size": room, "product_type": category})
    products, _ = catalog.search(query, intent, limit=5)
    return [product.model_dump(mode="json") for product in products]


@mcp.tool()
def get_product_specification(product_id: str) -> dict | None:
    """Get a single catalog product and its published specification-PDF URL."""
    product = catalog.get_product(product_id)
    return product.model_dump(mode="json") if product else None


if __name__ == "__main__":
    mcp.run()
