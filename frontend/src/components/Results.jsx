import { useEffect, useRef } from "react";
import { Check, Footprints, Info, LoaderCircle, MapPin, Play, RefreshCw, TriangleAlert } from "lucide-react";
import { VIBE_BY_ID } from "../lib/vibes";
import { Eyebrow, Section } from "./ui";
import { fmtPoint } from "../lib/format";

const FALLBACK = { label: "Place", Icon: MapPin, color: "#0ea5e9" };

export default function Results({ start, end, step, plan, loading, error, onRetry, onDemo, activeStop, onSelectStop }) {
  if (step < 2) return <HowItWorks step={step} onDemo={onDemo} />;

  if (error) {
    return (
      <Section>
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
            <TriangleAlert className="w-4 h-4" /> Couldn't plan that route
          </div>
          <p className="mt-1 text-xs font-mono text-red-600/80 dark:text-red-300/80 break-words">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-300 border border-red-500/30 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      </Section>
    );
  }

  if (!plan) return <Loading />;

  return (
    <Section className={`space-y-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
      <TripSummary plan={plan} loading={loading} />
      {plan.message && (
        <div className="flex gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          {plan.message}
        </div>
      )}
      <Timeline start={start} end={end} plan={plan} activeStop={activeStop} onSelectStop={onSelectStop} />
    </Section>
  );
}

function HowItWorks({ step, onDemo }) {
  const steps = [
    ["Set a start", "Search a place, use your location, or click the map."],
    ["Pick a destination", "Search for it, or click the map again."],
    ["Get a little lost", "We route you past the good stuff and still get you there on time."],
  ];
  return (
    <Section>
      <Eyebrow icon={Footprints}>How it works</Eyebrow>
      <ol className="mt-3 space-y-3">
        {steps.map(([title, desc], i) => (
          <li key={title} className="flex gap-3">
            <span
              className={`w-6 h-6 shrink-0 rounded-full border font-mono text-[11px] flex items-center justify-center transition ${
                i < step
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500"
                  : i === step
                    ? "border-sky-500/50 bg-sky-500/10 text-sky-500"
                    : "border-slate-300 dark:border-zinc-700 text-slate-500 dark:text-zinc-500"
              }`}
            >
              {i < step ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            <div>
              <div className={`text-sm font-semibold ${i === step ? "" : "text-slate-600 dark:text-zinc-400"}`}>{title}</div>
              <div className="text-xs text-slate-500 dark:text-zinc-500">{desc}</div>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onDemo}
        className="mt-5 w-full px-4 py-2.5 rounded-full border border-slate-300 dark:border-zinc-800 hover:bg-slate-200/50 dark:hover:bg-zinc-900 text-sm font-medium transition flex items-center justify-center gap-2"
      >
        <Play className="w-3.5 h-3.5 fill-current text-sky-500" /> Or try the Edinburgh demo
      </button>
    </Section>
  );
}

function Loading() {
  return (
    <Section className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
        <LoaderCircle className="w-4 h-4 animate-spin text-sky-500" /> Scouting views, parks and coffee...
      </div>
      <div className="animate-pulse space-y-3">
        <div className="h-44 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-200/60 dark:bg-zinc-900" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="ml-10 h-[72px] rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900/60" />
        ))}
      </div>
    </Section>
  );
}

function TripSummary({ plan, loading }) {
  const { boringMin, ourMin, stops, spareMin } = plan.stats;
  const budget = ourMin + spareMin;
  const extra = ourMin - boringMin;
  const onTime = spareMin >= 0;
  const scale = Math.max(budget, ourMin, 1);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-zinc-500">
            Your detour {loading && <LoaderCircle className="w-3 h-3 animate-spin text-sky-500" />}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight tabular-nums bg-linear-to-r from-sky-500 to-indigo-500 bg-clip-text text-transparent">
              {ourMin}
            </span>
            <span className="text-sm text-slate-500 dark:text-zinc-400">
              min · {stops} stop{stops === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${
            onTime
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
          }`}
        >
          {onTime ? <Check className="w-3.5 h-3.5" /> : <TriangleAlert className="w-3.5 h-3.5" />}
          {spareMin > 0 ? `${spareMin} min early` : spareMin === 0 ? "Right on time" : `${-spareMin} min over`}
        </span>
      </div>

      <div className="space-y-2.5">
        <TimeBar label="Your detour" minutes={ourMin} pct={ourMin / scale} fill="bg-linear-to-r from-sky-400 to-indigo-500" />
        <TimeBar label="Shortest way" minutes={boringMin} pct={boringMin / scale} fill="bg-slate-400 dark:bg-zinc-500" />
      </div>

      <div className="flex justify-between gap-3 pt-3 border-t border-slate-200 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400">
        <span>{extra > 0 ? `+${extra} min of wandering` : "No detour this time"}</span>
        <span>Budget {budget} min</span>
      </div>
    </div>
  );
}

