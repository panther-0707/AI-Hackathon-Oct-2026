import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from plan import make_plan

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://(get-lost-maps|ai-hackathon-oct-2026|adventure-maps).*\.vercel\.app|http://(localhost|127\.0\.0\.1)(:\d+)?",
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


def _ors_geocode(q, lon, lat):
    key = get_key()
    if not key:
        raise RuntimeError("no ORS_API_KEY")
    params = {"api_key": key, "text": q, "size": 6}
    if lon is not None and lat is not None:
        params["focus.point.lon"] = lon
        params["focus.point.lat"] = lat
    r = httpx.get("https://api.openrouteservice.org/geocode/autocomplete", params=params, timeout=8)
    r.raise_for_status()
    out = []
    for f in r.json().get("features", []):
        label = f.get("properties", {}).get("label")
        coords = f.get("geometry", {}).get("coordinates")
        if label and coords:
            out.append({"label": label, "lonlat": coords})
    return out


def _photon_label(props):
    """'Waverley Station, Edinburgh, Scotland, United Kingdom' - the first comma splits name from area."""
    first = props.get("name") or " ".join(x for x in (props.get("housenumber"), props.get("street")) if x)
    parts = [first, props.get("city") or props.get("town") or props.get("village") or props.get("county"),
             props.get("state"), props.get("country")]
    seen, label = set(), []
    for part in parts:
        if part and part not in seen:
            seen.add(part)
            label.append(part)
    return ", ".join(label)


def _photon_geocode(q, lon, lat):
    """Keyless fallback (OpenStreetMap data), used when ORS has no key, is out of quota or is down."""
    params = {"q": q, "limit": 6, "lang": "en"}
    if lon is not None and lat is not None:
        params["lon"] = lon
        params["lat"] = lat
    r = httpx.get("https://photon.komoot.io/api/", params=params, timeout=8, headers={"User-Agent": "get-lost-maps"})
    r.raise_for_status()
    out = []
    for f in r.json().get("features", []):
        label = _photon_label(f.get("properties", {}))
        coords = f.get("geometry", {}).get("coordinates")
        if label and coords:
            out.append({"label": label, "lonlat": coords})
    return out


@app.get("/geocode")
def geocode(q: str, lon: float | None = None, lat: float | None = None):
    q = q.strip()
    if len(q) < 3:
        return {"results": []}
    try:
        return {"results": _ors_geocode(q, lon, lat)}
    except Exception as ex:
        print("[geocode] ORS failed, trying Photon:", type(ex).__name__, str(ex)[:120])
    try:
        return {"results": _photon_geocode(q, lon, lat)}
    except Exception as ex:
        print("[geocode] Photon failed:", type(ex).__name__, str(ex)[:120])
        raise HTTPException(502, "geocoder unavailable")
