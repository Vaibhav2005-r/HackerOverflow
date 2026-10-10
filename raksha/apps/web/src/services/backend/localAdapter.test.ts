import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalBackend } from "./localAdapter";

// Local mode must behave like the SQL RPCs (supabase/migrations/0003_rpc.sql): same token shape, same duress semantics.
let b: LocalBackend;
beforeEach(() => { b = new LocalBackend(); });

describe("LocalBackend", () => {
  it("issues 64-hex tokens and exposes only the view fields (never ids)", async () => {
    const s = await b.startShare("live", 30, "Riya");
    expect(s.token).toMatch(/^[0-9a-f]{64}$/);
    const v = await b.getShareView(s.token);
    expect(v).toMatchObject({ name: "Riya", kind: "live", status: "active", coercion: false });
    expect(Object.keys(v!)).not.toContain("sessionId");
    expect(await b.getShareView("0".repeat(64))).toBeNull();
  });

  it("publishes points and ends sessions", async () => {
    const s = await b.startShare("walk", 30, "Riya");
    await b.pushPoint(s.sessionId, { lat: 19.2, lng: 72.85, accuracy: 8, t: Date.now() });
    expect((await b.getShareView(s.token))!.last).toMatchObject({ lat: 19.2 });
    await b.endShare(s.sessionId);
    await b.pushPoint(s.sessionId, { lat: 19.3, lng: 72.85, accuracy: 8, t: Date.now() }); // ignored after the end
    const v = (await b.getShareView(s.token))!;
    expect(v.status).toBe("ended"); expect(v.last!.lat).toBe(19.2);
  });

  it("duress cancel keeps the session ACTIVE and flags coercion; a real cancel then ends it", async () => {
    const r = await b.startSos("hold", "silent", "Riya");
    expect((await b.getShareView(r.token))!.kind).toBe("sos");
    await b.resolveSos(r.sosId, true);
    expect(await b.getShareView(r.token)).toMatchObject({ status: "active", coercion: true });
    await b.resolveSos(r.sosId, false);
    expect((await b.getShareView(r.token))!.status).toBe("ended");
  });

  it("a plain SOS cancel ends the session without a coercion flag", async () => {
    const r = await b.startSos("shake", "loud", "Riya");
    await b.resolveSos(r.sosId, false);
    expect(await b.getShareView(r.token)).toMatchObject({ status: "ended", coercion: false });
  });

  it("limits the circle to 5 contacts and supports edit/delete", async () => {
    for (let i = 0; i < 5; i++) await b.saveContact({ name: `c${i}`, phone: `+91987654320${i}` });
    await expect(b.saveContact({ name: "extra", phone: "+919876543299" })).rejects.toThrow(/5/);
    const [first] = await b.getCircle();
    await b.saveContact({ ...first!, name: "renamed" });
    expect((await b.getCircle())[0]!.name).toBe("renamed");
    await b.deleteContact(first!.id);
    expect(await b.getCircle()).toHaveLength(4);
  });

  it("aggregates only this device's reports, per cell and band (no seeded data)", async () => {
    expect((await b.getAggregates(["89608b44003ffff"])).size).toBe(0);
    await b.submitReport({ h3: "89608b44003ffff", band: "night", category: "stalking" });
    const agg = await b.getAggregates(["89608b44003ffff", "89608b44007ffff"]);
    expect(agg.get("89608b44003ffff")!.night.neg).toBeCloseTo(1, 1);
    expect(agg.get("89608b44003ffff")!.day.neg).toBeCloseTo(0.3, 1);     // other bands count ×0.3
    expect(agg.has("89608b44007ffff")).toBe(false);
  });

  it("deleteMyData wipes everything under the raksha: prefix", async () => {
    await b.saveContact({ name: "Maa", phone: "+919876543210" });
    await b.deleteMyData();
    expect(await b.getCircle()).toEqual([]);
  });
});
