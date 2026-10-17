import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

maplibregl.setWorkerUrl(workerUrl);

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DEMO_START = { lonlat: [-3.1883, 55.952], label: "Waverley Station" };
const DEMO_END = { lonlat: [-3.1999, 55.9486], label: "Edinburgh Castle (area)" };

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

function AddressInput({ label, text, setText, onPick, getFocus, placeholder }) {
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("");
  const timer = useRef(null);
  const reqId = useRef(0);

  function search(v) {
    clearTimeout(timer.current);
    if (v.trim().length < 3) {
      setResults([]);
      setStatus("");
      return;
    }
    timer.current = setTimeout(async () => {
      const id = ++reqId.current;
      setStatus("Searching...");
      try {
        const qs = new URLSearchParams({ q: v.trim() });
        const f = getFocus && getFocus();
        if (f) {
          qs.set("lon", f[0]);
          qs.set("lat", f[1]);
        }
        const res = await fetch(`${API}/geocode?${qs}`);
        if (!res.ok) throw new Error("bad response");
        const data = await res.json();
        if (id !== reqId.current) return;
        const list = data.results || [];
        setResults(list);
        setStatus(list.length ? "" : "No matches");
      } catch {
        if (id === reqId.current) {
          setResults([]);
          setStatus("Search unavailable");
        }
      }
    }, 350);
  }

  function choose(r) {
    clearTimeout(timer.current);
    reqId.current++;
    setResults([]);
    setStatus("");
    onPick({ lonlat: r.lonlat, label: r.label });
  }

  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="text"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          search(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) choose(results[0]);
        }}
      />
      {status && <div className="small">{status}</div>}
      {results.length > 0 && (
        <ul className="sugg">
          {results.map((r, i) => (
            <li key={i}>
              <button onClick={() => choose(r)}>{r.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function App() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const pickMarkers = useRef([]);
  const stopMarkers = useRef([]);
  const clickRef = useRef(() => {});
  const [loaded, setLoaded] = useState(false);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [minutes, setMinutes] = useState(40);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function getFocus() {
    const c = mapRef.current && mapRef.current.getCenter();
    return c ? [c.lng, c.lat] : null;
  }

  function pickStart(p) {
    setStart(p);
    setStartText(p.label);
    setError("");
    if (!end && mapRef.current) mapRef.current.flyTo({ center: p.lonlat, zoom: 14 });
  }

  function pickEnd(p) {
    setEnd(p);
    setEndText(p.label);
    setError("");
    if (!start && mapRef.current) mapRef.current.flyTo({ center: p.lonlat, zoom: 14 });
  }

  clickRef.current = (lonlat) => {
    const p = { lonlat, label: "Dropped pin" };
    if (!start) pickStart(p);
    else if (!end) pickEnd(p);
    else {
      setEnd(null);
      setEndText("");
      pickStart(p);
    }
  };

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => pickStart({ lonlat: [pos.coords.longitude, pos.coords.latitude], label: "My location" }),
      () => setError("Could not get your location"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function useDemo() {
    setStart(DEMO_START);
    setStartText(DEMO_START.label);
    setEnd(DEMO_END);
    setEndText(DEMO_END.label);
    setError("");
  }

  function reset() {
    setStart(null);
    setEnd(null);
    setStartText("");
    setEndText("");
    setPlan(null);
    setError("");
  }

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
    map.on("click", (e) => clickRef.current([e.lngLat.lng, e.lngLat.lat]));
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
    const list = [];
    if (start) list.push([start.lonlat, "pin start", "A"]);
    if (end) list.push([end.lonlat, "pin end", "B"]);
    pickMarkers.current = list.map(([ll, cls, txt]) =>
      new maplibregl.Marker({ element: pin(cls, txt) }).setLngLat(ll).addTo(map)
    );
  }, [start, end]);

  // 3. call the backend (debounced 400 ms)
  useEffect(() => {
    if (!start || !end) {
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
          body: JSON.stringify({ start: start.lonlat, end: end.lonlat, minutes, vibes: {} }),
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
  }, [start, end, minutes]);

  // 4. draw the plan
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    map.getSource("ellipse").setData(fc(plan && plan.ellipse));
    map.getSource("boring").setData(fc(plan && plan.boringRoute));
    map.getSource("route").setData(fc(plan && plan.route));
    stopMarkers.current.forEach((m) => m.remove());
    stopMarkers.current = ((plan && plan.stops) || []).map((s, i) =>
      new maplibregl.Marker({ element: pin("pin stop", String(i + 1)) })
        .setLngLat(s.lonlat)
        .setPopup(new maplibregl.Popup({ offset: 16 }).setText(s.name))
        .addTo(map)
    );
    if (plan && plan.route) {
      const ring = plan.ellipse ? plan.ellipse.coordinates[0] : plan.route.coordinates;
      const b = new maplibregl.LngLatBounds();
      ring.forEach((c) => b.extend(c));
      map.fitBounds(b, { padding: 60, duration: 800 });
    }
  }, [plan, loaded]);

  const hint = !start
    ? "Type a start address, or click the map"
    : !end
    ? "Now type a destination, or click the map"
    : "Drag the slider to re-plan";

  return (
    <div className="app">
      <div ref={mapEl} className="map" />
      <div className="panel">
        <h1>{"\u{1F9ED}"} Get-Lost Maps</h1>
        <p className="hint">{hint}</p>

        <AddressInput label="Start" text={startText} setText={setStartText}
          onPick={pickStart} getFocus={getFocus} placeholder="e.g. Waverley Station" />
        <div className="row">
          <button onClick={useMyLocation}>{"\u{1F4CD}"} Use my location</button>
        </div>
        <AddressInput label="Destination" text={endText} setText={setEndText}
          onPick={pickEnd} getFocus={getFocus} placeholder="e.g. Edinburgh Castle" />

        <label>Time available: <b>{minutes} min</b></label>
        <input type="range" min="10" max="90" step="1" value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))} />
        <div className="row">
          <button onClick={useDemo}>Edinburgh demo</button>
          <button onClick={reset}>Reset</button>
        </div>
        {loading && <p>Planning...</p>}
        {error && <p className="err">{error}</p>}
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
