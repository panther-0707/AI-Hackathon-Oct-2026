import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import Header from "./components/Header";
import { Legend, MapStyleSwitch, StatusPill } from "./components/MapOverlays";
import Panel from "./components/Panel";
import { API } from "./lib/api";
import { addOverlay, basemap, fc, pin, stopPopup } from "./lib/mapOverlay";
import { VIBE_BY_ID } from "./lib/vibes";

maplibregl.setWorkerUrl(workerUrl);

const DEMO = [
  { lonlat: [-3.1883, 55.952], label: "Waverley Station" },
  { lonlat: [-3.1999, 55.9486], label: "Edinburgh Castle (area)" },
];
const dropped = (lonlat) => ({ lonlat, label: "Dropped pin" });

const isDark = () => document.documentElement.classList.contains("dark");

function savedMapMode() {
  try {
    return localStorage.getItem("glm-map") === "classic" ? "classic" : "themed";
  } catch {
    return "themed";
  }
}

// keep the route clear of the floating panel (left on desktop, bottom sheet on mobile)
// `open` = whether the panel is expanded; a collapsed panel leaves the map nearly free
function fitPadding(open = true) {
  return window.innerWidth >= 768
    ? { top: 100, bottom: 60, left: open ? 440 : 340, right: 80 }
    : { top: 90, bottom: open ? Math.round(window.innerHeight * 0.55) + 24 : 100, left: 30, right: 30 };
}

