import { useState } from "react";
import { cellInfo, type Band, type ReportCategory } from "@raksha/core";
import { Sheet } from "./Sheet";
import { ClassBadge } from "./ClassBadge";
import { useCity } from "../store/city";
import { getBackend } from "../services/backend";
import { toast } from "../store/toast";
import { useJourney } from "../store/journey";
import { useT } from "../i18n";

const NEG: [number, string][] = [[1, "reason.unlit"], [2, "reason.isolated"], [4, "reason.nothingOpen"], [8, "reason.farFromHelp"], [16, "reason.narrowLane"], [32, "reason.fewPeople"], [64, "reason.reports"], [128, "reason.lowData"]];
const POS: [number, string][] = [[256, "positive.WELL_LIT"], [512, "positive.BUSY_STREET"], [1024, "positive.HELP_NEARBY"], [2048, "positive.TRANSIT_NEARBY"]];
const CATS: ReportCategory[] = ["harassment", "stalking", "felt_unsafe", "poor_lighting", "no_help_nearby", "well_lit", "helpful_people", "felt_safe"];

/** Hex reasons: class, confidence, up to 3 reasons, positives, footnote, and a local-mode report entry. */
export function ReasonsSheet({ h3, band, onClose }: { h3: string | null; band: Band; onClose: () => void }) {
  const t = useT();
  const cells = useCity((s) => s.cells);
  const adj = useCity((s) => s.adj);
  const [reporting, setReporting] = useState(false);
  const info = h3 ? cellInfo(cells, h3, band, adj) : undefined;
  const neg = NEG.filter(([b]) => (info?.reasons ?? 0) & b).slice(0, 3);
  const pos = POS.filter(([b]) => (info?.reasons ?? 0) & b);

  const report = async (c: ReportCategory) => {
    if (!h3) return;
    const u = useJourney.getState().user;
    try {
      await getBackend().submitReport({ h3, band, category: c }, u ? { lat: u.lat, lng: u.lng } : undefined);
    } catch (e) { toast((e as Error).message); return; }
    await useCity.getState().refreshAggregates();
    toast(t("report.thanks"));
    setReporting(false); onClose();
  };

  return (
    <Sheet open={!!h3} onOpenChange={(o) => { if (!o) { setReporting(false); onClose(); } }} title={t("home.hexes")}>
      {info && (
        <div data-testid="hex-reasons">
          <div className="flex items-center justify-between"><h3 className="text-xl font-bold">{t(`class.${info.cls}`)} · {t(`band.${band}`)}</h3><ClassBadge cls={info.cls} /></div>
          <p className="mt-1 text-sm text-text-2">{t("hex.score", { score: info.score })} · {t(`conf.${info.confidence}`)}</p>
          {!reporting ? (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {neg.map(([b, k]) => <span key={b} className="chip" style={{ background: "color-mix(in srgb, var(--cls-extra-care) 16%, transparent)" }}>{t(k)}</span>)}
                {pos.map(([b, k]) => <span key={b} className="chip" style={{ background: "color-mix(in srgb, var(--cls-comfortable) 16%, transparent)" }}>{t(k)}</span>)}
                {neg.length + pos.length === 0 && <span className="text-sm text-text-2">—</span>}
              </div>
              <p className="mt-4 text-xs text-text-3">{t("basedOn")}</p>
              <button className="btn mt-4 w-full" data-testid="report-here" onClick={() => setReporting(true)}>{t("report.here")}</button>
            </>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2" data-testid="report-cats">
              {CATS.map((c) => <button key={c} className="btn h-12 text-sm" data-testid={`report-${c}`} onClick={() => void report(c)}>{t(`report.${c}`)}</button>)}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
