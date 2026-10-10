import { describe, expect, it } from "vitest";
import { classifyPin, hashPin, isValidPinFormat, PIN_CONFIG, validatePinPair, verifyPin } from "./pin";
import { EMERGENCY, shareUrl, smsLink, telLink, whatsappLink } from "./links";

const FAST = 1000; // iterations for speed; one test uses the real default

describe("PIN hashing", () => {
  it("the same PIN verifies; a different PIN does not", async () => {
    const h = await hashPin("4821", FAST);
    expect(await verifyPin("4821", h)).toBe(true);
    expect(await verifyPin("4822", h)).toBe(false);
  });
  it("uses a random salt: same PIN twice gives different hashes", async () => {
    const [a, b] = await Promise.all([hashPin("4821", FAST), hashPin("4821", FAST)]);
    expect(a.salt).not.toBe(b.salt); expect(a.hash).not.toBe(b.hash);
    expect(await verifyPin("4821", b)).toBe(true);
  });
  it("defaults to PBKDF2 with 150k iterations", async () => {
    const h = await hashPin("123456");
    expect(h.iterations).toBe(150_000); expect(PIN_CONFIG.iterations).toBe(150_000);
    expect(await verifyPin("123456", h)).toBe(true);
    expect(JSON.stringify(h)).not.toContain("123456");
  });
  it("rejects malformed PINs", async () => {
    for (const bad of ["123", "1234567", "12a4", "", "12 4"]) { expect(isValidPinFormat(bad)).toBe(false); await expect(hashPin(bad, FAST)).rejects.toThrow(); }
  });
  it("classifies normal, duress and wrong PINs", async () => {
    const normal = await hashPin("1111", FAST), duress = await hashPin("2222", FAST);
    expect(await classifyPin("1111", normal, duress)).toBe("ok");
    expect(await classifyPin("2222", normal, duress)).toBe("duress");
    expect(await classifyPin("3333", normal, duress)).toBe("wrong");
  });
  it("enforces duress PIN ≠ normal PIN", () => {
    expect(validatePinPair("1111", "1111")).toBe("same");
    expect(validatePinPair("1111", "2222")).toBe("ok");
    expect(validatePinPair("1111", "22")).toBe("invalid");
  });
});

describe("links", () => {
  it("builds share, WhatsApp, SMS and tel links", () => {
    expect(shareUrl("https://raksha.app/", "abc")).toBe("https://raksha.app/s/abc");
    expect(whatsappLink("+91 98765-43210", "Help me & call")).toBe("https://wa.me/919876543210?text=Help%20me%20%26%20call");
    expect(smsLink("+919876543210", "hi there")).toBe("sms:+919876543210?&body=hi%20there");
    expect(smsLink("9876543210", "x")).toBe("sms:9876543210?&body=x");
    expect(telLink("+91 98765 43210")).toBe("tel:+919876543210");
    expect(telLink("98765 43210")).toBe("tel:9876543210");
    expect(EMERGENCY).toEqual({ police: "112", womenHelpline: "181" });
  });
});