export default function App() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const pickMarkers = useRef([]);
  const stopMarkers = useRef([]);
  const fittedPlan = useRef(null);
  const [dark, setDark] = useState(isDark);
  const [mapMode, setMapMode] = useState(savedMapMode);
  const baseRef = useRef(basemap(mapMode, dark)); // the basemap currently loaded, read by style.load
  const [styleTick, setStyleTick] = useState(0);
  const [points, setPoints] = useState([null, null]); // [start, end], each { lonlat, label, detail? }
  const [minutes, setMinutes] = useState(40);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState({ key: null, pointsKey: null, plan: null, error: "" });
  const [activeStop, setActiveStop] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(true);
  const sheetOpenRef = useRef(true); // read by map callbacks without re-subscribing
  sheetOpenRef.current = sheetOpen;

  const [start, end] = points;
  const step = start && end ? 2 : start ? 1 : 0;

  // the last answer stays on screen (dimmed) while minutes re-plan, but not once A or B move
  const pointsKey = start && end ? JSON.stringify([start.lonlat, end.lonlat]) : null;
  const reqKey = pointsKey && JSON.stringify([pointsKey, minutes, retry]);
  const loading = !!reqKey && result.key !== reqKey;
  const plan = pointsKey && result.pointsKey === pointsKey ? result.plan : null;
  const error = reqKey && result.key === reqKey ? result.error : "";

  // 1. create the map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: baseRef.current.url,
      center: [-3.19, 55.95],
      zoom: 14,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    // fires on first load and after every basemap switch (setStyle wipes our layers)
    map.on("style.load", () => {
      addOverlay(map, baseRef.current.dark);
      setStyleTick((t) => t + 1);
    });
    map.on("click", (e) => {
      if (e.originalEvent.target.closest?.(".pin")) return; // clicks on pins open popups, not new points
      const p = dropped([e.lngLat.lng, e.lngLat.lat]);
      setPoints(([a, b]) => (!a ? [p, b] : !b ? [a, p] : [p, null]));
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. theme: page class + saved choice
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#09090b" : "#f8fafc");
    try {
      localStorage.setItem("glm-theme", dark ? "dark" : "light");
    } catch {
      // storage blocked: the theme just won't be remembered
    }
  }, [dark]);

  // 2b. basemap: classic, or light/dark following the theme
  useEffect(() => {
    try {
      localStorage.setItem("glm-map", mapMode);
    } catch {
      // storage blocked: the map style just won't be remembered
    }
    const next = basemap(mapMode, dark);
    if (baseRef.current.url === next.url) return;
    baseRef.current = next;
    mapRef.current?.setStyle(next.url, { diff: false });
  }, [mapMode, dark]);

  // 3. A and B markers (draggable)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pickMarkers.current.forEach((m) => m.remove());
    pickMarkers.current = points.flatMap((p, i) => {
      if (!p) return [];
      const el = pin(i === 0 ? "a" : "b", i === 0 ? "A" : "B");
      if (!points[1 - i]) el.classList.add("is-waiting");
      const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(p.lonlat).addTo(map);
      m.on("dragend", () => {
        const { lng, lat } = m.getLngLat();
        setPoints((ps) => ps.map((q, j) => (j === i ? dropped([lng, lat]) : q)));
      });
      return [m];
    });
    map.getCanvas().style.cursor = points[0] && points[1] ? "" : "crosshair";
  }, [points]);

  // 4. call the backend (debounced 400 ms)
  useEffect(() => {
    if (!reqKey) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start: start.lonlat, end: end.lonlat, minutes }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Planner returned ${res.status}`);
        const data = await res.json();
        setResult({ key: reqKey, pointsKey, plan: data, error: "" });
        setActiveStop(null);
      } catch (err) {
        if (err.name === "AbortError") return;
        const msg = err instanceof TypeError ? `Can't reach the planner at ${API}` : String(err.message || err);
        setResult((r) => ({ ...r, key: reqKey, error: msg }));
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [reqKey, pointsKey, start, end, minutes]);

  // 5. draw the plan's lines (again after a style switch)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleTick || !map.getSource("route")) return;
    map.getSource("ellipse").setData(fc(plan?.ellipse));
    map.getSource("boring").setData(fc(plan?.boringRoute));
    map.getSource("route").setData(fc(plan?.route));
  }, [plan, styleTick]);

  // 6. stop markers + fit the new route once
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    stopMarkers.current.forEach((m) => m.remove());
    stopMarkers.current = (plan?.stops || []).map((s, i) => {
      const el = pin("stop", String(i + 1), VIBE_BY_ID[s.category]?.color);
      el.addEventListener("click", () => setActiveStop(i));
      return new maplibregl.Marker({ element: el })
        .setLngLat(s.lonlat)
        .setPopup(new maplibregl.Popup({ offset: 18, closeButton: false }).setDOMContent(stopPopup(s)))
        .addTo(map);
    });
    if (plan?.route && fittedPlan.current !== plan) {
      fittedPlan.current = plan;
      const b = new maplibregl.LngLatBounds();
      plan.route.coordinates.forEach((c) => b.extend(c));
      // geocoded points can sit off the walkable route (e.g. inside the castle), so keep the pins in view too
      [start, end].forEach((p) => p && b.extend(p.lonlat));
      map.fitBounds(b, { padding: fitPadding(sheetOpenRef.current), duration: 800, maxZoom: 16.5 });
    }
  }, [plan, start, end]);

  // 7. highlight the selected stop
  useEffect(() => {
    stopMarkers.current.forEach((m, i) => {
      const el = m.getElement();
      el.classList.toggle("is-active", i === activeStop);
      el.style.zIndex = i === activeStop ? "2" : "";
    });
  }, [activeStop, plan]);

  function selectStop(i) {
    setActiveStop(i);
    const map = mapRef.current;
    const marker = stopMarkers.current[i];
    if (!map || !marker) return;
    map.flyTo({ center: marker.getLngLat(), zoom: Math.max(map.getZoom(), 16), duration: 700, padding: fitPadding(sheetOpenRef.current) });
    stopMarkers.current.forEach((m, j) => j !== i && m.getPopup()?.isOpen() && m.togglePopup());
    if (!marker.getPopup().isOpen()) marker.togglePopup();
  }

  function loadDemo() {
    setPoints(DEMO);
    setSheetOpen(true);
    mapRef.current?.flyTo({ center: DEMO[0].lonlat, zoom: 14 });
  }

  // from the search boxes / "use my location"; the plan's fitBounds takes over once both are set
  function setPoint(i, p) {
    setPoints((ps) => ps.map((q, j) => (j === i ? p : q)));
    if (p && !points[1 - i]) mapRef.current?.flyTo({ center: p.lonlat, zoom: 15 });
  }

  function getFocus() {
    const c = mapRef.current?.getCenter();
    return c ? [c.lng, c.lat] : null;
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* MapLibre forces position:relative on its container, so the wrapper does the positioning */}
      <div className="absolute inset-0 bg-slate-100 dark:bg-zinc-900">
        <div ref={mapEl} className="w-full h-full" />
      </div>

      <Header
        dark={dark}
        onToggleTheme={() => setDark((d) => !d)}
        onDemo={loadDemo}
        step={step}
        done={!!plan && !loading}
      />
      <StatusPill step={step} loading={loading} />
      <MapStyleSwitch mode={mapMode} dark={dark} onChange={setMapMode} />
      {plan && <Legend />}

      <Panel
        start={start}
        end={end}
        step={step}
        onPoint={setPoint}
        getFocus={getFocus}
        minutes={minutes}
        onMinutes={setMinutes}
        onSwap={() => setPoints(([a, b]) => [b, a])}
        onReset={() => setPoints([null, null])}
        plan={plan}
        loading={loading}
        error={error}
        onRetry={() => setRetry((r) => r + 1)}
        onDemo={loadDemo}
        activeStop={activeStop}
        onSelectStop={selectStop}
        sheetOpen={sheetOpen}
        onToggleSheet={() => setSheetOpen((o) => !o)}
      />
    </div>
  );
}