function TimeBar({ label, minutes, pct, fill }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600 dark:text-zinc-400">{label}</span>
        <span className="font-medium tabular-nums">{minutes} min</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
    </div>
  );
}

function Timeline({ start, end, plan, activeStop, onSelectStop }) {
  const items = useRef([]);
  useEffect(() => {
    if (activeStop != null) items.current[activeStop]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeStop]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Eyebrow icon={MapPin}>Along the way</Eyebrow>
        <span className="font-mono text-xs text-slate-500 dark:text-zinc-500">
          {plan.stops.length} stop{plan.stops.length === 1 ? "" : "s"}
        </span>
      </div>
      <ol className="relative space-y-2.5">
        <span aria-hidden className="absolute left-[13px] top-4 bottom-4 w-0.5 rounded-full bg-linear-to-b from-sky-500 to-indigo-500 opacity-40" />
        <Endpoint letter="A" role="Start" point={start} dot="bg-sky-500" />
        {plan.stops.map((s, i) => {
          const meta = VIBE_BY_ID[s.category] || FALLBACK;
          const active = i === activeStop;
          const photo = typeof s.photo === "string" && s.photo.startsWith("http") ? s.photo : null;
          return (
            <li key={`${s.name}-${i}`} ref={(el) => (items.current[i] = el)} className="relative flex gap-3">
              <span
                className={`relative z-10 mt-3 w-7 h-7 shrink-0 rounded-full border-2 font-mono text-[11px] font-semibold flex items-center justify-center transition ${
                  active ? "bg-sky-500 text-white border-white dark:border-zinc-950" : "bg-white dark:bg-zinc-950"
                }`}
                style={active ? undefined : { borderColor: meta.color }}
              >
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => onSelectStop(i)}
                className={`flex-1 min-w-0 flex gap-3 text-left p-3 rounded-xl border transition ${
                  active
                    ? "border-sky-500/60 bg-sky-500/5 dark:bg-sky-500/10 ring-1 ring-sky-500/30"
                    : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-slate-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                      <meta.Icon className="w-3 h-3" style={{ color: meta.color }} />
                      {meta.label}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">{s.score}</span>
                  </div>
                  <div className="mt-1.5 font-semibold text-sm leading-snug">{s.name}</div>
                  {s.fact && <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">{s.fact}</p>}
                  <div className="mt-2 h-1 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full bg-linear-to-r from-sky-400 to-indigo-500" style={{ width: `${s.score}%` }} />
                  </div>
                </div>
                {photo && (
                  <img
                    src={photo}
                    alt=""
                    loading="lazy"
                    className="w-14 h-14 shrink-0 rounded-lg object-cover border border-slate-200 dark:border-zinc-800"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}
              </button>
            </li>
          );
        })}
        <Endpoint letter="B" role="Destination" point={end} dot="bg-indigo-500" />
      </ol>
    </div>
  );
}

function Endpoint({ letter, role, point, dot }) {
  return (
    <li className="relative flex items-center gap-3">
      <span className={`relative z-10 w-7 h-7 shrink-0 rounded-full ${dot} text-white font-mono text-xs font-semibold flex items-center justify-center ring-4 ring-white dark:ring-zinc-950`}>
        {letter}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{point.label}</div>
        <div className="text-[11px] text-slate-500 dark:text-zinc-500 truncate">
          {role} · {point.detail || <span className="font-mono">{fmtPoint(point.lonlat)}</span>}
        </div>
      </div>
    </li>
  );
}
