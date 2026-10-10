import { en, type StringKey } from "./en";
import { hi } from "./hi";
import { useSettings } from "../store/settings";

const dict: Record<string, Record<string, string>> = { en, hi };

export function translate(lang: string, key: string, params: Record<string, string | number> = {}): string {
  const raw = dict[lang]?.[key] ?? en[key as StringKey] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ""));
}

export function useT() {
  const lang = useSettings((s) => s.lang);
  return (key: StringKey | string, params?: Record<string, string | number>) => translate(lang, key, params);
}
export const tNow = (key: string, params?: Record<string, string | number>) => translate(useSettings.getState().lang, key, params);
export type { StringKey };
