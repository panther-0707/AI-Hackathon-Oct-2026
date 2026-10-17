# 🧭 Get-Lost Maps

**Take the long way round.** Pick a start, a destination and how much time you
have, and Get-Lost Maps plans a walking route that weaves past the best street
art, viewpoints, parks, history and coffee on the way, and still gets you there
on time.

Most map apps answer *"what's the fastest way?"* This one answers *"what's the
nicest way, given the time I've got?"*

## Features

- 🔎 **Address search** with autocomplete, or tap the map to set points, or use
  your current location
- ⏱️ **Time budget** from 10 to 120 minutes (slider or typed)
- 🎯 **Smart detours:** stops are chosen for value per extra second of walking,
  with variety across categories
- 🗺️ **Direct vs scenic:** see the plain route next to the detour, with minutes
  and stops
- 📌 Draggable A/B pins, a "Try Edinburgh" demo, light/dark mode and two map
  styles
- 📱 Works on desktop and mobile; the side panel can be minimised

## How it works

1. **Find places.** Places near the route are fetched from OpenStreetMap
   (Overpass), falling back to OpenRouteService POIs and then Wikipedia, and
   sorted into five categories: street art, views, green spaces, history and
   coffee. Only places inside an *ellipse* around A and B that your time budget
   could reach are kept.
2. **Score them.** Each place gets a "worth a detour" score (0-100) from its
   category and how well documented it is:

   | Part | Points |
   |---|---|
   | Category base: street art 10, views 9, green 7, history 6, coffee 5 | 5-10 |
   | Has a name | +2 |
   | Has a Wikipedia / Wikidata link | +3 |
   | Has a photo | +1 |

   At most 5 places per category are shortlisted. The score is a proxy built
   from map data, not a review rating.
3. **Pick stops.** A solver (VROOM through OpenRouteService, with a greedy
   fallback) inserts the stops with the best score per extra second of walking.
   Repeats of a category are worth 30% less.
4. **Fit the budget.** The walk is checked against a real routing engine
   (OpenRouteService, then OSRM, then straight lines). The planner learns what
   the added stops really cost, then adds stops if there's time to spare or
   drops the lowest-value ones if it runs over.

## Tech stack

| | |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, MapLibre GL, Lucide icons |
| Backend | Python, FastAPI, httpx, openrouteservice |
| Data and routing | OpenStreetMap / Overpass, OpenRouteService (geocoding, POIs, directions, optimisation), OSRM, Wikipedia, Photon, OpenFreeMap tiles |

## Project structure

```
backend/
  main.py        FastAPI app: /health, /plan, /geocode (CORS settings live here)
  plan.py        planner: ellipse, solver, real-route fitting
  scoring.py     categories and the 0-100 score
  geo.py         distances, ellipse test, search radius
  places.py      place lookup with fallbacks and a small cache
  overpass.py    Overpass queries (several mirrors)
  ors_places.py  OpenRouteService POIs
  config.py      reads ORS_API_KEY
  test_*.py      manual test scripts
frontend/
  src/App.jsx              map, state and requests to the backend
  src/components/          Panel, AddressField, Results, header, map overlays
  src/lib/                 API URL, map overlay helpers, category metadata
```

## Getting started

You need **Node.js 20.19+**, **Python 3.10+** and a free
[OpenRouteService API key](https://openrouteservice.org/dev/#/signup).

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
echo "ORS_API_KEY=your_key_here" > .env     # or set ORS_API_KEY in your environment
uvicorn main:app --reload
```

The API runs at `http://127.0.0.1:8000`. Check it at `/health`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The frontend calls
`http://127.0.0.1:8000` by default; set `VITE_API_URL` to point it elsewhere.

Try it: click **Try Edinburgh** in the header.

### Useful commands

```bash
npm run build      # production build (frontend)
npm run lint       # oxlint (frontend)

# plan a route from the command line (lon lat lon lat minutes)
cd backend && python test_plan.py -3.1883 55.9520 -3.1999 55.9486 40
```

## API

| Endpoint | Description |
|---|---|
| `GET /health` | Returns `{"ok": true}` |
| `GET /geocode?q=...&lon=...&lat=...` | Address autocomplete (OpenRouteService, falling back to Photon). `lon`/`lat` bias results toward the map |
| `POST /plan` | Body: `{"start": [lon, lat], "end": [lon, lat], "minutes": 40}`. Returns stops, the scenic and direct route geometry, the reachable ellipse and stats |

## Deployment

The frontend is built for Vercel. Set `VITE_API_URL` to your backend's URL, and
add your frontend's origin to the CORS settings in `backend/main.py` (Vercel
project URLs matching `get-lost-maps` or `ai-hackathon-oct-2026`, plus any
localhost port, are already allowed). The backend needs `ORS_API_KEY` set in
its environment.

## Known limitations

- Scores come from OpenStreetMap tags, so a place with sparse map data can be
  under-rated, and there is no opening-hours or review data yet.
- Free API tiers have rate limits; heavy use may need your own keys.
- Walking time assumes a steady pace of about 5 km/h plus 2 minutes per stop.

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors. Tiles by [OpenFreeMap](https://openfreemap.org). Routing and
geocoding by [OpenRouteService](https://openrouteservice.org),
[OSRM](https://project-osrm.org) and [Photon](https://photon.komoot.io).
Detour optimisation uses [VROOM](https://github.com/VROOM-Project/vroom).
Built at the AI Hackathon, October 2026.
