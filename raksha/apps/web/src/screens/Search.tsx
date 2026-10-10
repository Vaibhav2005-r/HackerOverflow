import { useEffect, useRef, useState } from "react";
import { m as motion } from "motion/react";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { useCity } from "../store/city";
import { useSettings } from "../store/settings";
import { planPreset, planTo, useJourney, type PlaceLite } from "../store/journey";
import { getFixtures } from "../services/fixtures";
import { navigate } from "../lib/router";
import { useT } from "../i18n";

// Landmarks inside the demo area, always available offline
const SAVED: PlaceLite[] = [
  { name: "Thakur College (TCET)", detail: "Thakur Village, Kandivali East", lng: 72.8746, lat: 19.2060 },
  { name: "Kandivali station", detail: "Kandivali West", lng: 72.8519, lat: 19.2054 },
  { name: "Malad station", detail: "Malad West", lng: 72.8493, lat: 19.1864 },
  { name: "Goregaon station", detail: "Goregaon West", lng: 72.8493, lat: 19.1646 },
];

export default function Search() {
  const t = useT();
  const [q, setQ] = useState("");
  const [live, setLive] = useState<PlaceLite[]>([]);
  const [searched, setSearched] = useState(false);
  const meta = useCity((s) => s.meta);
  const user = useJourney((s) => s.user);
  const recents = useSettings((s) => s.recents);
  const abort = useRef<AbortController | null>(null);
  const presets = getFixtures();

  // debounced live search (300 ms), merged with local filtering
  useEffect(() => {
    abort.current?.abort(); setSearched(false);
    if (q.trim().length < 2) { setLive([]); return; }
    const ctl = (abort.current = new AbortController());
    const id = setTimeout(() => {
      const c = user ?? (meta ? { lat: (meta.bbox[0] + meta.bbox[2]) / 2, lng: (meta.bbox[1] + meta.bbox[3]) / 2 } : { lat: 19.19, lng: 72.857 });
      import("../services/geocode").then((g) => g.searchPlaces(q, c, ctl.signal)).then((r) => { setLive(r); setSearched(true); }).catch((e) => { if ((e as Error).name !== "AbortError") { setLive([]); setSearched(true); } });
    }, 300);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [q, user, meta]);

  const match = (p: PlaceLite) => !q.trim() || `${p.name} ${p.detail ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());
  const saved = SAVED.filter(match), rec = recents.filter(match);
  const demos = presets.filter((p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase()) || "demo".includes(q.trim().toLowerCase()));
  const none = q.trim().length >= 2 && searched && live.length === 0 && saved.length === 0 && rec.length === 0 && demos.length === 0;

  const Row = ({ p, icon, onPick, testid }: { p: { name: string; detail?: string }; icon: React.ReactNode; onPick: () => void; testid?: string }) => (
    <li><button className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left active:bg-surface-1" data-testid={testid} onClick={onPick}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-1" style={{ color: "var(--brand-soft)" }}>{icon}</span>
      <span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{p.name}</span>{p.detail && <span className="block truncate text-[13px] text-text-2">{p.detail}</span>}</span>
    </button></li>
  );
  const Head = ({ children }: { children: string }) => <h3 className="eyebrow mb-1 mt-5 px-2 text-text-3">{children}</h3>;

  return (
    <motion.div className="absolute inset-x-0 bottom-0 top-[54px] z-20 flex flex-col rounded-t-[28px] bg-bg-1 px-4 pt-4 shadow-elev" data-testid="search-screen"
      initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 32 }}>
      <div className="flex items-center gap-2">
        <button className="btn size-12 !min-h-12 !rounded-full !p-0" aria-label={t("common.back")} data-testid="search-back" onClick={() => navigate("/")}><ArrowLeft size={20} strokeWidth={1.75} /></button>
        <input className="field !rounded-full" data-testid="search-input" placeholder={t("search.placeholder")} value={q} autoFocus onChange={(e) => setQ(e.target.value)} aria-label={t("search.placeholder")} />
      </div>
      <div className="mt-1 flex-1 overflow-y-auto pb-8">
        {demos.length > 0 && <><Head>{t("search.demo")}</Head><ul>{demos.map((p) => <Row key={p.id} p={{ name: p.title, detail: `${p.from.name} → ${p.to.name}` }} icon={<MapPin size={18} strokeWidth={1.75} />} testid={`demo-${p.id}`} onPick={() => { useSettings.getState().set({ demoBand: "night" }); planPreset(p.id); }} />)}</ul></>}
        {saved.length > 0 && <><Head>{t("search.saved")}</Head><ul>{saved.map((p) => <Row key={p.name} p={p} icon={<MapPin size={18} strokeWidth={1.75} />} onPick={() => planTo(p)} />)}</ul></>}
        {rec.length > 0 && <><Head>{t("search.recent")}</Head><ul>{rec.map((p) => <Row key={p.name} p={p} icon={<Clock size={18} strokeWidth={1.75} />} onPick={() => planTo(p)} />)}</ul></>}
        {live.length > 0 && <><Head>{t("search.results")}</Head><ul data-testid="search-results">{live.map((p, i) => <Row key={i} p={p} icon={<MapPin size={18} strokeWidth={1.75} />} onPick={() => planTo(p)} />)}</ul></>}
        {none && <p className="mt-8 px-4 text-center text-text-2" data-testid="search-none">{t("search.none")}</p>}
      </div>
    </motion.div>
  );
}
