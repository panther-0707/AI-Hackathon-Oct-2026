export function Eyebrow({ icon: Icon, children }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-500">
      {Icon && <Icon className="w-4 h-4" />} {children}
    </div>
  );
}

export function Section({ children, className = "" }) {
  return <section className={`relative px-5 py-4 border-t border-slate-200 dark:border-zinc-800/80 ${className}`}>{children}</section>;
}

export function IconButton({ label, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="p-1.5 rounded-full border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200/50 dark:hover:bg-zinc-900 hover:text-slate-900 dark:hover:text-zinc-100 disabled:opacity-40 disabled:pointer-events-none transition"
      {...props}
    >
      {children}
    </button>
  );
}

