import { Flag, LoaderCircle, Map as MapIcon, Moon, MousePointerClick, Sun } from "lucide-react";

const glass = "border border-slate-200 dark:border-zinc-800 bg-white/85 dark:bg-zinc-950/80 backdrop-blur-md shadow-lg shadow-slate-900/10 dark:shadow-black/40";

// mobile: top-left (the style switch sits top-right); desktop: centred over the map right of the 390px panel
export function StatusPill({ step, loading }) {
  let content = null;
  if (loading) content = <><LoaderCircle className="w-4 h-4 animate-spin text-sky-500" /> Finding the scenic way...</>;
  else if (step === 0) content = <><MousePointerClick className="w-4 h-4 text-sky-500" /> Click the map to set your start</>;
  else if (step === 1) content = <><Flag className="w-4 h-4 text-indigo-500" /> Now click your destination</>;
  if (!content) return null;
  return (
    <div className="absolute z-10 top-20 left-3 md:left-[calc(50%_+_203px)] md:-translate-x-1/2 pointer-events-none">
      <div role="status" className={`inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap ${glass}`}>
        {content}
      </div>
    </div>
  );
}

export function MapStyleSwitch({ mode, dark, onChange }) {
  const options = [
    { id: "themed", label: dark ? "Dark" : "Light", Icon: dark ? Moon : Sun },
    { id: "classic", label: "Classic", Icon: MapIcon },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Map style"
      className={`absolute z-10 top-20 right-3 md:top-auto md:bottom-10 flex items-center gap-1 p-1 rounded-full ${glass}`}
    >
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          aria-label={`${label} map`}
          title={`${label} map`}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full text-xs font-medium transition ${
            mode === id
              ? "bg-slate-900 text-white dark:bg-zinc-800 shadow-sm"
              : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-800/60"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function Legend() {
  return (
    <div className={`hidden md:block absolute z-10 right-3 bottom-[5.5rem] p-3 rounded-xl space-y-2 text-xs text-slate-600 dark:text-zinc-400 ${glass}`}>
      <Row swatch={<span className="w-6 h-1.5 rounded-full bg-linear-to-r from-sky-400 to-indigo-500 shadow-[0_0_8px_rgb(14_165_233/0.7)]" />}>
        Your detour
      </Row>
      <Row swatch={<span className="w-6 border-t-[3px] border-dotted border-slate-400 dark:border-zinc-500" />}>Shortest way</Row>
      <Row swatch={<span className="w-6 h-3 rounded-sm border border-dashed border-sky-500/70 bg-sky-500/10" />}>Reachable in time</Row>
    </div>
  );
}

function Row({ swatch, children }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-6 flex items-center justify-center">{swatch}</span>
      {children}
    </div>
  );
}
