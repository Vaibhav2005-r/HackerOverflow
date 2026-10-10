import { useState } from "react";
import { Check } from "lucide-react";
import { CompanionOrb } from "../components/CompanionOrb";
import { closeResolved, useJourney } from "../store/journey";
import { useSettings } from "../store/settings";
import { shareText } from "../lib/share";
import { useT } from "../i18n";

/**
 * Shown after a real OR a duress cancel — the UI is identical on purpose.
 * The duress branch never opens a share dialog or messages anyone as "safe"; it only looks like it did.
 */
export default function Resolved() {
  const t = useT();
  const duress = useJourney((s) => s.sos?.duress ?? false);
  const name = useSettings((s) => s.name);
  const [sent, setSent] = useState(false);
  const tell = async () => { if (!duress) await shareText(`${name || "I"} is safe. Thank you for being there.`); setSent(true); };
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-bg-0 px-6 pb-10 pt-32 text-center" data-testid="resolved">
      <div className="flex flex-col items-center">
        <CompanionOrb state="arrived" size={160} />
        <h1 className="mt-14 text-[28px] font-semibold leading-[34px]" data-testid="resolved-title">{t("resolved.title")}</h1>
      </div>
      <div className="w-full space-y-2">
        {sent
          ? <p className="flex h-[60px] items-center justify-center gap-2 rounded-2xl bg-surface-1 font-semibold" role="status" data-testid="resolved-sent"><Check size={18} style={{ color: "var(--success)" }} />{t("resolved.sent")}</p>
          : <button className="btn btn-primary h-[60px] w-full text-base" data-testid="resolved-tell" onClick={() => void tell()}>{t("resolved.tell")}</button>}
        <button className="btn btn-ghost h-12 w-full" data-testid="resolved-done" onClick={closeResolved}>{t("common.close")}</button>
      </div>
    </div>
  );
}
