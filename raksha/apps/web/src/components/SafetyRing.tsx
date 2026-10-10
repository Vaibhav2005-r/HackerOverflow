import { m as motion } from "motion/react";
import type { SafetyClass } from "@raksha/core";
import { CLASS_COLOR } from "../map/colors";
import { useT } from "../i18n";

/** Route comfort ring (0–100). Track 4 px, round cap, starts at −90°. It is an estimate, never "safe". */
export function SafetyRing({ value, cls, size = 52, stroke = 4 }: { value: number; cls: SafetyClass; size?: number; stroke?: number }) {
  const t = useT();
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${t("route.rsi")} ${Math.round(value)} / 100, ${t(`class.${cls}`)}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={CLASS_COLOR[cls]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(100, value)) / 100) }} transition={{ type: "spring", stiffness: 170, damping: 26 }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[15px] font-bold tabular-nums">{Math.round(value)}</span>
    </div>
  );
}
