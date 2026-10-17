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


import httpx
from config import get_key


@app.get("/geocode")
def geocode(q: str, lon: float | None = None, lat: float | None = None):
    q = q.strip()
    if len(q) < 3:
        return {"results": []}
    params = {"api_key": get_key(), "text": q, "size": 6}
    if lon is not None and lat is not None:
        params["focus.point.lon"] = lon
        params["focus.point.lat"] = lat
    try:
        r = httpx.get("https://api.openrouteservice.org/geocode/autocomplete", params=params, timeout=8)
        r.raise_for_status()
    except Exception:
        raise HTTPException(502, "geocoder unavailable")
    results = []
    for f in r.json().get("features", []):
        label = f.get("properties", {}).get("label")
        coords = f.get("geometry", {}).get("coordinates")
        if label and coords:
            results.append({"label": label, "lonlat": coords})
    return {"results": results}
