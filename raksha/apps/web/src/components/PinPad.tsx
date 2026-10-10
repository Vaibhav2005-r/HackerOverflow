import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { useT } from "../i18n";

/** 4-digit pad: round 76 px keys, auto-submits on the 4th digit. A wrong PIN shakes and clears the dots. */
export function PinPad({ title, sub, error, errorKey, onSubmit, disabled, length = 4 }: { title: string; sub?: string; error?: string; errorKey?: number; onSubmit: (pin: string) => void; disabled?: boolean; length?: number }) {
  const t = useT();
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(0);
  useEffect(() => { if (error) { setPin(""); setShake((n) => n + 1); } }, [error, errorKey]);
  const press = (d: string) => {
    if (disabled) return;
    const next = (pin + d).slice(0, length);
    setPin(next);
    if (next.length === length) { setTimeout(() => { onSubmit(next); setPin(""); }, 120); }
  };
  const key = "grid size-[76px] place-items-center rounded-full bg-surface-1 text-[28px] font-medium active:bg-surface-2 disabled:opacity-40";
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center" data-testid="pinpad">
      <h2 className="text-[22px] font-semibold leading-7">{title}</h2>
      {sub && <p className="mt-1 text-text-2">{sub}</p>}
      <div key={shake} className={`mt-6 flex gap-4 ${shake ? "shake" : ""}`} role="img" aria-label={`${pin.length} of ${length} digits`}>
        {Array.from({ length }, (_, i) => <span key={i} className="size-4 rounded-full" style={i < pin.length ? { background: "var(--text-1)" } : { boxShadow: "inset 0 0 0 2px var(--text-3)" }} />)}
      </div>
      <p className="mt-3 h-5 text-sm" style={{ color: "var(--cls-extra-care)" }} role="alert">{error}</p>
      <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-7">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} type="button" className={key} disabled={disabled} onClick={() => press(d)}>{d}</button>)}
        <span />
        <button type="button" className={key} disabled={disabled} onClick={() => press("0")}>0</button>
        <button type="button" className="grid size-[76px] place-items-center rounded-full" aria-label={t("common.delete")} disabled={disabled} onClick={() => setPin((p) => p.slice(0, -1))}><Delete strokeWidth={1.75} /></button>
      </div>
    </div>
  );
}
