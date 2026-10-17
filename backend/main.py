import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from plan import make_plan

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://(get-lost-maps|ai-hackathon-oct-2026).*\.vercel\.app|http://localhost:5173|http://127\.0\.0\.1:5173",
    allow_methods=["*"],
    allow_headers=["*"],
)


class PlanReq(BaseModel):
    start: list[float]
    end: list[float]
    minutes: int = 40
    vibes: dict[str, float] = {}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/plan")
def plan(req: PlanReq):
    if len(req.start) != 2 or len(req.end) != 2:
        raise HTTPException(422, "start and end must be [lon, lat]")
    return make_plan(req.start, req.end, req.minutes, req.vibes)
