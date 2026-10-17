BASE = {"art": 10, "views": 9, "green": 7, "history": 6, "coffee": 5}
MAX_RAW = 32  # (10 base + 2 + 3 + 1) x 2 boost
PER_CATEGORY_CAP = 5
TOP_N = 50
DEFAULT_VIBES = {"art": 1, "green": 1, "coffee": 1, "history": 1, "views": 1}


def category_of(tags):
    if tags.get("tourism") == "artwork":
        return "art"
    if tags.get("tourism") == "viewpoint":
        return "views"
    if tags.get("leisure") in ("park", "garden"):
        return "green"
    if tags.get("amenity") == "cafe":
        return "coffee"
    if tags.get("historic") or tags.get("tourism") in ("attraction", "museum", "gallery") or tags.get("amenity") == "fountain":
        return "history"
    return None


def score_places(places, vibes=None, top_n=TOP_N, overflow=False):
    """Best places first, at most PER_CATEGORY_CAP per category. With overflow=True the places
    past the cap are appended (by score) instead of dropped, so there is always more to fill time with."""
    vibes = {**DEFAULT_VIBES, **(vibes or {})}
    scored = []
    for p in places:
        t = p["tags"]
        cat = category_of(t)
        if cat is None:
            continue
        if not t.get("name") and cat != "art":
            continue  # unnamed parks and cafes are not worth a detour
        raw = BASE[cat]
        raw += 2 if t.get("name") else 0
        raw += 3 if (t.get("wikipedia") or t.get("wikidata")) else 0
        raw += 1 if (t.get("image") or t.get("wikimedia_commons")) else 0
        raw *= vibes.get(cat, 1)
        if raw <= 0:
            continue
        score = max(1, min(100, round(raw / MAX_RAW * 100)))
        scored.append({**p, "category": cat, "score": score, "name": t.get("name", "Street art")})
    scored.sort(key=lambda x: x["score"], reverse=True)
    counts, kept, spill = {}, [], []
    for p in scored:
        if counts.get(p["category"], 0) >= PER_CATEGORY_CAP:
            spill.append(p)
            continue
        counts[p["category"]] = counts.get(p["category"], 0) + 1
        kept.append(p)
    return (kept + spill if overflow else kept)[:top_n]
