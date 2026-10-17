import { Coffee, Landmark, Mountain, Palette, Trees } from "lucide-react";

// ids match backend/scoring.py categories; the weight is sent as `vibes` to /plan
export const VIBES = [
  { id: "views", label: "Views", Icon: Mountain, color: "#38bdf8" },
  { id: "green", label: "Green", Icon: Trees, color: "#34d399" },
  { id: "art", label: "Street art", Icon: Palette, color: "#e879f9" },
  { id: "history", label: "History", Icon: Landmark, color: "#fbbf24" },
  { id: "coffee", label: "Coffee", Icon: Coffee, color: "#fb923c" },
];

export const VIBE_BY_ID = Object.fromEntries(VIBES.map((v) => [v.id, v]));

export const DEFAULT_VIBES = Object.fromEntries(VIBES.map((v) => [v.id, 1]));

// tap cycles: on -> boosted -> skipped -> on
export const nextWeight = (w) => (w === 1 ? 2 : w === 2 ? 0 : 1);
