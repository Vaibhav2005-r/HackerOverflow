import { BANK, type Lang, type MessageKey } from "./bank";

const DEFAULTS: Record<string, string | number> = { name: "there", contact: "your circle", m: "a few", minutes: "a few", litPct: "most", seconds: "3" };

export function render(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? DEFAULTS[k] ?? ""));
}

/** Stateful picker: rotates variants so the same line is never spoken twice in a row. */
export class Messenger {
  private last = new Map<string, number>();
  private lastText = "";
  constructor(public lang: Lang = "en") {}

  say(key: MessageKey, params: Record<string, string | number> = {}): string {
    const variants = BANK[this.lang][key] ?? BANK.en[key];
    if (!variants?.length) throw new Error(`missing message ${key}`);
    let i = ((this.last.get(key) ?? -1) + 1) % variants.length;
    let text = render(variants[i]!, params);
    if (text === this.lastText && variants.length > 1) { i = (i + 1) % variants.length; text = render(variants[i]!, params); }
    this.last.set(key, i);
    this.lastText = text;
    return text;
  }
}

export function missingKeys(lang: Lang, keys: MessageKey[]): MessageKey[] {
  return keys.filter((k) => !BANK[lang][k]?.length);
}
