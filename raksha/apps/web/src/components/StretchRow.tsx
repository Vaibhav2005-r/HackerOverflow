import { Footprints, Moon, Store } from "lucide-react";
import { Reason, type Stretch, type StretchExplanation } from "@raksha/core";
import { CLASS_COLOR } from "../map/colors";
import { useT } from "../i18n";

/** One weak stretch: class-tinted icon, title (leading reason), tip, distance from start. */
export function StretchRow({ stretch, exp }: { stretch: Stretch; exp: StretchExplanation | undefined }) {
  const t = useT();
  const Icon = stretch.reasons & Reason.UNLIT ? Moon : stretch.reasons & Reason.NOTHING_OPEN ? Store : Footprints;
  const color = CLASS_COLOR[stretch.cls];
  const title = exp?.reasonKeys[0] ? t(exp.reasonKeys[0]) : t(`class.${stretch.cls}`);
  return (
    <div className="flex items-start gap-3 py-2" data-testid="stretch-row">
      <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}><Icon size={16} strokeWidth={1.75} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5">{title}</p>
        {exp?.tip && <p className="text-[13px] leading-[18px] text-text-2">{t(exp.tip.key, exp.tip.params)}</p>}
      </div>
      <span className="text-xs text-text-3">{Math.round(stretch.startM)} m</span>
    </div>
  );
}
