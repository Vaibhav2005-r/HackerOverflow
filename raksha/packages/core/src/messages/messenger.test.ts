import { describe, expect, it } from "vitest";
import { BANK, MESSAGE_KEYS, SHIPPED_LANGS } from "./bank";
import { Messenger, missingKeys, render } from "./messenger";

describe("message bank", () => {
  it.each(SHIPPED_LANGS)("every key exists in shipped language %s with ≥ 2 variants", (lang) => {
    expect(missingKeys(lang, MESSAGE_KEYS)).toEqual([]);
    for (const k of MESSAGE_KEYS) expect(BANK[lang][k]!.length).toBeGreaterThanOrEqual(2);
  });
  it("detects a missing key", () => { expect(missingKeys("hi", ["guard_on"])).toEqual(["guard_on"]); });
  it("never uses alarming wording", () => {
    const all = Object.values(BANK.en).flat().join(" ").toLowerCase();
    for (const w of ["danger", "unsafe area", "dangerous"]) expect(all).not.toContain(w);
  });
  it("keeps each line short (≤ 2 sentences)", () => {
    for (const lines of Object.values(BANK.en)) for (const l of lines!) expect(l.split(/[.!?]\s/).length).toBeLessThanOrEqual(3);
  });
});

describe("Messenger", () => {
  it("never repeats the same line back-to-back", () => {
    const m = new Messenger();
    let prev = "";
    for (let i = 0; i < 20; i++) { const t = m.say("guard_on"); expect(t).not.toBe(prev); prev = t; }
  });
  it("fills params and falls back for missing ones", () => {
    const m = new Messenger();
    expect(m.say("heads_up_unlit", { m: 120 })).toContain("120");
    expect(new Messenger().say("arrived", { contact: "Maa" })).toContain("Maa");
    expect(new Messenger().say("arrived")).toContain("your circle");
    expect(render("Hi {name}{x}")).toBe("Hi there");
  });
  it("falls back to English for languages without a bank and throws on unknown keys", () => {
    expect(new Messenger("hi").say("guard_off")).toBeTruthy();
    expect(() => new Messenger().say("nope" as never)).toThrow();
  });
});
