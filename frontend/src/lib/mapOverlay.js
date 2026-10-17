import { VIBE_BY_ID } from "./vibes";

export const STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
  classic: "https://tiles.openfreemap.org/styles/liberty", // the original colourful map
};

// "themed" follows the light/dark toggle; "classic" is always the colourful map
export function basemap(mode, dark) {
  if (mode === "classic") return { url: STYLES.classic, dark: false };
  return { url: dark ? STYLES.dark : STYLES.light, dark };
}

export const fc = (geometry) => ({
  type: "FeatureCollection",
  features: geometry ? [{ type: "Feature", geometry, properties: {} }] : [],
});

// sources + layers for the ellipse, the shortest route and our route; re-run after every setStyle
export function addOverlay(map, dark) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  map.addSource("ellipse", { type: "geojson", data: fc(null) });
  map.addSource("boring", { type: "geojson", data: fc(null) });
  map.addSource("route", { type: "geojson", data: fc(null), lineMetrics: true });

  map.addLayer({ id: "ellipse-fill", type: "fill", source: "ellipse",
    paint: { "fill-color": "#0ea5e9", "fill-opacity": dark ? 0.08 : 0.07 } }, firstLabel);
  map.addLayer({ id: "ellipse-line", type: "line", source: "ellipse",
    paint: { "line-color": dark ? "#38bdf8" : "#0284c7", "line-width": 1.5, "line-opacity": 0.6,
      "line-dasharray": [3, 3] } }, firstLabel);
  map.addLayer({ id: "boring-line", type: "line", source: "boring",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": dark ? "#71717a" : "#94a3b8", "line-width": 4, "line-dasharray": [0.6, 1.8] } });
  map.addLayer({ id: "route-casing", type: "line", source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": dark ? "#09090b" : "#ffffff", "line-width": 9, "line-opacity": 0.9 } });
  map.addLayer({ id: "route-glow", type: "line", source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#0ea5e9", "line-width": 18, "line-blur": 12, "line-opacity": dark ? 0.45 : 0.3 } });
  map.addLayer({ id: "route-line", type: "line", source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-width": 5,
      "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, "#38bdf8", 1, "#6366f1"] } });
}

export function pin(kind, text, color) {
  const el = document.createElement("div");
  el.className = `pin pin-${kind}`;
  if (color) el.style.setProperty("--cat", color);
  const body = document.createElement("div");
  body.className = "pin-body";
  body.textContent = text;
  el.appendChild(body);
  return el;
}

// built from DOM nodes, not HTML strings: place names come from OpenStreetMap
export function stopPopup(stop) {
  const meta = VIBE_BY_ID[stop.category];
  const root = document.createElement("div");
  root.className = "glm-popup";
  const chip = document.createElement("span");
  chip.className = "glm-popup-chip";
  chip.style.color = meta?.color || "#0ea5e9";
  chip.textContent = meta?.label || stop.category;
  const name = document.createElement("div");
  name.className = "glm-popup-name";
  name.textContent = stop.name;
  const score = document.createElement("div");
  score.className = "glm-popup-score";
  score.textContent = `score ${stop.score}/100`;
  root.append(chip, name, score);
  return root;
}
