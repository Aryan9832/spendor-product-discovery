# Spendor AI Product Advisor

The portfolio project's AI core. It treats the model as one bounded component in a verifiable system rather than an open-ended chatbot.

## What is demonstrated

- Typed request/response and tool contracts with Pydantic.
- A four-transition state machine: extract constraints → retrieve → rerank/verify → respond or hand off. The transition guard prevents agent loops.
- Tool-mediated catalog access. `mcp_server.py` exposes the same approved catalog through MCP tools.
- Hybrid retrieval reuse: when the Node catalog service is live, the workflow calls its embedding-plus-deterministic retrieval path; it falls back to deterministic local ranking during an outage.
- Semantic response cache, OpenTelemetry spans written to ignored local JSONL, latency/token estimates, and explicit retrieval route in each response.
- Golden-set pytest evaluation and CI on each push/PR.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r ai_service\requirements.txt
$env:PYTHONPATH = "ai_service"
uvicorn spendor_advisor.service:app --app-dir ai_service --reload --port 8000
pytest ai_service/tests
```

Open `http://localhost:8000/docs` to exercise the typed API. The existing Node catalog service on port 8787 adds embedding-based retrieval when configured.
