import { BANK, type Lang, type MessageKey } from "./bank";

const DEFAULTS_EN: Record<string, string | number> = { name: "there", contact: "your circle", m: "a few", minutes: "a few", litPct: "most", seconds: "3" };
const DEFAULTS_HI: Record<string, string | number> = { name: "", contact: "आपके लोग", m: "कुछ", minutes: "कुछ", litPct: "ज़्यादातर", seconds: "3" };

export function render(template: string, params: Record<string, string | number> = {}, lang: Lang = "en"): string {
  const defaults = lang === "hi" ? DEFAULTS_HI : DEFAULTS_EN;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? defaults[k] ?? ""));
}

/** Stateful picker: rotates variants so the same line is never spoken twice in a row. */
export class Messenger {
  private last = new Map<string, number>();
  private lastText = "";
  constructor(public lang: Lang = "en") {}

  say(key: MessageKey, params: Record<string, string | number> = {}): string {
    const own = BANK[this.lang][key];
    const variants = own ?? BANK.en[key];
    const lang: Lang = own ? this.lang : "en";
    if (!variants?.length) throw new Error(`missing message ${key}`);
    let i = ((this.last.get(key) ?? -1) + 1) % variants.length;
    let text = render(variants[i]!, params, lang);
    if (text === this.lastText && variants.length > 1) { i = (i + 1) % variants.length; text = render(variants[i]!, params, lang); }
    this.last.set(key, i);
    this.lastText = text;
    return text;
  }
}

export function missingKeys(lang: Lang, keys: MessageKey[]): MessageKey[] {
  return keys.filter((k) => !BANK[lang][k]?.length);
}
