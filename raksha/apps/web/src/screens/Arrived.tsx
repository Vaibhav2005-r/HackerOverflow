import { useState } from "react";
import { Check } from "lucide-react";
import { CompanionOrb } from "../components/CompanionOrb";
import { closeArrived, useJourney } from "../store/journey";
import { useSession } from "../store/session";
import { useSettings } from "../store/settings";
import { shareText } from "../lib/share";
import { useT } from "../i18n";

export default function Arrived() {
  const t = useT();
  const info = useJourney((s) => s.arrived);
  const contact = useSession((s) => s.circle[0]?.name) ?? t("plan.yourCircle");
  const name = useSettings((s) => s.name);
  const [sent, setSent] = useState(false);
  if (!info) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-bg-0 px-6 pb-10 pt-28 text-center" data-testid="arrived">
      <div className="flex w-full flex-col items-center">
        <CompanionOrb state="arrived" size={160} />
        <h1 className="mt-14 text-[28px] font-semibold leading-[34px]">{t("arrived.title")}</h1>
        <p className="mt-2 text-text-2">{t("arrived.ask", { contact })}</p>
        <div className="mt-8 grid w-full grid-cols-3 gap-2 rounded-2xl bg-surface-1 p-4">
          {[[info.minutes, t("arrived.min")], [info.km, t("arrived.km")], [info.guarded, t("arrived.guarded")]].map(([v, l]) => (
            <div key={String(l)}><p className="text-lg font-bold">{v}</p><p className="text-xs text-text-3">{l}</p></div>
          ))}
        </div>
      </div>
      <div className="w-full space-y-2">
        {sent
          ? <p className="flex h-[60px] items-center justify-center gap-2 rounded-2xl bg-surface-1 font-semibold" role="status"><Check size={18} style={{ color: "var(--success)" }} />{t("resolved.sent")}</p>
          : <button className="btn btn-primary h-[60px] w-full text-base" data-testid="arrived-tell" onClick={() => { void shareText(`${name || "I"} reached home safely.`); setSent(true); }}>{t("arrived.tell", { contact })}</button>}
        <button className="btn btn-ghost h-12 w-full" data-testid="arrived-close" onClick={closeArrived}>{t("common.close")}</button>
      </div>
    </div>
  );
}
