import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useCity } from "../store/city";
import { summarize, useNcrb } from "../store/ncrb";
import { navigate } from "../lib/router";
import { useT } from "../i18n";

/** Compare the covered cities' districts by registered cases. Counts, not rates — large cities are large. */
export default function Insights() {
  const t = useT();
  const { data, load } = useNcrb();
  const index = useCity((s) => s.index);
  useEffect(() => { void load(); }, [load]);
  const rows = data ? index.map((c) => ({ c, s: data.cities[c.id] ? summarize(data.cities[c.id]!.totals, data.years) : null })).filter((r) => r.s).sort((a, b) => b.s!.total - a.s!.total) : [];
  const max = Math.max(1, ...rows.map((r) => r.s!.total));
  const year = rows[0]?.s?.year;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-bg-0 px-5 pb-16 safe-top" data-testid="insights">
      <div className="flex items-center gap-2 py-2"><button className="btn !min-h-11" onClick={() => navigate("/")} aria-label={t("common.back")}><ArrowLeft size={20} /></button><h1 className="text-xl font-bold">{t("insights.title")}</h1></div>
      {year && <p className="mt-1 text-sm text-text-2">{t("insights.sub", { year })}</p>}
      <ul className="mt-5 space-y-3">
        {rows.map(({ c, s }) => (
          <li key={c.id} data-testid="insight-row">
            <div className="flex items-baseline justify-between"><span className="font-semibold">{c.name}</span><span className="tabular-nums text-sm text-text-2">{s!.total.toLocaleString("en-IN")}{s!.pct != null && ` · ${s!.pct > 0 ? "+" : ""}${s!.pct}%`}</span></div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${(s!.total / max) * 100}%`, background: "var(--brand-soft)" }} /></div>
          </li>
        ))}
      </ul>
      <p className="mt-6 rounded-xl bg-surface-2 p-3 text-xs leading-5 text-text-2">{t("ncrb.caveat1")} {t("ncrb.caveat2")}</p>
      {data && <p className="mt-3 text-xs"><a className="underline" style={{ color: "var(--brand-soft)" }} href={data.source.url} target="_blank" rel="noreferrer">{t("ncrb.source")}</a></p>}
    </div>
  );
}
