import { useEffect } from "react";
import { Sheet } from "./Sheet";
import { YearBars } from "./YearBars";
import { useNcrb, summarize } from "../store/ncrb";
import { navigate } from "../lib/router";
import { useT } from "../i18n";

/** District-level NCRB context for a city. Always shown with its caveats; never feeds the street-level score. */
export function DistrictSheet({ cityId, regionState, cityName, open, onOpenChange }: { cityId?: string; regionState?: string; cityName?: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const { data, load, status } = useNcrb();
  useEffect(() => { if (open) void load(); }, [open, load]);
  // a covered city has its own NCRB district(s); elsewhere in a state-wide area we show the state total
  const city = cityId ? data?.cities[cityId] : regionState ? data?.states[regionState] : undefined;
  const s = city && data ? summarize(city.totals, data.years) : null;
  const members = cityId && data?.cities[cityId] ? data.districts.filter((d) => data.cities[cityId]!.districts.includes(d.key)) : [];
  const stateRank = !cityId && regionState && data ? data.states[regionState]?.rank?.[String(s?.year)] : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("ncrb.title")}>
      <div data-testid="district-sheet">
        <p className="eyebrow text-text-2">{t("ncrb.title")}{cityName ? ` · ${cityName}` : ""}</p>
        {!data && status !== "error" && <p className="mt-3 text-text-2">…</p>}
        {status === "error" && <p className="mt-3 text-text-2">{t("ncrb.noData")}</p>}
        {data && !s && <p className="mt-3 text-text-2" data-testid="ncrb-none">{t("ncrb.noData")}</p>}
        {data && s && city && (
          <>
            <p className="mt-2 text-sm text-text-2">{t("ncrb.registered", { year: s.year })}</p>
            <p className="text-4xl font-bold tabular-nums" data-testid="ncrb-total">{s.total.toLocaleString("en-IN")}</p>
            {s.pct != null && <p className="text-sm text-text-2" data-testid="ncrb-trend">{t("ncrb.trend", { pct: `${s.pct > 0 ? "+" : ""}${s.pct}`, year: s.baseYear })}</p>}
            <div className="mt-3"><YearBars years={data.years} totals={city.totals} label={t("ncrb.registered", { year: s.year })} /></div>
            {stateRank && <p className="mt-2 text-sm text-text-2" data-testid="ncrb-state-rank">{t("ncrb.stateRank", { state: regionState ?? "", rank: stateRank[0], n: stateRank[1], year: s.year })}</p>}
            <ul className="mt-2 space-y-1 text-sm text-text-2">
              {members.slice(0, 6).map((d) => { const r = d.rank?.[String(s.year)]; return r ? <li key={d.key}>{t("ncrb.rank", { district: d.district, rank: r[0], n: r[1], year: s.year })}</li> : null; })}
            </ul>
          </>
        )}
        <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs leading-5 text-text-2" data-testid="ncrb-caveat">{t("ncrb.caveat1")} {t("ncrb.caveat2")}</p>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
          <a className="underline" style={{ color: "var(--brand-soft)" }} href={data?.source.url ?? "https://indiadataportal.com"} target="_blank" rel="noreferrer">{t("ncrb.source")}</a>
          <button className="btn !min-h-10" data-testid="open-insights" onClick={() => { onOpenChange(false); navigate("/insights"); }}>{t("ncrb.all")}</button>
        </div>
      </div>
    </Sheet>
  );
}
