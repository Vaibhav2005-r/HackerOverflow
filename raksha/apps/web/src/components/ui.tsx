import type { ComponentType, ReactNode } from "react";
import { m as motion } from "motion/react";
import { Moon, Search } from "lucide-react";
import { cx } from "../lib/cx";

export function Toggle({ on, onChange, label, testid }: { on: boolean; onChange: (b: boolean) => void; label: string; testid?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} data-testid={testid} onClick={() => onChange(!on)}
      className="relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[240ms]" style={{ background: on ? "var(--brand)" : "var(--line)" }}>
      <span className="absolute left-[3px] top-[3px] size-[18px] rounded-full bg-white shadow transition-transform duration-[240ms]" style={{ transform: `translateX(${on ? 16 : 0}px)` }} />
    </button>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, testid, label }: { value: T; options: [T, ReactNode][]; onChange: (v: T) => void; testid?: string; label?: string }) {
  return (
    <div className="flex rounded-xl bg-surface-2 p-[3px]" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} data-testid={testid ? `${testid}-${v}` : undefined} onClick={() => onChange(v)}
          className={cx("min-h-9 min-w-9 rounded-[10px] px-3 text-sm font-semibold transition-colors", value === v ? "bg-brand text-brand-ink" : "text-text-2")}>{l}</button>
      ))}
    </div>
  );
}

export function QuickAction({ icon: Icon, label, onClick, testid, tint }: { icon: ComponentType<{ size?: number; strokeWidth?: number }>; label: string; onClick: () => void; testid?: string; tint?: string }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={onClick} data-testid={testid}
      className="flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-1 text-xs font-medium shadow-[0_0_0_1px_var(--line)]" style={{ color: "var(--text-1)" }}>
      <span style={{ color: tint ?? "var(--sakhi-a)" }}><Icon size={22} strokeWidth={1.75} /></span>{label}
    </motion.button>
  );
}

export function SearchPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} data-testid="search" className="flex h-14 w-full items-center gap-3 rounded-full bg-surface-2 px-5 text-left text-text-2 shadow-[0_0_0_1px_var(--line)]">
      <Search size={20} strokeWidth={1.75} /><span className="text-base">{label}</span>
    </button>
  );
}

export function TimeBandChip({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} data-testid="time-band" className="glass flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold">
      <Moon size={14} strokeWidth={1.75} style={{ color: "var(--brand-soft)" }} />{label}
    </button>
  );
}

export function IconButton({ children, label, onClick, testid, className }: { children: ReactNode; label: string; onClick: () => void; testid?: string; className?: string }) {
  return <button type="button" aria-label={label} data-testid={testid} onClick={onClick} className={cx("glass grid size-11 place-items-center rounded-full", className)}>{children}</button>;
}
