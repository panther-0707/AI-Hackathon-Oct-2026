import { useRef, useState } from "react";
import { Check, LoaderCircle, LocateFixed, MapPin } from "lucide-react";
import { API } from "../lib/api";
import { fmtPoint } from "../lib/format";

// "Edinburgh Waverley, Edinburgh, Scotland, United Kingdom" -> ["Edinburgh Waverley", "Edinburgh, Scotland, United Kingdom"]
function splitLabel(label) {
  const i = label.indexOf(",");
  return i < 0 ? [label, ""] : [label.slice(0, i), label.slice(i + 1).trim()];
}

// one row of the trip card: search a place (backend /geocode), optionally use the device location
export default function AddressField({ letter, label, dot, point, waiting, placeholder, onPick, onClear, getFocus, locatable }) {
  const [text, setText] = useState(null); // null = not editing: show the point's name
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("");
  const [locStatus, setLocStatus] = useState("");
  const timer = useRef(null);
  const reqId = useRef(0);

  function cancelSearch() {
    clearTimeout(timer.current);
    reqId.current++;
    setResults([]);
    setStatus("");
  }

  function search(v) {
    clearTimeout(timer.current);
    const q = v.trim();
    if (q.length < 3) return cancelSearch();
    timer.current = setTimeout(async () => {
      const id = ++reqId.current;
      setStatus("Searching...");
      try {
        const qs = new URLSearchParams({ q });
        const focus = getFocus?.();
        if (focus) {
          qs.set("lon", focus[0]);
          qs.set("lat", focus[1]);
        }
        const res = await fetch(`${API}/geocode?${qs}`);
        if (!res.ok) throw new Error(`geocode ${res.status}`);
        const list = (await res.json()).results || [];
        if (id !== reqId.current) return;
        setResults(list);
        setActive(0);
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
    cancelSearch();
    setText(null);
    const [name, area] = splitLabel(r.label);
    onPick({ lonlat: r.lonlat, label: name, detail: area });
  }

  function locate() {
    if (!navigator.geolocation) return setLocStatus("Location isn't available in this browser");
    setLocStatus("Finding you...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocStatus("");
        onPick({ lonlat: [pos.coords.longitude, pos.coords.latitude], label: "My location" });
      },
      () => setLocStatus("Couldn't get your location"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const busy = status === "Searching..." || locStatus === "Finding you...";
  const note = locStatus || status;
  const coords = !note && point && !point.detail;
  const sub = note || (point ? point.detail || fmtPoint(point.lonlat) : "");

  return (
    <div className="relative flex items-start gap-3 px-3 py-2.5 first:rounded-t-xl last:rounded-b-xl focus-within:bg-white dark:focus-within:bg-zinc-900 transition">
      <span className={`mt-1 w-6 h-6 shrink-0 rounded-full ring-4 ${dot} text-white font-mono text-xs font-semibold flex items-center justify-center`}>
        {letter}
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-zinc-500">{label}</div>
        <input
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={results.length > 0}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          value={text ?? point?.label ?? ""}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setLocStatus("");
            search(e.target.value);
          }}
          onFocus={(e) => e.target.select()}
          onBlur={() => {
            if (text === "" && point) onClear();
            setText(null);
            cancelSearch();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              if (!results.length) return;
              e.preventDefault();
              setActive((a) => (a + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
            } else if (e.key === "Enter" && results[active]) {
              choose(results[active]);
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.currentTarget.blur();
            }
          }}
          className={`w-full bg-transparent text-sm font-medium truncate focus:outline-none placeholder:font-normal ${
            waiting ? "placeholder:text-sky-600 dark:placeholder:text-sky-400" : "placeholder:text-slate-400 dark:placeholder:text-zinc-600"
          }`}
        />
        {sub && (
          <div className={`flex items-center gap-1.5 text-[11px] truncate ${note && !busy ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-zinc-500"} ${coords ? "font-mono" : ""}`}>
            {busy && <LoaderCircle className="w-3 h-3 animate-spin text-sky-500 shrink-0" />}
            {sub}
          </div>
        )}
      </div>

      <div className="mt-1 flex items-center gap-1.5 shrink-0">
        {locatable && (
          <button
            type="button"
            onClick={locate}
            aria-label="Use my location"
            title="Use my location"
            className="p-1.5 rounded-full border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 hover:border-sky-500/40 transition"
          >
            <LocateFixed className="w-3.5 h-3.5" />
          </button>
        )}
        {point ? (
          <Check className="w-4 h-4 text-emerald-500" />
        ) : (
          waiting && (
            <span className="relative flex w-2 h-2 mx-1">
              <span className="absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-sky-500" />
            </span>
          )
        )}
      </div>

      {results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 left-2 right-2 top-full -mt-1 py-1 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl shadow-slate-900/15 dark:shadow-black/60 overflow-hidden"
        >
          {results.map((r, i) => {
            const [name, area] = splitLabel(r.label);
            return (
              <li key={`${r.label}-${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // keep focus so blur doesn't close the list first
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition ${i === active ? "bg-sky-500/10" : ""}`}
                >
                  <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${i === active ? "text-sky-500" : "text-slate-400 dark:text-zinc-500"}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{name}</span>
                    {area && <span className="block text-xs text-slate-500 dark:text-zinc-500 truncate">{area}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
