import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

maplibregl.setWorkerUrl(workerUrl);

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DEMO = [[-3.1883, 55.952], [-3.1999, 55.9486]];

const fc = (geometry) => ({
  type: "FeatureCollection",
  features: geometry ? [{ type: "Feature", geometry, properties: {} }] : [],
});

function pin(className, text) {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  return el;
}

export default function App() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const pickMarkers = useRef([]);
  const stopMarkers = useRef([]);
  const [loaded, setLoaded] = useState(false);
  const [picks, setPicks] = useState([]);
  const [minutes, setMinutes] = useState(40);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 1. create the map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: STYLE,
      center: [-3.19, 55.95],
      zoom: 14,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => {
      map.addSource("ellipse", { type: "geojson", data: fc(null) });
      map.addSource("boring", { type: "geojson", data: fc(null) });
      map.addSource("route", { type: "geojson", data: fc(null) });
      map.addLayer({ id: "ellipse-fill", type: "fill", source: "ellipse",
        paint: { "fill-color": "#7c3aed", "fill-opacity": 0.12 } });
      map.addLayer({ id: "ellipse-line", type: "line", source: "ellipse",
        paint: { "line-color": "#7c3aed", "line-width": 2, "line-dasharray": [2, 2] } });
      map.addLayer({ id: "boring-line", type: "line", source: "boring",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#9ca3af", "line-width": 5 } });
      map.addLayer({ id: "route-glow", type: "line", source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ff2d95", "line-width": 14, "line-blur": 8, "line-opacity": 0.5 } });
      map.addLayer({ id: "route-line", type: "line", source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ff2d95", "line-width": 5 } });
      setLoaded(true);
    });
    map.on("click", (e) => {
      const pt = [e.lngLat.lng, e.lngLat.lat];
      setPicks((p) => (p.length >= 2 ? [pt] : [...p, pt]));
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. A and B markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pickMarkers.current.forEach((m) => m.remove());
    pickMarkers.current = picks.map((pt, i) =>
      new maplibregl.Marker({ element: pin(i === 0 ? "pin start" : "pin end", i === 0 ? "A" : "B") })
        .setLngLat(pt)
        .addTo(map)
    );
  }, [picks]);

  // 3. call the backend (debounced 400 ms)
  useEffect(() => {
    if (picks.length !== 2) {
      setPlan(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API}/plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start: picks[0], end: picks[1], minutes, vibes: {} }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Server said ${res.status}`);
        setPlan(await res.json());
      } catch (err) {
        if (err.name !== "AbortError") setError(String(err.message || err));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [picks, minutes]);

  // 4. draw the plan
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    map.getSource("ellipse").setData(fc(plan?.ellipse));
    map.getSource("boring").setData(fc(plan?.boringRoute));
    map.getSource("route").setData(fc(plan?.route));
    stopMarkers.current.forEach((m) => m.remove());
    stopMarkers.current = (plan?.stops || []).map((s, i) =>
      new maplibregl.Marker({ element: pin("pin stop", String(i + 1)) })
        .setLngLat(s.lonlat)
        .setPopup(new maplibregl.Popup({ offset: 16 }).setText(s.name))
        .addTo(map)
    );
    if (plan?.route) {
      const ring = plan.ellipse ? plan.ellipse.coordinates[0] : plan.route.coordinates;
      const b = new maplibregl.LngLatBounds();
      ring.forEach((c) => b.extend(c));
      map.fitBounds(b, { padding: 60, duration: 800 });
    }
  }, [plan, loaded]);

  function useDemo() {
    setPicks(DEMO);
    mapRef.current?.flyTo({ center: DEMO[0], zoom: 14 });
  }

  const hint =
    picks.length === 0 ? "Click the map to set your START (A)"
    : picks.length === 1 ? "Now click your DESTINATION (B)"
    : "Drag the slider to re-plan";

  return (
    <div className="app">
      <div ref={mapEl} className="map" />
      <div className="panel">
        <h1>?? Get-Lost Maps</h1>
        <p className="hint">{hint}</p>
        <label>Time available: <b>{minutes} min</b></label>
        <input type="range" min="10" max="90" step="1" value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))} />
        <div className="row">
          <button onClick={useDemo}>Edinburgh demo</button>
          <button onClick={() => setPicks([])}>Reset</button>
        </div>
        {loading && <p>? Planning...</p>}
        {error && <p className="err">?? {error}</p>}
        {plan && !loading && (
          <div className="stats">
            <div><span className="grey">Shortest</span> {plan.stats.boringMin} min</div>
            <div><span className="neon">Yours</span> {plan.stats.ourMin} min - {plan.stats.stops} stops</div>
            <div>{plan.stats.spareMin >= 0 ? `Arrive ${plan.stats.spareMin} min early` : `${-plan.stats.spareMin} min over budget`}</div>
            {plan.message && <div className="msg">{plan.message}</div>}
            <ol>
              {plan.stops.map((s, i) => (
                <li key={i}>{s.name} <small>{s.category}</small></li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
