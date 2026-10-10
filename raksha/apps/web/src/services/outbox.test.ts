import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const backend = { pushPoint: vi.fn(), resolveSos: vi.fn() };
vi.mock("./backend", () => ({ getBackend: () => backend }));

const pt = (n: number) => ({ lat: 19 + n / 1000, lng: 72, accuracy: 8, t: n });

beforeEach(() => { vi.resetModules(); backend.pushPoint.mockReset(); backend.resolveSos.mockReset(); });

describe("outbox: positions", () => {
  it("keeps points while the backend is unreachable and drains them when it returns — newest first", async () => {
    const { sendPoint, flushPoints, pendingPoints } = await import("./outbox");
    backend.pushPoint.mockRejectedValue(new Error("offline"));
    sendPoint("s1", pt(1)); sendPoint("s1", pt(2)); sendPoint("s1", pt(3));
    await flushPoints();
    expect(pendingPoints()).toBe(3);

    const sent: number[] = [];
    backend.pushPoint.mockImplementation(async (_s: string, p: { t: number }) => { sent.push(p.t); });
    await flushPoints();
    expect(sent).toEqual([3, 1, 2]);       // where she is now first, then the older trail
    expect(pendingPoints()).toBe(0);
  });

  it("bounds memory during a long outage", async () => {
    const { sendPoint, pendingPoints } = await import("./outbox");
    backend.pushPoint.mockRejectedValue(new Error("offline"));
    for (let i = 0; i < 400; i++) sendPoint("s2", pt(i));
    await new Promise((r) => setTimeout(r, 0));
    expect(pendingPoints()).toBeLessThanOrEqual(150);
  });
});

describe("outbox: resolve / cancel", () => {
  it("persists a duress resolve across failures and delivers it exactly with the duress flag", async () => {
    const { queueResolve, flushResolves } = await import("./outbox");
    backend.resolveSos.mockRejectedValue(new Error("offline"));
    await queueResolve({ sosId: "sos-1", duress: true });
    await flushResolves();
    expect(backend.resolveSos).toHaveBeenCalledWith("sos-1", true);

    backend.resolveSos.mockReset(); backend.resolveSos.mockResolvedValue(undefined);
    await flushResolves();                                   // still queued from the failed attempts
    expect(backend.resolveSos).toHaveBeenCalledWith("sos-1", true);
    backend.resolveSos.mockClear();
    await flushResolves();
    expect(backend.resolveSos).not.toHaveBeenCalled();       // delivered once, then gone
  });

  it("a later real cancel replaces a queued duress for the same SOS", async () => {
    const { queueResolve, flushResolves } = await import("./outbox");
    backend.resolveSos.mockRejectedValue(new Error("offline"));
    await queueResolve({ sosId: "sos-2", duress: true });
    await queueResolve({ sosId: "sos-2", duress: false });
    backend.resolveSos.mockReset(); backend.resolveSos.mockResolvedValue(undefined);
    await flushResolves();
    expect(backend.resolveSos.mock.calls).toEqual([["sos-2", false]]);
  });
});
