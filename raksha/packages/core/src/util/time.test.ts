import { describe, expect, it } from "vitest";
import { bandForDate, bandForHour } from "./time";

describe("bandForHour", () => {
  it.each([[5, "night"], [6, "day"], [17, "day"], [18, "evening"], [21, "evening"], [22, "night"], [0, "night"]])(
    "%i → %s", (h, b) => expect(bandForHour(h)).toBe(b));
});
describe("bandForDate", () => {
  it("23:00 IST is night", () => expect(bandForDate(new Date("2026-10-10T17:30:00Z"))).toBe("night"));
  it("12:00 IST is day", () => expect(bandForDate(new Date("2026-10-10T06:30:00Z"))).toBe("day"));
});
