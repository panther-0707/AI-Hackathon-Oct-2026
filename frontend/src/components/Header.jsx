import { Check, Compass, Moon, Play, Sun } from "lucide-react";

const STEPS = ["Start", "Destination", "Wander"];

export default function Header({ dark, onToggleTheme, onDemo, step, done }) {
  return (
    <header className="absolute inset-x-0 top-0 z-30 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <Compass className="w-5 h-5" strokeWidth={2.25} />
          </div>
          <span className="text-lg sm:text-xl font-extrabold tracking-tight bg-linear-to-r from-slate-900 to-slate-700 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            Get-Lost Maps
          </span>
        </a>

        <nav aria-label="Progress" className="hidden lg:flex items-center gap-1 bg-slate-200/50 dark:bg-zinc-900/50 p-1 rounded-full border border-slate-300/50 dark:border-zinc-800">
          {STEPS.map((label, i) => {
            const complete = i < step || (i === 2 && done);
            const current = i === step && !complete;
            return (
              <span
                key={label}
                aria-current={current ? "step" : undefined}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full transition ${
                  current
                    ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm"
                    : complete
                      ? "text-sky-600 dark:text-sky-400"
                      : "text-slate-500 dark:text-zinc-500"
                }`}
              >
                {complete ? <Check className="w-3.5 h-3.5" /> : <span className="font-mono text-xs opacity-60">{i + 1}</span>}
                {label}
              </span>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-full border border-slate-200 dark:border-zinc-800 hover:bg-slate-200/50 dark:hover:bg-zinc-900 transition text-slate-600 dark:text-zinc-400"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
          <button
            onClick={onDemo}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/20 transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="sm:hidden">Demo</span>
            <span className="hidden sm:inline">Try Edinburgh</span>
          </button>
        </div>
      </div>
    </header>
  );
}
