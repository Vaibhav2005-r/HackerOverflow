import type { SafetyClass } from "@raksha/core";
import { CLASS_COLOR } from "../map/colors";
import { useT } from "../i18n";

export function ClassBadge({ cls }: { cls: SafetyClass }) {
  const t = useT();
  return (
    <span className="chip" data-testid="class-badge" data-cls={cls}>
      <span className="size-2.5 rounded-full" style={{ background: CLASS_COLOR[cls] }} />{t(`class.${cls}`)}
    </span>
  );
}
