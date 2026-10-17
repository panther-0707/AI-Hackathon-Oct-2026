import { useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, Clock, RotateCcw, Route, Sparkles } from "lucide-react";
import AddressField from "./AddressField";
import Results from "./Results";
import { Eyebrow, IconButton, Section } from "./ui";

// keep in step with the clamp in backend/plan.py
const MIN_MINUTES = 10;
const MAX_MINUTES = 120;
const TICKS = [10, 30, 60, 90, 120];
const pctOf = (m) => ((m - MIN_MINUTES) / (MAX_MINUTES - MIN_MINUTES)) * 100;
const clampMinutes = (m) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, m));

export default function Panel(props) {
  const { start, end, step, onPoint, getFocus, minutes, onMinutes, onSwap, onReset, plan, loading, sheetOpen, onToggleSheet } = props;

  const summary = loading
    ? "Planning your detour..."
    : plan
      ? `${plan.stats.ourMin} min · ${plan.stats.stops} stop${plan.stats.stops === 1 ? "" : "s"}`
      : !start ? "Search or tap the map for your start" : "Now pick your destination";

  return (
    <aside
      className="absolute z-20 flex flex-col overflow-hidden inset-x-0 bottom-0 max-h-[55dvh] rounded-t-3xl border-t
        md:inset-x-auto md:left-4 md:top-20 md:bottom-auto md:w-[390px] md:max-h-[calc(100dvh-6rem)] md:rounded-2xl md:border
        border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/85 backdrop-blur-xl
        shadow-2xl shadow-slate-900/15 dark:shadow-black/60"
    >
      <button
        type="button"
        onClick={onToggleSheet}
        aria-expanded={sheetOpen}
        className="md:hidden flex flex-col items-center gap-2 px-5 pt-2.5 pb-2 shrink-0"
      >
        <span className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-700" />
        <span className="w-full flex items-center justify-between text-sm font-medium">
          {summary}
          {sheetOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </span>
      </button>

      <div className={`relative flex-1 flex-col overflow-y-auto scroll-thin ${sheetOpen ? "flex" : "hidden md:flex"}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-radial-[ellipse_at_top] from-sky-400/20 via-transparent to-transparent dark:from-sky-600/15" />

        {/* the pitch shrinks to a headline once there's a route to show; on mobile the sheet's summary row replaces it */}
        <div className="relative hidden md:block px-5 pt-5 pb-4 space-y-3">
          {step < 2 && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Scenic detours that still arrive on time
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight leading-tight text-balance">
            Take the{" "}
            <span className="bg-linear-to-r from-sky-500 to-indigo-500 bg-clip-text text-transparent">long way</span>{" "}
            round
          </h1>
          {step < 2 && (
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Tell us how long you've got. We fill it with the best views, parks, art and coffee between A and B.
            </p>
          )}
        </div>

        <Section>
          <div className="flex items-center justify-between mb-3">
            <Eyebrow icon={Route}>Your trip</Eyebrow>
            <div className="flex gap-1.5">
              <IconButton label="Swap start and destination" onClick={onSwap} disabled={!start && !end}>
                <ArrowUpDown className="w-3.5 h-3.5" />
              </IconButton>
              <IconButton label="Clear route" onClick={onReset} disabled={!start && !end}>
                <RotateCcw className="w-3.5 h-3.5" />
              </IconButton>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/50 divide-y divide-slate-200 dark:divide-zinc-800">
            <AddressField
              letter="A"
              label="Start"
              dot="bg-sky-500 ring-sky-500/20"
              point={start}
              waiting={!start}
              placeholder="Search a place, or click the map"
              onPick={(p) => onPoint(0, p)}
              onClear={() => onPoint(0, null)}
              getFocus={getFocus}
              locatable
            />
            <AddressField
              letter="B"
              label="Destination"
              dot="bg-indigo-500 ring-indigo-500/20"
              point={end}
              waiting={!!start && !end}
              placeholder={start ? "Search a place, or click the map" : "Where to?"}
              onPick={(p) => onPoint(1, p)}
              onClear={() => onPoint(1, null)}
              getFocus={getFocus}
            />
          </div>
          {step === 2 && (
            <p className="mt-2 text-[11px] text-slate-400 dark:text-zinc-500">Drag the A or B pin to fine-tune. Clicking the map starts over.</p>
          )}
        </Section>

        <Section>
          <div className="flex items-center justify-between mb-3">
            <Eyebrow icon={Clock}>Time budget</Eyebrow>
            <MinutesInput minutes={minutes} onMinutes={onMinutes} />
          </div>
          <input
            type="range"
            className="range"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            step="1"
            value={minutes}
            aria-label="Time budget in minutes"
            style={{ "--fill": `${pctOf(minutes)}%` }}
            onChange={(e) => onMinutes(Number(e.target.value))}
          />
          {/* inset by the thumb radius so labels line up with where the thumb actually sits */}
          <div className="relative h-3 mt-2 mx-2.5 font-mono text-[10px] text-slate-400 dark:text-zinc-600">
            {TICKS.map((t) => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pctOf(t)}%` }}>{t}</span>
            ))}
          </div>
        </Section>

        <div className={step === 2 ? "max-md:order-first" : ""}>
          <Results {...props} />
        </div>

        <footer className="px-5 py-4 border-t border-slate-200 dark:border-zinc-800/80 bg-slate-100/50 dark:bg-zinc-950/50 flex items-center justify-between gap-4 text-[11px] text-slate-500 dark:text-zinc-500">
          <span>Map data © OpenStreetMap contributors</span>
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="hover:text-slate-800 dark:hover:text-zinc-300">
            OpenFreeMap
          </a>
        </footer>
      </div>
    </aside>
  );
}

// typed values apply as soon as they're in range; out-of-range ones snap to the nearest limit on blur/Enter
function MinutesInput({ minutes, onMinutes }) {
  const [draft, setDraft] = useState(null); // null = not editing, show the live value

  function change(raw) {
    const digits = raw.replace(/\D/g, "").slice(0, 3);
    setDraft(digits);
    const n = Number(digits);
    if (digits && n >= MIN_MINUTES && n <= MAX_MINUTES) onMinutes(n);
  }

  function commit() {
    if (draft) onMinutes(clampMinutes(Number(draft)));
    setDraft(null);
  }

  return (
    <label className="flex items-baseline gap-1.5 cursor-text">
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Time budget in minutes, ${MIN_MINUTES} to ${MAX_MINUTES}`}
        value={draft ?? String(minutes)}
        onFocus={(e) => {
          setDraft(String(minutes));
          e.target.select();
        }}
        onChange={(e) => change(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const n = clampMinutes(minutes + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1));
            setDraft(String(n));
            onMinutes(n);
          }
        }}
        className="w-[5.25rem] px-2 py-0.5 text-right text-3xl font-bold tabular-nums tracking-tight rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-zinc-700 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 transition"
      />
      <span className="text-sm text-slate-500 dark:text-zinc-400">min</span>
    </label>
  );
}
