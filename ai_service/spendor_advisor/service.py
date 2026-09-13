from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .workflow import AdvisorWorkflow

app = FastAPI(title="Spendor AI Product Advisor", version="1.0.0")
workflow = AdvisorWorkflow()


class AdviceRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)


@app.get("/health")
def health():
    return {"status": "ok", "workflow": "bounded-state-machine", "max_transitions": 5}


@app.post("/v1/advice")
def advice(request: AdviceRequest):
    try:
        return workflow.run(request.question)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
