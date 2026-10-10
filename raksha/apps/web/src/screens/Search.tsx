import { useEffect, useRef, useState } from "react";
import { m as motion } from "motion/react";
import { ArrowLeft, Clock, Locate, MapPin } from "lucide-react";
import { useSettings } from "../store/settings";
import { pickStart, planTo, useJourney, type PlaceLite } from "../store/journey";
import { navigate } from "../lib/router";
import { useT } from "../i18n";

/** Search for a destination — or, in "start" mode, for where she is starting from (when GPS is off or she is planning ahead). */
export default function Search() {
  const t = useT();
  const [q, setQ] = useState("");
  const [live, setLive] = useState<PlaceLite[]>([]);
  const [searched, setSearched] = useState(false);
  const user = useJourney((s) => s.user);
  const mode = useJourney((s) => s.searchFor);
  const recents = useSettings((s) => s.recents);
  const abort = useRef<AbortController | null>(null);

  // debounced live search (300 ms), biased towards where she is
  useEffect(() => {
    abort.current?.abort(); setSearched(false);
    if (q.trim().length < 2) { setLive([]); return; }
    const ctl = (abort.current = new AbortController());
    const id = setTimeout(() => {
      import("../services/geocode").then((g) => g.searchPlaces(q, user ? { lat: user.lat, lng: user.lng } : null, ctl.signal))
        .then((r) => { setLive(r); setSearched(true); })
        .catch((e) => { if ((e as Error).name !== "AbortError") { setLive([]); setSearched(true); } });
    }, 300);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [q, user]);

  const match = (p: PlaceLite) => !q.trim() || `${p.name} ${p.detail ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());
  const rec = recents.filter(match);
  const none = q.trim().length >= 2 && searched && live.length === 0 && rec.length === 0;
  const pick = (p: PlaceLite) => (mode === "start" ? pickStart(p) : void planTo(p));
  const leave = () => { useJourney.setState({ searchFor: "dest", pendingDest: null }); navigate(useJourney.getState().plan ? "/plan" : "/"); };

  const Row = ({ p, icon, onPick, testid }: { p: { name: string; detail?: string }; icon: React.ReactNode; onPick: () => void; testid?: string }) => (
    <li><button className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left active:bg-surface-1" data-testid={testid} onClick={onPick}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-1" style={{ color: "var(--brand-soft)" }}>{icon}</span>
      <span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{p.name}</span>{p.detail && <span className="block truncate text-[13px] text-text-2">{p.detail}</span>}</span>
    </button></li>
  );
  const Head = ({ children }: { children: string }) => <h3 className="eyebrow mb-1 mt-5 px-2 text-text-2">{children}</h3>;

  return (
    <motion.div className="absolute inset-x-0 bottom-0 top-[54px] z-20 flex flex-col rounded-t-[28px] bg-bg-1 px-4 pt-4 shadow-elev" data-testid="search-screen"
      initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 32 }}>
      <div className="flex items-center gap-2">
        <button className="btn size-12 !min-h-12 !rounded-full !p-0" aria-label={t("common.back")} data-testid="search-back" onClick={leave}><ArrowLeft size={20} strokeWidth={1.75} /></button>
        <input className="field !rounded-full" data-testid="search-input" placeholder={mode === "start" ? t("search.startPlaceholder") : t("search.placeholder")} value={q} autoFocus onChange={(e) => setQ(e.target.value)} aria-label={t("search.placeholder")} />
      </div>
      <div className="mt-1 flex-1 overflow-y-auto pb-8">
        {mode === "start" && user && (
          <ul className="mt-3"><Row p={{ name: t("search.useGps") }} icon={<Locate size={18} strokeWidth={1.75} />} testid="use-gps" onPick={() => { useJourney.setState({ start: null, searchFor: "dest" }); const d = useJourney.getState().pendingDest; if (d) void planTo(d); else navigate("/"); }} /></ul>
        )}
        {rec.length > 0 && <><Head>{t("search.recent")}</Head><ul>{rec.map((p) => <Row key={p.name} p={p} icon={<Clock size={18} strokeWidth={1.75} />} onPick={() => pick(p)} />)}</ul></>}
        {live.length > 0 && <><Head>{t("search.results")}</Head><ul data-testid="search-results">{live.map((p, i) => <Row key={i} p={p} icon={<MapPin size={18} strokeWidth={1.75} />} testid={`result-${i}`} onPick={() => pick(p)} />)}</ul></>}
        {none && <p className="mt-8 px-4 text-center text-text-2" data-testid="search-none">{t("search.none")}</p>}
      </div>
    </motion.div>
  );
}
