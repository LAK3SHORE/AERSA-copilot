"""Pure functions behind each MCP tool.

Every function in this subpackage is importable and callable without a
running MCP session — the FastMCP server in `mcp_server.server` registers
them as MCP tools, but the FastAPI layer can also call them directly.
"""
from mcp_server.tools.category_shrinkage import get_category_shrinkage
from mcp_server.tools.cierre_summary import get_cierre_summary
from mcp_server.tools.product_history import get_product_history
from mcp_server.tools.top_anomalies import get_top_anomalies

__all__ = [
    "get_category_shrinkage",
    "get_cierre_summary",
    "get_product_history",
    "get_top_anomalies",
]
